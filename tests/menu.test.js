'use strict';
// Spec 001 → Tests → Safety, plus the full Check setup run.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSrc, srcFiles, SRC_DIR } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeSession, makeHtmlService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const OWNER = 'owner@example.com';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

/** This month in Karachi as "November 2026", worked out independently of src/. */
function karachiMonthLabel(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: 'numeric',
  }).formatToParts(date);
  const part = (type) => Number(parts.find((p) => p.type === type).value);
  return `${MONTHS[part('month') - 1]} ${part('year')}`;
}

/**
 * Everything Check setup touches, faked, with a count of every Google call that matters.
 * @param {{ activeEmail?: string, effectiveEmail?: string, metaTabs?: object | null }} [options]
 *   metaTabs: null means the Meta-Data sheet can't be opened.
 */
function world(options = {}) {
  const {
    activeEmail = OWNER, effectiveEmail = OWNER, metaTabs = metaDataTabs(),
  } = options;
  const diary = makeSpreadsheet({ Sheet1: [] }, { timeZone: 'America/New_York', name: 'Sales Diary' });
  const metaData = metaTabs && makeSpreadsheet(metaTabs, {
    readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data',
  });
  const app = makeSpreadsheetApp({
    byId: metaData ? { [META_DATA_ID]: metaData } : {},
    active: diary,
  });
  const calls = { openById: 0, getActiveSpreadsheet: 0 };
  const SpreadsheetApp = {
    ...app,
    openById(id) { calls.openById++; return app.openById(id); },
    getActiveSpreadsheet() { calls.getActiveSpreadsheet++; return app.getActiveSpreadsheet(); },
  };
  const src = loadSrc({
    SpreadsheetApp,
    Session: makeSession({ activeEmail, effectiveEmail }),
    Utilities: makeUtilities(),
    HtmlService: makeHtmlService(),
  });
  return { src, diary, metaData, ui: app._ui, calls };
}

// ----------------------------------------------------------------------------------- Safety

test('the only public functions are doGet, onOpen and menuCheckSetup', () => {
  const { src } = world();
  const publicFunctions = Object.keys(src.sandbox)
    .filter((name) => !src.globalNamesBefore.has(name))
    .filter((name) => typeof src.sandbox[name] === 'function' && !name.endsWith('_'));
  assert.deepEqual(publicFunctions.sort(), ['doGet', 'menuCheckSetup', 'onOpen']);
});

test('no top-level const, let or var holds a function (would dodge the check above)', () => {
  const pattern = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\b\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/gm;
  for (const name of srcFiles()) {
    const source = fs.readFileSync(path.join(SRC_DIR, name), 'utf8');
    assert.deepEqual([...source.matchAll(pattern)].map((m) => m[1]), [], name);
  }
});

const REFUSALS = [
  ['nobody signed in (a web app visitor)', '', OWNER],
  ['both emails blank', '', ''],
  ['the script runs as someone else', 'salesman@example.com', OWNER],
];
for (const [why, activeEmail, effectiveEmail] of REFUSALS) {
  test(`menuCheckSetup refuses when ${why}, and touches nothing`, () => {
    const { src, diary, metaData, ui, calls } = world({ activeEmail, effectiveEmail });
    const before = JSON.stringify(diary._snapshot());
    assert.throws(() => src.sandbox.menuCheckSetup(), /only be run by the owner/);
    assert.equal(JSON.stringify(diary._snapshot()), before);
    assert.deepEqual(diary._writes(), []);
    assert.deepEqual(metaData._writes(), []);
    assert.deepEqual(calls, { openById: 0, getActiveSpreadsheet: 0 });
    assert.deepEqual(ui.alerts, []);
  });
}

test('the signed-in check needs both emails, and the same one', () => {
  const check = (activeEmail, effectiveEmail) =>
    world({ activeEmail, effectiveEmail }).src.sandbox.isSignedInSelf_();
  assert.equal(check(OWNER, OWNER), true);
  assert.equal(check('', ''), false);
  assert.equal(check(OWNER, ''), false);
  assert.equal(check(OWNER, 'other@example.com'), false);
});

// -------------------------------------------------------------------------------- Check setup

test('onOpen adds Sales Diary → Check setup, and nothing else', () => {
  const { src, ui, diary, calls } = world({ activeEmail: '', effectiveEmail: OWNER });
  src.sandbox.onOpen(); // no signed-in check: Google may not give the email in onOpen
  assert.deepEqual(JSON.parse(JSON.stringify(ui.menus)), [
    { name: 'Sales Diary', items: [{ caption: 'Check setup', functionName: 'menuCheckSetup' }] },
  ]);
  assert.deepEqual(diary._writes(), []);
  assert.deepEqual(calls, { openById: 0, getActiveSpreadsheet: 0 });
});

test('the menu item calls a function that exists and is public', () => {
  const { src, ui } = world();
  src.sandbox.onOpen();
  const functionName = ui.menus[0].items[0].functionName;
  assert.equal(typeof src.sandbox[functionName], 'function');
  assert.ok(!functionName.endsWith('_'));
});

test('a full run creates the tabs and shows the summary; Meta-Data is untouched', () => {
  const { src, diary, metaData, ui } = world();
  const metaBefore = JSON.stringify(metaData._snapshot());
  const monthBefore = karachiMonthLabel(new Date());
  src.sandbox.menuCheckSetup();
  const monthAfter = karachiMonthLabel(new Date());

  assert.deepEqual(diary.getSheets().map((s) => s.getName()), ['Sites', 'Activity', 'Lists']);
  assert.equal(diary.getSpreadsheetTimeZone(), 'Asia/Karachi');

  assert.equal(ui.alerts.length, 1);
  const [title, message, buttons] = ui.alerts[0].args;
  assert.equal(title, 'Check setup');
  assert.equal(buttons, 'OK');
  const lines = message.split('\n');
  assert.equal(lines[0], 'Salesmen: 7');
  assert.ok(lines.includes('  North: RIA, AUR, WAK'));
  assert.ok(lines.includes('  Center: SH, SJ, SM'));
  assert.ok(lines.includes('  South: IB'));
  assert.ok([monthBefore, monthAfter].some((m) => lines.includes(`Targets for ${m}`)), message);
  assert.ok(lines.some((l) => l.trim().startsWith('House / office sales')));
  assert.equal(lines[lines.length - 1], 'Nothing to fix.');

  assert.deepEqual(metaData._writes(), []);
  assert.equal(JSON.stringify(metaData._snapshot()), metaBefore);
});

test('a second run changes nothing in the Sales Diary sheet', () => {
  const { src, diary } = world();
  src.sandbox.menuCheckSetup();
  const before = diary._snapshot();
  const writes = diary._writes().length;
  src.sandbox.menuCheckSetup();
  assert.deepEqual(diary._snapshot(), before);
  assert.equal(diary._writes().length, writes);
});

test("Meta-Data can't be opened: tabs are still created, and the pop-up says only that", () => {
  const { src, diary, ui } = world({ metaTabs: null });
  src.sandbox.menuCheckSetup();
  assert.deepEqual(diary.getSheets().map((s) => s.getName()), ['Sites', 'Activity', 'Lists']);
  assert.equal(ui.alerts[0].args[1],
    "Can't open the Meta-Data sheet. Check it still exists and your Google account can open it.");
});

test('a missing Meta-Data column: the pop-up says only that', () => {
  const tabs = metaDataTabs();
  tabs['Rep-Targets'][0] = ['Rep', 'Month', 'Amount'];
  const { src, ui } = world({ metaTabs: tabs });
  src.sandbox.menuCheckSetup();
  assert.equal(ui.alerts[0].args[1], "Rep-Targets has no 'Target' column in row 1.");
});

test('problems in the Sales Diary sheet are listed too', () => {
  const { src, diary, ui } = world();
  diary.insertSheet('Lists').getRange(1, 1, 1, 2).setValues([['list', 'value']]);
  src.sandbox.menuCheckSetup();
  const lines = ui.alerts[0].args[1].split('\n');
  assert.ok(lines.includes('Check these:'));
  assert.ok(lines.some((l) => l.includes("Lists has no 'region' column in row 1.")), lines.join('\n'));
});

test('problems in the Sales Diary sheet are listed even when Meta-Data can\'t be opened', () => {
  const { src, diary, ui } = world({ metaTabs: null });
  diary.insertSheet('Lists').getRange(1, 1, 1, 2).setValues([['list', 'value']]);
  src.sandbox.menuCheckSetup();
  const lines = ui.alerts[0].args[1].split('\n');
  assert.match(lines[0], /^Can't open the Meta-Data sheet/);
  assert.ok(lines.includes('Check these:'));
  assert.ok(lines.some((l) => l.includes("Lists has no 'region' column in row 1.")));
});

test('a Meta-Data problem row is listed under Check these', () => {
  const tabs = metaDataTabs();
  tabs['Rep-Targets'][39][2] = 'abc';
  const { src, ui } = world({ metaTabs: tabs });
  src.sandbox.menuCheckSetup();
  const lines = ui.alerts[0].args[1].split('\n');
  assert.ok(lines.includes('Check these:'));
  assert.ok(lines.includes("- Rep-Targets row 40: target 'abc' is not a number."));
  assert.ok(!lines.includes('Nothing to fix.'));
});

// ---------------------------------------------------------------------------------- Web app

test('doGet returns the placeholder page: titled, phone-sized, no data, no server calls', () => {
  const { src, diary, calls } = world({ activeEmail: '', effectiveEmail: OWNER });
  const page = src.sandbox.doGet();
  assert.equal(page.getTitle(), 'Sales Diary');
  assert.deepEqual(JSON.parse(JSON.stringify(page._metaTags)), [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ]);
  const html = page.getContent();
  assert.ok(html.includes('Sales Diary is set up.'));
  assert.ok(!/<script/i.test(html), 'no scripts');
  assert.ok(!html.includes('google.script'), 'no server calls');
  for (const word of ['RIA', 'Rs.', 'Target', 'North']) assert.ok(!html.includes(word), word);
  assert.deepEqual(calls, { openById: 0, getActiveSpreadsheet: 0 });
  assert.deepEqual(diary._writes(), []);
});

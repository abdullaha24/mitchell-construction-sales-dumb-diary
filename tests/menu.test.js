'use strict';
// Spec 001 → Tests → Safety, plus the full Check setup run.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSrc, srcFiles, SRC_DIR } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeSession, makeHtmlService,
  makePropertiesService,
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
    PropertiesService: makePropertiesService(),
    SpreadsheetApp,
    Session: makeSession({ activeEmail, effectiveEmail }),
    Utilities: makeUtilities(),
    HtmlService: makeHtmlService(),
  });
  return { src, diary, metaData, ui: app._ui, calls };
}

// ----------------------------------------------------------------------------------- Safety

test('the only public functions are the 21 specs 002 to 012 list', () => {
  const { src } = world();
  const publicFunctions = Object.keys(src.sandbox)
    .filter((name) => !src.globalNamesBefore.has(name))
    .filter((name) => typeof src.sandbox[name] === 'function' && !name.endsWith('_'));
  assert.deepEqual(publicFunctions.sort(), [
    'adminPageDaily', 'adminPageLoad', 'adminPageSaveStatus', 'adminPageSummary', 'adminPageUpdateSite',
    'doGet', 'menuCheckSetup', 'menuLinks', 'menuRefreshSalesmen', 'onOpen',
    'ownerCancelLink', 'ownerListLinks', 'ownerNewLink',
    'repAddSite', 'repCheckPhone', 'repEditSite', 'repLoad', 'repSaveStatus', 'repSnoozeSite', 'repSummary', 'repUpdateSite',
  ]);
});

test('each kind of public function starts with its own check (spec 008)', () => {
  // adminPage…: opened by the admin's LINK (no signed-in email): the admin-link check.
  // menu… / owner…: run from the sheet's menu: the signed-in check. rep…: the salesman's link.
  const { src } = world();
  const firstLines = (name) => String(src.sandbox[name]).split('\n').slice(1, 4).map((l) => l.trim()).join(' ');
  const names = Object.keys(src.sandbox).filter((n) => typeof src.sandbox[n] === 'function' && !n.endsWith('_') &&
    !src.globalNamesBefore.has(n));
  for (const name of names) {
    const first = firstLines(name);
    if (name.startsWith('adminPage')) {
      assert.match(first, /^return forAdminPage_\(\(\) => \{ (const \{ [\w, ]+ \} = )?requireAdminLink_\(k\);/, name);
    } else if (name.startsWith('rep')) {
      assert.match(first, /^return forSalesman_\(\(\) => \{ (const tidy = tidyPhone_\(phone\); )?const \{ [\w, ]+ \} = requireRep_\(k\);/, name);
    } else if (name.startsWith('owner') || name === 'menuLinks') {
      assert.match(first, /^requireOwner_\(\);/, name);
    } else if (name.startsWith('menu')) {
      assert.match(first, /^if \(!isSignedInSelf_\(\)\) \{/, name);
    } else {
      assert.ok(['doGet', 'onOpen'].includes(name), name);
    }
  }
});

test('no top-level const, let or var holds a function (would dodge the check above)', () => {
  const pattern = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\b\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/gm;
  for (const name of srcFiles()) {
    const source = fs.readFileSync(path.join(SRC_DIR, name), 'utf8');
    assert.deepEqual([...source.matchAll(pattern)].map((m) => m[1]), [], name);
  }
});

const REFUSALS = [
  ['nobody signed in (a web app visitor who is not the owner)', '', OWNER],
  ['both emails blank', '', ''],
  ['the script runs as someone else', 'salesman@example.com', OWNER],
];
for (const [why, activeEmail, effectiveEmail] of REFUSALS) {
  test(`menuCheckSetup refuses when ${why}, and touches nothing`, () => {
    const { src, diary, metaData, ui, calls } = world({ activeEmail, effectiveEmail });
    const before = JSON.stringify(diary._snapshot());
    assert.throws(() => src.sandbox.menuCheckSetup(), /only be run by the admin/);
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

test('onOpen adds Sales Diary → Check setup, Links and Refresh salesmen & targets, and nothing else', () => {
  const { src, ui, diary, calls } = world({ activeEmail: '', effectiveEmail: OWNER });
  src.sandbox.onOpen(); // no signed-in check: Google may not give the email in onOpen
  assert.deepEqual(JSON.parse(JSON.stringify(ui.menus)), [
    { name: 'Sales Diary', items: [
      { caption: 'Check setup', functionName: 'menuCheckSetup' },
      { caption: 'Links', functionName: 'menuLinks' },
      { caption: 'Refresh salesmen & targets', functionName: 'menuRefreshSalesmen' },
    ] },
  ]);
  assert.deepEqual(diary._writes(), []);
  assert.deepEqual(calls, { openById: 0, getActiveSpreadsheet: 0 });
});

test('every menu item calls a function that exists and is public', () => {
  const { src, ui } = world();
  src.sandbox.onOpen();
  for (const { functionName } of ui.menus[0].items) {
    assert.equal(typeof src.sandbox[functionName], 'function', functionName);
    assert.ok(!functionName.endsWith('_'));
  }
});

test('a full run creates the tabs and shows the summary; Meta-Data is untouched', () => {
  const { src, diary, metaData, ui } = world();
  const metaBefore = JSON.stringify(metaData._snapshot());
  const monthBefore = karachiMonthLabel(new Date());
  src.sandbox.menuCheckSetup();
  const monthAfter = karachiMonthLabel(new Date());

  assert.deepEqual(diary.getSheets().map((s) => s.getName()), ['Sites', 'Activity', 'Lists', 'Links']);
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
  assert.deepEqual(diary.getSheets().map((s) => s.getName()), ['Sites', 'Activity', 'Lists', 'Links']);
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

// ------------------------------------------------------------- Sites with no number (spec 003)

const SITES_HEADER = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'earlier_contacts'];
const siteWith = (rep, phone) => SITES_HEADER.map((h) => ({ site_id: 'S1', rep, site_name: 'x', contact_phone: phone })[h] ?? '');

test('Check setup lists sites with no phone number per salesman, North to South', () => {
  const { src, diary, ui } = world();
  diary.insertSheet('Sites').getRange(1, 1, 6, SITES_HEADER.length).setValues([
    SITES_HEADER, siteWith('IB', ''), siteWith('RIA', '923001234567'), siteWith('RIA', ''),
    siteWith('ria', ' '), siteWith('MUB', ''),
  ]);
  src.sandbox.menuCheckSetup();
  const lines = ui.alerts[0].args[1].split('\n');
  const at = lines.indexOf('Sites with no phone number');
  assert.ok(at > 0, lines.join('\n'));
  assert.deepEqual(lines.slice(at + 1, at + 3), ['  RIA  2 of 3', '  IB   1 of 1']);
  assert.equal(lines[at + 3], '', 'only salesmen with sites; MUB (left) is not listed');
  assert.equal(lines[lines.length - 1], 'Nothing to fix.');
});

test('Check setup on a sheet with no sites yet says so', () => {
  const { src, ui } = world();
  src.sandbox.menuCheckSetup();
  assert.ok(ui.alerts[0].args[1].split('\n').includes('Sites with no phone number: no sites yet.'));
});

test('a broken Sites tab is listed under Check these, and the pop-up still shows', () => {
  const { src, diary, ui } = world();
  diary.insertSheet('Sites').getRange(1, 1, 1, 2).setValues([['site_id', 'rep']]);
  src.sandbox.menuCheckSetup();
  const lines = ui.alerts[0].args[1].split('\n');
  assert.ok(lines.includes('Check these:'));
  assert.ok(lines.some((l) => l.includes("Sites has no 'region' column in row 1.")), lines.join('\n'));
});

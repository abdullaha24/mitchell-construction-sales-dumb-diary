'use strict';
// Spec 002 → "Opening a link".
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeHtmlService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const LINKS = ['role', 'rep', 'token', 'active', 'issued_at'];
const NOW = new Date('2026-11-04T09:00:00Z');
const RIA_CODE = 'a'.repeat(64);
const OWNER_CODE = 'b'.repeat(64);
const CANCELLED_CODE = 'c'.repeat(64);
const ODD_CODE = 'd'.repeat(64);

function world({ links, metaTabs = metaDataTabs(), diaryOpens = true } = {}) {
  const diary = makeSpreadsheet({
    Links: links || [
      LINKS,
      ['rep', 'RIA', RIA_CODE, true, NOW],
      ['owner', '', OWNER_CODE, true, NOW],
      ['rep', 'SH', CANCELLED_CODE, false, NOW],
    ],
  }, { name: 'Sales Diary' });
  const byId = {};
  if (diaryOpens) byId[SALES_DIARY_ID] = diary;
  if (metaTabs) {
    byId[META_DATA_ID] = makeSpreadsheet(metaTabs, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  }
  const app = makeSpreadsheetApp({ byId });
  const opened = [];
  const src = loadSrc({
    SpreadsheetApp: { ...app, openById(id) { opened.push(id); return app.openById(id); } },
    Utilities: makeUtilities(),
    LockService: makeLockService(),
    HtmlService: makeHtmlService(),
  });
  return { doGet: (e) => src.sandbox.doGet(e), opened, diary };
}

const visit = (w, k) => w.doGet({ parameter: k === undefined ? {} : { k } });
// Google's template may print the apostrophe as &#39;; the browser shows it the same.
const NO_LINK = /This link doesn(?:'|&#39;)t work\./;

function assertSafePage(page) {
  assert.equal(page.getTitle(), 'Sales Diary');
  assert.deepEqual(JSON.parse(JSON.stringify(page._metaTags)), [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ]);
  const html = page.getContent();
  for (const secret of [RIA_CODE, OWNER_CODE, CANCELLED_CODE, ODD_CODE]) {
    assert.ok(!html.includes(secret), 'a link code is in the page');
  }
  assert.ok(!/<script/i.test(html), 'no scripts');
  assert.ok(!html.includes('google.script'), 'no server calls');
  return html;
}

test("a salesman's link: Hello, RIA, and nothing else about him", () => {
  const html = assertSafePage(visit(world(), RIA_CODE));
  assert.ok(html.includes('<h1>Hello, RIA</h1>'), html);
  for (const word of ['owner', 'North', 'Rs.', 'Target', 'SH']) assert.ok(!html.includes(word), word);
});

test("the owner's link: Hello, owner, and that his screen comes later", () => {
  const html = assertSafePage(visit(world(), OWNER_CODE));
  assert.ok(html.includes('<h1>Hello, owner</h1>'));
  assert.ok(html.includes('Your screen comes in a later phase.'));
});

test('cancelled, unknown, badly shaped or missing codes all get the same "doesn\'t work" page', () => {
  const w = world();
  const pages = [
    visit(w, CANCELLED_CODE), visit(w, ODD_CODE), visit(w, 'hello'), visit(w, `${RIA_CODE}a`),
    visit(w, RIA_CODE.toUpperCase()), visit(w, ''), visit(w, undefined), w.doGet({}), w.doGet(undefined),
  ].map((page) => assertSafePage(page));
  for (const html of pages) {
    assert.match(html, NO_LINK);
    assert.ok(html.includes('Ask the owner for a new one.'));
    assert.equal(html, pages[0], 'every refusal looks the same: it never hints whether a link existed');
  }
});

test('junk codes open no sheet at all', () => {
  const w = world();
  visit(w, 'hello');
  visit(w, undefined);
  w.doGet(undefined);
  assert.deepEqual(w.opened, []);
});

test('a salesman removed from Rep_Mapping gets the "doesn\'t work" page', () => {
  const tabs = metaDataTabs();
  tabs.Rep_Mapping = tabs.Rep_Mapping.filter((row) => row[0] !== 'RIA');
  assert.match(assertSafePage(visit(world({ metaTabs: tabs }), RIA_CODE)), NO_LINK);
});

test('Google failing gives "Something went wrong", never "doesn\'t work", and no code', () => {
  for (const w of [
    world({ diaryOpens: false }), // Sales Diary can't be opened
    world({ metaTabs: null }), // Meta-Data can't be opened (salesman link)
    world({ links: [['role', 'rep']] }), // Links tab broken
  ]) {
    const html = assertSafePage(visit(w, RIA_CODE));
    assert.ok(html.includes('Something went wrong.'), html);
    assert.ok(html.includes('Try again in a minute.'));
    assert.doesNotMatch(html, NO_LINK);
  }
});

test('page loads never write to any sheet', () => {
  const w = world();
  for (const k of [RIA_CODE, OWNER_CODE, CANCELLED_CODE, ODD_CODE, 'x']) visit(w, k);
  assert.deepEqual(w.diary._writes(), []);
});

test("whatever is in the sheet is escaped on the page", () => {
  const tabs = metaDataTabs();
  tabs.Rep_Mapping.push(['<img src=x onerror=alert(1)>', 'North']);
  const w = world({ metaTabs: tabs, links: [LINKS, ['rep', '<img src=x onerror=alert(1)>', RIA_CODE, true, NOW]] });
  const html = assertSafePage(visit(w, RIA_CODE));
  assert.ok(html.includes('Hello, &lt;IMG SRC=X ONERROR=ALERT(1)&gt;'), html);
  assert.ok(!/<img/i.test(html));
});

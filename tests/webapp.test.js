'use strict';
// Spec 002 → "Opening a link"; spec 003 → a salesman's link opens his app.
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
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at'];
const LISTS = ['list', 'value', 'region', 'added_by', 'active', 'sort'];
const siteRow = (id, rep, name, phone) => [id, rep, 'North', name, 'Dealer', 'DHA', `${name} contact`, phone,
  '', 'Visited / Lead', '', '', '', NOW, '', NOW, NOW];
const NOW = new Date('2026-11-04T09:00:00Z');
const RIA_CODE = 'a'.repeat(64);
const OWNER_CODE = 'b'.repeat(64);
const CANCELLED_CODE = 'c'.repeat(64);
const ODD_CODE = 'd'.repeat(64);

function world({ links, metaTabs = metaDataTabs(), diaryOpens = true, sites } = {}) {
  const diary = makeSpreadsheet({
    Sites: sites || [SITES, siteRow('S000001', 'RIA', 'F-11 Tower', '923001234567'), siteRow('S000002', 'SH', 'Gulberg Mall', '923007654321')],
    Lists: [LISTS, ['buyer_type', 'Dealer', '', 'owner', true, 10], ['area', 'DHA', 'North', 'RIA', true, 10]],
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

/** The page data a salesman's app carries, decoded as the browser would. */
function appData(page) {
  const match = /<div id="data" hidden>([^<]*)<\/div>/.exec(page.getContent());
  assert.ok(match, 'the app page carries its data');
  const decoded = match[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return JSON.parse(decoded);
}

test("a salesman's link opens his app with his own sites and his own code only", () => {
  const page = visit(world(), RIA_CODE);
  assert.equal(page.getTitle(), 'Sales Diary');
  const html = page.getContent();
  assert.ok(html.includes('+ New Site'));
  const data = appData(page);
  assert.equal(data.rep, 'RIA');
  assert.equal(data.k, RIA_CODE, 'his page needs his own code to save');
  assert.deepEqual(data.sites.map((x) => x.name), ['F-11 Tower']);
  for (const secret of ['Gulberg Mall', '923007654321', OWNER_CODE, CANCELLED_CODE, ODD_CODE]) {
    assert.ok(!html.includes(secret), `the page leaks ${secret}`);
  }
});

test("a salesman's link writes nothing when the page opens", () => {
  const w = world();
  visit(w, RIA_CODE);
  assert.deepEqual(w.diary._writes(), []);
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

test('whatever is in the sheet is escaped on the page', () => {
  const evil = '<img src=x onerror=alert(1)></div><script>alert(2)</script>';
  const w = world({ sites: [SITES, siteRow('S000001', 'RIA', evil, '')] });
  const page = visit(w, RIA_CODE);
  const html = page.getContent();
  assert.ok(!/<img/i.test(html), 'no raw <img>');
  assert.equal((html.match(/<script>/g) || []).length, 1, 'only the page\'s own script');
  assert.equal(appData(page).sites[0].name, evil, 'the name arrives intact, as text');
});

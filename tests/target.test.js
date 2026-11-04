'use strict';
// Spec 006 → his monthly target: read from Rep-Targets with the salesmen list, kept for a day,
// and only ever his own on his page (ADR-0004). Tests build targets around the real current
// month, so they never depend on which month they run in.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeCacheService,
  makePropertiesService, makeSession, makeHtmlService,
} = require('./helpers/fakes');
const { META_TIME_ZONE } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const RIA = 'a'.repeat(64);
const SH = 'b'.repeat(64);
const OWNER = 'owner@example.com';
const REPS = [['RIA', 'North'], ['AUR', 'North'], ['SH', 'Center'], ['IB', 'South']];

/** A month `offset` months from the current one in Pakistan time, as [yyyy-MM, Karachi 1st-of-month Date]. */
function month(offset, from = new Date()) {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit' })
    .format(from).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return [key, new Date(d.getTime() - 5 * 60 * 60 * 1000)];
}

/** Made-up, all different: e.g. RIA this month 1,000,111; next month 1,000,112. */
const AMOUNT = { RIA: 1000110, AUR: 2000220, SH: 3000330, IB: 4000440, North: 9000990 };
const amount = (rep, offset) => AMOUNT[rep] + offset;

function metaTabs({ repTargets } = {}) {
  const rows = [['Rep', 'Month', 'Target']];
  for (const [rep] of REPS) for (const offset of [-1, 0, 1, 2]) rows.push([rep, month(offset)[1], amount(rep, offset)]);
  return {
    Rep_Mapping: [['Rep', 'Region'], ...REPS],
    'Rep-Targets': repTargets || rows,
    Targets: [['Region', 'Month', 'Target'], ['North', month(0)[1], amount('North', 0)]],
  };
}

function world({ meta = metaTabs(), sites = [] } = {}) {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort'],
    ['buyer_type', 'Dealer', '', 'owner', true, 10]];
  const diary = makeSpreadsheet({
    Sites: [SITES, ...sites], Activity: [ACTIVITY], Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, new Date()], ['rep', 'SH', SH, true, new Date()]],
  }, { name: 'Sales Diary' });
  const byId = { [SALES_DIARY_ID]: diary };
  // Opened fresh from `meta` each time, so a test can play the owner editing Meta-Data by hand.
  const writes = [];
  if (meta) {
    Object.defineProperty(byId, META_DATA_ID, {
      enumerable: true,
      get() {
        const sheet = makeSpreadsheet(meta, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
        writes.push(sheet);
        return sheet;
      },
    });
  }
  const metaData = { _writes: () => writes.flatMap((m) => m._writes()) };
  const app = makeSpreadsheetApp({ byId, active: diary });
  const props = makePropertiesService();
  const src = loadSrc({
    SpreadsheetApp: app, Utilities: makeUtilities(), LockService: makeLockService(), CacheService: makeCacheService(),
    PropertiesService: props, HtmlService: makeHtmlService(), Session: makeSession({ activeEmail: OWNER, effectiveEmail: OWNER }),
  });
  return { s: src.sandbox, props, metaData, meta, ui: app._ui };
}
const kept = (w) => JSON.parse(w.props._store.get('salesmen'));
/** The page data inside his app's HTML, as his phone gets it. */
function pageData(w, code) {
  const html = w.s.doGet({ parameter: { k: code } }).getContent();
  const text = /<div id="data" hidden>([^<]*)<\/div>/.exec(html)[1]
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return { data: JSON.parse(text), html };
}

// ------------------------------------------------------------------------------ His page

test('his page carries his own target for this month, and Google\'s clock', () => {
  const w = world();
  const before = Date.now();
  const r = plain(w.s.repLoad(RIA));
  assert.deepEqual(r.target, { month: month(0)[0], amount: amount('RIA', 0) });
  assert.ok(r.now >= before && r.now <= Date.now(), 'now is the server clock in ms');
  assert.equal(plain(w.s.repLoad(SH)).target.amount, amount('SH', 0), 'SH gets his');
});

test('nobody else\'s target, and no region target, ever reaches his page (ADR-0004)', () => {
  const w = world();
  const { data, html } = pageData(w, RIA);
  assert.deepEqual(data.target, { month: month(0)[0], amount: amount('RIA', 0) });
  for (const [rep] of REPS) {
    for (const offset of [-1, 0, 1, 2]) {
      if (rep === 'RIA' && offset === 0) continue;
      assert.ok(!html.includes(String(amount(rep, offset))), `${rep} ${offset}: not on RIA's page`);
    }
  }
  assert.ok(!html.includes(String(amount('North', 0))), 'no region target');
  const load = JSON.stringify(plain(w.s.repLoad(RIA)));
  assert.ok(!load.includes(String(amount('SH', 0))) && !load.includes(String(amount('RIA', 1))));
});

test('no target this month → none (missing row, 0, or the month listed twice)', () => {
  const thisMonth = month(0)[1];
  const cases = {
    missing: [['Rep', 'Month', 'Target'], ['RIA', month(1)[1], 5]],
    zero: [['Rep', 'Month', 'Target'], ['RIA', thisMonth, 0]],
    twice: [['Rep', 'Month', 'Target'], ['RIA', thisMonth, 5], ['RIA', thisMonth, 6]],
    blankAmount: [['Rep', 'Month', 'Target'], ['RIA', thisMonth, '']],
  };
  for (const [name, repTargets] of Object.entries(cases)) {
    const w = world({ meta: metaTabs({ repTargets }) });
    assert.equal(plain(w.s.repLoad(RIA)).target, null, name);
  }
});

test('a broken Rep-Targets never locks him out: no target, and the owner is told on Refresh', () => {
  for (const repTargets of [[['Rep', 'Month', 'Amount'], ['RIA', month(0)[1], 5]], null]) {
    const meta = metaTabs();
    if (repTargets) meta['Rep-Targets'] = repTargets; else delete meta['Rep-Targets'];
    const w = world({ meta });
    const r = plain(w.s.repLoad(RIA));
    assert.equal(r.ok, true);
    assert.equal(r.target, null);
    assert.deepEqual(kept(w).targets, {});
    w.s.menuRefreshSalesmen();
    const message = w.ui.alerts[0].args[1];
    assert.match(message, repTargets ? /Rep-Targets has no 'Target' column in row 1\./ : /The Meta-Data sheet has no 'Rep-Targets' tab\./);
    assert.match(message, /Salesmen: 4/);
  }
});

// ------------------------------------------------------------------------- Kept with the list

test('kept: this month and next month for current salesmen only; nothing older, no regions', () => {
  const w = world();
  w.s.repLoad(RIA);
  const targets = kept(w).targets;
  const expected = {};
  for (const [rep] of REPS) for (const offset of [0, 1]) expected[`${rep}|${month(offset)[0]}`] = amount(rep, offset);
  assert.deepEqual(targets, expected);
  assert.deepEqual(w.metaData._writes(), [], 'Meta-Data is only read');
});

test('a target changed in Meta-Data shows after Refresh salesmen & targets (or Check setup), not before', () => {
  const w = world();
  w.s.repLoad(RIA);
  // The owner edits the sheet by hand.
  const row = w.meta['Rep-Targets'].find((r) => r[0] === 'RIA' && r[2] === amount('RIA', 0));
  row[2] = 7777777;
  assert.equal(plain(w.s.repLoad(RIA)).target.amount, amount('RIA', 0), 'kept copy still used');
  w.s.menuRefreshSalesmen();
  assert.equal(plain(w.s.repLoad(RIA)).target.amount, 7777777);
  row[2] = 8888888;
  w.s.menuCheckSetup();
  assert.equal(plain(w.s.repLoad(RIA)).target.amount, 8888888);
});

test('the 1st of the month rolls over without a refresh: next month is already kept', () => {
  const s = world().s;
  const nov30 = new Date('2026-11-30T18:00:00Z'); // 11 pm in Karachi
  const dec1 = new Date('2026-11-30T19:30:00Z'); // 00:30 on 1 Dec in Karachi
  const repTargets = { 'RIA|2026-11': 100, 'RIA|2026-12': 200, 'RIA|2027-01': 300, 'SH|2026-12': 400 };
  const keep = plain(s.targetsToKeep_([{ rep: 'RIA', region: 'North' }], repTargets, nov30));
  assert.deepEqual(keep, { 'RIA|2026-11': 100, 'RIA|2026-12': 200 });
  assert.deepEqual(plain(s.hisTarget_(keep, 'RIA', nov30)), { month: '2026-11', amount: 100 });
  assert.deepEqual(plain(s.hisTarget_(keep, 'RIA', dec1)), { month: '2026-12', amount: 200 });
  assert.equal(s.hisTarget_(keep, 'SH', dec1), null, 'only salesmen asked for are kept');
  assert.equal(s.hisTarget_(undefined, 'RIA', dec1), null);
  assert.equal(s.hisTarget_({ 'RIA|2026-12': -5 }, 'RIA', dec1), null, 'never a bad amount');
});

test('next month after December is January', () => {
  const s = world().s;
  assert.equal(s.nextMonthKey_('2026-12'), '2027-01');
  assert.equal(s.nextMonthKey_('2026-01'), '2026-02');
  assert.equal(s.nextMonthKey_('2026-09'), '2026-10');
});

test('the owner\'s link page never carries a target', () => {
  const w = world();
  w.s.repLoad(RIA);
  assert.ok(!JSON.stringify(plain(w.s.whoIsVisiting_('c'.repeat(64)))).includes('target'));
});

'use strict';
// Spec 009: weekly and monthly summaries. The kept copy of targets (last month too), revised
// prices recorded only when they change (S9-13), periods, every count, the team parts, the
// WhatsApp text, privacy (ADR-0004) and what a summary costs. Amounts are made up.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeCacheService,
  makePropertiesService, makeHtmlService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs, fakeTarget } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'earlier_contacts'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const LINKS = ['role', 'rep', 'token', 'active', 'issued_at'];
const RIA = 'a'.repeat(64);
const AUR = 'e'.repeat(64);
const ADMIN = 'c'.repeat(64);
const OLD_ADMIN = 'd'.repeat(64); // a cancelled admin link
const OLD_RIA = 'f'.repeat(64); // a cancelled link of RIA's
const NO_LINK = "This link doesn't work. Ask the admin for a new one.";
const TRY_AGAIN = 'Something went wrong. Try again in a minute.';

/** A moment in Pakistan time (UTC+5, no daylight saving). */
const pk = (y, m, d, h = 12, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 5, min));
/** Midnight Pakistan time, as the sheet stores a follow-up day. */
const day = (y, m, d) => pk(y, m, d, 0);
// "Now" for most tests: Wednesday 4 November 2026, noon in Pakistan. This week: Sat 31 Oct to
// now; last week: Sat 24 Oct to Fri 30 Oct; this month: 1 Nov to now; last month: October.
const NOW = pk(2026, 11, 4, 12);
const LONG_AGO = pk(2026, 8, 10);

const WON = 'Won (Order)';
const LOST = 'Lost / Dead';
const RQ = 'Rate Quoted';
const SAMPLE = 'Sample / Trial';
const LEAD = 'Visited / Lead';

const site = (id, rep, name, extra = {}) => SITES.map((h) => ({
  site_id: id, rep, region: { SH: 'Center', IB: 'South' }[rep] || 'North', site_name: name,
  buyer_type: 'Dealer', area: 'DHA', contact_name: 'Asif', contact_phone: '923001234567', products: 'Tile Adhesives',
  stage: LEAD, next_followup: day(2026, 11, 20), last_note: '', created_at: LONG_AGO, updated_at: LONG_AGO, worked_at: NOW,
  ...extra,
})[h] ?? '');
let activityId = 0;
const act = (when, rep, siteId, action, extra = {}) => ACTIVITY.map((h) => ({
  activity_id: `A${String(++activityId).padStart(7, '0')}`, timestamp: when, rep, site_id: siteId, action, ...extra,
})[h] ?? '');

function world({ metaTabs = metaDataTabs(), sites = [], activity = [] } = {}) {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Site Delayed', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, ...sites],
    Activity: [ACTIVITY, ...activity],
    Lists: lists,
    Links: [LINKS, ['owner', '', OLD_ADMIN, false, LONG_AGO], ['rep', 'RIA', OLD_RIA, false, LONG_AGO], ['rep', 'RIA', RIA, true, LONG_AGO],
      ['rep', 'AUR', AUR, true, LONG_AGO], ['owner', '', ADMIN, true, LONG_AGO]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaTabs, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const app = makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } });
  const opened = [];
  const props = makePropertiesService();
  const lock = makeLockService();
  const cache = makeCacheService();
  const src = loadSrc({
    PropertiesService: props,
    SpreadsheetApp: { ...app, openById(id) { opened.push(id === SALES_DIARY_ID ? 'diary' : 'meta'); return app.openById(id); } },
    Utilities: makeUtilities(), LockService: lock, CacheService: cache, HtmlService: makeHtmlService(),
  });
  return { s: src.sandbox, diary, metaData, opened, props, lock, cache };
}

const thrown = (fn) => { try { fn(); } catch (e) { return e.message; } return 'nothing thrown'; };
const kept = (w) => JSON.parse(w.props._store.get('salesmen'));

// ------------------------------------------------------------- The kept copy holds last month

test('the kept copy holds last month, this month and next month, and says so in `months`', () => {
  const w = world();
  assert.equal(w.s.knownSalesmen_(NOW).ok, true);
  const copy = kept(w);
  assert.deepEqual(copy.months, ['2026-10', '2026-11', '2026-12']);
  assert.equal(copy.targets['RIA|2026-10'], fakeTarget('RIA', '2026-10'));
  assert.equal(copy.targets['RIA|2026-11'], fakeTarget('RIA', '2026-11'));
  assert.equal(copy.targets['RIA|2026-12'], fakeTarget('RIA', '2026-12'));
  assert.equal(copy.targets['RIA|2026-09'], undefined, 'nothing older');
  assert.equal(copy.regionTargets['North|2026-10'], fakeTarget('North', '2026-10'));
  assert.equal(copy.regionTargets['UNASSIGNED|2026-10'], fakeTarget('UNASSIGNED', '2026-10'));
  assert.deepEqual(w.metaData._writes(), [], 'Meta-Data is only read');
});

test('a copy from spec 008 (no `months`) or one whose months miss last month is read again at once', () => {
  const w = world();
  w.s.knownSalesmen_(NOW);
  const fresh = kept(w);
  for (const [why, copy] of [
    ['no months (spec 008)', { ...fresh, months: undefined }],
    ['months without last month', { ...fresh, months: ['2026-11', '2026-12', '2027-01'] }],
    ['months not a list', { ...fresh, months: '2026-10' }],
  ]) {
    w.props._store.set('salesmen', JSON.stringify(copy));
    w.opened.length = 0;
    assert.equal(w.s.knownSalesmen_(NOW).ok, true);
    assert.deepEqual(w.opened, ['meta'], why);
    assert.deepEqual(kept(w).months, ['2026-10', '2026-11', '2026-12'], why);
  }
  w.opened.length = 0;
  w.s.knownSalesmen_(NOW);
  assert.deepEqual(w.opened, [], 'a fresh copy with its months is used as it is');
});

test('the 1st of a month rolls over without a refresh: the copy already holds the new last month', () => {
  const w = world();
  const oct31 = pk(2026, 10, 31, 23); // kept late on 31 October
  const nov1 = pk(2026, 11, 1, 0, 30); // 00:30 on 1 November
  assert.equal(w.s.knownSalesmen_(oct31).ok, true);
  assert.deepEqual(kept(w).months, ['2026-09', '2026-10', '2026-11']);
  w.opened.length = 0;
  const read = w.s.knownSalesmen_(nov1);
  assert.deepEqual(w.opened, [], 'not read again');
  assert.equal(w.s.shownTarget_(read.repTargets, 'RIA', '2026-10'), fakeTarget('RIA', '2026-10'), 'last month, now October');
  assert.equal(w.s.shownTarget_(read.repTargets, 'RIA', '2026-11'), fakeTarget('RIA', '2026-11'), 'this month, now November');
  assert.equal(w.s.previousMonthKey_('2027-01'), '2026-12');
  assert.equal(w.s.previousMonthKey_('2026-10'), '2026-09');
});

// ------------------------------------------- Revised prices recorded only when changed (S9-13)

const lastActivity = (w) => {
  const values = w.diary.getSheetByName('Activity').getDataRange().getValues();
  return Object.fromEntries(ACTIVITY.map((h, i) => [h, values[values.length - 1][i]]));
};
const quoted = () => [site('S000001', 'RIA', 'Quoted Site', { stage: RQ, value_rs: 300000, payment_terms: 'Credit' })];

test('an Update at the same stage with the Rs. unchanged writes no value or terms in Activity', () => {
  for (const [who, save] of [
    ['salesman', (w, input) => w.s.repUpdateSite(RIA, 'S000001', input)],
    ['admin', (w, input) => w.s.adminPageUpdateSite(ADMIN, 'S000001', input)],
  ]) {
    const w = world({ sites: quoted() });
    const r = plain(save(w, { stage: RQ, value: '300,000', terms: 'Credit', followUp: '3days', note: 'called' }));
    assert.equal(r.ok, true, r.message);
    const a = lastActivity(w);
    assert.deepEqual([a.action, a.value_rs, a.payment_terms, a.note.replace('Admin: ', '')], ['update', '', '', 'called'], who);
  }
});

test('an Update that changes the Rs. or Cash / Credit writes both; stage changes and new sites as before', () => {
  const w = world({ sites: quoted() });
  w.s.repUpdateSite(RIA, 'S000001', { stage: RQ, value: '320000', terms: 'Credit', followUp: '3days' });
  assert.deepEqual([lastActivity(w).action, lastActivity(w).value_rs, lastActivity(w).payment_terms], ['update', 320000, 'Credit']);
  w.s.repUpdateSite(RIA, 'S000001', { stage: RQ, value: '320000', terms: 'Cash', followUp: '3days' });
  assert.deepEqual([lastActivity(w).value_rs, lastActivity(w).payment_terms], [320000, 'Cash'], 'terms only: both');
  w.s.adminPageUpdateSite(ADMIN, 'S000001', { stage: RQ, value: '330000', terms: 'Cash', followUp: '3days' });
  assert.deepEqual([lastActivity(w).rep, lastActivity(w).value_rs, lastActivity(w).payment_terms], ['admin', 330000, 'Cash']);
  w.s.repUpdateSite(RIA, 'S000001', { stage: WON, value: '330000', terms: 'Cash' });
  assert.deepEqual([lastActivity(w).action, lastActivity(w).value_rs, lastActivity(w).payment_terms], ['stage_change', 330000, 'Cash'],
    'a stage change carries the Rs. even when it is the same');
  w.s.repAddSite(RIA, { name: 'New Quote', buyerType: 'Dealer', phone: '0300 7654321', stage: RQ, value: '90000', terms: 'Cash', followUp: 'tomorrow' });
  assert.deepEqual([lastActivity(w).action, lastActivity(w).value_rs, lastActivity(w).payment_terms], ['created', 90000, 'Cash']);
});

test("the admin's Today feed shows Rs. on an Update only when it changed", () => {
  const w = world({ sites: quoted() });
  w.s.repUpdateSite(RIA, 'S000001', { stage: RQ, value: '300000', terms: 'Credit', followUp: '3days', note: 'same price' });
  w.s.repUpdateSite(RIA, 'S000001', { stage: RQ, value: '280000', terms: 'Credit', followUp: '3days', note: 'new price' });
  const feed = plain(w.s.adminPageLoad(ADMIN)).feed;
  assert.deepEqual(feed.map((f) => [f.note, f.value, f.terms]), [['new price', 280000, 'Credit'], ['same price', null, '']]);
});

// ------------------------------------------------------------------------------ The fixture
// Now: Wednesday 4 November 2026, noon. RIA, AUR (North), SH (Center) are salesmen; MUB has
// left (not in Rep_Mapping). Names say what each site is for.

function summarySites() {
  return [
    site('S000001', 'RIA', 'F-11 Commercial Tower', { stage: WON, value_rs: 450000, payment_terms: 'Cash', next_followup: '' }),
    site('S000002', 'RIA', 'Bahria Villas', { stage: RQ, value_rs: 800000, payment_terms: 'Credit', next_followup: day(2026, 11, 6), worked_at: pk(2026, 11, 1) }),
    site('S000003', 'RIA', 'DHA Plaza', { stage: LOST, value_rs: 600000, payment_terms: 'Cash', lost_reason: 'Price Too High', next_followup: '' }),
    site('S000004', 'RIA', 'Gulberg Heights', { stage: RQ, value_rs: 1200000, payment_terms: 'Credit', next_followup: day(2026, 11, 2), worked_at: pk(2026, 10, 20) }),
    site('S000005', 'RIA', 'Askari Sample', { stage: SAMPLE, next_followup: day(2026, 11, 5), worked_at: pk(2026, 10, 31, 0) }),
    site('S000006', 'RIA', 'Won 29 Oct Lost 3 Nov', { stage: LOST, value_rs: 300000, payment_terms: 'Cash', lost_reason: 'Site Delayed', next_followup: '' }),
    site('S000007', 'RIA', 'Repriced After', { stage: WON, value_rs: 999000, payment_terms: 'Cash', next_followup: '' }),
    site('S000008', 'RIA', 'Reopened', { stage: RQ, value_rs: 200000, payment_terms: 'Cash', next_followup: day(2026, 11, 10), worked_at: pk(2026, 11, 3) }),
    site('S000009', 'RIA', 'Hand Typed Won', { stage: WON, value_rs: 10000, payment_terms: 'Cash', next_followup: '' }),
    site('S000010', 'AUR', 'Handed Over', { stage: WON, value_rs: 70000, payment_terms: 'Cash', next_followup: '' }),
    site('S000011', 'RIA', 'Admin Won', { stage: WON, value_rs: 60000, payment_terms: 'Credit', next_followup: '' }),
    site('S000012', 'AUR', 'AUR Secret Tower', { stage: RQ, value_rs: 777000, payment_terms: 'Cash' }),
    site('S000013', 'MUB', 'Former Salesman Site', { stage: SAMPLE }),
    site('S000014', 'SH', 'SH Mall', { stage: WON, value_rs: 500000, payment_terms: 'Cash', next_followup: '' }),
    site('S000016', 'RIA', 'No Date Lead', { next_followup: '' }),
  ];
}

function summaryActivity() {
  activityId = 0;
  return [
    act(pk(2026, 9, 30, 23, 59), 'RIA', 'S000004', 'update', { note: 'before last month' }),
    act(pk(2026, 10, 20), 'RIA', 'S000004', 'stage_change', { from_stage: LEAD, to_stage: RQ, value_rs: 1200000, payment_terms: 'Credit' }),
    act(pk(2026, 10, 28), 'RIA', 'S000007', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 500000, payment_terms: 'Cash' }),
    act(pk(2026, 10, 29), 'RIA', 'S000006', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 300000, payment_terms: 'Cash' }),
    act(pk(2026, 10, 30, 10), 'RIA', 'S000004', 'details', { note: 'Contact name' }),
    act(pk(2026, 10, 30, 23, 59), 'RIA', 'S000004', 'update', { note: 'Friday night' }),
    act(pk(2026, 10, 31, 0, 0), 'RIA', 'S000005', 'created', { to_stage: SAMPLE, note: 'Saturday 00:00' }),
    act(pk(2026, 11, 1, 9), 'RIA', 'S000002', 'stage_change', { from_stage: LEAD, to_stage: RQ, value_rs: 800000, payment_terms: 'Credit' }),
    act(pk(2026, 11, 1, 10), 'SH', 'S000014', 'created', { to_stage: WON, value_rs: 500000, payment_terms: 'Cash' }),
    act(pk(2026, 11, 1, 11), 'MUB', 'S000013', 'created', { to_stage: LEAD }),
    act(pk(2026, 11, 2, 9), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 450000, payment_terms: 'Cash' }),
    act(pk(2026, 11, 2, 9, 30), 'RIA', 'S000010', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 70000, payment_terms: 'Cash' }),
    act(pk(2026, 11, 2, 10), 'RIA', 'S000099', 'created', { to_stage: RQ, value_rs: 55000, payment_terms: 'Cash', note: 'site row deleted by hand' }),
    act(pk(2026, 11, 2, 10, 30), 'RIA', 'S000002', 'snooze', { next_followup: day(2026, 11, 6) }),
    act(pk(2026, 11, 2, 11), 'RIA', 'S000007', 'update', { value_rs: 999000, payment_terms: 'Cash', note: 're-priced after' }),
    act(pk(2026, 11, 2, 12), 'RIA', 'S000008', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 200000, payment_terms: 'Cash' }),
    act(pk(2026, 11, 2, 13), 'AUR', 'S000012', 'created', { to_stage: RQ, value_rs: 777000, payment_terms: 'Cash' }),
    act(pk(2026, 11, 2, 14), 'MUB', 'S000013', 'stage_change', { from_stage: LEAD, to_stage: SAMPLE }),
    act(pk(2026, 11, 3, 9), 'RIA', 'S000008', 'stage_change', { from_stage: WON, to_stage: RQ, value_rs: 200000, payment_terms: 'Cash' }),
    act(pk(2026, 11, 3, 10), 'RIA', 'S000003', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Price Too High' }),
    act(pk(2026, 11, 3, 11), 'RIA', 'S000006', 'stage_change', { from_stage: WON, to_stage: LOST, lost_reason: 'Site Delayed' }),
    act(pk(2026, 11, 3, 12), 'admin', 'S000011', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 60000, payment_terms: 'Credit', note: 'Admin: done' }),
    act(pk(2026, 11, 3, 13), 'AUR', 'S000010', 'update', { note: 'handed over to AUR' }),
    act(pk(2026, 11, 4, 9), 'RIA', 'S000002', 'update', { note: 'called' }),
  ];
}

const summaryWorld = (extra = {}) => world({ sites: summarySites(), activity: summaryActivity(), ...extra });
/** RIA's summary for a period at a moment (default NOW). */
const ria = (w, period, now = NOW) => plain(w.s.repSummaryFor_(w.diary, 'RIA', period, now));
const team = (w, period, now = NOW) => plain(w.s.teamSummaryFor_(w.diary, period, now));
/** The Numbers of one salesman (or a group) for a period at a moment, as summaries count them. */
function numbers(w, reps, period, now = NOW) {
  const read = w.s.readSummary_(w.diary, period, now);
  const n = plain(w.s.summaryNumbers_(read.facts, new Set(reps)));
  const names = (test) => n.results.filter(test).map((r) => r.site.name).sort();
  return {
    created: n.created, worked: n.worked, days: n.days, samples: n.samples, quotes: n.quotes, quoteRs: n.quoteRs,
    won: n.won, wonRs: n.wonRs, lost: n.lost,
    wonNames: names((r) => r.won), lostNames: names((r) => r.lost), quoteNames: names((r) => r.quote !== null),
  };
}
/** A row as text: "F-11 Commercial Tower · Cash | Rs. 450,000" (spec 010 tables). */
const rowText = (r) => r.c[0] + (r.s ? ` ${r.s}` : '') + (r.c.length > 1 ? ` | ${r.c.slice(1).join(' | ')}` : '');
/** A table's rows as text, then its "+ N more"; 'tiles' and 'now' too; null when it isn't there. */
const lines = (summary, h) => {
  if (h === 'tiles') return summary.tiles.map((t) => `${t.l} ${t.n}${t.rs ? ` ${t.rs}` : ''}`);
  if (h === 'now') return summary.now.rows.map(rowText);
  const t = summary.tables.find((x) => x.h === h);
  return t ? t.rows.map(rowText).concat(t.more ? [t.more] : []) : null;
};
/**
 * A summary part without what spec 011 added for taps (site lists `ids` / `x` / `p` / `lh`, a named
 * row's `id`, a region row's `reg`), so the spec 009 / 010 shapes can be compared as they were.
 */
const bare = (x) => JSON.parse(JSON.stringify(x, (k, v) => (['ids', 'x', 'p', 'lh', 'id', 'reg'].includes(k) ? undefined : v)));
/** One row of the admin's team table, as text. */
const teamRow = (t, name) => {
  const r = t.tables[0].rows.find((x) => x.c[0] === name);
  return r ? rowText(r) : null;
};

// ---------------------------------------------------------------------------------- Periods

test('periods: a week is Saturday 00:00 to Friday 23:59 in Pakistan time; months from the 1st', () => {
  const { s } = world();
  const p = (period, now) => plain(s.summaryPeriod_(period, now));
  // Wednesday 4 Nov: the week crosses two months.
  assert.deepEqual(p('this-week', NOW), { key: 'this-week', running: true, start: pk(2026, 10, 31, 0).getTime(),
    end: pk(2026, 11, 7, 0).getTime(), month: '', title: 'This week so far · Sat 31 Oct – Wed 4 Nov', name: 'This week so far', days: 'Sat 31 Oct – Wed 4 Nov',
    today: '2026-11-04' });
  assert.deepEqual(p('last-week', NOW), { key: 'last-week', running: false, start: pk(2026, 10, 24, 0).getTime(),
    end: pk(2026, 10, 31, 0).getTime(), month: '', title: 'Last week · Sat 24 Oct – Fri 30 Oct', name: 'Last week', days: 'Sat 24 Oct – Fri 30 Oct',
    today: '2026-11-04' });
  assert.deepEqual(p('this-month', NOW), { key: 'this-month', running: true, start: pk(2026, 11, 1, 0).getTime(),
    end: pk(2026, 12, 1, 0).getTime(), month: '2026-11', title: 'November so far · 1–4 Nov', name: 'November so far', days: '1–4 Nov',
    today: '2026-11-04' });
  assert.deepEqual(p('last-month', NOW), { key: 'last-month', running: false, start: pk(2026, 10, 1, 0).getTime(),
    end: pk(2026, 11, 1, 0).getTime(), month: '2026-10', title: 'October', name: 'October', days: '1–31 Oct', today: '2026-11-04' });
  // Friday at 23:59: the whole week, no "so far".
  assert.equal(p('this-week', pk(2026, 11, 6, 23, 59)).title, 'This week · Sat 31 Oct – Fri 6 Nov');
  assert.equal(p('this-week', pk(2026, 11, 6, 23, 59)).start, pk(2026, 10, 31, 0).getTime());
  // Saturday: a new week, from 00:00 that day.
  for (const at of [pk(2026, 11, 7, 0, 0), pk(2026, 11, 7, 10)]) {
    assert.equal(p('this-week', at).title, 'This week so far · Sat 7 Nov');
    assert.equal(p('this-week', at).start, pk(2026, 11, 7, 0).getTime());
    assert.equal(p('last-week', at).title, 'Last week · Sat 31 Oct – Fri 6 Nov');
    assert.equal(p('last-week', at).end, pk(2026, 11, 7, 0).getTime(), 'last week ends where this week starts');
  }
  // Pakistan time, not UTC: 00:30 Saturday in Pakistan is still Friday in UTC.
  assert.equal(p('this-week', new Date(Date.UTC(2026, 10, 6, 19, 30))).title, 'This week so far · Sat 7 Nov');
  // The 1st of a month.
  const nov1 = pk(2026, 11, 1, 9);
  assert.equal(p('this-month', nov1).title, 'November so far · 1 Nov');
  assert.equal(p('last-month', nov1).title, 'October');
  assert.equal(p('this-week', nov1).title, 'This week so far · Sat 31 Oct – Sun 1 Nov');
  // 1 January (a Friday): the week and last month cross the year.
  const jan1 = pk(2027, 1, 1, 9);
  assert.equal(p('this-week', jan1).title, 'This week · Sat 26 Dec – Fri 1 Jan');
  assert.equal(p('this-week', jan1).start, pk(2026, 12, 26, 0).getTime());
  assert.equal(p('last-week', jan1).title, 'Last week · Sat 19 Dec – Fri 25 Dec');
  assert.equal(p('this-month', jan1).title, 'January so far · 1 Jan');
  assert.deepEqual([p('last-month', jan1).title, p('last-month', jan1).month, p('last-month', jan1).start, p('last-month', jan1).end],
    ['December', '2026-12', pk(2026, 12, 1, 0).getTime(), pk(2027, 1, 1, 0).getTime()]);
  assert.equal(p('this-month', jan1).start, pk(2027, 1, 1, 0).getTime());
  // Anything else: the usual message.
  for (const bad of ['next-week', 'This week', '', null, undefined, 3, {}, ['this-week'], 'this-week ']) {
    assert.equal(thrown(() => s.summaryPeriod_(bad, NOW)), TRY_AGAIN, String(bad));
  }
});

test('a save at Friday 23:59 is in that week; one at Saturday 00:00 in the next, never both', () => {
  const w = summaryWorld();
  const last = numbers(w, ['RIA'], 'last-week');
  const now = numbers(w, ['RIA'], 'this-week');
  assert.equal(last.worked, 3, 'Fri 30 Oct 23:59 update counts last week (with the two wins)');
  assert.equal(last.samples, 0, 'the Sat 31 Oct 00:00 sample is not last week');
  assert.equal(now.samples, 1, '...it is this week');
  assert.equal(numbers(w, ['RIA'], 'last-month').samples, 1, '...and October');
  assert.equal(numbers(w, ['RIA'], 'this-month').samples, 0, '...not November');
});

// ----------------------------------------------------------------------------------- Counts

test('counts this week: new sites, sites worked (once each; no snooze or Edit details), samples, quotes, won, lost', () => {
  const w = summaryWorld();
  assert.deepEqual(numbers(w, ['RIA'], 'this-week'), {
    created: 2, worked: 9, days: 5, samples: 1, quotes: 2, quoteRs: 1000000, won: 2, wonRs: 510000, lost: 2,
    wonNames: ['Admin Won', 'F-11 Commercial Tower'], lostNames: ['DHA Plaza', 'Won 29 Oct Lost 3 Nov'],
    quoteNames: ['Bahria Villas', 'Reopened'],
  });
});

test('sites worked and days logged: a snooze or Edit details is a day logged, never a site worked', () => {
  activityId = 0;
  const w = world({
    sites: [site('S000001', 'RIA', 'Lead One'), site('S000002', 'RIA', 'Lead Two')],
    activity: [
      act(pk(2026, 11, 2, 9), 'RIA', 'S000001', 'snooze', { next_followup: day(2026, 11, 5) }),
      act(pk(2026, 11, 3, 9), 'RIA', 'S000002', 'details', { note: 'Area' }),
      act(pk(2026, 11, 4, 9), 'RIA', 'S000001', 'update', { note: 'a' }),
      act(pk(2026, 11, 4, 10), 'RIA', 'S000001', 'update', { note: 'b' }),
    ],
  });
  const n = numbers(w, ['RIA'], 'this-week');
  assert.deepEqual([n.worked, n.days, n.created], [1, 3, 0]);
});

test('quotes: Rs. from the latest move to Rate Quoted in the period; a revised price is not another quote (S9-13)', () => {
  activityId = 0;
  const w = world({
    sites: [site('S000001', 'RIA', 'Requoted', { stage: RQ, value_rs: 450000, payment_terms: 'Cash' })],
    activity: [
      act(pk(2026, 11, 2, 9), 'RIA', 'S000001', 'stage_change', { from_stage: LEAD, to_stage: RQ, value_rs: 300000, payment_terms: 'Cash' }),
      act(pk(2026, 11, 2, 10), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: SAMPLE }),
      act(pk(2026, 11, 3, 9), 'RIA', 'S000001', 'stage_change', { from_stage: SAMPLE, to_stage: RQ, value_rs: 400000, payment_terms: 'Cash' }),
      act(pk(2026, 11, 3, 10), 'RIA', 'S000001', 'update', { value_rs: 450000, payment_terms: 'Cash', note: 'revised price' }),
    ],
  });
  const n = numbers(w, ['RIA'], 'this-week');
  assert.deepEqual([n.quotes, n.quoteRs, n.samples], [1, 400000, 1], 'one site, the latest move\'s Rs., a revised price not counted');
  assert.deepEqual(lines(ria(w, 'this-week'), 'Quotes given'), ['Requoted | Rs. 400,000']);
});

test('a Won or Lost site moved back to Rate Quoted is a new quote given (owner S9-16)', () => {
  activityId = 0;
  const w = world({
    sites: [
      site('S000001', 'RIA', 'Back From Won', { stage: RQ, value_rs: 210000, payment_terms: 'Cash' }),
      site('S000002', 'RIA', 'Back From Lost', { stage: RQ, value_rs: 90000, payment_terms: 'Cash' }),
    ],
    activity: [
      act(pk(2026, 10, 10), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 200000, payment_terms: 'Cash' }),
      act(pk(2026, 10, 10), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Price Too High' }),
      act(pk(2026, 11, 2), 'RIA', 'S000001', 'stage_change', { from_stage: WON, to_stage: RQ, value_rs: 210000, payment_terms: 'Cash' }),
      act(pk(2026, 11, 3), 'RIA', 'S000002', 'stage_change', { from_stage: LOST, to_stage: RQ, value_rs: 90000, payment_terms: 'Cash' }),
    ],
  });
  const n = numbers(w, ['RIA'], 'this-week');
  assert.deepEqual([n.quotes, n.quoteRs, n.quoteNames], [2, 300000, ['Back From Lost', 'Back From Won']]);
});

test('won / lost this week and this month: spec 008\'s rule (P7-1), equal to the Team and This month tabs', () => {
  const w = summaryWorld();
  const screen = plain(w.s.adminDataFor_(w.diary, [], NOW));
  for (const rep of ['RIA', 'AUR', 'SH']) {
    const tab = screen.sites.filter((c) => c.rep === rep && c.closed);
    const won = tab.filter((c) => c.stage === WON);
    const n = numbers(w, [rep], 'this-month');
    assert.deepEqual([n.won, n.wonRs, n.lost], [won.length, won.reduce((a, c) => a + c.value, 0), tab.length - won.length], rep);
    assert.deepEqual(n.wonNames, won.map((c) => c.name).sort(), rep);
  }
  const week = numbers(w, ['RIA'], 'this-week');
  assert.ok(!week.wonNames.includes('Repriced After'), 'won on 28 Oct: not this week');
  assert.ok(!week.wonNames.includes('Reopened'), 'won then reopened in the week: not counted');
  assert.ok(!week.wonNames.includes('Hand Typed Won'), 'a stage typed by hand (no history): never counted');
  assert.ok(week.lostNames.includes('Won 29 Oct Lost 3 Nov'), 'lost this week');
  assert.ok(week.wonNames.includes('Admin Won'), 'moved by the admin: counts for the site\'s salesman');
});

test('this week / this month follow the sheet as it is now, as the Team tab does (a stage or Rs. changed by hand)', () => {
  activityId = 0;
  const w = world({
    sites: [
      site('S000001', 'RIA', 'Rs Fixed By Hand', { stage: WON, value_rs: 650000, payment_terms: 'Cash', next_followup: '' }),
      site('S000002', 'RIA', 'Reopened By Hand', { stage: RQ, value_rs: 300000, payment_terms: 'Cash' }),
    ],
    activity: [
      act(pk(2026, 11, 2), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 600000, payment_terms: 'Cash' }),
      act(pk(2026, 11, 2), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 300000, payment_terms: 'Cash' }),
    ],
  });
  for (const period of ['this-week', 'this-month']) {
    assert.deepEqual(lines(ria(w, period), 'Won'), ['Rs Fixed By Hand · Cash | Rs. 650,000'], period);
  }
  const screen = plain(w.s.adminDataFor_(w.diary, [], NOW));
  assert.deepEqual(screen.sites.filter((c) => c.closed).map((c) => [c.name, c.value]), [['Rs Fixed By Hand', 650000]], 'as the This month tab');
  assert.deepEqual(lines(ria(w, 'last-week', pk(2026, 11, 9)), 'Won'), ['Rs Fixed By Hand · Cash | Rs. 600,000',
    'Reopened By Hand · Cash | Rs. 300,000'], 'a finished week: as it ended');
});

test('won / lost last week and last month: as the period ended (S9-14)', () => {
  const w = summaryWorld();
  const oct = numbers(w, ['RIA'], 'last-month');
  assert.deepEqual([oct.won, oct.wonRs, oct.lost], [2, 800000, 0]);
  assert.deepEqual(oct.wonNames, ['Repriced After', 'Won 29 Oct Lost 3 Nov'], 'won 29 Oct, lost 3 Nov: won in October');
  assert.ok(numbers(w, ['RIA'], 'this-month').lostNames.includes('Won 29 Oct Lost 3 Nov'), '...and lost in November');
  assert.deepEqual(lines(ria(w, 'last-week'), 'Won'), ['Repriced After · Cash | Rs. 500,000', 'Won 29 Oct Lost 3 Nov · Cash | Rs. 300,000'],
    're-priced after the week: the week\'s Rs.');
});

test('as the period ended: reopened inside it, won twice, corrected inside it, its own lost reason, admin-moved', () => {
  activityId = 0;
  const lastWeek = (d, h = 9) => pk(2026, 10, d, h);
  const w = world({
    sites: [
      site('S000001', 'RIA', 'Reopened In Week', { stage: WON, value_rs: 500000, payment_terms: 'Cash' }),
      site('S000002', 'RIA', 'Won Twice', { stage: RQ, value_rs: 90000, payment_terms: 'Cash' }),
      site('S000003', 'RIA', 'Corrected', { stage: WON, value_rs: 1, payment_terms: 'Credit' }),
      site('S000004', 'RIA', 'Lost Then Reopened', { stage: RQ, value_rs: 50000, payment_terms: 'Cash' }),
      site('S000005', 'RIA', 'Admin Moved', { stage: WON, value_rs: 40000, payment_terms: 'Credit' }),
    ],
    activity: [
      act(lastWeek(26), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 500000, payment_terms: 'Cash' }),
      act(lastWeek(27), 'RIA', 'S000001', 'stage_change', { from_stage: WON, to_stage: RQ, value_rs: 500000, payment_terms: 'Cash' }),
      act(lastWeek(26), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 70000, payment_terms: 'Cash' }),
      act(lastWeek(27), 'RIA', 'S000002', 'stage_change', { from_stage: WON, to_stage: RQ, value_rs: 70000, payment_terms: 'Cash' }),
      act(lastWeek(28), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 80000, payment_terms: 'Cash' }),
      act(lastWeek(26), 'RIA', 'S000003', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 100000, payment_terms: 'Cash' }),
      act(lastWeek(27), 'RIA', 'S000003', 'update', { value_rs: 120000, payment_terms: 'Credit', note: 'corrected' }),
      act(lastWeek(26), 'RIA', 'S000004', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Credit Terms' }),
      act(lastWeek(29), 'admin', 'S000005', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 40000, payment_terms: 'Credit' }),
      // After the week: none of this changes it.
      act(pk(2026, 11, 1), 'RIA', 'S000002', 'stage_change', { from_stage: WON, to_stage: RQ, value_rs: 90000, payment_terms: 'Cash' }),
      act(pk(2026, 11, 1), 'RIA', 'S000003', 'update', { value_rs: 1, payment_terms: 'Credit' }),
      act(pk(2026, 11, 2), 'RIA', 'S000004', 'stage_change', { from_stage: LOST, to_stage: RQ, value_rs: 50000, payment_terms: 'Cash' }),
    ],
  });
  const summary = ria(w, 'last-week');
  assert.deepEqual(lines(summary, 'Won'), ['Corrected · Credit | Rs. 120,000', 'Won Twice · Cash | Rs. 80,000', 'Admin Moved · Credit | Rs. 40,000']);
  assert.deepEqual(lines(summary, 'Lost'), ['Lost Then Reopened | Credit Terms']);
  const n = numbers(w, ['RIA'], 'last-week');
  assert.deepEqual([n.won, n.wonRs, n.lost, n.worked], [3, 240000, 1, 4], 'the admin\'s move is a result, not RIA\'s work');
});

test('a handed-over site: results for its salesman now, work for whoever saved it; a deleted site row: work only', () => {
  const w = summaryWorld();
  const riaWeek = numbers(w, ['RIA'], 'this-week');
  const aurWeek = numbers(w, ['AUR'], 'this-week');
  assert.ok(!riaWeek.wonNames.includes('Handed Over'));
  assert.ok(aurWeek.wonNames.includes('Handed Over'), 'won by RIA before the hand-over: AUR\'s result now');
  const facts = w.s.readSummary_(w.diary, 'this-week', NOW).facts;
  assert.ok(facts.work.get('RIA').worked.has('S000010'), 'RIA worked it');
  assert.ok(facts.work.get('RIA').worked.has('S000099'), 'the site whose row was deleted by hand: his work');
  assert.ok(!facts.results.some((r) => r.site.id === 'S000099'), '...never a result or a named site');
  assert.ok(!JSON.stringify(ria(w, 'this-week')).includes('S000099'));
});

test('the admin\'s saves never count as work', () => {
  const w = summaryWorld();
  const facts = w.s.readSummary_(w.diary, 'this-week', NOW).facts;
  assert.equal(facts.work.has('admin'), false);
  assert.equal(facts.work.has('ADMIN'), false);
  assert.ok(!facts.work.get('RIA').worked.has('S000011'), 'the admin marked it Won: not RIA\'s work');
  const t = team(w, 'this-week');
  assert.ok(!t.tables[0].rows.some((r) => /admin/i.test(r.c[0])), 'no row for the admin');
  assert.equal(teamRow(t, 'MUB'), 'MUB | 1 | 0 | 0 | 0', 'a former code: worked, quotes, won, lost');
});

// ------------------------------------------------------------------------------------ Team

test('team: All salesmen = North + Center + South = the salesmen; a former code is in neither; sites worked once', () => {
  const w = summaryWorld();
  const all = numbers(w, ['RIA', 'AUR', 'WAK', 'SH', 'SJ', 'SM', 'IB'], 'this-week');
  const regions = [['RIA', 'AUR', 'WAK'], ['SH', 'SJ', 'SM'], ['IB']].map((reps) => numbers(w, reps, 'this-week'));
  const reps = ['RIA', 'AUR', 'WAK', 'SH', 'SJ', 'SM', 'IB'].map((rep) => numbers(w, [rep], 'this-week'));
  for (const key of ['created', 'samples', 'quotes', 'quoteRs', 'won', 'wonRs', 'lost']) {
    const sum = (list) => list.reduce((a, n) => a + n[key], 0);
    assert.equal(all[key], sum(regions), key);
    assert.equal(all[key], sum(reps), key);
  }
  assert.equal(all.worked, 11, 'Handed Over was worked by RIA and by AUR: once');
  assert.equal(reps[0].worked + reps[1].worked + reps[3].worked, 12);
  const t = team(w, 'this-week');
  assert.deepEqual(lines(t, 'tiles'), ['New sites 4', 'Sites worked 11', 'Samples 1', 'Quotes 3 Rs. 1,777,000', 'Won 4 Rs. 1,080,000', 'Lost 2']);
  assert.equal(teamRow(t, 'North'), 'North | 10 | 3 | 0.58M | 2');
  assert.equal(teamRow(t, 'Team'), 'Team | 11 | 3 | 1.08M | 2');
  assert.equal(t.target, undefined, 'a week has no targets');
  assert.ok(!JSON.stringify(t).includes('Former Salesman Site'));
});

test('team regions come from Rep_Mapping, never from Sites.region', () => {
  const sites = summarySites().map((row) => row.slice());
  sites.forEach((row) => { if (row[0] === 'S000001') row[2] = 'South'; }); // a stale region cell
  const w = world({ sites, activity: summaryActivity() });
  const t = team(w, 'this-week');
  assert.equal(teamRow(t, 'South'), 'South | 0 | 0 | 0 | 0');
  assert.equal(teamRow(t, 'North'), 'North | 10 | 3 | 0.58M | 2');
});

test('team side by side: Rep_Mapping order, "nothing logged", lost reasons most first', () => {
  const w = summaryWorld();
  const t = team(w, 'this-week');
  const table = t.tables[0];
  assert.deepEqual([table.h, table.n, table.cols], ['Salesmen', 'tap a name', ['Name', 'Worked', 'Quotes', 'Won Rs.', 'Lost']]);
  assert.deepEqual(bare(table.rows), [
    { c: ['North', '10', '3', '0.58M', '2'], k: 'reg' },
    { c: ['RIA', '9', '2', '0.51M', '2'], rep: 'RIA' },
    { c: ['AUR', '2', '1', '0.07M', '0'], rep: 'AUR' },
    { c: ['WAK', '—', '—', '—', '—'], k: 'none', rep: 'WAK' },
    { c: ['Center', '1', '0', '0.5M', '0'], k: 'reg' },
    { c: ['SH', '1', '0', '0.5M', '0'], rep: 'SH' },
    { c: ['SJ', '—', '—', '—', '—'], k: 'none', rep: 'SJ' },
    { c: ['SM', '—', '—', '—', '—'], k: 'none', rep: 'SM' },
    { c: ['South', '0', '0', '0', '0'], k: 'reg' },
    { c: ['IB', '—', '—', '—', '—'], k: 'none', rep: 'IB' },
    { c: ['Team', '11', '3', '1.08M', '2'], k: 'tot' },
    { c: ['Not in the salesmen list'], k: 'grey' },
    { c: ['MUB', '1', '0', '0', '0'] },
  ]);
  assert.deepEqual(lines(t, 'Lost reasons'), ['Price Too High | 1', 'Site Delayed | 1']);
  assert.equal(t.tables[1].n, '2');
  assert.deepEqual(t.salesmen.map((x) => x.rep), ['RIA', 'AUR', 'WAK', 'SH', 'SJ', 'SM', 'IB']);
});

test('lost reasons: most first, then by name; a lost site with no reason is Other', () => {
  activityId = 0;
  const sites = [];
  const activity = [];
  [['Site Delayed', 1], ['Price Too High', 3], ['', 1], ['Competitor Approved', 1]].forEach(([reason, count], i) => {
    for (let j = 0; j < count; j++) {
      const id = `S0000${i}${j}`;
      sites.push(site(id, 'SH', `Lost ${i}${j}`, { stage: LOST, lost_reason: reason, next_followup: '' }));
      activity.push(act(pk(2026, 11, 2), 'SH', id, 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: reason }));
    }
  });
  // A former salesman's lost site and a lost site with no salesman: in no team total.
  sites.push(site('S000090', 'MUB', 'Former Lost', { stage: LOST, lost_reason: 'Credit Terms', next_followup: '' }));
  sites.push(site('S000091', '', 'Nobody Lost', { stage: LOST, lost_reason: 'Credit Terms', next_followup: '' }));
  activity.push(act(pk(2026, 11, 2), 'MUB', 'S000090', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Credit Terms' }));
  activity.push(act(pk(2026, 11, 2), 'admin', 'S000091', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Credit Terms' }));
  const t = team(world({ sites, activity }), 'this-week');
  assert.deepEqual(lines(t, 'Lost reasons'), ['Price Too High | 3', 'Competitor Approved | 1', 'Other | 1', 'Site Delayed | 1']);
  assert.equal(t.tables[1].n, '6');
  assert.equal(lines(t, 'tiles')[5], 'Lost 6', 'the same Lost count as the Lost tile');
  assert.equal(teamRow(t, 'MUB'), 'MUB | 1 | 0 | 0 | 1', 'the former code\'s loss is on his own row');
});

// ------------------------------------------------------------------------------ Targets, %

test('month targets and %: this month and last month; weeks none; no target means no %', () => {
  const w = summaryWorld();
  assert.deepEqual(ria(w, 'this-month').target, { h: 'Target', pct: 44, won: 'Won Rs. 510,000', of: 'of Rs. 1,140,000' });
  assert.equal(fakeTarget('RIA', '2026-11'), 1140000);
  assert.deepEqual(ria(w, 'last-month').target, { h: 'Target', pct: 70, won: 'Won Rs. 800,000', of: 'of Rs. 1,130,000' });
  assert.ok(ria(w, 'last-month').text.includes('\nTarget  70% of 1,130,000\n'));
  for (const period of ['this-week', 'last-week']) {
    assert.ok(!/target/i.test(ria(w, period).text) && ria(w, period).target === undefined, period);
    assert.ok(!/target/i.test(team(w, period).text) && team(w, period).target === undefined, period);
  }
  const tabs = metaDataTabs();
  tabs['Rep-Targets'] = tabs['Rep-Targets'].filter((r) => !(r[0] === 'RIA' && r[1] instanceof Date && r[1].getTime() === pk(2026, 11, 1, 0).getTime()));
  const none = world({ metaTabs: tabs, sites: summarySites(), activity: summaryActivity() });
  assert.deepEqual(ria(none, 'this-month').target, { none: 'No target for November' });
  assert.ok(ria(none, 'this-month').text.includes('\nNo target for November\n'));
  assert.ok(!ria(none, 'this-month').text.includes('%'));
  assert.equal(teamRow(team(none, 'this-month'), 'RIA'), 'RIA | 8 | 2 | 0.51M | —', 'no % of target');
});

test('team month: target = North + Center + South; house / office target for the admin only', () => {
  const w = summaryWorld();
  const t = team(w, 'this-month');
  const teamTarget = fakeTarget('North', '2026-11') + fakeTarget('Center', '2026-11') + fakeTarget('South', '2026-11');
  assert.equal(teamTarget, 6720000);
  assert.deepEqual(t.target, { h: 'Team target', pct: 16, won: 'Won Rs. 1,080,000', of: 'of Rs. 6,720,000',
    note: 'House / office target Rs. 2,440,000 · not in the diary' });
  assert.equal(teamRow(t, 'North'), 'North | 9 | 3 | 0.58M | 27', 'the region\'s % of its target');
  assert.equal(teamRow(t, 'Team'), 'Team | 10 | 3 | 1.08M | 16');
  const oct = team(w, 'last-month');
  assert.equal(oct.target.note, `House / office target ${w.s.formatRs_(fakeTarget('UNASSIGNED', '2026-10'))} · not in the diary`);
  for (const period of ['this-month', 'last-month']) {
    const json = JSON.stringify(ria(w, period));
    assert.ok(!json.includes('House') && !json.includes(w.s.formatRs_(fakeTarget('UNASSIGNED', '2026-11'))) &&
      !json.includes(w.s.formatRs_(teamTarget)), 'never on a salesman\'s summary');
  }
  const tabs = metaDataTabs();
  tabs.Targets = [tabs.Targets[0]];
  const none = team(world({ metaTabs: tabs, sites: summarySites(), activity: summaryActivity() }), 'this-month');
  assert.deepEqual(none.target, { none: 'No target for November', note: 'No house / office target for November' });
});

// ------------------------------------------------------------------------- Coming up, late

test('NOW: hot sites and their Rs. (Rate Quoted), follow-ups due today and the 6 days after', () => {
  const extra = { stage: SAMPLE };
  const sites = [
    site('S000001', 'RIA', 'Sample Old', { ...extra, next_followup: day(2026, 11, 8), created_at: pk(2026, 9, 1) }),
    site('S000002', 'RIA', 'Sample New', { ...extra, next_followup: day(2026, 11, 8), created_at: pk(2026, 9, 2) }),
    site('S000003', 'RIA', 'Sample Soon', { ...extra, next_followup: day(2026, 11, 5) }),
    site('S000004', 'RIA', 'Quote Late Date', { stage: RQ, value_rs: 500000, payment_terms: 'Cash', next_followup: day(2026, 11, 9) }),
    site('S000005', 'RIA', 'Quote Soon Date', { stage: RQ, value_rs: 500000, payment_terms: 'Cash', next_followup: day(2026, 11, 10) }),
    site('S000006', 'RIA', 'Quote Big', { stage: RQ, value_rs: 900000, payment_terms: 'Cash', next_followup: day(2026, 11, 11) }),
    site('S000007', 'RIA', 'Lead Due', { next_followup: day(2026, 11, 4) }),
    site('S000008', 'RIA', 'Won Not Open', { stage: WON, value_rs: 5000000, payment_terms: 'Cash', next_followup: day(2026, 11, 5) }),
  ];
  const now = ria(world({ sites }), 'this-week').now;
  assert.deepEqual(bare(now.rows), [{ c: ['Hot sites', '6 · Rs. 1,900,000'] }, { c: ['Follow-ups next 7 days', '6'] },
    { c: ['Late', '0'], k: 'none' }, { c: ['Going cold', '0'], k: 'none' }], 'due: today 4 Nov to 10 Nov (not 11 Nov, not the Won site)');
});

test('NOW, named (owner S9-7): his top 5 hot sites in Hot Pipeline order; the 3 biggest late or going cold', () => {
  const sites = [
    site('S000001', 'RIA', 'Sample Old', { stage: SAMPLE, next_followup: day(2026, 11, 8), created_at: pk(2026, 9, 1) }),
    site('S000002', 'RIA', 'Sample New', { stage: SAMPLE, next_followup: day(2026, 11, 8), created_at: pk(2026, 9, 2) }),
    site('S000003', 'RIA', 'Sample Soon', { stage: SAMPLE, next_followup: day(2026, 11, 5) }),
    site('S000004', 'RIA', 'Quote Late Date', { stage: RQ, value_rs: 500000, payment_terms: 'Cash', next_followup: day(2026, 11, 9) }),
    site('S000005', 'RIA', 'Quote Soon Date', { stage: RQ, value_rs: 500000, payment_terms: 'Cash', next_followup: day(2026, 11, 10) }),
    site('S000006', 'RIA', 'Quote Big', { stage: RQ, value_rs: 900000, payment_terms: 'Cash', next_followup: day(2026, 11, 11) }),
    site('S000007', 'RIA', 'Lead Due', { next_followup: day(2026, 11, 4) }),
    site('S000008', 'RIA', 'Won Not Open', { stage: WON, value_rs: 5000000, payment_terms: 'Cash', next_followup: day(2026, 11, 5) }),
  ];
  const hot = ria(world({ sites }), 'this-week').now.tables;
  assert.deepEqual(bare(hot), [{ h: 'Hot sites', n: '6', rows: [
    { c: ['Quote Big', 'Rs. 900,000'] }, { c: ['Quote Late Date', 'Rs. 500,000'] }, { c: ['Quote Soon Date', 'Rs. 500,000'] },
    { c: ['Sample Soon', SAMPLE], k: 'm' }, { c: ['Sample New', SAMPLE], k: 'm' },
  ] }], 'Rs. biggest, then soonest follow-up, then newest; 5 of 6; nothing late or cold: no second table');
  const behind = [
    site('S000001', 'RIA', 'Small Late', { stage: RQ, value_rs: 100000, payment_terms: 'Cash', next_followup: day(2026, 11, 3) }),
    site('S000002', 'RIA', 'Big Cold', { stage: RQ, value_rs: 900000, payment_terms: 'Cash', worked_at: pk(2026, 10, 26) }),
    site('S000003', 'RIA', 'Mid Late', { stage: RQ, value_rs: 500000, payment_terms: 'Cash', next_followup: day(2026, 10, 30) }),
    site('S000004', 'RIA', 'Lead Late', { next_followup: day(2026, 11, 3) }),
  ];
  const w = world({ sites: behind });
  assert.deepEqual(bare(ria(w, 'this-week').now.tables[1]), { h: 'Late & going cold', n: 'Late 3 · Cold 1', rows: [
    { c: ['Big Cold', 'no update for 9 days'], k: 'cold w' }, { c: ['Mid Late', '5 days late'], k: 'late w' },
    { c: ['Small Late', '1 day late'], k: 'late w' },
  ] }, 'the 3 biggest by Rs.');
  assert.ok(ria(w, 'this-week').text.endsWith(['*Late & going cold*', '- Big Cold · no update for 9 days', '- Mid Late · 5 days late',
    '- Small Late · 1 day late'].join('\n')));
  assert.ok(!ria(w, 'last-week').text.includes('*Hot sites*') && !ria(w, 'last-week').text.includes('*Late & going cold*'),
    'a past period leaves NOW out of the text (S9-15)');
  assert.equal(ria(w, 'last-week').now.tables.length, 2, '...but shows it on screen');
  assert.equal(team(w, 'this-week').now.tables, undefined, 'the team\'s NOW: counts only');
  assert.ok(!team(w, 'this-week').text.includes('*Hot sites*'));
  assert.deepEqual(ria(world({ sites: [site('S000001', 'RIA', 'Fine')] }), 'this-week').now.tables, [], 'none: both tables left out');
});

test('NOW: the Late and Going cold counts follow the Late & cold tab\'s rules; nothing late shows 0 in grey', () => {
  const w = summaryWorld();
  const screen = plain(w.s.adminDataFor_(w.diary, [], NOW));
  const today = '2026-11-04';
  const open = screen.sites.filter((c) => ![WON, LOST].includes(c.stage));
  const late = open.filter((c) => !c.followUp || c.followUp < today).length;
  const cold = open.filter((c) => [SAMPLE, RQ].includes(c.stage) && w.s.daysBetween_(c.worked, today) >= 7).length;
  assert.deepEqual(lines(team(w, 'this-week'), 'now').slice(2), [`Late | ${late}`, `Going cold | ${cold}`]);
  assert.deepEqual([late, cold], [2, 1]);
  const sites = [
    site('S000001', 'RIA', 'Small Late', { stage: RQ, value_rs: 100000, payment_terms: 'Cash', next_followup: day(2026, 11, 3) }),
    site('S000002', 'RIA', 'Big Cold', { stage: RQ, value_rs: 900000, payment_terms: 'Cash', worked_at: pk(2026, 10, 26) }),
    site('S000003', 'RIA', 'Mid Late', { stage: RQ, value_rs: 500000, payment_terms: 'Cash', next_followup: day(2026, 10, 30) }),
    site('S000004', 'RIA', 'Lead Late', { next_followup: day(2026, 11, 3) }),
  ];
  assert.deepEqual(bare(ria(world({ sites }), 'this-week').now.rows), [{ c: ['Hot sites', '3 · Rs. 1,500,000'] },
    { c: ['Follow-ups next 7 days', '0'] }, { c: ['Late', '3'], k: 'late' }, { c: ['Going cold', '1'], k: 'cold' }]);
  assert.deepEqual(bare(ria(world({ sites: [site('S000001', 'RIA', 'Fine')] }), 'this-week').now.rows.slice(2)),
    [{ c: ['Late', '0'], k: 'none' }, { c: ['Going cold', '0'], k: 'none' }]);
});

test('NOW: on screen under every button, headed "Now · <today>"; left out of past periods\' text (S9-15)', () => {
  const w = summaryWorld();
  for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
    const summary = ria(w, period);
    assert.equal(summary.now.cap, 'Now · 4 Nov', period);
    assert.equal(summary.now.rows.length, 4, period);
    assert.equal(summary.text.includes('*Now, 4 Nov*') && summary.text.includes('Hot sites'), period.startsWith('this'), period);
    assert.equal(team(w, period).text.includes('*Now, 4 Nov*'), period.startsWith('this'), `team ${period}`);
    assert.equal(team(w, period).now.cap, 'Now · 4 Nov');
  }
});

// ------------------------------------------------------------------------- The WhatsApp text

/** Every line inside a monospace block (``` … ```) is at most 30 characters (spec 010). */
function monoLines(text) {
  const out = [];
  let inside = false;
  for (const line of text.split('\n')) {
    if (line === '```') inside = !inside;
    else if (inside) out.push(line);
  }
  assert.equal(inside, false, 'every block is closed');
  return out;
}

test("WhatsApp text: a salesman's week, exactly", () => {
  assert.equal(ria(summaryWorld(), 'this-week').text, [
    '*RIA · This week so far (Sat 31 Oct – Wed 4 Nov)*',
    '```',
    'New sites      2',
    'Sites worked   9',
    'Samples        1',
    'Quotes         2     1,000,000',
    'Won            2       510,000',
    'Lost           2',
    '```',
    '_Rs. logged, not invoiced_',
    '',
    '*Won*',
    '- F-11 Commercial Tower · Rs. 450,000 Cash',
    '- Admin Won · Rs. 60,000 Credit',
    '',
    '*Quotes given*',
    '- Bahria Villas · Rs. 800,000',
    '- Reopened · Rs. 200,000',
    '',
    '*Lost*',
    '- DHA Plaza · Price Too High',
    '- Won 29 Oct Lost 3 Nov · Site Delayed',
    '',
    '*Now, 4 Nov*',
    '```',
    'Hot sites      4     2,200,000',
    'Due in 7 days  3',
    'Late           2',
    'Going cold     1',
    '```',
    '',
    '*Hot sites*',
    '- Gulberg Heights · Rs. 1,200,000',
    '- Bahria Villas · Rs. 800,000',
    '- Reopened · Rs. 200,000',
    '- Askari Sample · Sample / Trial',
    '',
    '*Late & going cold*',
    '- Gulberg Heights · 2 days late · no update for 15 days',
    '- No Date Lead · no follow-up date',
  ].join('\n'));
});

test("WhatsApp text: a salesman's past week, without the Now part", () => {
  assert.equal(ria(summaryWorld(), 'last-week').text, [
    '*RIA · Last week (Sat 24 Oct – Fri 30 Oct)*',
    '```',
    'New sites      0',
    'Sites worked   3',
    'Samples        0',
    'Quotes         0',
    'Won            2       800,000',
    'Lost           0',
    '```',
    '_Rs. logged, not invoiced_',
    '',
    '*Won*',
    '- Repriced After · Rs. 500,000 Cash',
    '- Won 29 Oct Lost 3 Nov · Rs. 300,000 Cash',
  ].join('\n'));
});

test("WhatsApp text: a salesman's month, exactly", () => {
  assert.equal(ria(summaryWorld(), 'this-month').text, [
    '*RIA · November so far (1–4 Nov)*',
    '```',
    'New sites      1',
    'Sites worked   8',
    'Samples        0',
    'Quotes         2     1,000,000',
    'Won            2       510,000',
    'Lost           2',
    'Target  44% of 1,140,000',
    '```',
    '_Rs. logged, not invoiced_',
    '',
    '*Won*',
    '- F-11 Commercial Tower · Rs. 450,000 Cash',
    '- Admin Won · Rs. 60,000 Credit',
    '',
    '*Quotes given*',
    '- Bahria Villas · Rs. 800,000',
    '- Reopened · Rs. 200,000',
    '',
    '*Lost*',
    '- DHA Plaza · Price Too High',
    '- Won 29 Oct Lost 3 Nov · Site Delayed',
    '',
    '*Now, 4 Nov*',
    '```',
    'Hot sites      4     2,200,000',
    'Due in 7 days  3',
    'Late           2',
    'Going cold     1',
    '```',
    '',
    '*Hot sites*',
    '- Gulberg Heights · Rs. 1,200,000',
    '- Bahria Villas · Rs. 800,000',
    '- Reopened · Rs. 200,000',
    '- Askari Sample · Sample / Trial',
    '',
    '*Late & going cold*',
    '- Gulberg Heights · 2 days late · no update for 15 days',
    '- No Date Lead · no follow-up date',
  ].join('\n'));
});

test("WhatsApp text: a salesman's month on the 1st", () => {
  activityId = 0;
  const nov1 = pk(2026, 11, 1, 11);
  const w = world({
    sites: [site('S000001', 'RIA', 'First Day Win', { stage: WON, value_rs: 1234000, payment_terms: 'Credit', next_followup: '' })],
    activity: [
      act(pk(2026, 10, 31, 23, 59), 'RIA', 'S000001', 'stage_change', { from_stage: LEAD, to_stage: RQ, value_rs: 1234000, payment_terms: 'Credit' }),
      act(pk(2026, 11, 1, 0, 0), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 1234000, payment_terms: 'Credit' }),
    ],
  });
  assert.equal(ria(w, 'this-month', nov1).text, [
    '*RIA · November so far (1 Nov)*',
    '```',
    'New sites      0',
    'Sites worked   1',
    'Samples        0',
    'Quotes         0',
    'Won            1     1,234,000',
    'Lost           0',
    'Target 108% of 1,140,000',
    '```',
    '_Rs. logged, not invoiced_',
    '',
    '*Won*',
    '- First Day Win · Rs. 1,234,000 Credit',
    '',
    '*Now, 1 Nov*',
    '```',
    'Hot sites      0',
    'Due in 7 days  0',
    'Late           0',
    'Going cold     0',
    '```',
  ].join('\n'));
  assert.ok(ria(w, 'last-month', nov1).text.includes('\nQuotes         1     1,234,000\n'));
});

test('WhatsApp text: the team month, exactly (Won in millions, S10-4)', () => {
  assert.equal(team(summaryWorld(), 'this-month').text, [
    '*Team · November so far (1–4 Nov)*',
    '```',
    'New sites      3',
    'Sites worked  10',
    'Samples        0',
    'Quotes         3     1,777,000',
    'Won            4     1,080,000',
    'Lost           2',
    'Target  16% of 6,720,000',
    'House target         2,440,000',
    '```',
    '_Rs. logged, not invoiced_',
    '_House / office sales are not in the diary_',
    '',
    '```',
    'Name Worked Quotes    Won    %',
    'North     9      3  0.58M   27',
    'RIA       8      2  0.51M   44',
    'AUR       2      1  0.07M    5',
    'WAK       —      —      —    0',
    'Center    1      0   0.5M   22',
    'SH        1      0   0.5M   40',
    'SJ        —      —      —    0',
    'SM        —      —      —    0',
    'South     0      0      0    0',
    'IB        —      —      —    0',
    'Team     10      3  1.08M   16',
    'Not in list',
    'MUB       1      0      0    —',
    '```',
    '',
    '*Lost reasons (2)*',
    '- Price Too High · 1',
    '- Site Delayed · 1',
    '',
    '*Now, 4 Nov*',
    '```',
    'Hot sites      6     2,977,000',
    'Due in 7 days  3',
    'Late           2',
    'Going cold     1',
    '```',
  ].join('\n'));
});

test('WhatsApp text: monospace lines at most 30 characters, numbers and Rs. lined up, even for big amounts', () => {
  activityId = 0;
  const sites = [];
  const activity = [];
  for (let i = 1; i <= 10; i++) {
    const id = `S${String(i).padStart(6, '0')}`;
    sites.push(site(id, 'RIA', `Big ${i}`, { stage: WON, value_rs: 999999999, payment_terms: 'Cash', next_followup: '' }));
    activity.push(act(pk(2026, 11, 2), 'RIA', id, 'created', { to_stage: WON, value_rs: 999999999, payment_terms: 'Cash' }));
  }
  const w = world({ sites, activity });
  const texts = [];
  for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
    texts.push(ria(w, period).text, team(w, period).text, ria(summaryWorld(), period).text, team(summaryWorld(), period).text);
    texts.push(...team(summaryWorld(), period).salesmen.map((x) => x.text));
  }
  for (const text of texts) {
    for (const line of monoLines(text)) {
      assert.ok(line.length <= 30, `${line.length}: ${line}`);
      const row = /^([A-Z][a-z]+(?: [a-z0-9]+)*) +(\d+)( +[\d,]+)?$/.exec(line);
      if (!row || /^(Name|North|Center|South|Team)\b/.test(line)) continue;
      // A count row: the label from column 1, the count ending at column 16, Rs. ending at column 30.
      assert.ok(line.slice(0, 16).endsWith(row[2]) && line.slice(0, 13).trimEnd() === row[1], `count at column 16: ${line}`);
      if (row[3]) assert.ok(/^ +\d/.test(line.slice(16)), `a space before the Rs.: ${line}`);
      if (row[3]) assert.equal(line.length, 30, `Rs. at column 30: ${line}`);
    }
  }
  assert.ok(ria(w, 'this-week').text.includes('\nWon           10 9,999,999,990\n'), 'a 13-character amount still fits');
  assert.ok(team(w, 'this-month').text.includes('\nNorth    10      0 10000M 999+\n'), 'a huge % keeps its column');
});

test('WhatsApp text: extremes stay within 30 characters with a space between columns (long former code, 4-digit counts)', () => {
  activityId = 0;
  const sites = [];
  const activity = [];
  for (let i = 1; i <= 1000; i++) {
    const id = `S${String(i).padStart(6, '0')}`;
    sites.push(site(id, 'RIA', `Q${i}`, { stage: RQ, value_rs: 1000000, payment_terms: 'Cash' }));
    activity.push(act(pk(2026, 11, 2), 'RIA', id, 'created', { to_stage: RQ, value_rs: 1000000, payment_terms: 'Cash' }));
  }
  sites.push(site('S009001', 'MUHAMMAD-ALI', 'Former Long Code', { stage: WON, value_rs: 2450000, payment_terms: 'Cash', next_followup: '' }));
  activity.push(act(pk(2026, 11, 2), 'MUHAMMAD-ALI', 'S009001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 2450000, payment_terms: 'Cash' }));
  const w = world({ sites, activity });
  const texts = ['this-week', 'this-month'].flatMap((p) => [ria(w, p).text, team(w, p).text]);
  for (const text of texts) {
    for (const line of monoLines(text)) {
      assert.ok(line.length <= 30, `${line.length}: ${line}`);
      assert.ok(!/\d{4}\d|[a-z]\d|\d[A-Za-z]/.test(line.replace(/\d+(?:\.\d+)?M\b/g, 'm').replace(/<0\.01M/, 'm')) || /^Due in/.test(line),
        `columns apart: ${line}`);
    }
  }
  assert.ok(ria(w, 'this-week').text.includes('\nQuotes      1000 1,000,000,000\n'), 'a 4-digit count and a 13-character amount');
  assert.ok(ria(w, 'this-week').text.includes('\nSites worked 1000\n'));
  assert.ok(team(w, 'this-week').text.includes('\nMUHAMMAD- 1      0  2.45M    0\n'), 'the long code is cut short');
  assert.equal(w.s.targetMono_('2026-11', 1000000000, 99999999999), 'Target >999% of 1,000,000,000', 'a huge % keeps the line short');
  assert.equal(w.s.targetMono_('2026-11', 1000, 190), 'Target  19% of 1,000');
  assert.equal(w.s.monoRow_('Due in 7 days', 100), 'Due in 7 days 100', 'a 13-letter label keeps its space');
});

test('WhatsApp text: names can\'t switch on WhatsApp formatting (backticks, *, _, ~); the screen shows them as they are', () => {
  activityId = 0;
  const name = 'Tower ```x``` *Big* _new_ ~old~';
  const w = world({
    sites: [site('S000001', 'RIA', name, { stage: WON, value_rs: 100000, payment_terms: 'Cash', next_followup: '' }),
      site('S000002', 'RIA', '`Odd`', { stage: LOST, lost_reason: '*Too* dear', next_followup: '' })],
    activity: [act(pk(2026, 11, 2), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 100000, payment_terms: 'Cash' }),
      act(pk(2026, 11, 2), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: '*Too* dear' })],
  });
  const mine = ria(w, 'this-week');
  assert.ok(mine.text.includes("\n- Tower '''x''' ∗Big∗ ˍnewˍ ∼old∼ · Rs. 100,000 Cash\n"));
  assert.ok(mine.text.includes("\n- 'Odd' · ∗Too∗ dear"));
  assert.equal(mine.text.split('\n').filter((l) => l === '```').length % 2, 0);
  assert.ok(!mine.text.split('\n').some((l) => l !== '```' && l.includes('`')), 'no backtick outside the fences');
  assert.equal(lines(mine, 'Won')[0], `${name} · Cash | Rs. 100,000`, 'the screen: exactly as typed');
  assert.ok(team(w, 'this-week').text.includes('- ∗Too∗ dear · 1'));
});

test('team table: a salesman with nothing logged shows —, and in a month 0 for % when he has a target', () => {
  const tabs = metaDataTabs();
  tabs['Rep-Targets'] = tabs['Rep-Targets'].filter((r) => !(r[0] === 'IB' && r[1] instanceof Date && r[1].getTime() === pk(2026, 11, 1, 0).getTime()));
  const w = world({ metaTabs: tabs, sites: summarySites(), activity: summaryActivity() });
  assert.equal(teamRow(team(w, 'this-month'), 'WAK'), 'WAK | — | — | — | 0', 'a target, nothing logged: 0% is information');
  assert.equal(teamRow(team(w, 'this-month'), 'IB'), 'IB | — | — | — | —', 'no target');
  assert.equal(teamRow(team(w, 'this-week'), 'WAK'), 'WAK | — | — | — | —', 'a week: all —');
});

test('WhatsApp text: the team table columns end at characters 11, 18, 25 and 30', () => {
  for (const period of ['this-week', 'this-month']) {
    const lines = monoLines(team(summaryWorld(), period).text).filter((l) => /^(Name|North|Center|South|Team|RIA|AUR|WAK|SH|SJ|SM|IB|MUB) /.test(l) &&
      !/^(New|Sites|Samples|Quotes|Won|Lost)/.test(l));
    assert.equal(lines.length, 13, period);
    for (const line of lines) {
      for (const edge of [11, 18, 25, 30]) assert.ok(line[edge - 1] !== ' ' && (line[edge] === ' ' || line[edge] === undefined), `${edge}: ${line}`);
    }
  }
});

test('millions (owner S10-4): 2 decimals, trailing zeros dropped; 0 and under Rs. 5,000', () => {
  const { s } = world();
  const m = (n) => s.millions_(n);
  assert.deepEqual([2450000, 1500000, 250000, 6100000, 0, 4999, 5000, 1, 12345678, 999999999].map(m),
    ['2.45M', '1.5M', '0.25M', '6.1M', '0', '<0.01M', '0.01M', '<0.01M', '12.35M', '1000M']);
});

test("the admin's view of a salesman: exactly his summary plus his days logged", () => {
  const w = summaryWorld();
  for (const period of ['this-week', 'last-month']) {
    const his = ria(w, period);
    const view = team(w, period).salesmen.find((x) => x.rep === 'RIA');
    const withDays = his.text.split('\n');
    assert.ok(withDays[3].startsWith('Sites worked'), period);
    withDays.splice(4, 0, 'Days logged    5');
    assert.equal(view.text, withDays.join('\n'), period);
    assert.equal(view.title, `RIA · ${his.title}`);
    assert.equal(view.logged, 'Logged on 5 days');
    const { title, logged, text, rep, ...parts } = view;
    const { title: t2, text: x2, ...hisParts } = his;
    assert.deepEqual(bare(parts), bare(Object.fromEntries(Object.entries(hisParts).filter(([key]) => !['ok', 'period', 'at'].includes(key)))),
      'the same tiles, target, tables and NOW (their lists: see spec 011 below)');
    assert.ok(!his.text.includes('Days logged') && his.logged === undefined, 'never on his own summary (S9-9)');
  }
});

test('named lists: up to 10, biggest Rs. first, then "+ N more"; an empty list is left out', () => {
  activityId = 0;
  const sites = [];
  const activity = [];
  for (let i = 1; i <= 13; i++) {
    const id = `S${String(i).padStart(6, '0')}`;
    sites.push(site(id, 'RIA', `Quote ${i}`, { stage: RQ, value_rs: i * 100000, payment_terms: 'Cash' }));
    activity.push(act(pk(2026, 11, 2), 'RIA', id, 'created', { to_stage: RQ, value_rs: i * 100000, payment_terms: 'Cash' }));
  }
  const summary = ria(world({ sites, activity }), 'this-week');
  const quotes = lines(summary, 'Quotes given');
  assert.equal(quotes.length, 11);
  assert.deepEqual([quotes[0], quotes[9], quotes[10]], ['Quote 13 | Rs. 1,300,000', 'Quote 4 | Rs. 400,000', '+ 3 more']);
  assert.equal(summary.tables.find((x) => x.h === 'Quotes given').n, '13', 'the count in the top row: all of them');
  assert.ok(summary.text.includes('*Quotes given*\n- Quote 13 · Rs. 1,300,000\n') && summary.text.includes('- Quote 4 · Rs. 400,000\n+ 3 more'));
  assert.equal(lines(summary, 'Won'), null, 'no Won table when nothing was won');
  assert.equal(lines(summary, 'Lost'), null);
  assert.ok(!summary.text.includes('*Won*'));
});

// --------------------------------------------------------------------- Privacy (ADR-0004)

test("privacy: RIA's summary holds nothing of AUR's, MUB's or SH's, and no team or region figures", () => {
  const w = summaryWorld();
  for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
    const json = JSON.stringify(ria(w, period));
    for (const other of ['AUR', 'Handed Over', 'AUR Secret Tower', '777', '70,000', '70000', 'MUB', 'Former Salesman Site', 'SH Mall',
      'North', 'Center', 'South', 'Team', 'House', 'UNASSIGNED', 'salesmen', 'logged on', 'Logged on',
      w.s.formatRs_(fakeTarget('AUR', '2026-11')), w.s.formatRs_(fakeTarget('North', '2026-11'))]) {
      assert.ok(!json.includes(other), `${period}: ${other}`);
    }
    assert.deepEqual(Object.keys(ria(w, period)).filter((key) => key !== 'target').sort(),
      ['at', 'now', 'ok', 'period', 'sub', 'tables', 'text', 'tiles', 'title']);
  }
  // Hot sites and late counts are his own: AUR's open quote is not in them.
  assert.equal(lines(ria(w, 'this-week'), 'now')[0], 'Hot sites | 4 · Rs. 2,200,000');
});

test('privacy: AUR sees only his own, through his own link', () => {
  const w = summaryWorld();
  const his = plain(w.s.repSummaryFor_(w.diary, 'AUR', 'this-week', NOW));
  assert.ok(his.text.startsWith('*AUR · This week so far'));
  for (const other of ['RIA', 'F-11 Commercial Tower', 'Bahria Villas', 'DHA Plaza', 'Gulberg Heights', 'Admin Won', 'SH Mall']) {
    assert.ok(!JSON.stringify(his).includes(other), other);
  }
  assert.deepEqual(lines(his, 'Won'), ['Handed Over · Cash | Rs. 70,000'], 'a row by RIA on his site now: his result, no name of who wrote it');
});

test('repSummary and adminPageSummary refuse junk (no sheet opened), cancelled and wrong-kind codes', () => {
  const w = summaryWorld();
  for (const k of ['hello', undefined, null, 42, RIA.toUpperCase(), `${ADMIN}a`, '']) {
    assert.equal(thrown(() => w.s.repSummary(k, 'this-week')), NO_LINK, String(k));
    assert.equal(thrown(() => w.s.adminPageSummary(k, 'this-week')), NO_LINK, String(k));
  }
  assert.deepEqual(w.opened, []);
  for (const k of [OLD_RIA, ADMIN, OLD_ADMIN]) assert.equal(thrown(() => w.s.repSummary(k, 'this-week')), NO_LINK);
  for (const k of [RIA, AUR, OLD_ADMIN, OLD_RIA]) assert.equal(thrown(() => w.s.adminPageSummary(k, 'this-week')), NO_LINK);
  for (const bad of ['next-week', '', null, 7, { toString: () => 'this-week' }]) {
    assert.equal(thrown(() => w.s.repSummary(RIA, bad)), TRY_AGAIN, String(bad));
    assert.equal(thrown(() => w.s.adminPageSummary(ADMIN, bad)), TRY_AGAIN, String(bad));
  }
  assert.deepEqual(w.diary._writes(), []);
});

test('the public functions: a reply with no Dates and no link code; Google failing is "Something went wrong"', () => {
  const w = summaryWorld();
  for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
    const mine = w.s.repSummary(RIA, period);
    const all = w.s.adminPageSummary(ADMIN, period);
    assert.equal(mine.ok, true);
    assert.match(mine.at, /^\d\d:\d\d$/);
    assert.ok(mine.text.startsWith('*RIA · '));
    assert.ok(all.text.startsWith('*Team · '));
    const json = JSON.stringify([mine, all]);
    for (const code of [RIA, AUR, ADMIN, OLD_ADMIN, OLD_RIA]) assert.ok(!json.includes(code));
    const hasDate = (x) => (x && typeof x === 'object' ? Object.prototype.toString.call(x) === '[object Date]' ||
      Object.values(x).some(hasDate) : false);
    assert.equal(hasDate(mine) || hasDate(all), false, 'no Dates (Google drops them from replies)');
  }
  w.diary.getSheetByName('Activity').getRange(1, 2).setValues([['when']]); // a header renamed by hand
  assert.equal(thrown(() => w.s.repSummary(RIA, 'this-week')), TRY_AGAIN);
  assert.equal(thrown(() => w.s.adminPageSummary(ADMIN, 'this-week')), TRY_AGAIN);
});

// -------------------------------------------------------------------------------------- Speed

function speedWorld() {
  // Built around the real clock, since the public functions use it: 5,000 rows from before last
  // month, 40 from last month, nothing this month.
  const probe = world();
  const start = probe.s.summaryPeriod_('last-month', new Date()).start;
  activityId = 0;
  const activity = [];
  for (let i = 0; i < 5000; i++) activity.push(act(new Date(start - 20 * 24 * 60 * 60 * 1000), 'RIA', 'S000001', 'update', { note: 'old' }));
  for (let i = 0; i < 40; i++) activity.push(act(new Date(start + 60 * 60 * 1000), 'RIA', 'S000001', 'update', { note: 'last month' }));
  return world({ sites: [site('S000001', 'RIA', 'Busy Site')], activity });
}

test('speed: each summary opens Sales Diary once, reads Sites once, never Activity whole; no Meta-Data; writes nothing', () => {
  const w = speedWorld();
  w.s.repLoad(RIA); // the first call of the day reads Meta-Data and keeps it
  const tabs = ['Links', 'Sites', 'Activity', 'Lists'];
  const sheet = (t) => w.diary.getSheetByName(t);
  for (const [name, call] of [['repSummary', (p) => w.s.repSummary(RIA, p)], ['adminPageSummary', (p) => w.s.adminPageSummary(ADMIN, p)]]) {
    for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
      const reads = tabs.map((t) => sheet(t)._reads);
      const rows = sheet('Activity')._rowsRead;
      const props = JSON.stringify([...w.props._store]);
      const cache = w.cache._store.size;
      const lockEvents = w.lock._events.length;
      w.opened.length = 0;
      const r = call(period);
      assert.equal(r.ok, true);
      const what = `${name} ${period}`;
      assert.deepEqual(w.opened, ['diary'], what);
      assert.deepEqual(tabs.map((t, i) => sheet(t)._reads - reads[i]), [1, 1, 0, 0], `${what}: Links, Sites once; Activity never whole; no Lists`);
      assert.equal(sheet('Activity')._rowsRead - rows, 501, `${what}: the header and one block of 500 from the bottom`);
      assert.deepEqual(w.diary._writes(), [], what);
      assert.equal(JSON.stringify([...w.props._store]), props, `${what}: nothing kept`);
      assert.equal(w.cache._store.size, cache);
      assert.equal(w.lock._events.length, lockEvents, `${what}: no lock`);
    }
  }
  assert.equal(w.s.repSummary(RIA, 'last-month').tiles[1].n, '1', 'the 40 rows of last month were read');
  assert.equal(w.s.repSummary(RIA, 'this-month').tiles[1].n, '0');
});

test('speed: a long period is read in blocks from the bottom until it reaches a row from before it', () => {
  const w = speedWorld();
  activityId = 9000;
  const sheet = w.diary.getSheetByName('Activity');
  const now = new Date();
  const rows = [];
  for (let i = 0; i < 1200; i++) rows.push(act(new Date(now.getTime() - 1000), 'RIA', 'S000001', 'update', { note: 'this month' }));
  w.s.appendRows_(sheet, rows);
  const before = sheet._rowsRead;
  const moves = w.s.activitySince_(w.diary, w.s.summaryPeriod_('last-month', now).start);
  assert.equal(moves.length, 1240);
  assert.equal(sheet._rowsRead - before, 1501, 'the header and 3 blocks of 500');
});

test('a row a few seconds out of time order at a block edge never hides a row of the period (skew margin)', () => {
  // Saves take Google's time before waiting for the lock, so a save timed Fri 23:59:59 can land
  // after one timed Sat 00:00:01. Here it lands as the top row of the bottom block of 500.
  activityId = 0;
  const activity = [];
  for (let i = 0; i < 100; i++) activity.push(act(pk(2026, 9, 1), 'RIA', 'S000002', 'update', { note: 'long ago' }));
  activity.push(act(new Date(pk(2026, 10, 31, 0, 0).getTime() + 1000), 'RIA', 'S000001',
    'stage_change', { from_stage: LEAD, to_stage: RQ, value_rs: 250000, payment_terms: 'Cash' }));
  activity.push(act(new Date(pk(2026, 10, 31, 0, 0).getTime() - 1000), 'RIA', 'S000002', 'update', { note: 'Friday 23:59:59, landed late' }));
  for (let i = 0; i < 499; i++) activity.push(act(pk(2026, 11, 2), 'RIA', 'S000002', 'update', { note: 'this week' }));
  const w = world({ sites: [site('S000001', 'RIA', 'Saturday Quote', { stage: RQ, value_rs: 250000, payment_terms: 'Cash' }),
    site('S000002', 'RIA', 'Busy Lead')], activity });
  const sheet = w.diary.getSheetByName('Activity');
  assert.equal(sheet.getLastRow(), 602);
  const before = sheet._rowsRead;
  assert.deepEqual(lines(ria(w, 'this-week'), 'Quotes given'), ['Saturday Quote | Rs. 250,000'], 'the Sat 00:00:01 quote is counted');
  assert.equal(sheet._rowsRead - before, 1 + 500 + 101, 'one more block, read because the stop row was inside the margin');
  const n = numbers(w, ['RIA'], 'last-week');
  assert.deepEqual([n.worked, n.quotes], [1, 0], 'the Friday row counts last week, never this week');
});

// ------------------------------------------------------- Spec 011: tappable summaries

/** Every tappable part of a summary: [where, count, list] for the six tiles and the four NOW rows. */
const tappable = (summary, where) => [
  ...summary.tiles.map((t) => [`${where} ${t.l}`, Number(t.n), t]),
  ...summary.now.rows.map((r) => [`${where} now ${r.c[0]}`, Number(r.c[1].split(' ')[0]), r]),
];
/** Every site ID a summary sends: its lists and its named rows. */
const sentIds = (summary) => [...summary.tiles, ...summary.now.rows].flatMap((x) => x.ids)
  .concat([...summary.tables, ...(summary.now.tables || [])].flatMap((t) => t.rows.map((r) => r.id).filter(Boolean)));

test('spec 011: every tile and NOW row lists exactly what it counts (cards + "+ N" = the number), all periods, every view', () => {
  const w = summaryWorld();
  for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
    const t = team(w, period);
    const views = [['RIA own', ria(w, period)], ['team', t], ...t.salesmen.map((x) => [x.rep, x]), ...t.regions.map((x) => [x.reg, x])];
    for (const [who, view] of views) {
      for (const [where, count, list] of tappable(view, `${period} ${who}`)) {
        assert.equal(list.ids.length + (list.x || 0), count, where);
        assert.equal(new Set(list.ids).size, list.ids.length, `${where}: each site once`);
        if (list.p) assert.equal(list.p.length, list.ids.length, `${where}: a period line per site`);
        assert.ok(list.lh.startsWith(view.title) || list.lh.startsWith(`${view.title.split(' · ')[0]} · Now, 4 Nov · `)
          || list.lh.startsWith('Now, 4 Nov · '), `${where}: ${list.lh}`);
      }
    }
  }
});

test('spec 011: list order, headings and the period lines (as counted, not as the card is now)', () => {
  const w = summaryWorld();
  const week = ria(w, 'this-week');
  const tile = (s, l) => s.tiles.find((x) => x.l === l);
  assert.deepEqual(plain(tile(week, 'Won')), { n: '2', l: 'Won', c: 'won', rs: 'Rs. 510,000', lh: 'This week so far · Won',
    ids: ['S000001', 'S000011'], p: ['Won Rs. 450,000 · Cash', 'Won Rs. 60,000 · Credit'] });
  assert.deepEqual(plain(tile(week, 'Quotes')).p, ['Quoted Rs. 800,000', 'Quoted Rs. 200,000'], 'biggest first');
  assert.deepEqual(plain(tile(week, 'Lost')).p, ['Lost · Price Too High', 'Lost · Site Delayed']);
  assert.deepEqual(plain(tile(week, 'Sites worked')).ids, ['S000007', 'S000002', 'S000001', 'S000008', 'S000006', 'S000003', 'S000005'],
    'other lists: the card\'s Rs. biggest first, then soonest follow-up');
  const october = plain(tile(ria(w, 'last-month'), 'Won'));
  assert.deepEqual([october.ids, october.p], [['S000007', 'S000006'], ['Won Rs. 500,000 · Cash', 'Won Rs. 300,000 · Cash']],
    'Repriced After shows the Rs. it was won at in October (its card now says 999,000); Won 29 Oct Lost 3 Nov is October\'s win');
  assert.deepEqual(plain(week.now.rows).map((r) => [r.lh, r.ids]), [
    ['Now, 4 Nov · Hot sites', ['S000004', 'S000002', 'S000008', 'S000005']],
    ['Now, 4 Nov · Follow-ups next 7 days', ['S000002', 'S000008', 'S000005']],
    ['Now, 4 Nov · Late', ['S000004', 'S000016']],
    ['Now, 4 Nov · Going cold', ['S000004']],
  ]);
  const t = team(w, 'this-week');
  assert.equal(tile(t, 'Won').lh, 'Team · This week so far · Won');
  assert.equal(t.now.rows[2].lh, 'Team · Now, 4 Nov · Late');
  assert.equal(t.salesmen[0].now.rows[2].lh, 'RIA · Now, 4 Nov · Late');
  assert.deepEqual(plain(week.tables.find((x) => x.h === 'Won').rows.map((r) => r.id)), ['S000001', 'S000011'], 'named rows open their site');
  assert.deepEqual(plain(week.now.tables.map((x) => x.rows.map((r) => r.id))), [['S000004', 'S000002', 'S000008', 'S000005'], ['S000004', 'S000016']]);
});

test('spec 011 privacy: his own summary never sends a site that is no longer his; the admin\'s view shows it', () => {
  const w = summaryWorld();
  // This week RIA worked S000010 (now AUR's: handed over) and created S000099 (its row deleted by hand).
  const mine = ria(w, 'this-week');
  const worked = mine.tiles.find((x) => x.l === 'Sites worked');
  assert.deepEqual([worked.n, worked.ids.length, worked.x], ['9', 7, 2], '+ 2 no longer in your list');
  assert.deepEqual([mine.tiles[0].n, mine.tiles[0].ids, mine.tiles[0].x], ['2', ['S000005'], 1]);
  const his = new Set(summarySites().filter((r) => r[1] === 'RIA').map((r) => r[0]));
  for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
    const r = ria(w, period);
    for (const id of sentIds(r)) assert.ok(his.has(id), `${period}: ${id} is his`);
    const json = JSON.stringify(r);
    for (const other of ['S000010', 'S000012', 'S000013', 'S000014', 'S000099', '"cards"', '"regions"']) assert.ok(!json.includes(other), `${period}: ${other}`);
  }
  const view = team(w, 'this-week').salesmen.find((x) => x.rep === 'RIA').tiles.find((x) => x.l === 'Sites worked');
  assert.deepEqual([view.ids.length, view.x], [8, 1], 'the admin sees the handed-over site (with AUR on its card); only the deleted one is "+ 1"');
  assert.ok(view.ids.includes('S000010'));
});

test('spec 011: a region\'s summary is built as a salesman\'s, for its current salesmen, and equals its team-table row', () => {
  const w = summaryWorld();
  for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
    const t = team(w, period);
    assert.deepEqual(t.regions.map((x) => x.reg), ['North', 'Center', 'South']);
    for (const region of t.regions) {
      const row = t.tables[0].rows.find((r) => r.reg === region.reg);
      assert.equal(row.k, 'reg');
      const n = (l) => region.tiles.find((x) => x.l === l).n;
      assert.deepEqual([row.c[1], row.c[2]], [n('Sites worked'), n('Quotes')], `${period} ${region.reg}`);
      if (!period.endsWith('month')) assert.equal(row.c[4], n('Lost'), `${period} ${region.reg}`);
      assert.equal(region.title, `${region.reg} · ${t.title.replace('Team · ', '')}`);
      assert.ok(region.text.startsWith(`*${region.reg} · `), 'its own WhatsApp text');
      assert.equal(region.logged, undefined, 'no "Logged on"');
    }
  }
  const north = team(w, 'this-month').regions[0];
  const numbersNorth = numbers(w, ['RIA', 'AUR', 'WAK'], 'this-month');
  assert.deepEqual(north.tiles.map((x) => Number(x.n)), [numbersNorth.created, numbersNorth.worked, numbersNorth.samples,
    numbersNorth.quotes, numbersNorth.won, numbersNorth.lost]);
  assert.deepEqual(plain(north.target), { h: 'Target', pct: Math.floor(numbersNorth.wonRs * 100 / fakeTarget('North', '2026-11')),
    won: `Won ${w.s.formatRs_(numbersNorth.wonRs)}`, of: `of ${w.s.formatRs_(fakeTarget('North', '2026-11'))}` }, 'the region\'s target');
  assert.equal(north.now.rows[0].c[1], '5 · Rs. 2,977,000', 'NOW: open sites of its salesmen (AUR Secret Tower too), never MUB\'s');
  assert.deepEqual(plain(north.now.tables[0].rows.map((r) => r.c[0])), ['Gulberg Heights', 'Bahria Villas', 'AUR Secret Tower', 'Reopened',
    'Askari Sample'], 'named, as a salesman\'s');
  assert.ok(!team(w, 'this-month').regions[1].now.rows[0].ids.includes('S000013'), 'Center: MUB has left, so his site is in no region');
});

test('spec 011: the admin\'s reply carries the cards of listed sites now at Won / Lost (with their day), and sites newer than his page', () => {
  const w = summaryWorld();
  const t = team(w, 'last-month');
  assert.deepEqual(plain(t.cards.map((c) => [c.id, c.rep, c.region, c.stage, c.closed])), [
    ['S000007', 'RIA', 'North', WON, '2026-10-28'], ['S000006', 'RIA', 'North', LOST, '2026-11-03']]);
  assert.equal(t.cards[0].name, 'Repriced After');
  assert.equal(t.cards[0].value, 999000, 'the card as it is now');
  const week = team(w, 'this-week');
  assert.ok(week.cards.every((c) => [WON, LOST].includes(c.stage)), 'open sites are on his page already');
  assert.equal(week.cards.find((c) => c.id === 'S000007').closed, '', 'won before the rows read: no day');
  assert.equal(week.cards.find((c) => c.id === 'S000010').rep, 'AUR');
  const fresh = plain(w.s.teamSummaryFor_(w.diary, 'this-week', NOW, LONG_AGO.getTime() - 1));
  assert.ok(fresh.cards.some((c) => c.id === 'S000002' && c.closed === ''), 'added after his page loaded: its card comes too');
  assert.deepEqual(plain(w.s.teamSummaryFor_(w.diary, 'this-week', NOW, NOW.getTime()).cards.map((c) => c.id)), ['S000007'],
    'a page loaded today holds the sites closed this month before today: only the one won before the rows read comes');
  assert.deepEqual(plain(w.s.teamSummaryFor_(w.diary, 'this-week', NOW, pk(2026, 11, 3, 8).getTime()).cards.map((c) => c.id)).sort(),
    ['S000003', 'S000006', 'S000007', 'S000011'], 'loaded on 3 Nov: what closed on 3 Nov comes too (the same day: it may be after)');
  assert.equal(plain(w.s.teamSummaryFor_(w.diary, 'this-week', NOW, 'junk')).cards.length, week.cards.length, 'a junk time is ignored');
  assert.equal(ria(w, 'this-week').cards, undefined, 'never on a salesman\'s');
});

test('spec 011: the admin\'s summary reply for three times a busy month stays under 150 KB', () => {
  // About three times the live sheet as it is filling up: 450 sites of 7 salesmen added over two
  // months (two thirds moved on to Sample / Trial, Rate Quoted, Won or Lost), 2,400 Updates of open
  // sites this month by their own salesmen; long names and notes. Late November, his page loaded 10
  // minutes ago.
  activityId = 0;
  const now = pk(2026, 11, 27, 18);
  const reps = ['RIA', 'AUR', 'WAK', 'SH', 'SJ', 'SM', 'IB'];
  const stages = [LEAD, LEAD, SAMPLE, RQ, WON, LOST];
  const sites = [];
  const activity = [];
  const idOf = (i) => `S${String(i).padStart(6, '0')}`;
  for (let i = 1; i <= 450; i++) {
    const stage = stages[i % stages.length];
    const rep = reps[i % reps.length];
    const money = [RQ, WON].includes(stage);
    const added = new Date(pk(2026, 10, 1).getTime() + Math.floor(i * 56 / 450) * 86400000);
    const moved = new Date(Math.min(added.getTime() + 5 * 86400000, now.getTime() - 3600000));
    sites.push(site(idOf(i), rep, `Site ${i} Defence Housing Authority Phase ${i % 8} Commercial Block`, {
      stage, value_rs: money ? i * 10000 : '', payment_terms: money ? 'Cash' : '', lost_reason: stage === LOST ? 'Price Too High' : '',
      next_followup: [WON, LOST].includes(stage) ? '' : day(2026, 11, 15 + (i % 20)), worked_at: moved,
      last_note: 'Met the site engineer, he wants a sample of the tile adhesive next week', created_at: added }));
    activity.push(act(added, rep, idOf(i), 'created', { to_stage: LEAD }));
    if (stage !== LEAD) {
      activity.push(act(moved, rep, idOf(i), 'stage_change', { from_stage: LEAD, to_stage: stage, value_rs: money ? i * 10000 : '',
        payment_terms: money ? 'Cash' : '', lost_reason: stage === LOST ? 'Price Too High' : '' }));
    }
  }
  const open = sites.filter((r) => ![WON, LOST].includes(r[9])).map((r) => r[0]);
  for (let i = 0; i < 2400; i++) {
    const id = open[(i * 7) % open.length];
    activity.push(act(new Date(pk(2026, 11, 1).getTime() + i * 15 * 60 * 1000), reps[Number(id.slice(1)) % 7], id, 'update', { note: 'called' }));
  }
  activity.sort((a, b) => a[1] - b[1]);
  const w = world({ sites, activity });
  for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
    const size = Buffer.byteLength(JSON.stringify(w.s.teamSummaryFor_(w.diary, period, now, now.getTime() - 10 * 60 * 1000)));
    assert.ok(size <= 150 * 1024, `${period}: ${size} bytes`);
  }
});

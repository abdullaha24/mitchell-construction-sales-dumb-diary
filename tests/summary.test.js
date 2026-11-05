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
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at'];
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
const lines = (summary, h) => (summary.blocks.find((b) => b.h === h) || { lines: null }).lines;

// ---------------------------------------------------------------------------------- Periods

test('periods: a week is Saturday 00:00 to Friday 23:59 in Pakistan time; months from the 1st', () => {
  const { s } = world();
  const p = (period, now) => plain(s.summaryPeriod_(period, now));
  // Wednesday 4 Nov: the week crosses two months.
  assert.deepEqual(p('this-week', NOW), { key: 'this-week', running: true, start: pk(2026, 10, 31, 0).getTime(),
    end: pk(2026, 11, 7, 0).getTime(), month: '', title: 'This week so far · Sat 31 Oct – Wed 4 Nov', today: '2026-11-04' });
  assert.deepEqual(p('last-week', NOW), { key: 'last-week', running: false, start: pk(2026, 10, 24, 0).getTime(),
    end: pk(2026, 10, 31, 0).getTime(), month: '', title: 'Last week · Sat 24 Oct – Fri 30 Oct', today: '2026-11-04' });
  assert.deepEqual(p('this-month', NOW), { key: 'this-month', running: true, start: pk(2026, 11, 1, 0).getTime(),
    end: pk(2026, 12, 1, 0).getTime(), month: '2026-11', title: 'November so far · 1–4 Nov', today: '2026-11-04' });
  assert.deepEqual(p('last-month', NOW), { key: 'last-month', running: false, start: pk(2026, 10, 1, 0).getTime(),
    end: pk(2026, 11, 1, 0).getTime(), month: '2026-10', title: 'October', today: '2026-11-04' });
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
  assert.deepEqual(lines(ria(w, 'this-week'), 'Quotes given'), ['• Requoted · Rs. 400,000']);
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
    assert.deepEqual(lines(ria(w, period), 'Won'), ['• Rs Fixed By Hand · Rs. 650,000 Cash'], period);
  }
  const screen = plain(w.s.adminDataFor_(w.diary, [], NOW));
  assert.deepEqual(screen.sites.filter((c) => c.closed).map((c) => [c.name, c.value]), [['Rs Fixed By Hand', 650000]], 'as the This month tab');
  assert.deepEqual(lines(ria(w, 'last-week', pk(2026, 11, 9)), 'Won'), ['• Rs Fixed By Hand · Rs. 600,000 Cash',
    '• Reopened By Hand · Rs. 300,000 Cash'], 'a finished week: as it ended');
});

test('won / lost last week and last month: as the period ended (S9-14)', () => {
  const w = summaryWorld();
  const oct = numbers(w, ['RIA'], 'last-month');
  assert.deepEqual([oct.won, oct.wonRs, oct.lost], [2, 800000, 0]);
  assert.deepEqual(oct.wonNames, ['Repriced After', 'Won 29 Oct Lost 3 Nov'], 'won 29 Oct, lost 3 Nov: won in October');
  assert.ok(numbers(w, ['RIA'], 'this-month').lostNames.includes('Won 29 Oct Lost 3 Nov'), '...and lost in November');
  assert.deepEqual(lines(ria(w, 'last-week'), 'Won'), ['• Repriced After · Rs. 500,000 Cash', '• Won 29 Oct Lost 3 Nov · Rs. 300,000 Cash'],
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
  assert.deepEqual(lines(summary, 'Won'), ['• Corrected · Rs. 120,000 Credit', '• Won Twice · Rs. 80,000 Cash', '• Admin Moved · Rs. 40,000 Credit']);
  assert.deepEqual(lines(summary, 'Lost'), ['• Lost Then Reopened · Credit Terms']);
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
  assert.ok(!t.text.toLowerCase().includes('admin ·'), 'no line for the admin');
  assert.deepEqual(lines(t, 'Not in the salesmen list'), ['MUB · worked 1 · quotes 0 · won 0 · lost 0 · logged on 2 days']);
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
  assert.deepEqual(lines(t, 'All salesmen'), ['New sites 4 · Sites worked 11', 'Samples given 1 · Quotes given 3 · Rs. 1,777,000',
    'Won 4 · Rs. 1,080,000 · Lost 2', '(Rs. logged, not invoiced)']);
  assert.deepEqual(lines(t, 'North'), ['New sites 3 · Sites worked 10', 'Samples given 1 · Quotes given 3 · Rs. 1,777,000',
    'Won 3 · Rs. 580,000 · Lost 2']);
  assert.equal(lines(t, 'House / office sales'), null, 'a week has no targets');
  assert.ok(!JSON.stringify(t).includes('Former Salesman Site'));
});

test('team regions come from Rep_Mapping, never from Sites.region', () => {
  const sites = summarySites().map((row) => row.slice());
  sites.forEach((row) => { if (row[0] === 'S000001') row[2] = 'South'; }); // a stale region cell
  const w = world({ sites, activity: summaryActivity() });
  const t = team(w, 'this-week');
  assert.equal(lines(t, 'South')[2], 'Won 0 · Lost 0');
  assert.equal(lines(t, 'North')[2], 'Won 3 · Rs. 580,000 · Lost 2');
});

test('team side by side: Rep_Mapping order, "nothing logged", lost reasons most first', () => {
  const w = summaryWorld();
  const t = team(w, 'this-week');
  assert.deepEqual(t.blocks.find((b) => b.h === 'Salesmen'), {
    h: 'Salesmen', reps: ['RIA', 'AUR', 'WAK', 'SH', 'SJ', 'SM', 'IB'], lines: [
      'RIA · worked 9 · quotes 2 · Rs. 1,000,000 · won 2 · Rs. 510,000 · lost 2 · logged on 5 days',
      'AUR · worked 2 · quotes 1 · Rs. 777,000 · won 1 · Rs. 70,000 · lost 0 · logged on 2 days',
      'WAK · nothing logged',
      'SH · worked 1 · quotes 0 · won 1 · Rs. 500,000 · lost 0 · logged on 1 day',
      'SJ · nothing logged', 'SM · nothing logged', 'IB · nothing logged',
    ],
  });
  assert.deepEqual(lines(t, 'Lost reasons'), ['Lost 2: Price Too High 1 · Site Delayed 1']);
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
  assert.deepEqual(lines(t, 'Lost reasons'), ['Lost 6: Price Too High 3 · Competitor Approved 1 · Other 1 · Site Delayed 1']);
  assert.equal(lines(t, 'All salesmen')[2], 'Won 0 · Lost 6', 'the same Lost count as All salesmen');
  assert.deepEqual(lines(t, 'Not in the salesmen list'), ['MUB · worked 1 · quotes 0 · won 0 · lost 1 · logged on 1 day'],
    'the former code\'s loss is on his own line');
});

// ------------------------------------------------------------------------------ Targets, %

test('month targets and %: this month and last month; weeks none; no target means no %', () => {
  const w = summaryWorld();
  assert.equal(lines(ria(w, 'this-month'), '')[4], `November target Rs. 1,140,000 · Won Rs. 510,000 (44%)`);
  assert.equal(fakeTarget('RIA', '2026-11'), 1140000);
  assert.equal(lines(ria(w, 'last-month'), '')[4], `October target Rs. 1,130,000 · Won Rs. 800,000 (70%)`);
  for (const period of ['this-week', 'last-week']) {
    assert.ok(!ria(w, period).text.includes('target'), period);
    assert.ok(!team(w, period).text.includes('target'), period);
  }
  const tabs = metaDataTabs();
  tabs['Rep-Targets'] = tabs['Rep-Targets'].filter((r) => !(r[0] === 'RIA' && r[1] instanceof Date && r[1].getTime() === pk(2026, 11, 1, 0).getTime()));
  const none = world({ metaTabs: tabs, sites: summarySites(), activity: summaryActivity() });
  assert.equal(lines(ria(none, 'this-month'), '')[4], 'No target for November');
  assert.ok(!ria(none, 'this-month').text.includes('%'));
  assert.ok(team(none, 'this-month').blocks.find((b) => b.h === 'Salesmen').lines[0].endsWith('logged on 4 days'), 'no % of target');
});

test('team month: target = North + Center + South; house / office target for the admin only', () => {
  const w = summaryWorld();
  const t = team(w, 'this-month');
  const teamTarget = fakeTarget('North', '2026-11') + fakeTarget('Center', '2026-11') + fakeTarget('South', '2026-11');
  assert.equal(teamTarget, 6720000);
  assert.equal(lines(t, 'All salesmen')[4], 'November target Rs. 6,720,000 · Won Rs. 1,080,000 (16%)');
  assert.deepEqual(lines(t, 'House / office sales'), ['November target Rs. 2,440,000 · Not logged in the diary.']);
  assert.equal(lines(t, 'North')[3], 'November target Rs. 2,140,000 · Won Rs. 580,000 (27%)');
  const oct = team(w, 'last-month');
  assert.deepEqual(lines(oct, 'House / office sales'), [`October target ${w.s.formatRs_(fakeTarget('UNASSIGNED', '2026-10'))} · Not logged in the diary.`]);
  for (const period of ['this-month', 'last-month']) {
    const json = JSON.stringify(ria(w, period));
    assert.ok(!json.includes('House') && !json.includes(w.s.formatRs_(fakeTarget('UNASSIGNED', '2026-11'))) &&
      !json.includes(w.s.formatRs_(teamTarget)), 'never on a salesman\'s summary');
  }
  const tabs = metaDataTabs();
  tabs.Targets = [tabs.Targets[0]];
  const none = team(world({ metaTabs: tabs, sites: summarySites(), activity: summaryActivity() }), 'this-month');
  assert.equal(lines(none, 'All salesmen')[4], 'No target for November');
  assert.deepEqual(lines(none, 'House / office sales'), ['No target for November · Not logged in the diary.']);
});

// ------------------------------------------------------------------------- Coming up, late

test('Coming up: Hot Pipeline order (Rs. biggest, then soonest follow-up, then newest); top 5; due in 7 days', () => {
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
  const coming = lines(ria(world({ sites }), 'this-week'), 'Coming up');
  assert.deepEqual(coming, ['Hot sites 6 · Rs. 1,900,000 quoted', '• Quote Big · Rate Quoted · Rs. 900,000',
    '• Quote Late Date · Rate Quoted · Rs. 500,000', '• Quote Soon Date · Rate Quoted · Rs. 500,000', '• Sample Soon · Sample / Trial',
    '• Sample New · Sample / Trial', 'Follow-ups due in the next 7 days: 6'],
    'due: today 4 Nov to 10 Nov (not 11 Nov, not the Won site)');
});

test('Late & going cold: the Late & cold tab\'s counts; the 3 biggest by Rs.; nothing: one line', () => {
  const w = summaryWorld();
  const screen = plain(w.s.adminDataFor_(w.diary, [], NOW));
  const today = '2026-11-04';
  const open = screen.sites.filter((c) => ![WON, LOST].includes(c.stage));
  const late = open.filter((c) => !c.followUp || c.followUp < today).length;
  const cold = open.filter((c) => [SAMPLE, RQ].includes(c.stage) && w.s.daysBetween_(c.worked, today) >= 7).length;
  assert.deepEqual(lines(team(w, 'this-week'), 'Late & going cold'), [`Late ${late} · Going cold ${cold}`]);
  assert.deepEqual([late, cold], [2, 1]);
  const sites = [
    site('S000001', 'RIA', 'Small Late', { stage: RQ, value_rs: 100000, payment_terms: 'Cash', next_followup: day(2026, 11, 3) }),
    site('S000002', 'RIA', 'Big Cold', { stage: RQ, value_rs: 900000, payment_terms: 'Cash', worked_at: pk(2026, 10, 26) }),
    site('S000003', 'RIA', 'Mid Late', { stage: RQ, value_rs: 500000, payment_terms: 'Cash', next_followup: day(2026, 10, 30) }),
    site('S000004', 'RIA', 'Lead Late', { next_followup: day(2026, 11, 3) }),
  ];
  assert.deepEqual(lines(ria(world({ sites }), 'this-week'), 'Late & going cold'), ['Late 3 · Going cold 1',
    '• Big Cold · Rate Quoted · Rs. 900,000 · no update for 9 days', '• Mid Late · Rate Quoted · Rs. 500,000 · 5 days late',
    '• Small Late · Rate Quoted · Rs. 100,000 · 1 day late']);
  assert.deepEqual(lines(ria(world({ sites: [site('S000001', 'RIA', 'Fine')] }), 'this-week'), 'Late & going cold'),
    ['Nothing late or going cold.']);
});

test('Now parts: on screen under every button, headed "Now, <today>"; left out of past periods\' text (S9-15)', () => {
  const w = summaryWorld();
  for (const period of ['this-week', 'last-week', 'this-month', 'last-month']) {
    const summary = ria(w, period);
    const heads = summary.blocks.filter((b) => b.now).map((b) => b.h);
    assert.deepEqual(heads, ['Now, 4 Nov', 'Coming up', 'Late & going cold'], period);
    const inText = summary.text.includes('*Coming up*') && summary.text.includes('*Late & going cold*') && summary.text.includes('*Now, 4 Nov*');
    assert.equal(inText, period.startsWith('this'), period);
    assert.equal(team(w, period).text.includes('*Coming up*'), period.startsWith('this'), `team ${period}`);
  }
});

// ------------------------------------------------------------------------- The WhatsApp text

test("WhatsApp text: a salesman's week, exactly", () => {
  assert.equal(ria(summaryWorld(), 'this-week').text, [
    '*RIA · This week so far · Sat 31 Oct – Wed 4 Nov*',
    'New sites 2 · Sites worked 9',
    'Samples given 1 · Quotes given 2 · Rs. 1,000,000',
    'Won 2 · Rs. 510,000 · Lost 2',
    '(Rs. logged, not invoiced)',
    '',
    '*Won*',
    '• F-11 Commercial Tower · Rs. 450,000 Cash',
    '• Admin Won · Rs. 60,000 Credit',
    '',
    '*Quotes given*',
    '• Bahria Villas · Rs. 800,000',
    '• Reopened · Rs. 200,000',
    '',
    '*Lost*',
    '• DHA Plaza · Price Too High',
    '• Won 29 Oct Lost 3 Nov · Site Delayed',
    '',
    '*Now, 4 Nov*',
    '*Coming up*',
    'Hot sites 4 · Rs. 2,200,000 quoted',
    '• Gulberg Heights · Rate Quoted · Rs. 1,200,000',
    '• Bahria Villas · Rate Quoted · Rs. 800,000',
    '• Reopened · Rate Quoted · Rs. 200,000',
    '• Askari Sample · Sample / Trial',
    'Follow-ups due in the next 7 days: 3',
    '',
    '*Late & going cold*',
    'Late 2 · Going cold 1',
    '• Gulberg Heights · Rate Quoted · Rs. 1,200,000 · 2 days late · no update for 15 days',
    '• No Date Lead · Visited / Lead · no follow-up date',
  ].join('\n'));
});

test("WhatsApp text: a salesman's past week, without the Now parts", () => {
  assert.equal(ria(summaryWorld(), 'last-week').text, [
    '*RIA · Last week · Sat 24 Oct – Fri 30 Oct*',
    'New sites 0 · Sites worked 3',
    'Samples given 0 · Quotes given 0',
    'Won 2 · Rs. 800,000 · Lost 0',
    '(Rs. logged, not invoiced)',
    '',
    '*Won*',
    '• Repriced After · Rs. 500,000 Cash',
    '• Won 29 Oct Lost 3 Nov · Rs. 300,000 Cash',
  ].join('\n'));
});

test("WhatsApp text: a salesman's month, exactly", () => {
  const text = ria(summaryWorld(), 'this-month').text.split('\n');
  assert.deepEqual(text.slice(0, 7), [
    '*RIA · November so far · 1–4 Nov*',
    'New sites 1 · Sites worked 8',
    'Samples given 0 · Quotes given 2 · Rs. 1,000,000',
    'Won 2 · Rs. 510,000 · Lost 2',
    '(Rs. logged, not invoiced)',
    'November target Rs. 1,140,000 · Won Rs. 510,000 (44%)',
    '',
  ]);
  assert.deepEqual(text.slice(7), ria(summaryWorld(), 'this-week').text.split('\n').slice(6), 'the same named sites and Now parts');
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
    '*RIA · November so far · 1 Nov*',
    'New sites 0 · Sites worked 1',
    'Samples given 0 · Quotes given 0',
    'Won 1 · Rs. 1,234,000 · Lost 0',
    '(Rs. logged, not invoiced)',
    'November target Rs. 1,140,000 · Won Rs. 1,234,000 (108%)',
    '',
    '*Won*',
    '• First Day Win · Rs. 1,234,000 Credit',
    '',
    '*Now, 1 Nov*',
    '*Coming up*',
    'Hot sites 0',
    'Follow-ups due in the next 7 days: 0',
    '',
    '*Late & going cold*',
    'Nothing late or going cold.',
  ].join('\n'));
  assert.equal(ria(w, 'last-month', nov1).text.split('\n')[2], 'Samples given 0 · Quotes given 1 · Rs. 1,234,000');
});

test('WhatsApp text: the team month, exactly', () => {
  assert.equal(team(summaryWorld(), 'this-month').text, [
    '*Team · November so far · 1–4 Nov*',
    '*All salesmen*',
    'New sites 3 · Sites worked 10',
    'Samples given 0 · Quotes given 3 · Rs. 1,777,000',
    'Won 4 · Rs. 1,080,000 · Lost 2',
    '(Rs. logged, not invoiced)',
    'November target Rs. 6,720,000 · Won Rs. 1,080,000 (16%)',
    '',
    '*House / office sales*',
    'November target Rs. 2,440,000 · Not logged in the diary.',
    '',
    '*North*',
    'New sites 2 · Sites worked 9',
    'Samples given 0 · Quotes given 3 · Rs. 1,777,000',
    'Won 3 · Rs. 580,000 · Lost 2',
    'November target Rs. 2,140,000 · Won Rs. 580,000 (27%)',
    '',
    '*Center*',
    'New sites 1 · Sites worked 1',
    'Samples given 0 · Quotes given 0',
    'Won 1 · Rs. 500,000 · Lost 0',
    'November target Rs. 2,240,000 · Won Rs. 500,000 (22%)',
    '',
    '*South*',
    'New sites 0 · Sites worked 0',
    'Samples given 0 · Quotes given 0',
    'Won 0 · Lost 0',
    'November target Rs. 2,340,000 · Won Rs. 0 (0%)',
    '',
    '*Salesmen*',
    'RIA · worked 8 · quotes 2 · Rs. 1,000,000 · won 2 · Rs. 510,000 · lost 2 · logged on 4 days · 44% of target',
    'AUR · worked 2 · quotes 1 · Rs. 777,000 · won 1 · Rs. 70,000 · lost 0 · logged on 2 days · 5% of target',
    'WAK · nothing logged',
    'SH · worked 1 · quotes 0 · won 1 · Rs. 500,000 · lost 0 · logged on 1 day · 40% of target',
    'SJ · nothing logged',
    'SM · nothing logged',
    'IB · nothing logged',
    '',
    '*Not in the salesmen list*',
    'MUB · worked 1 · quotes 0 · won 0 · lost 0 · logged on 2 days',
    '',
    '*Lost reasons*',
    'Lost 2: Price Too High 1 · Site Delayed 1',
    '',
    '*Now, 4 Nov*',
    '*Coming up*',
    'Hot sites 6 · Rs. 2,977,000 quoted',
    'Follow-ups due in the next 7 days: 3',
    '',
    '*Late & going cold*',
    'Late 2 · Going cold 1',
  ].join('\n'));
});

test("the admin's view of a salesman: exactly his summary plus his days logged", () => {
  const w = summaryWorld();
  for (const period of ['this-week', 'last-month']) {
    const his = ria(w, period);
    const view = team(w, period).salesmen.find((x) => x.rep === 'RIA');
    const withDays = his.text.split('\n');
    withDays.splice(2, 0, `Logged on ${period === 'this-week' ? 5 : 5} days`);
    assert.equal(view.text, withDays.join('\n'), period);
    assert.equal(view.title, `RIA · ${his.title}`);
    assert.ok(!his.text.includes('Logged on'), 'never on his own summary (S9-9)');
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
  assert.deepEqual([quotes[0], quotes[9], quotes[10]], ['• Quote 13 · Rs. 1,300,000', '• Quote 4 · Rs. 400,000', '+ 3 more']);
  assert.equal(lines(summary, 'Won'), null, 'no Won heading when nothing was won');
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
    assert.deepEqual(Object.keys(ria(w, period)).sort(), ['at', 'blocks', 'ok', 'period', 'text', 'title']);
  }
  // Hot sites and late counts are his own: AUR's open quote is not in them.
  assert.equal(lines(ria(w, 'this-week'), 'Coming up')[0], 'Hot sites 4 · Rs. 2,200,000 quoted');
});

test('privacy: AUR sees only his own, through his own link', () => {
  const w = summaryWorld();
  const his = plain(w.s.repSummaryFor_(w.diary, 'AUR', 'this-week', NOW));
  assert.ok(his.text.startsWith('*AUR · This week so far'));
  for (const other of ['RIA', 'F-11 Commercial Tower', 'Bahria Villas', 'DHA Plaza', 'Gulberg Heights', 'Admin Won', 'SH Mall']) {
    assert.ok(!JSON.stringify(his).includes(other), other);
  }
  assert.deepEqual(lines(his, 'Won'), ['• Handed Over · Rs. 70,000 Cash'], 'a row by RIA on his site now: his result, no name of who wrote it');
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
  assert.ok(w.s.repSummary(RIA, 'last-month').text.includes('Sites worked 1'), 'the 40 rows of last month were read');
  assert.ok(w.s.repSummary(RIA, 'this-month').text.includes('Sites worked 0'));
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
  assert.deepEqual(lines(ria(w, 'this-week'), 'Quotes given'), ['• Saturday Quote · Rs. 250,000'], 'the Sat 00:00:01 quote is counted');
  assert.equal(sheet._rowsRead - before, 1 + 500 + 101, 'one more block, read because the stop row was inside the margin');
  const n = numbers(w, ['RIA'], 'last-week');
  assert.deepEqual([n.worked, n.quotes], [1, 0], 'the Friday row counts last week, never this week');
});

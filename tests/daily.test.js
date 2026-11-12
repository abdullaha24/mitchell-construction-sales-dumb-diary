'use strict';
// Spec 012: the Daily message (one day of a region's work, as WhatsApp text for the region's group).
// The day (default, limits, Pakistan midnight), every count, the exact text, privacy (ADR-0012) and
// what it costs. Names and amounts are made up.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSrc, plain, SRC_DIR } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeCacheService,
  makePropertiesService, makeHtmlService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'earlier_contacts'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const LINKS = ['role', 'rep', 'token', 'active', 'issued_at'];
const RIA = 'a'.repeat(64);
const SH = 'b'.repeat(64);
const ADMIN = 'c'.repeat(64);
const OLD_ADMIN = 'd'.repeat(64); // a cancelled admin link
const OLD_RIA = 'f'.repeat(64); // a cancelled link of RIA's
const NO_LINK = "This link doesn't work. Ask the admin for a new one.";
const TRY_AGAIN = 'Something went wrong. Try again in a minute.';

/** A moment in Pakistan time (UTC+5, no daylight saving). */
const pk = (y, m, d, h = 12, min = 0, s = 0) => new Date(Date.UTC(y, m - 1, d, h - 5, min, s));
// The day most tests look at: Wednesday 11 November 2026. "Now": Thursday 12 November, 10:00.
const D = [2026, 11, 11];
const at = (h, min = 0) => pk(...D, h, min);
const NOW = pk(2026, 11, 12, 10);
const LONG_AGO = pk(2026, 8, 10);

const LEAD = 'Visited / Lead';
const SAMPLE = 'Sample / Trial';
const RQ = 'Rate Quoted';
const WON = 'Won (Order)';
const LOST = 'Lost / Dead';

const site = (id, rep, name, extra = {}) => SITES.map((h) => ({
  site_id: id, rep, region: { SH: 'Center', SJ: 'Center', SM: 'Center', IB: 'South' }[rep] || 'North', site_name: name,
  buyer_type: 'Dealer', area: 'Secret Area', contact_name: 'Contact Asif', contact_phone: '923001234567', products: 'Tile Adhesives',
  stage: LEAD, next_followup: pk(2026, 11, 20, 0), last_note: 'site note', created_at: LONG_AGO, updated_at: LONG_AGO, worked_at: LONG_AGO,
  ...extra,
})[h] ?? '');
let activityId = 0;
const act = (when, rep, siteId, action, extra = {}) => ACTIVITY.map((h) => ({
  activity_id: `A${String(++activityId).padStart(7, '0')}`, timestamp: when, rep, site_id: siteId, action, ...extra,
})[h] ?? '');

function world({ sites = [], activity = [], metaTabs = metaDataTabs() } = {}) {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, ...sites],
    Activity: [ACTIVITY, ...activity],
    Lists: lists,
    Links: [LINKS, ['owner', '', OLD_ADMIN, false, LONG_AGO], ['rep', 'RIA', OLD_RIA, false, LONG_AGO], ['rep', 'RIA', RIA, true, LONG_AGO],
      ['rep', 'SH', SH, true, LONG_AGO], ['owner', '', ADMIN, true, LONG_AGO]],
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
/** The reply for a day at NOW (or `now`). */
const daily = (w, day = '2026-11-11', now = NOW) => plain(w.s.dailyFor_(w.diary, day, now));
/** One region's text. */
const textOf = (w, region, day, now) => daily(w, day, now).regions.find((r) => r.region === region).text;
/** One salesman's block (his lines), from a region's text. */
const blockOf = (text, rep) => {
  const block = text.split('\n\n').find((b) => b.startsWith(`*${rep}* · `));
  return block ? block.split('\n') : null;
};

// ------------------------------------------------------------------------------------- The day

test('the default day is the last working day: yesterday, or Saturday when yesterday was Sunday', () => {
  const { s } = world();
  // Week of Mon 9 Nov 2026 to Sun 15 Nov 2026.
  const cases = [
    ['2026-11-09', '2026-11-07', 'Monday → Saturday'],
    ['2026-11-10', '2026-11-09', 'Tuesday → Monday'],
    ['2026-11-11', '2026-11-10', 'Wednesday → Tuesday'],
    ['2026-11-12', '2026-11-11', 'Thursday → Wednesday'],
    ['2026-11-13', '2026-11-12', 'Friday → Thursday'],
    ['2026-11-14', '2026-11-13', 'Saturday → Friday'],
    ['2026-11-15', '2026-11-14', 'Sunday → Saturday'],
    ['2026-12-01', '2026-11-30', 'the 1st of a month (a Tuesday) → the last of the month before'],
    ['2027-03-01', '2027-02-27', 'the 1st of a month on a Monday → the Saturday of the month before'],
    ['2027-01-01', '2026-12-31', '1 January → 31 December'],
    ['2024-01-01', '2023-12-30', '1 January on a Monday → Saturday 30 December'],
  ];
  for (const [today, want, why] of cases) assert.equal(s.dailyDay_('', today), want, why);
  for (const [today, want, why] of cases.slice(0, 7)) {
    const [y, m, d] = today.split('-').map(Number);
    for (const hour of [0, 9, 23]) {
      assert.equal(daily(world(), '', pk(y, m, d, hour, hour === 23 ? 59 : 0)).day, want, `${why} at ${hour}h`);
    }
  }
});

test('‹ goes back 31 days, › up to today; today is "(so far)"; Sundays can be shown', () => {
  const w = world();
  const r = daily(w, '2026-11-11');
  assert.deepEqual([r.day, r.prev, r.next], ['2026-11-11', '2026-11-10', '2026-11-12']);
  const today = daily(w, '2026-11-12');
  assert.deepEqual([today.day, today.prev, today.next], ['2026-11-12', '2026-11-11', ''], 'no › on today');
  assert.ok(today.regions.every((x) => x.text.startsWith(`*${x.region} · Thu 12 Nov (so far)*\n`)));
  assert.ok(r.regions.every((x) => x.text.startsWith(`*${x.region} · Wed 11 Nov*\n`)), 'a finished day: no "(so far)"');
  const first = daily(w, '2026-10-12');
  assert.deepEqual([first.day, first.prev, first.next], ['2026-10-12', '', '2026-10-13'], '31 days back: no ‹');
  assert.equal(daily(w, '2026-10-13').prev, '2026-10-12');
  assert.equal(daily(w, '2026-11-08').regions[0].text.split('\n')[0], '*North · Sun 8 Nov*', 'a Sunday');
  assert.equal(daily(w, '2026-11-01').regions[0].text.split('\n')[0], '*North · Sun 1 Nov*');
  const newYear = plain(w.s.dailyFor_(w.diary, '', pk(2027, 1, 1, 9)));
  assert.deepEqual([newYear.day, newYear.prev, newYear.next], ['2026-12-31', '2026-12-30', '2027-01-01']);
  assert.equal(newYear.regions[0].text.split('\n')[0], '*North · Thu 31 Dec*');
});

test('a bad day is refused with "Something went wrong", before Sites, Activity or Meta-Data are read', () => {
  const w = world({ sites: [site('S000001', 'RIA', 'Lead')] });
  for (const bad of ['2026-11-13', '2026-10-11', '2026-02-30', '2026-11-1', '2026-11-11T00:00', ' 2026-11-11', 'yesterday',
    undefined, null, 7, ['2026-11-11'], { toString: () => '2026-11-11' }]) {
    assert.equal(thrown(() => w.s.dailyFor_(w.diary, bad, NOW)), TRY_AGAIN, String(bad));
  }
  // Through the public function (the real clock): only the link check has read anything.
  const sheet = (t) => w.diary.getSheetByName(t);
  const before = ['Links', 'Sites', 'Activity'].map((t) => [sheet(t)._reads, sheet(t)._rowsRead]);
  for (const bad of ['2020-01-01', '9999-12-31', 'x', null]) {
    w.opened.length = 0;
    assert.equal(thrown(() => w.s.adminPageDaily(ADMIN, bad)), TRY_AGAIN, String(bad));
    assert.deepEqual(w.opened, ['diary'], 'no Meta-Data');
  }
  const after = ['Links', 'Sites', 'Activity'].map((t) => [sheet(t)._reads, sheet(t)._rowsRead]);
  assert.equal(after[0][0] - before[0][0], 4, 'Links read for each link check');
  assert.deepEqual(after.slice(1), before.slice(1), 'Sites and Activity untouched');
  assert.equal(w.props._store.size, 0, 'the kept copy was never asked for');
});

test('a row counts by its own Pakistan time: 00:00 and 23:59:59 are the day, 23:59 the day before and 00:00 the day after are not', () => {
  activityId = 0;
  const w = world({
    sites: ['S000001', 'S000002', 'S000003', 'S000004'].map((id, i) => site(id, 'RIA', `Edge ${i + 1}`)),
    activity: [
      act(pk(2026, 11, 10, 23, 59, 59), 'RIA', 'S000001', 'update', { note: 'the day before' }),
      act(pk(...D, 0, 0), 'RIA', 'S000002', 'update', { note: 'midnight' }),
      act(pk(...D, 23, 59, 59), 'RIA', 'S000003', 'update', { note: 'last second' }),
      act(pk(2026, 11, 12, 0, 0), 'RIA', 'S000004', 'update', { note: 'the day after' }),
    ],
  });
  assert.deepEqual(blockOf(textOf(w, 'North', '2026-11-11'), 'RIA'), ['*RIA* · 2 activities', 'Followed up: Edge 2, Edge 3']);
  assert.deepEqual(blockOf(textOf(w, 'North', '2026-11-10'), 'RIA'), ['*RIA* · 1 activity', 'Followed up: Edge 1']);
  assert.deepEqual(blockOf(textOf(w, 'North', '2026-11-12'), 'RIA'), ['*RIA* · 1 activity', 'Followed up: Edge 4']);
});

// --------------------------------------------------------------------------------- The counts

test('activity = different sites with a created, stage_change or update row; snoozes, Edit details and contact rows never count', () => {
  activityId = 0;
  const w = world({
    sites: [site('S000001', 'RIA', 'Worked Twice'), site('S000002', 'RIA', 'Snoozed Only'), site('S000003', 'RIA', 'Details Only'),
      site('S000004', 'RIA', 'Contact Only')],
    activity: [
      act(at(9), 'RIA', 'S000001', 'update', { note: 'one' }),
      act(at(10), 'RIA', 'S000001', 'update', { note: 'two' }),
      act(at(11), 'RIA', 'S000002', 'snooze', { next_followup: pk(2026, 11, 14, 0) }),
      act(at(12), 'RIA', 'S000003', 'details', { note: 'Area' }),
      act(at(13), 'RIA', 'S000004', 'contact', { note: 'New contact: Someone' }),
    ],
  });
  const text = textOf(w, 'North');
  assert.deepEqual(blockOf(text, 'RIA'), ['*RIA* · 1 activity', 'Followed up: Worked Twice']);
  assert.equal(text.split('\n')[1], '1 activity');
  for (const name of ['Snoozed Only', 'Details Only', 'Contact Only']) assert.ok(!text.includes(name), name);

  activityId = 0;
  const idle = world({ sites: [site('S000002', 'RIA', 'Snoozed Only')],
    activity: [act(at(11), 'RIA', 'S000002', 'snooze', {}), act(at(12), 'RIA', 'S000002', 'details', {}), act(at(13), 'RIA', 'S000002', 'contact', {})] });
  assert.deepEqual(blockOf(textOf(idle, 'North'), 'RIA'), ['*RIA* · no activity'], 'only snoozes and changes: no activity');
  assert.equal(textOf(idle, 'North').split('\n')[1], 'No activity');
});

test('New, Sample given and Quoted: added that day, and moved to Sample / Trial or Rate Quoted (created there or a stage change)', () => {
  activityId = 0;
  const w = world({
    sites: [site('S000001', 'RIA', 'Added Lead'), site('S000002', 'RIA', 'Added Quoted'), site('S000003', 'RIA', 'Added Sample'),
      site('S000004', 'RIA', 'Moved To Sample'), site('S000005', 'RIA', 'Moved To Quote'), site('S000006', 'RIA', 'Quote Repriced', { stage: RQ })],
    activity: [
      act(at(9), 'RIA', 'S000001', 'created', { to_stage: LEAD }),
      act(at(9, 10), 'RIA', 'S000002', 'created', { to_stage: RQ, value_rs: 650000, payment_terms: 'Credit' }),
      act(at(9, 20), 'RIA', 'S000003', 'created', { to_stage: SAMPLE }),
      act(at(9, 30), 'RIA', 'S000004', 'stage_change', { from_stage: LEAD, to_stage: SAMPLE }),
      act(at(9, 40), 'RIA', 'S000005', 'stage_change', { from_stage: SAMPLE, to_stage: RQ, value_rs: 90000, payment_terms: 'Cash' }),
      act(at(9, 50), 'RIA', 'S000006', 'update', { value_rs: 88000, payment_terms: 'Cash', note: 'new price' }),
    ],
  });
  assert.deepEqual(blockOf(textOf(w, 'North'), 'RIA'), [
    '*RIA* · 6 activities',
    'Quoted: Added Quoted, Moved To Quote',
    'Sample given: Added Sample, Moved To Sample',
    'New: Added Lead, Added Quoted, Added Sample',
    'Followed up: Quote Repriced',
  ], 'a changed Rs. at the same stage is Followed up, never Quoted again');
  assert.equal(textOf(w, 'North').split('\n')[1], '6 activities · New 3 · Sample given 2 · Quoted 2');
});

test('Won and Lost as the day ended: won then reopened is not Won; won twice once; Rs. and reason the last of the day', () => {
  activityId = 0;
  const w = world({
    sites: [site('S000001', 'RIA', 'Won Then Reopened', { stage: RQ, value_rs: 50000 }),
      site('S000002', 'RIA', 'Won Twice', { stage: WON, value_rs: 70000 }),
      site('S000003', 'RIA', 'Repriced Win', { stage: WON, value_rs: 999000 }),
      site('S000004', 'RIA', 'Lost Twice', { stage: LOST, lost_reason: 'Other' }),
      site('S000005', 'RIA', 'Won Then Lost', { stage: LOST, lost_reason: 'Site Delayed' }),
      site('S000006', 'RIA', 'Lost Then Reopened', { stage: LEAD })],
    activity: [
      act(at(9), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 50000, payment_terms: 'Cash' }),
      act(at(9, 5), 'RIA', 'S000001', 'stage_change', { from_stage: WON, to_stage: RQ, value_rs: 50000, payment_terms: 'Cash' }),
      act(at(9, 10), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 60000, payment_terms: 'Cash' }),
      act(at(9, 15), 'RIA', 'S000002', 'stage_change', { from_stage: WON, to_stage: RQ, value_rs: 60000, payment_terms: 'Cash' }),
      act(at(9, 20), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 70000, payment_terms: 'Cash' }),
      act(at(9, 30), 'RIA', 'S000003', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 100000, payment_terms: 'Cash' }),
      act(at(9, 35), 'RIA', 'S000003', 'update', { value_rs: 120000, payment_terms: 'Credit', note: 'corrected' }),
      act(at(9, 40), 'RIA', 'S000004', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Price Too High' }),
      act(at(9, 45), 'RIA', 'S000004', 'stage_change', { from_stage: LOST, to_stage: RQ, value_rs: 1000 }),
      act(at(9, 50), 'RIA', 'S000004', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Other' }),
      act(at(10), 'RIA', 'S000005', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 40000 }),
      act(at(10, 5), 'RIA', 'S000005', 'stage_change', { from_stage: WON, to_stage: LOST, lost_reason: 'Site Delayed' }),
      act(at(10, 10), 'RIA', 'S000006', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Price Too High' }),
      act(at(10, 15), 'RIA', 'S000006', 'stage_change', { from_stage: LOST, to_stage: LEAD }),
    ],
  });
  const text = textOf(w, 'North');
  assert.deepEqual(blockOf(text, 'RIA'), [
    '*RIA* · 6 activities',
    'Won: Repriced Win Rs. 120,000, Won Twice Rs. 70,000',
    'Lost: Lost Twice (Other), Won Then Lost (Site Delayed)',
    // Moved to Rate Quoted that day (as the summaries count it, spec 009), whatever came after.
    'Quoted: Won Then Reopened, Won Twice, Lost Twice',
    'Followed up: Lost Then Reopened',
  ]);
  assert.equal(text.split('\n')[1], '6 activities · Quoted 3 · Won 2 Rs. 190,000 · Lost 2');
});

test('Followed up: every other site he worked (not named in Won / Lost / Quoted / Sample given / New); a stage moved back is Followed up', () => {
  activityId = 0;
  const w = world({
    sites: [site('S000001', 'RIA', 'Quoted And Updated'), site('S000002', 'RIA', 'Moved Back'), site('S000003', 'RIA', 'New And Called'),
      site('S000004', 'RIA', 'Won And Noted'), site('S000005', 'RIA', 'Only Called')],
    activity: [
      act(at(9), 'RIA', 'S000001', 'stage_change', { from_stage: LEAD, to_stage: RQ, value_rs: 1000 }),
      act(at(9, 5), 'RIA', 'S000001', 'update', { note: 'sent rates' }),
      act(at(9, 10), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: LEAD }),
      act(at(9, 20), 'RIA', 'S000003', 'created', { to_stage: LEAD }),
      act(at(9, 25), 'RIA', 'S000003', 'update', { note: 'called back' }),
      act(at(9, 30), 'RIA', 'S000004', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 5000 }),
      act(at(9, 35), 'RIA', 'S000004', 'update', { note: 'thanks' }),
      act(at(9, 40), 'RIA', 'S000005', 'update', { next_followup: pk(2026, 11, 13, 0) }),
    ],
  });
  assert.deepEqual(blockOf(textOf(w, 'North'), 'RIA'), [
    '*RIA* · 5 activities',
    'Won: Won And Noted Rs. 5,000',
    'Quoted: Quoted And Updated',
    'New: New And Called',
    'Followed up: Moved Back, Only Called',
  ]);
});

test("work counts for whoever saved it: the admin's rows and a former salesman's never show; a handed-over site counts for the worker", () => {
  activityId = 0;
  const w = world({
    sites: [site('S000001', 'AUR', 'Handed To AUR'), site('S000002', 'RIA', 'Admin Touched', { stage: WON, value_rs: 1000 }),
      site('S000003', 'MUB', 'Former Salesman Site'), site('S000004', 'RIA', 'RIA Own')],
    activity: [
      act(at(9), 'RIA', 'S000001', 'update', { note: 'before the handover' }),
      act(at(9, 10), 'admin', 'S000002', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 1000, note: 'Admin: done' }),
      act(at(9, 20), 'admin', 'S000004', 'update', { note: 'Admin: checked' }),
      act(at(9, 30), 'MUB', 'S000003', 'created', { to_stage: LEAD }),
      act(at(9, 40), 'MUB', 'S000004', 'update', { note: 'old code' }),
    ],
  });
  const north = textOf(w, 'North');
  assert.deepEqual(blockOf(north, 'RIA'), ['*RIA* · 1 activity', 'Followed up: Handed To AUR']);
  assert.deepEqual(blockOf(north, 'AUR'), ['*AUR* · no activity'], 'the site is his now, but RIA did the work');
  assert.equal(north.split('\n')[1], '1 activity');
  const all = daily(w).regions.map((r) => r.text).join('\n');
  for (const absent of ['Admin Touched', 'MUB', 'Former Salesman Site', 'admin', 'Admin']) assert.ok(!all.includes(absent), absent);
});

test('a site deleted from Sites by hand shows as "(not in the sheet)"; a site with no name shows its ID', () => {
  activityId = 0;
  const w = world({
    sites: [site('S000002', 'RIA', '')],
    activity: [
      act(at(9), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 25000 }),
      act(at(9, 10), 'RIA', 'S000002', 'update', { note: 'x' }),
      act(at(9, 20), 'RIA', '', 'update', { note: 'no site' }),
    ],
  });
  assert.deepEqual(blockOf(textOf(w, 'North'), 'RIA'), ['*RIA* · 2 activities', 'Won: (not in the sheet) Rs. 25,000', 'Followed up: S000002']);
});

test('Won / Lost is decided per site by its final move that day, by anyone: an undone win is nobody\'s Won and leaks no Rs.', () => {
  activityId = 0;
  const w = world({
    sites: [site('S000001', 'RIA', 'Admin Reopened', { stage: RQ, value_rs: 777000, payment_terms: 'Credit' }),
      site('S000002', 'AUR', 'AUR Reopened', { stage: RQ, value_rs: 888000, payment_terms: 'Cash' }),
      site('S000003', 'RIA', 'Admin Won', { stage: WON, value_rs: 555000, payment_terms: 'Cash' }),
      site('S000004', 'RIA', 'Admin Lost', { stage: LOST, lost_reason: 'Other' })],
    activity: [
      // RIA wins; the admin moves it back to Rate Quoted at a new quote.
      act(at(10), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 500000, payment_terms: 'Cash' }),
      act(at(11), 'admin', 'S000001', 'stage_change', { from_stage: WON, to_stage: RQ, value_rs: 777000, payment_terms: 'Credit',
        note: 'Admin: not won yet' }),
      // RIA wins; AUR (it is his now) moves it back to Rate Quoted at a new quote.
      act(at(12), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 600000, payment_terms: 'Cash' }),
      act(at(15), 'AUR', 'S000002', 'stage_change', { from_stage: WON, to_stage: RQ, value_rs: 888000, payment_terms: 'Cash' }),
      // RIA quotes; the admin marks it Won / Lost.
      act(at(13), 'RIA', 'S000003', 'stage_change', { from_stage: LEAD, to_stage: RQ, value_rs: 555000 }),
      act(at(14), 'admin', 'S000003', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 555000, payment_terms: 'Cash' }),
      act(at(16), 'RIA', 'S000004', 'update', { note: 'still hoping' }),
      act(at(17), 'admin', 'S000004', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Other' }),
    ],
  });
  const north = textOf(w, 'North');
  assert.deepEqual(blockOf(north, 'RIA'), ['*RIA* · 4 activities', 'Quoted: Admin Won', 'Followed up: Admin Reopened, AUR Reopened, Admin Lost']);
  assert.deepEqual(blockOf(north, 'AUR'), ['*AUR* · 1 activity', 'Quoted: AUR Reopened']);
  assert.equal(north.split('\n')[1], '5 activities · Quoted 2', 'nobody Won or Lost');
  for (const never of ['Won:', 'Lost:', '· Won', '· Lost', 'Rs.', '777', '888', '555', '500,000', '600,000', 'Other']) assert.ok(!north.includes(never), never);
});

test("the lost reason: the last saved that day, else the site's own", () => {
  activityId = 0;
  const w = world({
    sites: [site('S000001', 'RIA', 'Reason Today', { stage: LOST, lost_reason: 'Old Reason' }),
      site('S000002', 'RIA', 'Reason Typed By Hand', { stage: LOST, lost_reason: 'Site Delayed' }),
      site('S000003', 'RIA', 'No Reason Anywhere', { stage: LOST })],
    activity: [
      act(at(9), 'RIA', 'S000001', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Price Too High' }),
      act(at(10), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: LOST }),
      act(at(11), 'RIA', 'S000003', 'stage_change', { from_stage: RQ, to_stage: LOST }),
    ],
  });
  assert.deepEqual(blockOf(textOf(w, 'North'), 'RIA'), ['*RIA* · 3 activities',
    'Lost: Reason Today (Price Too High), Reason Typed By Hand (Site Delayed), No Reason Anywhere']);
});

test('a line break or run of spaces typed by hand in a name, reason or code becomes one space', () => {
  activityId = 0;
  const tabs = metaDataTabs();
  const w = world({
    metaTabs: tabs,
    sites: [site('S000001', 'RIA', '  Al   Noor\nBuilders\r\n '), site('S000002', 'RIA', 'Tab\tName', { stage: LOST, lost_reason: 'Price\n\nToo  High' }),
      site('S000003', 'RIA', 'Won\nSite', { stage: WON, value_rs: 1000 })],
    activity: [
      act(at(9), 'RIA', 'S000001', 'update', { note: 'x' }),
      act(at(10), 'RIA', 'S000002', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Price\n\nToo  High' }),
      act(at(11), 'RIA', 'S000003', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 1000 }),
    ],
  });
  const text = textOf(w, 'North');
  assert.deepEqual(blockOf(text, 'RIA'), ['*RIA* · 3 activities', 'Won: Won Site Rs. 1,000', 'Lost: Tab Name (Price Too High)',
    'Followed up: Al Noor Builders']);
  assert.ok(!/[\r\t]| {2}/.test(text), 'no tab, carriage return or double space');
  assert.equal(w.s.dailySafe_(' A\n*B*_ '), 'A ∗B∗ˍ');
});

// ----------------------------------------------------------------------------- The exact text

function textWorld() {
  activityId = 0;
  return world({
    sites: [
      site('S000001', 'RIA', 'Al Noor Builders', { contact_name: 'Haji Rafiq', contact_phone: '923331112222', area: 'Bahria Phase 7' }),
      site('S000002', 'RIA', 'Gulberg Heights', { stage: RQ, value_rs: 650000, payment_terms: 'Credit' }),
      site('S000003', 'RIA', 'DHA Plaza', { stage: LOST, value_rs: 600000, payment_terms: 'Cash', lost_reason: 'Price Too High' }),
      site('S000004', 'RIA', 'Askari Homes', { stage: WON, value_rs: 42250, payment_terms: 'Cash' }),
      site('S000005', 'RIA', 'Metro *Plaza*_x ~y~ `z`', { stage: WON, value_rs: 187000, payment_terms: 'Credit' }),
      site('S000006', 'RIA', 'Bahria Villas'),
      site('S000007', 'RIA', 'Sample Site', { stage: SAMPLE }),
      site('S000008', 'RIA', 'Moved Back'),
      site('S000009', 'RIA', 'Snoozed Only'),
      site('S000010', 'AUR', 'Single Update'),
      site('S000011', 'MUB', 'Former Salesman Site'),
      site('S000012', 'SH', 'SH Mall', { stage: WON, value_rs: 500000, payment_terms: 'Cash' }),
      site('S000013', 'SH', 'SH Tower', { stage: LOST, lost_reason: 'Site_Delayed*' }),
      site('S000014', 'IB', 'IB Yesterday'),
    ],
    activity: [
      act(pk(2026, 11, 10, 23, 59), 'IB', 'S000014', 'update', { note: 'the day before' }),
      act(at(9), 'RIA', 'S000001', 'created', { to_stage: LEAD, note: 'secret first note' }),
      act(at(9, 10), 'RIA', 'S000002', 'created', { to_stage: RQ, value_rs: 650000, payment_terms: 'Credit', note: 'quote note' }),
      act(at(9, 20), 'RIA', 'S000003', 'stage_change', { from_stage: RQ, to_stage: LOST, value_rs: 600000, payment_terms: 'Cash',
        lost_reason: 'Price Too High', note: 'too dear' }),
      act(at(9, 30), 'RIA', 'S000004', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 42250, payment_terms: 'Cash' }),
      act(at(9, 40), 'RIA', 'S000005', 'stage_change', { from_stage: LEAD, to_stage: WON, value_rs: 187000, payment_terms: 'Credit' }),
      act(at(9, 50), 'RIA', 'S000006', 'update', { note: 'called the engineer', next_followup: pk(2026, 11, 14, 0) }),
      act(at(10), 'RIA', 'S000007', 'stage_change', { from_stage: LEAD, to_stage: SAMPLE }),
      act(at(10, 10), 'RIA', 'S000001', 'update', { note: 'second visit' }),
      act(at(10, 20), 'RIA', 'S000008', 'stage_change', { from_stage: RQ, to_stage: LEAD }),
      act(at(10, 30), 'RIA', 'S000009', 'snooze', { next_followup: pk(2026, 11, 18, 0) }),
      act(at(10, 40), 'RIA', 'S000006', 'details', { note: 'Contact name' }),
      act(at(10, 50), 'RIA', 'S000006', 'contact', { note: 'New contact: Haji Rafiq · 0333 1112222' }),
      act(at(11), 'admin', 'S000006', 'update', { note: 'Admin: seen' }),
      act(at(11, 10), 'MUB', 'S000011', 'created', { to_stage: LEAD }),
      act(at(12), 'AUR', 'S000010', 'update', { note: 'one call' }),
      act(at(13), 'SH', 'S000012', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 500000, payment_terms: 'Cash' }),
      act(at(14), 'SH', 'S000013', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Site_Delayed*' }),
      act(pk(2026, 11, 12, 0, 0), 'IB', 'S000014', 'update', { note: 'the day after' }),
    ],
  });
}

test('exact text: a busy salesman with every group in order, a single activity, nobody, Won biggest first, waSafe_ on names', () => {
  const w = textWorld();
  const r = daily(w);
  assert.deepEqual(r.regions.map((x) => x.region), ['North', 'Center', 'South']);
  assert.equal(r.regions[0].text, [
    '*North · Wed 11 Nov*',
    '9 activities · New 2 · Sample given 1 · Quoted 1 · Won 2 Rs. 229,250 · Lost 1',
    '',
    '*RIA* · 8 activities',
    "Won: Metro ∗Plaza∗ˍx ∼y∼ 'z' Rs. 187,000, Askari Homes Rs. 42,250",
    'Lost: DHA Plaza (Price Too High)',
    'Quoted: Gulberg Heights',
    'Sample given: Sample Site',
    'New: Al Noor Builders, Gulberg Heights',
    'Followed up: Bahria Villas, Moved Back',
    '',
    '*AUR* · 1 activity',
    'Followed up: Single Update',
    '',
    '*WAK* · no activity',
  ].join('\n'));
  assert.equal(r.regions[1].text, [
    '*Center · Wed 11 Nov*',
    '2 activities · Won 1 Rs. 500,000 · Lost 1',
    '',
    '*SH* · 2 activities',
    'Won: SH Mall Rs. 500,000',
    'Lost: SH Tower (SiteˍDelayed∗)',
    '',
    '*SJ* · no activity',
    '',
    '*SM* · no activity',
  ].join('\n'));
  assert.equal(r.regions[2].text, ['*South · Wed 11 Nov*', 'No activity', '', '*IB* · no activity'].join('\n'));
});

test('the same day while it runs is "(so far)"; the exact example of the spec', () => {
  activityId = 0;
  const names = ['Al Noor Builders', 'Gulberg Heights', 'Bahria Traders', 'Eng Kamran', 'Shah Associates', 'Faisal sb',
    'Javed Brothers', 'Usman sb', 'Ali Hassan', 'Green Valley'];
  const sites = names.map((n, i) => site(`S0000${10 + i}`, 'AUR', n));
  sites.push(site('S000030', 'WAK', 'Askari Homes', { stage: WON, value_rs: 42250 }));
  const activity = names.map((n, i) => act(at(9, i), 'AUR', `S0000${10 + i}`, 'created',
    i === 1 ? { to_stage: RQ, value_rs: 36000, payment_terms: 'Cash' } : { to_stage: LEAD }));
  activity.push(act(at(11), 'WAK', 'S000030', 'stage_change', { from_stage: LEAD, to_stage: WON, value_rs: 42250, payment_terms: 'Cash' }));
  const w = world({ sites, activity });
  const want = [
    '*North · Wed 11 Nov*',
    '11 activities · New 10 · Quoted 1 · Won 1 Rs. 42,250',
    '',
    '*RIA* · no activity',
    '',
    '*AUR* · 10 activities',
    'Quoted: Gulberg Heights',
    `New: ${names.join(', ')}`,
    '',
    '*WAK* · 1 activity',
    'Won: Askari Homes Rs. 42,250',
  ];
  assert.equal(textOf(w, 'North', '2026-11-11'), want.join('\n'));
  const running = textOf(w, 'North', '2026-11-11', pk(...D, 15));
  assert.equal(running, ['*North · Wed 11 Nov (so far)*', ...want.slice(1)].join('\n'));
});

test('the region totals are the sum of its blocks', () => {
  const w = textWorld();
  for (const { text } of daily(w).regions) {
    const [head, ...blocks] = text.split('\n\n');
    const line = head.split('\n')[1];
    const sum = { activities: 0, New: 0, 'Sample given': 0, Quoted: 0, Won: 0, Lost: 0, rs: 0 };
    for (const block of blocks) {
      const [top, ...groups] = block.split('\n');
      const n = /· (\d+) activit/.exec(top);
      sum.activities += n ? Number(n[1]) : 0;
      for (const g of groups) {
        const [label, rest] = g.split(': ');
        const items = rest.split(', ');
        if (label === 'Won') {
          const amounts = [...rest.matchAll(/Rs\. ([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
          sum.Won += amounts.length;
          sum.rs += amounts.reduce((a, b) => a + b, 0);
        } else if (label in sum) sum[label] += items.length;
      }
    }
    const want = !sum.activities ? 'No activity' : [`${sum.activities} activit${sum.activities === 1 ? 'y' : 'ies'}`,
      ...['New', 'Sample given', 'Quoted'].filter((k) => sum[k]).map((k) => `${k} ${sum[k]}`),
      ...(sum.Won ? [`Won ${sum.Won} Rs. ${sum.rs.toLocaleString('en-US')}`] : []), ...(sum.Lost ? [`Lost ${sum.Lost}`] : [])].join(' · ');
    assert.equal(line, want, head);
  }
});

test('every current salesman of the region, in Rep_Mapping order, every day; a region with no salesmen says "No activity"', () => {
  const tabs = metaDataTabs();
  tabs.Rep_Mapping = [['Rep', 'Region'], ['WAK', 'North'], ['RIA', 'North'], ['SH', 'Center']];
  const w = world({ metaTabs: tabs });
  const r = daily(w);
  assert.equal(r.regions[0].text, '*North · Wed 11 Nov*\nNo activity\n\n*WAK* · no activity\n\n*RIA* · no activity');
  assert.equal(r.regions[2].text, '*South · Wed 11 Nov*\nNo activity');
});

// ---------------------------------------------------------------------------- Privacy (ADR-0012)

test('privacy: no quote Rs., Cash / Credit, notes, contacts, areas or another region in a text', () => {
  const w = textWorld();
  const r = daily(w);
  const all = r.regions.map((x) => x.text).join('\n');
  for (const never of ['650,000', '650000', '600,000', '600000', 'Cash', 'Credit', 'secret first note', 'quote note', 'too dear',
    'called the engineer', 'second visit', 'Contact name', 'Haji Rafiq', 'Contact Asif', '0333', '923331112222', '923001234567',
    'Bahria Phase 7', 'Secret Area', 'site note', 'Admin', 'admin', 'seen', 'MUB', 'Former Salesman Site', 'Snoozed Only',
    'Tile Adhesives', 'Dealer', 'the day before', 'the day after', 'IB Yesterday', 'S0000']) {
    assert.ok(!all.includes(never), never);
  }
  const [north, center, south] = r.regions.map((x) => x.text);
  for (const other of ['SH', 'SJ', 'SM', 'IB', 'Center', 'South', 'SH Mall', 'SH Tower', '500,000']) assert.ok(!north.includes(other), `North: ${other}`);
  for (const other of ['RIA', 'AUR', 'WAK', 'IB', 'North', 'South', 'Al Noor', 'Askari', '187,000', '42,250']) {
    assert.ok(!center.includes(other), `Center: ${other}`);
  }
  for (const other of ['RIA', 'AUR', 'WAK', 'SH', 'North', 'Center', 'Mall']) assert.ok(!south.includes(other), `South: ${other}`);
  assert.deepEqual(Object.keys(r).sort(), ['day', 'next', 'ok', 'prev', 'regions']);
  assert.deepEqual(r.regions.map((x) => Object.keys(x).sort()), [['region', 'text'], ['region', 'text'], ['region', 'text']]);
});

test('adminPageDaily refuses junk (no sheet opened), a cancelled admin code and every salesman code; writes nothing', () => {
  const w = textWorld();
  for (const k of ['hello', undefined, null, 42, ADMIN.toUpperCase(), `${ADMIN}a`, '', { toString: () => ADMIN }]) {
    assert.equal(thrown(() => w.s.adminPageDaily(k, '')), NO_LINK, String(k));
  }
  assert.deepEqual(w.opened, [], 'junk opens no sheet');
  for (const k of [RIA, SH, OLD_ADMIN, OLD_RIA]) assert.equal(thrown(() => w.s.adminPageDaily(k, '')), NO_LINK);
  assert.deepEqual(w.diary._writes(), []);
  assert.deepEqual(w.metaData._writes(), []);
});

test('adminPageDaily: a reply with no Dates and no link code; Google failing is "Something went wrong"', () => {
  const w = textWorld();
  const r = w.s.adminPageDaily(ADMIN, '');
  assert.equal(r.ok, true);
  assert.match(r.day, /^\d{4}-\d\d-\d\d$/);
  const json = JSON.stringify(r);
  for (const code of [RIA, SH, ADMIN, OLD_ADMIN, OLD_RIA]) assert.ok(!json.includes(code));
  const hasDate = (x) => (x && typeof x === 'object' ? Object.prototype.toString.call(x) === '[object Date]' ||
    Object.values(x).some(hasDate) : false);
  assert.equal(hasDate(r), false);
  w.diary.getSheetByName('Activity').getRange(1, 2).setValues([['when']]); // a header renamed by hand
  assert.equal(thrown(() => w.s.adminPageDaily(ADMIN, '')), TRY_AGAIN);
});

test("the salesman's side gets nothing new: no rep… function, and his served page never holds the Daily message", () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'daily.js'), 'utf8');
  assert.deepEqual([...source.matchAll(/^function (\w+)/gm)].map((m) => m[1]).filter((n) => !n.endsWith('_')), ['adminPageDaily']);
  const w = world();
  const page = w.s.doGet({ parameter: { k: RIA } }).getContent();
  for (const word of ['adminPageDaily', 'Daily message', 'dailyView']) assert.ok(!page.includes(word), word);
  const admin = w.s.doGet({ parameter: { k: ADMIN } }).getContent();
  for (const word of ['adminPageDaily', 'Daily message', 'dailyView']) assert.ok(admin.includes(word), word);
});

// ------------------------------------------------------------------------------------- Speed

test('speed: one Sales Diary open, Sites read once, Activity from the bottom (never whole), no Meta-Data, no writes, no lock', () => {
  // Built around the real clock, since the public function uses it: 5,000 rows from long before
  // the default day, then 40 of that day.
  const probe = world();
  const now = new Date();
  const day = probe.s.dailyDay_('', probe.s.dayKey_(now));
  const start = probe.s.dayStart_(day).getTime();
  activityId = 0;
  const activity = [];
  for (let i = 0; i < 5000; i++) activity.push(act(new Date(start - 20 * 24 * 60 * 60 * 1000), 'RIA', 'S000001', 'update', { note: 'old' }));
  for (let i = 0; i < 40; i++) activity.push(act(new Date(start + (i + 1) * 60 * 1000), 'RIA', 'S000001', 'update', { note: 'the day' }));
  const w = world({ sites: [site('S000001', 'RIA', 'Busy Site')], activity });
  w.s.adminPageLoad(ADMIN); // the first call of the day reads Meta-Data and keeps it
  const tabs = ['Links', 'Sites', 'Activity', 'Lists'];
  const sheet = (t) => w.diary.getSheetByName(t);
  for (const ask of ['', day]) {
    const reads = tabs.map((t) => sheet(t)._reads);
    const rows = sheet('Activity')._rowsRead;
    const props = JSON.stringify([...w.props._store]);
    const cache = w.cache._store.size;
    const lockEvents = w.lock._events.length;
    w.opened.length = 0;
    const r = w.s.adminPageDaily(ADMIN, ask);
    assert.equal(r.day, day);
    assert.deepEqual(w.opened, ['diary'], 'Sales Diary once, Meta-Data not opened');
    assert.deepEqual(tabs.map((t, i) => sheet(t)._reads - reads[i]), [1, 1, 0, 0], 'Links, Sites once; Activity never whole; no Lists');
    assert.equal(sheet('Activity')._rowsRead - rows, 501, 'the header and one block of 500 from the bottom');
    assert.deepEqual(w.diary._writes(), []);
    assert.deepEqual(w.metaData._writes(), []);
    assert.equal(JSON.stringify([...w.props._store]), props, 'nothing kept');
    assert.equal(w.cache._store.size, cache);
    assert.equal(w.lock._events.length, lockEvents, 'no lock');
    assert.ok(r.regions[0].text.includes('*RIA* · 1 activity\nFollowed up: Busy Site'), 'the 40 rows of the day were read');
  }
});

test('speed: a day further back reads blocks from the bottom only until it passes that day', () => {
  activityId = 0;
  const activity = [];
  for (let i = 0; i < 300; i++) activity.push(act(pk(2026, 10, 1), 'RIA', 'S000001', 'update', { note: 'long ago' }));
  for (let i = 0; i < 20; i++) activity.push(act(pk(2026, 10, 20, 10), 'RIA', 'S000001', 'update', { note: 'that day' }));
  for (let i = 0; i < 1200; i++) activity.push(act(pk(2026, 11, 5), 'RIA', 'S000002', 'update', { note: 'later' }));
  const w = world({ sites: [site('S000001', 'RIA', 'Old Day Site'), site('S000002', 'RIA', 'Later Site')], activity });
  const sheet = w.diary.getSheetByName('Activity');
  const before = sheet._rowsRead;
  assert.deepEqual(blockOf(textOf(w, 'North', '2026-10-20'), 'RIA'), ['*RIA* · 1 activity', 'Followed up: Old Day Site'],
    'rows after the day are read but not counted');
  assert.equal(sheet._rowsRead - before, 1 + 1500, 'the header and 3 blocks of 500: the third holds rows from before the day');
  assert.equal(sheet._reads, 0, 'never the whole tab at once');
});

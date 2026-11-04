'use strict';
// Spec 008: the admin's (owner's) screen and his Updates. Who may call, what the screen shows
// (worked today, won / lost this month, targets, late and going cold come from the same cards),
// what an admin Update writes, "two people, one site", and what it costs.
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
const SH = 'b'.repeat(64);
const ADMIN = 'c'.repeat(64);
const OLD_ADMIN = 'd'.repeat(64); // a cancelled admin link
const NO_LINK = "This link doesn't work. Ask the admin for a new one.";

/** A moment in Pakistan time (UTC+5, no daylight saving). */
const pk = (y, m, d, h = 12, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 5, min));
// The rules are checked at a fixed "now": Wednesday 4 November 2026, noon in Pakistan.
const NOW = pk(2026, 11, 4, 12);
const OCT = pk(2026, 10, 20, 10);

const site = (id, rep, name, extra = {}) => SITES.map((h) => ({
  site_id: id, rep, region: { RIA: 'North', SH: 'Center', MUB: 'Center' }[rep] || 'North', site_name: name,
  buyer_type: 'Dealer', area: 'DHA', contact_name: 'Asif', contact_phone: '923001234567', products: 'Tile Adhesives',
  stage: 'Visited / Lead', next_followup: pk(2026, 11, 6, 0), last_note: '', created_at: OCT, updated_at: OCT, worked_at: OCT,
  ...extra,
})[h] ?? '');
let activityId = 0;
const act = (when, rep, siteId, action, extra = {}) => ACTIVITY.map((h) => ({
  activity_id: `A${String(++activityId).padStart(7, '0')}`, timestamp: when, rep, site_id: siteId, action, ...extra,
})[h] ?? '');

const WON = 'Won (Order)';
const LOST = 'Lost / Dead';
const RQ = 'Rate Quoted';

function standardSites() {
  return [
    site('S000001', 'RIA', 'Open Lead'),
    site('S000002', 'RIA', 'Quote', { stage: RQ, value_rs: 300000, payment_terms: 'Credit' }),
    site('S000003', 'RIA', 'Won Straight', { stage: WON, value_rs: 500000, payment_terms: 'Cash', next_followup: '' }),
    site('S000004', 'RIA', 'Quoted Oct Won Nov', { stage: WON, value_rs: 250000, payment_terms: 'Cash', next_followup: '' }),
    site('S000005', 'SH', 'Won In October', { stage: WON, value_rs: 900000, payment_terms: 'Cash', next_followup: '' }),
    site('S000006', 'SH', 'Won Then Reopened', { stage: RQ, value_rs: 400000, payment_terms: 'Cash' }),
    site('S000007', 'SH', 'Won Twice', { stage: WON, value_rs: 120000, payment_terms: 'Cash', next_followup: '' }),
    site('S000008', 'AUR', 'Handed Over', { stage: WON, value_rs: 70000, payment_terms: 'Cash', next_followup: '' }),
    site('S000009', 'SH', 'Admin Won', { stage: WON, value_rs: 60000, payment_terms: 'Credit', next_followup: '' }),
    site('S000010', 'RIA', 'Hand Typed Won', { stage: WON, value_rs: 10000, payment_terms: 'Cash', next_followup: '' }),
    site('S000011', 'RIA', 'Lost On Price', { stage: LOST, value_rs: 80000, payment_terms: 'Cash', lost_reason: 'Price Too High', next_followup: '' }),
    site('S000012', 'SH', 'Lost In October', { stage: LOST, lost_reason: 'Site Delayed', next_followup: '' }),
    site('S000013', 'SH', 'Old Won Edited Today', { stage: WON, value_rs: 5000, payment_terms: 'Cash', next_followup: '' }),
    site('S000014', 'MUB', 'Former Salesman Lead'),
  ];
}

function standardActivity() {
  activityId = 0;
  return [
    act(OCT, 'RIA', 'S000004', 'created', { to_stage: RQ, value_rs: 200000 }),
    act(OCT, 'SH', 'S000005', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 900000 }),
    act(OCT, 'SH', 'S000012', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Site Delayed' }),
    act(OCT, 'SH', 'S000013', 'stage_change', { from_stage: RQ, to_stage: WON }),
    act(pk(2026, 10, 31, 23, 59), 'SH', 'S000007', 'stage_change', { from_stage: RQ, to_stage: WON }), // last month
    act(pk(2026, 11, 1, 0, 1), 'RIA', 'S000003', 'created', { to_stage: WON, value_rs: 450000 }), // this month
    act(pk(2026, 11, 2), 'SH', 'S000006', 'stage_change', { from_stage: RQ, to_stage: WON }),
    act(pk(2026, 11, 2, 13), 'SH', 'S000006', 'stage_change', { from_stage: WON, to_stage: RQ }), // reopened
    act(pk(2026, 11, 2, 14), 'SH', 'S000007', 'stage_change', { from_stage: WON, to_stage: RQ }),
    act(pk(2026, 11, 3), 'SH', 'S000007', 'stage_change', { from_stage: RQ, to_stage: WON }), // won again
    act(pk(2026, 11, 3), 'RIA', 'S000004', 'stage_change', { from_stage: RQ, to_stage: WON, value_rs: 240000 }),
    act(pk(2026, 11, 3), 'RIA', 'S000008', 'stage_change', { from_stage: RQ, to_stage: WON }), // later handed to AUR
    act(pk(2026, 11, 3), 'RIA', 'S000002', 'snooze', { next_followup: pk(2026, 11, 4, 0) }),
    act(pk(2026, 11, 3, 23, 59), 'RIA', 'S000002', 'snooze', { next_followup: pk(2026, 11, 5, 0) }), // yesterday
    act(pk(2026, 11, 4, 0, 1), 'RIA', 'S000011', 'stage_change', { from_stage: RQ, to_stage: LOST, lost_reason: 'Price Too High', note: 'too dear' }),
    act(pk(2026, 11, 4, 9), 'RIA', 'S000001', 'update', { note: 'call again', next_followup: pk(2026, 11, 6, 0) }),
    act(pk(2026, 11, 4, 9, 30), 'RIA', 'S000001', 'details', { note: 'Contact name' }),
    act(pk(2026, 11, 4, 10), 'RIA', 'S000002', 'snooze', { next_followup: pk(2026, 11, 7, 0) }),
    act(pk(2026, 11, 4, 10, 30), 'SH', 'S000013', 'details', { note: 'Area' }),
    act(pk(2026, 11, 4, 11), 'admin', 'S000009', 'stage_change', { from_stage: RQ, to_stage: WON, note: 'Admin: done' }),
    act(pk(2026, 11, 4, 11, 30), 'RIA', 'S000015', 'created', { to_stage: 'Visited / Lead' }),
  ];
}

function world({ metaTabs = metaDataTabs(), sites = standardSites(), activity = standardActivity() } = {}) {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Site Delayed', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, ...sites, site('S000015', 'RIA', 'New Today', { created_at: pk(2026, 11, 4, 11, 30) })],
    Activity: [ACTIVITY, ...activity],
    Lists: lists,
    Links: [LINKS, ['owner', '', OLD_ADMIN, false, OCT], ['rep', 'RIA', RIA, true, OCT], ['rep', 'SH', SH, true, OCT],
      ['owner', '', ADMIN, true, OCT]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaTabs, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const app = makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } });
  const opened = [];
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: { ...app, openById(id) { opened.push(id === SALES_DIARY_ID ? 'diary' : 'meta'); return app.openById(id); } },
    Utilities: makeUtilities(), LockService: makeLockService(), CacheService: makeCacheService(), HtmlService: makeHtmlService(),
  });
  /** The admin screen's data at NOW. */
  const screen = () => plain(src.sandbox.adminDataFor_(diary, ['RIA', 'SH'], NOW));
  return { s: src.sandbox, diary, metaData, opened, screen };
}

const thrown = (fn) => { try { fn(); } catch (e) { return e.message; } return 'nothing thrown'; };
const byId = (data) => Object.fromEntries(data.sites.map((c) => [c.id, c]));
const sitesRow = (w, id) => {
  const values = w.diary.getSheetByName('Sites').getDataRange().getValues();
  const row = values.find((r) => r[0] === id);
  return Object.fromEntries(SITES.map((h, i) => [h, row[i]]));
};
const lastActivity = (w) => {
  const values = w.diary.getSheetByName('Activity').getDataRange().getValues();
  return Object.fromEntries(ACTIVITY.map((h, i) => [h, values[values.length - 1][i]]));
};

// ------------------------------------------------------------------- Who may call (ADR-0004)

const ADMIN_CALLS = {
  adminPageLoad: (s, k) => s.adminPageLoad(k),
  adminPageUpdateSite: (s, k) => s.adminPageUpdateSite(k, 'S000001', { stage: RQ, value: '1000', terms: 'Cash', followUp: 'tomorrow' }),
  adminPageSaveStatus: (s, k) => s.adminPageSaveStatus(k, ['abcdefgh01']),
};

for (const [name, call] of Object.entries(ADMIN_CALLS)) {
  test(`${name}: junk codes get "doesn't work" without opening any sheet`, () => {
    const w = world();
    for (const k of ['hello', undefined, null, 42, ADMIN.toUpperCase(), `${ADMIN}a`, '']) {
      assert.equal(thrown(() => call(w.s, k)), NO_LINK, String(k));
    }
    assert.deepEqual(w.opened, []);
  });

  test(`${name}: a salesman's code or a cancelled admin code gets nothing, and nothing is written`, () => {
    const w = world();
    for (const k of [RIA, SH, OLD_ADMIN]) assert.equal(thrown(() => call(w.s, k)), NO_LINK);
    assert.deepEqual(w.diary._writes(), []);
  });
}

test('every salesman function refuses the admin code', () => {
  const w = world();
  const calls = [
    () => w.s.repLoad(ADMIN), () => w.s.repCheckPhone(ADMIN, '0300 1234567'),
    () => w.s.repAddSite(ADMIN, { name: 'X', buyerType: 'Dealer', followUp: 'tomorrow' }),
    () => w.s.repUpdateSite(ADMIN, 'S000001', { stage: 'Visited / Lead', followUp: '3days', note: 'x' }),
    () => w.s.repEditSite(ADMIN, 'S000001', { name: 'X', buyerType: 'Dealer' }),
    () => w.s.repSnoozeSite(ADMIN, 'S000001', { followUp: 'tomorrow' }), () => w.s.repSaveStatus(ADMIN, []),
  ];
  for (const call of calls) assert.equal(thrown(call), NO_LINK);
  assert.deepEqual(w.diary._writes(), []);
});

test("the admin's screen data holds no link code at all (his own is added only to his page)", () => {
  const w = world();
  const json = JSON.stringify(w.s.adminPageLoad(ADMIN));
  for (const code of [RIA, SH, ADMIN, OLD_ADMIN]) assert.ok(!json.includes(code));
  assert.ok(!json.includes('token'));
});

test("a salesman's page is unchanged: his sites and his target only, no region or house target", () => {
  const w = world();
  const page = plain(w.s.repLoad(RIA));
  assert.deepEqual(Object.keys(page).sort(), ['areas', 'buyerTypes', 'categories', 'lostReasons', 'now', 'ok', 'region',
    'rep', 'rules', 'sites', 'target', 'today'].sort());
  assert.ok(page.sites.every((c) => !('rep' in c)), 'his cards are as before');
  assert.ok(!page.sites.some((c) => ['Won In October', 'Won Twice', 'Admin Won', 'Former Salesman Lead'].includes(c.name)));
  assert.ok(!JSON.stringify(page).includes('UNASSIGNED'));
});

// ------------------------------------------------------------------------------- The screen

test('worked today: any save counts; the admin, yesterday and 23:59 the night before do not', () => {
  const data = world().screen();
  assert.equal(data.today, '2026-11-04');
  assert.deepEqual(data.feed.map((f) => `${f.time} ${f.by} ${f.action} ${f.site}`), [
    '11:30 RIA created S000015',
    '11:00 admin stage_change S000009',
    '10:30 SH details S000013',
    '10:00 RIA snooze S000002',
    '09:30 RIA details S000001',
    '09:00 RIA update S000001',
    '00:01 RIA stage_change S000011',
  ], 'newest first, today only (Pakistan time)');
  const feed = data.feed.find((f) => f.site === 'S000011');
  assert.deepEqual([feed.name, feed.from, feed.to, feed.lostReason, feed.note], ['Lost On Price', RQ, LOST, 'Price Too High', 'too dear']);
  assert.equal(data.feed.find((f) => f.action === 'snooze').followUp, '2026-11-07');
});

test('salesmen: this month\'s target, a working link yes/no, snoozes this month', () => {
  const data = world().screen();
  assert.deepEqual(data.salesmen.map((s) => s.rep), ['RIA', 'AUR', 'WAK', 'SH', 'SJ', 'SM', 'IB']);
  const ria = data.salesmen.find((s) => s.rep === 'RIA');
  assert.deepEqual(ria, { rep: 'RIA', region: 'North', target: fakeTarget('RIA', '2026-11'), linked: true, snoozes: 3 });
  assert.equal(data.salesmen.find((s) => s.rep === 'AUR').linked, false);
  assert.deepEqual(data.regionTargets, {
    North: fakeTarget('North', '2026-11'), Center: fakeTarget('Center', '2026-11'), South: fakeTarget('South', '2026-11'),
    UNASSIGNED: fakeTarget('UNASSIGNED', '2026-11'),
  });
  assert.equal(data.houseRegion, 'UNASSIGNED');
  assert.equal(byId(data).S000002.snoozes, 3, 'per site, this month');
});

test('a missing or doubled target shows as none', () => {
  const tabs = metaDataTabs();
  const novRows = (key) => tabs[key === 'North' ? 'Targets' : 'Rep-Targets'].findIndex((r) => r[0] === key &&
    r[1] instanceof Date && r[1].getTime() === pk(2026, 11, 1, 0).getTime());
  tabs['Rep-Targets'].splice(novRows('RIA'), 1);
  tabs.Targets.push(tabs.Targets[novRows('North')].slice());
  const data = world({ metaTabs: tabs }).screen();
  assert.equal(data.salesmen.find((s) => s.rep === 'RIA').target, null);
  assert.equal(data.regionTargets.North, null);
  assert.equal(data.salesmen.find((s) => s.rep === 'SH').target, fakeTarget('SH', '2026-11'));
});

test('won this month: by the day it was marked Won (owner P7-1), only if still Won', () => {
  const sites = byId(world().screen());
  assert.equal(sites.S000003.closed, '2026-11-01', 'added straight at Won on the 1st at 00:01');
  assert.equal(sites.S000004.closed, '2026-11-03', 'quoted in October, won in November: November');
  assert.equal(sites.S000004.value, 250000, 'its current value, not the one typed when it was won');
  assert.equal(sites.S000005, undefined, 'won in October: not on the screen');
  assert.equal(sites.S000006.closed, '', 'won, then reopened: not won');
  assert.equal(sites.S000007.closed, '2026-11-03', 'won 31 Oct 23:59, reopened, won again: counted once, in November');
  assert.equal(sites.S000008.rep, 'AUR', 'handed over: counts for the salesman it belongs to now');
  assert.equal(sites.S000008.closed, '2026-11-03');
  assert.equal(sites.S000009.rep, 'SH', 'marked Won by the admin: counts for the site\'s salesman');
  assert.equal(sites.S000009.closed, '2026-11-04');
  assert.equal(sites.S000010, undefined, 'a Won row typed by hand (no history) is not counted');
});

test('lost this month, with its reason; a closed site in today\'s saves is shown, not counted', () => {
  const sites = byId(world().screen());
  assert.deepEqual([sites.S000011.closed, sites.S000011.lostReason, sites.S000011.value], ['2026-11-04', 'Price Too High', 80000]);
  assert.equal(sites.S000012, undefined, 'lost in October');
  assert.equal(sites.S000013.closed, '', 'won in October, edited today: shown for the feed, not won this month');
});

test('open sites of every salesman are on the screen, including someone no longer in the list', () => {
  const sites = byId(world().screen());
  assert.deepEqual(['S000001', 'S000002', 'S000014', 'S000015'].map((id) => sites[id] && sites[id].rep), ['RIA', 'RIA', 'MUB', 'RIA']);
  assert.equal(sites.S000014.region, 'Center');
  assert.equal(sites.S000015.worked, '2026-10-20', 'cards keep the salesman\'s fields (going cold, last note, ...)');
});

test('the lost reasons and stage rules come with it, for the Update form', () => {
  const data = world().screen();
  assert.deepEqual(data.lostReasons, ['Price Too High', 'Site Delayed', 'Other']);
  assert.equal(data.rules.coldDays, 7);
  assert.equal(data.admin, true);
  assert.equal(data.month, '2026-11');
});

// ------------------------------------------------------------------------- An admin Update

test('an admin Update: any salesman\'s site; Activity says admin; "Admin: " note; never worked_at', () => {
  const w = world();
  const before = sitesRow(w, 'S000002');
  const r = plain(w.s.adminPageUpdateSite(ADMIN, 'S000002', {
    stage: WON, value: '310,000', terms: 'Cash', note: '=HYPERLINK("x")', saveId: 'adminSave001',
    seen: { stage: RQ, value: 300000, terms: 'Credit', lostReason: '', followUp: '2026-11-06' },
  }));
  assert.equal(r.ok, true, r.message);
  assert.equal(r.site.rep, 'RIA');
  assert.equal(r.site.region, 'North');
  assert.equal(r.site.note, 'Admin: =HYPERLINK("x")');
  const after = sitesRow(w, 'S000002');
  assert.equal(after.stage, WON);
  assert.equal(after.value_rs, 310000);
  assert.equal(after.last_note, 'Admin: =HYPERLINK("x")', 'stored as text, with the admin mark (P7-4)');
  assert.equal(after.rep, 'RIA', 'rep never changes');
  assert.equal(after.region, 'North');
  assert.equal(after.worked_at.getTime(), before.worked_at.getTime(), 'the admin never resets going cold (P7-5)');
  assert.ok(after.updated_at.getTime() > before.updated_at.getTime());
  assert.equal(after.next_followup, '', 'Won has no follow-up');
  const row = lastActivity(w);
  assert.deepEqual([row.rep, row.site_id, row.action, row.from_stage, row.to_stage, row.note],
    ['admin', 'S000002', 'stage_change', RQ, WON, 'Admin: =HYPERLINK("x")']);
  assert.ok(!w.diary._writes().some((x) => /Meta/.test(x)));
});

test('an admin Update: same checks and messages as the salesman\'s; unknown site', () => {
  const w = world();
  assert.deepEqual(plain(w.s.adminPageUpdateSite(ADMIN, 'S000001', { stage: RQ, followUp: 'tomorrow' })),
    { ok: false, message: 'Type the total Rs. value.' });
  assert.equal(thrown(() => w.s.adminPageUpdateSite(ADMIN, 'S999999', { stage: RQ })), "That site isn't in the diary.");
  assert.equal(thrown(() => w.s.adminPageUpdateSite(ADMIN, '=A1', { stage: RQ })), "That site isn't in the diary.");
  assert.deepEqual(w.diary._writes(), []);
});

test('an admin save is saved once per save ID; adminPageSaveStatus knows only his', () => {
  const w = world();
  const input = { stage: 'Visited / Lead', followUp: '1week', note: 'x', saveId: 'adminSave002' };
  w.s.adminPageUpdateSite(ADMIN, 'S000001', input);
  const rows = w.diary.getSheetByName('Activity').getLastRow();
  w.s.adminPageUpdateSite(ADMIN, 'S000001', input);
  assert.equal(w.diary.getSheetByName('Activity').getLastRow(), rows, 'not saved twice');
  assert.deepEqual(plain(w.s.adminPageSaveStatus(ADMIN, ['adminSave002', 'neverSent01'])), { ok: true, landed: ['adminSave002'] });
  assert.deepEqual(plain(w.s.repSaveStatus(RIA, ['adminSave002'])), { ok: true, landed: [] }, 'a salesman never sees it');
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: '3days', note: 'y', saveId: 'riaSave0001' });
  assert.deepEqual(plain(w.s.adminPageSaveStatus(ADMIN, ['riaSave0001'])), { ok: true, landed: [] }, 'nor he a salesman\'s');
});

test('two people, one site: a form opened on an older state is refused, both ways, nothing written', () => {
  const w = world();
  // RIA moved the quote on; the admin's screen still shows the morning's state (a list of states the
  // page knows of works the same: none matches).
  const stale = { stage: 'Visited / Lead', value: null, terms: '', lostReason: '', followUp: '2026-11-01' };
  const writes = w.diary._writes().length;
  const r = plain(w.s.adminPageUpdateSite(ADMIN, 'S000002', { stage: RQ, value: '1', terms: 'Cash', followUp: 'tomorrow', seen: stale }));
  assert.equal(r.ok, false);
  assert.equal(r.changed, true);
  assert.equal(r.message, 'This site was changed a moment ago. Here it is now: check it and save again.');
  assert.equal(r.site.value, 300000, 'with the site as it is now');
  assert.equal(r.site.rep, 'RIA');
  const s = plain(w.s.repUpdateSite(RIA, 'S000002', { stage: RQ, value: '1', terms: 'Cash', followUp: 'tomorrow', seen: stale }));
  assert.equal(s.changed, true);
  assert.equal(s.site.rep, undefined, 'his card, as always');
  const both = plain(w.s.repUpdateSite(RIA, 'S000002', { stage: RQ, value: '1', terms: 'Cash', followUp: 'tomorrow',
    seen: [stale, { ...stale, stage: 'Sample / Trial' }] }));
  assert.equal(both.changed, true, 'none of the states his page knows of');
  assert.equal(w.diary._writes().length, writes, 'nothing written');
});

test('two people, one site: a matching form, or one from an older page (no seen), saves; his saves in a row both land', () => {
  const w = world();
  const seen = { stage: RQ, value: 300000, terms: 'Credit', lostReason: '', followUp: '2026-11-06' };
  const first = plain(w.s.repUpdateSite(RIA, 'S000002', { stage: RQ, value: '350000', terms: 'Cash', followUp: '1week', seen }));
  assert.equal(first.ok, true, first.message);
  // The next form is opened on the card the first one left (as his page does).
  const card = first.site;
  const second = plain(w.s.repUpdateSite(RIA, 'S000002', { stage: LOST, lostReason: 'Price Too High', note: 'gone',
    seen: { stage: card.stage, value: card.value, terms: card.terms, lostReason: card.lostReason, followUp: card.followUp } }));
  assert.equal(second.ok, true, second.message);
  // A save whose reply was lost may have landed: his page offers both states, and either matches.
  const now = { stage: LOST, value: 350000, terms: 'Cash', lostReason: 'Price Too High', followUp: '' };
  const after = plain(w.s.repUpdateSite(RIA, 'S000002', { stage: LOST, lostReason: 'Price Too High', note: 'gone for good',
    seen: [{ ...now, stage: RQ }, now] }));
  assert.equal(after.ok, true, after.message);
  const old = plain(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: '3days', note: 'no seen' }));
  assert.equal(old.ok, true);
});

// ------------------------------------------------------------------------------------ Speed

function activityRows(oldCount, newCount) {
  activityId = 0;
  const now = Date.now();
  const longAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
  const rows = [];
  for (let i = 0; i < oldCount; i++) rows.push(act(longAgo, 'RIA', 'S000001', 'update', { note: 'old' }));
  for (let i = 0; i < newCount; i++) rows.push(act(new Date(now - 1000), 'RIA', 'S000001', 'update', { note: 'new' }));
  return rows;
}

test('opening the admin screen: Sales Diary once, Meta-Data not (kept copy fresh), Activity never read whole', () => {
  const w = world({ activity: activityRows(5000, 40) });
  w.s.adminPageLoad(ADMIN); // the first call of the day reads Meta-Data and keeps it
  const tabs = ['Links', 'Sites', 'Activity', 'Lists'];
  const sheet = (t) => w.diary.getSheetByName(t);
  const reads = tabs.map((t) => sheet(t)._reads);
  const rowsBefore = sheet('Activity')._rowsRead;
  w.opened.length = 0;
  const data = plain(w.s.adminPageLoad(ADMIN));
  assert.deepEqual(w.opened, ['diary']);
  assert.deepEqual(tabs.map((t, i) => sheet(t)._reads - reads[i]), [1, 1, 0, 1], 'Links, Sites, Lists once; Activity never whole');
  assert.equal(sheet('Activity')._rowsRead - rowsBefore, 501, 'the header and one block of 500 from the bottom');
  assert.equal(data.feed.length + data.salesmen.find((s) => s.rep === 'RIA').snoozes, 40);
});

test('a busy month is read from the bottom in blocks until it reaches last month', () => {
  const w = world({ activity: activityRows(5000, 1200) });
  const before = w.diary.getSheetByName('Activity')._rowsRead;
  const moves = w.s.monthActivity_(w.diary, new Date());
  assert.equal(moves.length, 1200);
  assert.equal(w.diary.getSheetByName('Activity')._rowsRead - before, 1501);
  assert.ok(moves.every((m) => m.note === 'new'));
});

test('an admin save opens Sales Diary once and reads each tab once (inside the lock)', () => {
  const w = world();
  w.s.adminPageLoad(ADMIN);
  const tabs = ['Links', 'Sites', 'Activity', 'Lists'];
  const reads = tabs.map((t) => w.diary.getSheetByName(t)._reads);
  w.opened.length = 0;
  const r = w.s.adminPageUpdateSite(ADMIN, 'S000001', { stage: 'Visited / Lead', followUp: '3days', note: 'x' });
  assert.equal(r.ok, true);
  assert.deepEqual(w.opened, ['diary']);
  assert.deepEqual(tabs.map((t, i) => w.diary.getSheetByName(t)._reads - reads[i]), [1, 1, 1, 1]);
});

test('page size: 1,000 open sites (long names and notes) stay under 500 KB of page data', () => {
  const many = [];
  for (let i = 1; i <= 1000; i++) {
    many.push(site(`S${String(i).padStart(6, '0')}`, ['RIA', 'SH', 'IB'][i % 3], `Commercial Tower Block ${i}`, {
      stage: RQ, value_rs: 450000, payment_terms: 'Credit', products: 'Tile Adhesives | Waterproofing Job',
      contact_name: 'Asif (site engineer)', last_note: 'Quoted WP-100 @ Rs. 1,450, waiting for the consultant to approve', note_at: OCT,
    }));
  }
  const w = world({ sites: many, activity: [] });
  const size = JSON.stringify(w.s.adminPageLoad(ADMIN)).length;
  assert.ok(size < 500 * 1024, `${Math.round(size / 1024)} KB`);
});

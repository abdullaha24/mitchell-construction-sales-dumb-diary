'use strict';
// Spec 007: what the site card needs (worked_at, note_at, going cold's day, the last-spoken
// line's day) and Snooze (repSnoozeSite). Whose site, what is written, the history.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeCacheService,
  makePropertiesService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'owner notes'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const LINKS = ['role', 'rep', 'token', 'active', 'issued_at'];
const RIA = 'a'.repeat(64);
const SH = 'b'.repeat(64);
const OWNER = 'c'.repeat(64);
const D = new Date('2026-10-01T05:00:00Z');   // created
const W = new Date('2026-10-03T05:00:00Z');   // last worked
const N = new Date('2026-10-02T05:00:00Z');   // note written

/** Today in Karachi, `offsetDays` away, worked out without src/. */
function karachiDay(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
  const [y, m, d] = parts.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}
/** Midnight of a Karachi day, as the sheet stores a follow-up date. */
const dayStart = (key) => new Date(`${key}T00:00:00+05:00`);

const site = (id, rep, name, extra = {}) => SITES.map((h) => ({
  site_id: id, rep, region: rep === 'SH' ? 'Center' : 'North', site_name: name, buyer_type: 'Dealer', area: 'DHA',
  contact_name: 'Asif', contact_phone: '923001234567', products: 'Tile Adhesives', stage: 'Rate Quoted',
  value_rs: 450000, payment_terms: 'Credit', next_followup: dayStart(karachiDay(-2)), last_note: 'waiting for consultant',
  created_at: D, updated_at: W, worked_at: W, note_at: N, 'owner notes': 'keep me', ...extra,
})[h] ?? '');

function world() {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  lists.push(['area', 'DHA', 'North', 'RIA', true, 10]);
  const diary = makeSpreadsheet({
    Sites: [SITES,
      site('S000001', 'RIA', 'F-11 Tower'),
      site('S000002', 'SH', 'Gulberg Mall'),
      site('S000003', 'RIA', 'Blue Area', { stage: 'Won (Order)', next_followup: '' }),
      site('S000004', 'RIA', 'Typed by hand', { worked_at: '', note_at: '', stage: 'Sample / Trial', value_rs: '', payment_terms: '' }),
      site('S000005', 'RIA', 'Far ahead', { next_followup: dayStart(karachiDay(10)) })],
    Activity: [ACTIVITY, ['A0000007', D, 'RIA', 'S000001', 'created', '', 'Rate Quoted', 450000, 'Credit', '', '', D]],
    Lists: lists,
    Links: [LINKS, ['rep', 'RIA', RIA, true, D], ['rep', 'SH', SH, true, D], ['owner', '', OWNER, true, D]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaDataTabs(), { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), CacheService: makeCacheService(),
  });
  return { s: src.sandbox, diary };
}

const rowOf = (w, n) => {
  const values = w.diary.getSheetByName('Sites').getDataRange().getValues()[n];
  return Object.fromEntries(SITES.map((h, i) => [h, values[i]]));
};
const activityRows = (w) => w.diary.getSheetByName('Activity').getDataRange().getValues()
  .slice(1).map((values) => Object.fromEntries(ACTIVITY.map((h, i) => [h, values[i]])));
const lastActivity = (w) => activityRows(w).at(-1);
const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]';
const holdsDate = (v) => isDate(v) || (v && typeof v === 'object' && Object.values(v).some(holdsDate));
const cardIn = (w, id) => plain(w.s.repLoad(RIA)).sites.find((s) => s.id === id);

// ------------------------------------------------------------------- The card's new dates

test("the card carries the day it was last worked and the day of its note", () => {
  const w = world();
  const card = cardIn(w, 'S000001');
  assert.equal(card.worked, '2026-10-03');
  assert.equal(card.noteDay, '2026-10-02');
  assert.equal(card.note, 'waiting for consultant');
});

test('no worked_at (a row typed by hand): worked from created_at; no note_at: no day', () => {
  const card = cardIn(world(), 'S000004');
  assert.equal(card.worked, '2026-10-01');
  assert.equal(card.noteDay, '');
  const { cardOf_ } = world().s;
  const bare = plain(cardOf_({ site_id: 'S000009', stage: 'Rate Quoted' }));
  assert.equal(bare.worked, '', 'nothing to go by: never shown as cold');
  assert.equal(bare.noteDay, '');
  assert.equal(plain(cardOf_({ worked_at: 'yesterday', created_at: D })).worked, '2026-10-01', 'junk worked_at');
});

test('a new site is worked the moment it is added; note_at only with a note', () => {
  const w = world();
  const add = (note) => w.s.repAddSite(RIA, { name: `New ${note}`, buyerType: 'Dealer', phone: '03331112222', followUp: 'tomorrow', note });
  assert.equal(add('').ok, true);
  let row = rowOf(w, 6);
  assert.ok(isDate(row.worked_at));
  assert.equal(row.worked_at.getTime(), row.created_at.getTime());
  assert.equal(row.note_at, '');
  const reply = plain(add('met Bilal'));
  row = rowOf(w, 7);
  assert.equal(row.note_at.getTime(), row.created_at.getTime());
  assert.equal(reply.site.worked, karachiDay(0));
  assert.equal(reply.site.noteDay, karachiDay(0));
});

test('Update (P6-2): resets worked_at every time; note_at only when he writes a note', () => {
  const w = world();
  let reply = plain(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Rate Quoted', value: '450000', terms: 'Credit', followUp: '3days' }));
  assert.equal(reply.ok, true);
  let row = rowOf(w, 1);
  assert.ok(row.worked_at.getTime() > W.getTime(), 'a follow-up-only Update is still a real Update');
  assert.equal(row.worked_at.getTime(), row.updated_at.getTime());
  assert.equal(row.note_at.getTime(), N.getTime(), 'no note: the old note keeps its day');
  assert.equal(row.last_note, 'waiting for consultant');
  assert.equal(reply.site.worked, karachiDay(0));
  assert.equal(reply.site.noteDay, '2026-10-02');

  reply = plain(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Sample / Trial', followUp: '1week', note: 'trial on Monday' }));
  row = rowOf(w, 1);
  assert.equal(row.note_at.getTime(), row.worked_at.getTime());
  assert.equal(reply.site.noteDay, karachiDay(0));
  assert.equal(row['owner notes'], 'keep me');
});

test('Edit details (P6-2) changes neither worked_at nor note_at', () => {
  const w = world();
  const reply = plain(w.s.repEditSite(RIA, 'S000001', { name: 'F-11 Tower B', buyerType: 'Dealer', phone: '923001234567' }));
  assert.equal(reply.ok, true);
  const row = rowOf(w, 1);
  assert.equal(row.site_name, 'F-11 Tower B');
  assert.ok(row.updated_at.getTime() > W.getTime(), 'updated_at is still "any change"');
  assert.equal(row.worked_at.getTime(), W.getTime());
  assert.equal(row.note_at.getTime(), N.getTime());
  assert.equal(reply.site.worked, '2026-10-03');
});

test('his page data stays plain (no Dates) and his own sites only', () => {
  const reply = world().s.repLoad(RIA);
  assert.equal(holdsDate(reply), false);
  assert.ok(!JSON.stringify(plain(reply)).includes('Gulberg Mall'));
});

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

// ---------------------------------------------------------------------------------- Snooze

test('repSnoozeSite: only a working salesman link, and only his own sites (ADR-0004)', () => {
  for (const [k, id, message] of [
    [OWNER, 'S000001', "This link doesn't work. Ask the owner for a new one."],
    ['junk', 'S000001', "This link doesn't work. Ask the owner for a new one."],
    [RIA, 'S000002', "That site isn't in your list."], // SH's site
    [SH, 'S000001', "That site isn't in your list."], // RIA's site
    [RIA, 'S999999', "That site isn't in your list."],
    [RIA, { site_id: 'S000001' }, "That site isn't in your list."],
    [RIA, 'S000001 ', "That site isn't in your list."],
  ]) {
    const w = world();
    assert.throws(() => w.s.repSnoozeSite(k, id, { followUp: 'tomorrow' }), (e) => e.message === message,
      `${String(k).slice(0, 5)} ${JSON.stringify(id)}`);
    assert.deepEqual(w.diary._writes(), []);
  }
});

for (const [choice, days] of [['tomorrow', 1], ['3days', 3], ['1week', 7]]) {
  test(`Snooze ${choice}: the follow-up moves to today + ${days}; nothing else in the row`, () => {
    const w = world();
    const before = rowOf(w, 1);
    const reply = plain(w.s.repSnoozeSite(RIA, 'S000001', { followUp: choice }));
    assert.equal(reply.ok, true);
    const after = rowOf(w, 1);
    assert.equal(after.next_followup.toISOString(), dayStart(karachiDay(days)).toISOString());
    assert.ok(after.updated_at.getTime() > before.updated_at.getTime());
    for (const kept of SITES.filter((h) => !['next_followup', 'updated_at'].includes(h))) {
      assert.deepEqual(after[kept], before[kept], kept); // worked_at too: snooze is not work (P6-2)
    }
    assert.equal(reply.site.followUp, karachiDay(days));
    assert.equal(reply.site.worked, '2026-10-03', 'still going cold');
    assert.deepEqual(rowOf(w, 2), rowOf(world(), 2), "SH's row is untouched");
  });
}

test('Snooze: one snooze row in Activity, and nothing typed becomes a formula', () => {
  const w = world();
  w.s.repSnoozeSite(RIA, 'S000001', { followUp: '3days' });
  const a = lastActivity(w);
  assert.ok(isDate(a.timestamp));
  assert.equal(a.next_followup.toISOString(), dayStart(karachiDay(3)).toISOString());
  assert.deepEqual({ ...a, timestamp: 'D', next_followup: 'D' }, {
    activity_id: 'A0000008', timestamp: 'D', rep: 'RIA', site_id: 'S000001', action: 'snooze', from_stage: '',
    to_stage: '', value_rs: '', payment_terms: '', lost_reason: '', note: '', next_followup: 'D',
  });
  assert.equal(activityRows(w).length, 2);
  assert.ok(!JSON.stringify(w.diary._snapshot()).includes('FORMULA('));
});

test('Snooze: a site with no follow-up date gets one', () => {
  const w = world();
  w.diary.getSheetByName('Sites').getRange(2, SITES.indexOf('next_followup') + 1).setValues([['']]);
  assert.equal(plain(w.s.repSnoozeSite(RIA, 'S000001', { followUp: 'tomorrow' })).site.followUp, karachiDay(1));
});

test('Snooze: only the three buttons, only open sites; refusals write nothing', () => {
  const w = world();
  for (const input of [{ followUp: karachiDay(3) }, { followUp: 'date' }, { followUp: 'keep' }, { followUp: 'toString' },
    { followUp: 7 }, {}, null, 'tomorrow']) {
    assert.deepEqual(plain(w.s.repSnoozeSite(RIA, 'S000001', input)).ok, false, JSON.stringify(input));
  }
  assert.deepEqual(plain(w.s.repSnoozeSite(RIA, 'S000001', { followUp: 'date' })),
    { ok: false, message: 'Tap Tomorrow, 3 days or 1 week.' });
  assert.deepEqual(plain(w.s.repSnoozeSite(RIA, 'S000003', { followUp: 'tomorrow' })),
    { ok: false, message: 'Won and Lost sites have no follow-up.' });
  assert.deepEqual(w.diary._writes(), []);
});

test('Snooze never brings a follow-up earlier: nothing written, the card as it is, a notice', () => {
  const w = world();
  const reply = plain(w.s.repSnoozeSite(RIA, 'S000005', { followUp: '1week' }));
  const [, m, d] = karachiDay(10).split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  assert.deepEqual({ ok: reply.ok, notice: reply.notice, followUp: reply.site.followUp },
    { ok: true, notice: `Follow-up is already ${d} ${months[m - 1]}.`, followUp: karachiDay(10) });
  assert.deepEqual(w.diary._writes(), []);
  // The same day counts as "already" too: snoozing it twice changes nothing.
  w.s.repSnoozeSite(RIA, 'S000001', { followUp: 'tomorrow' });
  const writes = w.diary._writes().length;
  assert.equal(plain(w.s.repSnoozeSite(RIA, 'S000001', { followUp: 'tomorrow' })).notice !== undefined, true);
  assert.equal(w.diary._writes().length, writes);
});

test('Snooze: the reply carries only that site (no Dates, nobody else)', () => {
  const reply = world().s.repSnoozeSite(RIA, 'S000001', { followUp: 'tomorrow' });
  assert.equal(holdsDate(reply), false);
  const r = plain(reply);
  assert.equal(r.sites, undefined);
  assert.equal(r.site.id, 'S000001');
  assert.ok(!JSON.stringify(r).includes('Gulberg Mall'));
  assert.ok(!JSON.stringify(r).includes('Blue Area'));
});

test('Snooze saved twice (reply lost) is saved once, and repSaveStatus knows it', () => {
  const w = world();
  w.s.repSnoozeSite(RIA, 'S000001', { followUp: 'tomorrow', saveId: 'snooze00001' });
  w.s.repSnoozeSite(RIA, 'S000001', { followUp: 'tomorrow', saveId: 'snooze00001' });
  assert.equal(activityRows(w).filter((a) => a.action === 'snooze').length, 1);
  assert.deepEqual(plain(w.s.repSaveStatus(RIA, ['snooze00001', 'other000001'])), { ok: true, landed: ['snooze00001'] });
  assert.deepEqual(plain(w.s.repSaveStatus(SH, ['snooze00001'])), { ok: true, landed: [] }, "only his own saves");
});

test('Snooze after Update: going cold keeps the day of the Update', () => {
  const w = world();
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Rate Quoted', value: '450000', terms: 'Credit', followUp: 'tomorrow', note: 'x' });
  const worked = rowOf(w, 1).worked_at.getTime();
  w.s.repSnoozeSite(RIA, 'S000001', { followUp: '1week' });
  assert.equal(rowOf(w, 1).worked_at.getTime(), worked);
});

test('his page gets the going-cold threshold with the stage rules (owner Q5: 7 days)', () => {
  const rules = plain(world().s.repLoad(RIA)).rules;
  assert.equal(rules.coldDays, 7);
  assert.deepEqual(rules.hotStages, ['Sample / Trial', 'Rate Quoted']);
});

test("the page tidies a typed number exactly as the server does (Call / WhatsApp while saving)", () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.html'), 'utf8');
  const source = /function tidyPhone\(raw\) \{[\s\S]*?\n {6}\}/.exec(html);
  assert.ok(source, 'tidyPhone is in App.html');
  const page = vm.runInNewContext(`(${source[0]})`);
  const { tidyPhone_ } = world().s;
  for (const typed of ['0300 1234567', '0300-1234567', '+92 300 1234567', '+92 (0)300 1234567', '0092 300 1234567',
    '3001234567', '923001234567', '042 3576 1234', '+971 50 123 4567', '00971501234567', '0300 12', '0300 12345678',
    'n/a', '-', '', '   ', '+44 20 7946 0958', '051-1234567']) {
    const server = plain(tidyPhone_(typed));
    assert.equal(page(typed), server.ok ? server.phone : '', JSON.stringify(typed));
  }
});

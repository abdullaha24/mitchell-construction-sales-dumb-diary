'use strict';
// Spec 004: repUpdateSite and repEditSite. Whose site, what is written, the history.
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
const D = new Date('2026-10-01T05:00:00Z');

const site = (id, rep, name, phone, extra = {}) => SITES.map((h) => ({
  site_id: id, rep, region: rep === 'SH' ? 'Center' : 'North', site_name: name, buyer_type: 'Dealer', area: 'DHA',
  contact_name: 'Asif', contact_phone: phone, products: 'Tile Adhesives', stage: 'Visited / Lead',
  next_followup: D, last_note: 'first visit', created_at: D, updated_at: D, 'owner notes': 'keep me', ...extra,
})[h] ?? '');

function world() {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives', 'Tile Grouts'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Credit Terms', 'Competitor Approved', 'Site Delayed', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  lists.push(['area', 'DHA', 'North', 'RIA', true, 10]);
  const diary = makeSpreadsheet({
    Sites: [SITES,
      site('S000001', 'RIA', 'F-11 Tower', '923001234567'),
      site('S000002', 'SH', 'Gulberg Mall', '923007654321'),
      site('S000003', 'RIA', 'Blue Area', '')],
    Activity: [ACTIVITY, ['A0000003', D, 'RIA', 'S000003', 'created', '', 'Visited / Lead', '', '', '', '', D]],
    Lists: lists,
    Links: [LINKS, ['rep', 'RIA', RIA, true, D], ['rep', 'SH', SH, true, D], ['owner', '', OWNER, true, D]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaDataTabs(), { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const lockService = makeLockService();
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData }, onFlush: () => lockService._events.push('flush') }),
    Utilities: makeUtilities(), LockService: lockService, CacheService: makeCacheService(),
  });
  return { s: src.sandbox, diary, lockService };
}

const rowOf = (w, n) => {
  const values = w.diary.getSheetByName('Sites').getDataRange().getValues()[n];
  return Object.fromEntries(SITES.map((h, i) => [h, values[i]]));
};
const lastActivity = (w) => {
  const values = w.diary.getSheetByName('Activity').getDataRange().getValues();
  return Object.fromEntries(ACTIVITY.map((h, i) => [h, values[values.length - 1][i]]));
};
const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]';
const holdsDate = (v) => Object.prototype.toString.call(v) === '[object Date]'
  || (v && typeof v === 'object' && Object.values(v).some(holdsDate));
const QUOTE = { stage: 'Rate Quoted', value: '450,000', terms: 'Credit', followUp: '3days', note: 'WP-100 @ 1,450' };

// ------------------------------------------------------------------------------ Whose site

for (const [name, call] of [
  ['repUpdateSite', (w, k, id) => w.s.repUpdateSite(k, id, QUOTE)],
  ['repEditSite', (w, k, id) => w.s.repEditSite(k, id, { name: 'X', buyerType: 'Dealer' })],
]) {
  test(`${name}: only a working salesman link, and only his own sites`, () => {
    for (const [k, id, message] of [
      [OWNER, 'S000001', "This link doesn't work. Ask the admin for a new one."],
      ['junk', 'S000001', "This link doesn't work. Ask the admin for a new one."],
      [RIA, 'S000002', "That site isn't in your list."], // SH's site
      [SH, 'S000001', "That site isn't in your list."], // RIA's site
      [RIA, 'S999999', "That site isn't in your list."],
      [RIA, { site_id: 'S000001' }, "That site isn't in your list."],
      [RIA, 'S000001 ', "That site isn't in your list."],
    ]) {
      const w = world();
      assert.throws(() => call(w, k, id), (e) => e.message === message, `${String(k).slice(0, 5)} ${JSON.stringify(id)}`);
      assert.deepEqual(w.diary._writes(), []);
    }
  });
}

// ---------------------------------------------------------------------------------- Update

test('Update: only the changed cells, nothing else in the row (owner columns untouched)', () => {
  const w = world();
  const before = rowOf(w, 1);
  const reply = w.s.repUpdateSite(RIA, 'S000001', QUOTE);
  assert.equal(reply.ok, true);
  const after = rowOf(w, 1);
  assert.equal(after.stage, 'Rate Quoted');
  assert.equal(after.value_rs, 450000);
  assert.equal(after.payment_terms, 'Credit');
  assert.equal(after.last_note, 'WP-100 @ 1,450');
  assert.ok(isDate(after.next_followup));
  assert.ok(after.updated_at.getTime() > before.updated_at.getTime());
  for (const kept of ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name', 'contact_phone', 'products', 'created_at', 'owner notes']) {
    assert.deepEqual(after[kept], before[kept], kept);
  }
  assert.deepEqual(rowOf(w, 2), rowOf(world(), 2), "SH's row is untouched");
});

test('Update: one Activity row, stage_change with from / to, value, terms, note, follow-up', () => {
  const w = world();
  w.s.repUpdateSite(RIA, 'S000001', QUOTE);
  const a = lastActivity(w);
  assert.ok(isDate(a.timestamp) && isDate(a.next_followup));
  assert.deepEqual({ ...a, timestamp: 'D', next_followup: 'D' }, {
    activity_id: 'A0000004', timestamp: 'D', rep: 'RIA', site_id: 'S000001', action: 'stage_change',
    from_stage: 'Visited / Lead', to_stage: 'Rate Quoted', value_rs: 450000, payment_terms: 'Credit',
    lost_reason: '', note: 'WP-100 @ 1,450', next_followup: 'D',
  });
});

test('Update: same stage with a new note or date → an "update" row, no from / to', () => {
  const w = world();
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: '1week', note: 'called again' });
  const a = lastActivity(w);
  assert.deepEqual([a.action, a.from_stage, a.to_stage, a.note], ['update', '', '', 'called again']);
});

test('Won clears the follow-up; Lost too, with its reason; leaving Lost clears the reason', () => {
  const w = world();
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Won (Order)', value: '500000', terms: 'Cash' });
  assert.deepEqual([rowOf(w, 1).stage, rowOf(w, 1).next_followup, rowOf(w, 1).value_rs], ['Won (Order)', '', 500000]);
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Lost / Dead', lostReason: 'Competitor Approved' });
  assert.deepEqual([rowOf(w, 1).lost_reason, rowOf(w, 1).next_followup, rowOf(w, 1).value_rs], ['Competitor Approved', '', 500000]);
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: 'tomorrow' });
  assert.equal(rowOf(w, 1).lost_reason, '');
  assert.ok(isDate(rowOf(w, 1).next_followup));
  const actions = w.diary.getSheetByName('Activity').getDataRange().getValues().slice(2).map((r) => `${r[5]}>${r[6]}`);
  assert.deepEqual(actions, ['Visited / Lead>Won (Order)', 'Won (Order)>Lost / Dead', 'Lost / Dead>Visited / Lead']);
});

test('the number gate: a site without a number gets one on the way to Sample / Trial', () => {
  const w = world();
  assert.deepEqual(plain(w.s.repUpdateSite(RIA, 'S000003', { stage: 'Sample / Trial', followUp: 'tomorrow' })),
    { ok: false, message: "Add the contact's number to move this site to Sample / Trial." });
  assert.deepEqual(w.diary._writes(), []);
  const reply = plain(w.s.repUpdateSite(RIA, 'S000003', { stage: 'Sample / Trial', followUp: 'tomorrow', phone: '+92 300 7654321' }));
  assert.deepEqual(reply.warning, { team: true, mine: [] }, "SH's number: only 'yes'");
  assert.equal(rowOf(w, 3).contact_phone, '923007654321');
  assert.equal(w.diary.getSheetByName('Sites')._numberFormat(4, 8), '@');
  assert.equal(lastActivity(w).note, 'Phone added 923007654321');
  assert.ok(!JSON.stringify(reply).includes('Gulberg Mall'));
});

test('something to fix or nothing changed → a plain message and nothing written', () => {
  const w = world();
  assert.deepEqual(plain(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Rate Quoted', followUp: 'tomorrow' })),
    { ok: false, message: 'Type the total Rs. value.' });
  assert.deepEqual(plain(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Lost / Dead', lostReason: 'Other' })),
    { ok: false, message: 'Write a short note for Other.' });
  assert.deepEqual(plain(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: '2026-10-01' })).ok, false);
  assert.deepEqual(w.diary._writes(), []);
});

test('typed notes are stored as text, never as formulas', () => {
  const w = world();
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: 'tomorrow', note: '=TEXTJOIN(",",1,Links!C:C)' });
  assert.equal(rowOf(w, 1).last_note, '=TEXTJOIN(",",1,Links!C:C)');
  assert.ok(!JSON.stringify(w.diary._snapshot()).includes('FORMULA('));
});

test('the same Update saved twice (reply lost) is saved once', () => {
  const w = world();
  w.s.repUpdateSite(RIA, 'S000001', { ...QUOTE, saveId: 'update00001' });
  w.s.repUpdateSite(RIA, 'S000001', { ...QUOTE, saveId: 'update00001' });
  assert.equal(w.diary.getSheetByName('Activity').getLastRow(), 3);
});

test('the reply carries only the updated site (spec 005), plain values only', () => {
  const reply = world().s.repUpdateSite(RIA, 'S000001', QUOTE);
  assert.equal(holdsDate(reply), false);
  const r = plain(reply);
  assert.equal(r.sites, undefined, 'not his whole list');
  assert.deepEqual([r.site.id, r.site.stage, r.site.value, r.site.terms, r.site.note, r.site.name],
    ['S000001', 'Rate Quoted', 450000, 'Credit', 'WP-100 @ 1,450', 'F-11 Tower']);
  assert.ok(!JSON.stringify(r).includes('Gulberg Mall'));
  const edit = plain(world().s.repEditSite(RIA, 'S000001', { ...DETAILS, name: 'F-11 B', area: 'Saddar' }));
  assert.deepEqual([edit.site.name, edit.site.area], ['F-11 B', 'Saddar']);
  assert.deepEqual(edit.areas, ['DHA', 'Saddar'], 'a new area comes back so his page can offer it');
});

test('updates run inside the script lock and save before letting go', () => {
  const w = world();
  w.s.repUpdateSite(RIA, 'S000001', QUOTE);
  assert.deepEqual(w.lockService._events, ['waitLock 10000', 'flush', 'releaseLock']);
});

// ---------------------------------------------------------------------------- Edit details

const DETAILS = { name: 'F-11 Tower', buyerType: 'Dealer', contactName: 'Asif', phone: '923001234567', products: ['Tile Adhesives'], area: 'DHA' };

test('Edit details: changed fields saved; the history names them, with the old and new number', () => {
  const w = world();
  const reply = plain(w.s.repEditSite(RIA, 'S000001', { ...DETAILS, name: 'F-11 Tower B', phone: '0300 9998888' }));
  assert.equal(reply.ok, true);
  assert.deepEqual([rowOf(w, 1).site_name, rowOf(w, 1).contact_phone, rowOf(w, 1)['owner notes']], ['F-11 Tower B', '923009998888', 'keep me']);
  const a = lastActivity(w);
  assert.deepEqual([a.action, a.note, a.from_stage], ['details', 'Site name; Phone 923001234567 → 923009998888', '']);
});

test("Edit details: a number can't be removed; nothing changed saves nothing", () => {
  const w = world();
  assert.deepEqual(plain(w.s.repEditSite(RIA, 'S000001', { ...DETAILS, phone: '' })),
    { ok: false, message: "A site's number can be changed, not removed." });
  assert.deepEqual(plain(w.s.repEditSite(RIA, 'S000001', DETAILS)), { ok: false, message: 'Nothing to save.' });
  assert.deepEqual(w.diary._writes(), []);
});

test('Edit details: a new area goes into Lists; text stays text', () => {
  const w = world();
  w.s.repEditSite(RIA, 'S000001', { ...DETAILS, area: 'Saddar', contactName: '=1+1' });
  const lists = w.diary.getSheetByName('Lists').getDataRange().getValues();
  assert.deepEqual(lists[lists.length - 1].slice(0, 4), ['area', 'Saddar', 'North', 'RIA']);
  assert.deepEqual([rowOf(w, 1).area, rowOf(w, 1).contact_name], ['Saddar', '=1+1']);
});

test("Edit details: the duplicate warning counts other sites, not this one", () => {
  const w = world();
  // Same number as before: no change, nothing to warn about.
  assert.deepEqual(plain(w.s.repEditSite(RIA, 'S000003', { ...DETAILS, name: 'Blue Area', phone: '0300 1234567' })).warning,
    { team: false, mine: ['F-11 Tower'] }, 'his other site has it');
  assert.deepEqual(plain(w.s.repEditSite(RIA, 'S000001', { ...DETAILS, phone: '0300 7654321' })).warning,
    { team: true, mine: [] }, "SH's number: only 'yes'");
});

test('inside the lock the site is found again by ID and his code (e.g. owner just reassigned it)', () => {
  const w = world();
  const ria = { rep: 'RIA', region: 'North' };
  assert.throws(() => w.s.saveUpdate_(w.diary, ria, 'S000002', { stage: 'Visited / Lead', followUp: 'tomorrow', note: 'x' }, new Date(), ''),
    /That site isn't in your list/);
  assert.throws(() => w.s.saveDetails_(w.diary, ria, 'S000002', { name: 'X', buyerType: 'Dealer' }, new Date(), ''),
    /That site isn't in your list/);
  assert.deepEqual(w.diary._writes(), []);
});

// ------------------------------------------------------------------- Fixes from the review

test('a number added a moment ago (by another save) cannot be removed by a stale Edit details', () => {
  const w = world();
  // Phone A: adds a number to Blue Area through the number gate.
  w.s.repUpdateSite(RIA, 'S000003', { stage: 'Sample / Trial', followUp: 'tomorrow', phone: '0321 5556666' });
  // Phone B still showed "No number yet" and sends Edit details with an empty number.
  const reply = plain(w.s.repEditSite(RIA, 'S000003', { ...DETAILS, name: 'Blue Area 2', phone: '' }));
  assert.deepEqual(reply, { ok: false, message: "A site's number can be changed, not removed." });
  assert.equal(rowOf(w, 3).contact_phone, '923215556666');
});

test('a repeat after a lost reply says Saved, not "Nothing to save", and saves once', () => {
  const w = world();
  const first = plain(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Won (Order)', value: '500000', terms: 'Cash', saveId: 'won0000001' }));
  const again = plain(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Won (Order)', value: '500000', terms: 'Cash', saveId: 'won0000001' }));
  assert.equal(first.ok, true);
  assert.equal(again.ok, true, again.message);
  assert.equal(w.diary.getSheetByName('Activity').getLastRow(), 3, 'one history row');
  const edit = { ...DETAILS, name: 'Renamed', saveId: 'edit000001' };
  assert.equal(plain(w.s.repEditSite(RIA, 'S000001', edit)).ok, true);
  assert.equal(plain(w.s.repEditSite(RIA, 'S000001', edit)).ok, true);
  assert.equal(w.diary.getSheetByName('Activity').getLastRow(), 4);
});

test('the same save ID sent again with a corrected value saves the correction', () => {
  const w = world();
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Won (Order)', value: '500000', terms: 'Cash', saveId: 'won0000002' });
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Won (Order)', value: '750000', terms: 'Cash', saveId: 'won0000002' });
  assert.equal(rowOf(w, 1).value_rs, 750000);
});

test('a new site sent again with changes after it was saved: not made twice, and he is told', () => {
  const w = world();
  const site = { name: 'Askari', buyerType: 'Dealer', followUp: 'tomorrow', saveId: 'newsite001' };
  w.s.repAddSite(RIA, site);
  const reply = plain(w.s.repAddSite(RIA, { ...site, name: 'Askari Heights' }));
  assert.equal(reply.ok, true);
  assert.equal(reply.notice, 'This site was already saved. Open it from your list to change anything.');
  assert.equal(w.diary.getSheetByName('Sites').getLastRow(), 5, 'one new site, not two');
  assert.equal(plain(w.s.repAddSite(RIA, site)).notice, '', 'a plain repeat needs no notice');
});

test("an update never erases a value or reason it isn't changing (e.g. typed by the owner)", () => {
  const w = world();
  w.diary.getSheetByName('Sites').getRange(2, 11, 1, 3).setValues([["'4.5 lakh", 'Cash', "'my own words"]]);
  w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: '1week', note: 'called' });
  assert.deepEqual([rowOf(w, 1).value_rs, rowOf(w, 1).payment_terms], ['4.5 lakh', 'Cash']);
});

test('junk in the phone cell ("-", "n/a") is no number: shown as such, and the gate applies', () => {
  const w = world();
  w.diary.getSheetByName('Sites').getRange(4, 8).setValues([['-']]);
  const card = plain(w.s.repLoad(RIA)).sites.find((x) => x.id === 'S000003');
  assert.equal(card.phone, '');
  assert.deepEqual(plain(w.s.repUpdateSite(RIA, 'S000003', { stage: 'Won (Order)', value: '5', terms: 'Cash' })),
    { ok: false, message: "Add the contact's number to move this site to Won (Order)." });
});

test("Edit details keeps an area or product the owner has since turned off, without re-adding it", () => {
  const w = world();
  const sites = w.diary.getSheetByName('Sites');
  sites.getRange(2, 6).setValues([["'Old Area"]]);
  sites.getRange(2, 9).setValues([["'Tile Adhesives | Old Category"]]);
  const listsBefore = w.diary.getSheetByName('Lists').getLastRow();
  const reply = plain(w.s.repEditSite(RIA, 'S000001', {
    ...DETAILS, name: 'Renamed', area: 'Old Area', products: ['Tile Adhesives', 'Old Category'],
  }));
  assert.equal(reply.ok, true, reply.message);
  assert.equal(w.diary.getSheetByName('Lists').getLastRow(), listsBefore, 'nothing added to Lists');
  assert.deepEqual([rowOf(w, 1).area, rowOf(w, 1).products], ['Old Area', 'Tile Adhesives | Old Category']);
  // He can still untick the old category.
  assert.equal(plain(w.s.repEditSite(RIA, 'S000001', { ...DETAILS, name: 'Renamed', area: 'Old Area', products: ['Tile Adhesives'] })).ok, true);
  assert.equal(rowOf(w, 1).products, 'Tile Adhesives');
});

test('the locked save itself refuses to remove a number (the check runs inside the lock)', () => {
  const w = world();
  const ria = { rep: 'RIA', region: 'North' };
  const outcome = plain(w.s.saveDetails_(w.diary, ria, 'S000001', { ...DETAILS, name: 'X', phone: '' }, new Date(), ''));
  assert.deepEqual(outcome.result, { ok: false, message: "A site's number can be changed, not removed." });
  const gate = plain(w.s.saveUpdate_(w.diary, ria, 'S000003', { stage: 'Won (Order)', value: '5', terms: 'Cash' },
    new Date(), ''));
  assert.deepEqual(gate.result, { ok: false, message: "Add the contact's number to move this site to Won (Order)." });
  assert.deepEqual(w.diary._writes(), []);
});

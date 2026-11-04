'use strict';
// Spec 003: the salesman's server functions. Privacy (ADR-0004), refusals, and what a save writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeCacheService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const LISTS = ['list', 'value', 'region', 'added_by', 'active', 'sort'];
const LINKS = ['role', 'rep', 'token', 'active', 'issued_at'];

const RIA = 'a'.repeat(64);
const SH = 'b'.repeat(64);
const OWNER = 'c'.repeat(64);
const CANCELLED_SJ = 'd'.repeat(64);
const MUB = 'e'.repeat(64);
const D1 = new Date('2026-10-01T05:00:00Z');
const D2 = new Date('2026-10-02T05:00:00Z');
const D3 = new Date('2026-10-03T05:00:00Z');

const site = (id, rep, region, name, phone, created, extra = {}) => SITES.map((h) => ({
  site_id: id, rep, region, site_name: name, buyer_type: 'Dealer', area: 'DHA', contact_name: `${name} contact`,
  contact_phone: phone, products: 'Tile Adhesives', stage: 'Visited / Lead', next_followup: created,
  created_at: created, updated_at: created, ...extra,
})[h] ?? '');

function lists() {
  const rows = [LISTS];
  ['Tile Adhesives', 'Waterproofing Job', 'Mortars, Plasters & Putties']
    .forEach((v, i) => rows.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer']
    .forEach((v, i) => rows.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  rows.push(['area', 'DHA', 'North', 'RIA', true, 10]);
  rows.push(['area', 'F-11', 'North', 'AUR', true, 20]);
  rows.push(['area', 'Gulberg', 'Center', 'SH', true, 10]);
  rows.push(['area', 'Old Area', 'North', 'RIA', false, 30]);
  rows.push(['area', 'Everywhere', '', 'owner', true, 5]);
  return rows;
}

function world({ metaTabs = metaDataTabs(), sites, activity, busyLock = false, diaryOpens = true } = {}) {
  const diary = makeSpreadsheet({
    Sites: sites || [
      SITES,
      site('S000001', 'RIA', 'North', 'F-11 Tower', '923001234567', D1),
      site('S000002', 'SH', 'Center', 'Gulberg Mall', '923007654321', D2),
      site('S000003', 'RIA', 'North', 'Blue Area Plaza', '', D3),
    ],
    Activity: activity || [ACTIVITY, ['A0000003', D3, 'RIA', 'S000003', 'created', '', 'Visited / Lead', '', '', '', '', D3]],
    Lists: lists(),
    Links: [
      LINKS,
      ['rep', 'RIA', RIA, true, D1], ['rep', 'SH', SH, true, D1], ['owner', '', OWNER, true, D1],
      ['rep', 'SJ', CANCELLED_SJ, false, D1], ['rep', 'MUB', MUB, true, D1],
    ],
  }, { name: 'Sales Diary' });
  const byId = diaryOpens ? { [SALES_DIARY_ID]: diary } : {};
  if (metaTabs) byId[META_DATA_ID] = makeSpreadsheet(metaTabs, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const lockService = makeLockService({ busy: busyLock });
  const app = makeSpreadsheetApp({ byId, onFlush: () => lockService._events.push('flush') });
  const cacheService = makeCacheService();
  const src = loadSrc({ SpreadsheetApp: app, Utilities: makeUtilities(), LockService: lockService, CacheService: cacheService });
  return { s: src.sandbox, diary, lockService, cacheService };
}

/** Today and tomorrow in Karachi, worked out without src/. */
function karachiDay(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
  const [y, m, d] = parts.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}
const holdsDate = (v) => Object.prototype.toString.call(v) === '[object Date]'
  || (v && typeof v === 'object' && Object.values(v).some(holdsDate));
const GOOD = {
  name: 'New Site', buyerType: 'Project Owner', contactName: 'Bilal', phone: '0333 1112222',
  products: ['Waterproofing Job', 'Mortars, Plasters & Putties'], area: 'DHA', followUp: 'tomorrow',
};

// ---------------------------------------------------------------------------------- Refusals

const NOT_A_SALESMAN = [
  ["the owner's link", OWNER], ['a cancelled link', CANCELLED_SJ], ['a salesman removed from Rep_Mapping', MUB],
  ['a made-up code', 'f'.repeat(64)], ['junk', 'hello'], ['nothing', undefined],
];
for (const [what, k] of NOT_A_SALESMAN) {
  test(`${what} gets "This link doesn't work" from every salesman function, and nothing is written`, () => {
    const w = world();
    const before = JSON.stringify(w.diary._snapshot());
    for (const call of [() => w.s.repLoad(k), () => w.s.repCheckPhone(k, '03001234567'), () => w.s.repAddSite(k, GOOD)]) {
      assert.throws(call, (e) => e.message === "This link doesn't work. Ask the owner for a new one.");
    }
    assert.equal(JSON.stringify(w.diary._snapshot()), before);
    assert.deepEqual(w.diary._writes(), []);
  });
}

test('Google failing throws a plain error, never the code', () => {
  const w = world({ metaTabs: null });
  for (const call of [() => w.s.repLoad(RIA), () => w.s.repAddSite(RIA, GOOD)]) {
    assert.throws(call, (e) => !e.message.includes(RIA));
  }
  assert.deepEqual(w.diary._writes(), []);
});

// ----------------------------------------------------------------------------------- Privacy

test("repLoad: only his own sites, newest first, and nothing of anyone else's", () => {
  const reply = plain(world().s.repLoad(RIA));
  assert.equal(reply.ok, true);
  assert.equal(reply.rep, 'RIA');
  assert.equal(reply.region, 'North');
  assert.deepEqual(reply.sites.map((x) => x.id), ['S000003', 'S000001']);
  const text = JSON.stringify(reply);
  for (const secret of ['Gulberg Mall', 'S000002', '923007654321', 'Gulberg Mall contact', 'SH', SH, OWNER, RIA]) {
    assert.ok(!text.includes(secret), `reply leaks ${secret}`);
  }
});

test("repLoad: area names of his region (and no-region ones), active only, never who added them", () => {
  const reply = plain(world().s.repLoad(RIA));
  assert.deepEqual(reply.areas, ['Everywhere', 'DHA', 'F-11']);
  assert.ok(!JSON.stringify(reply.areas).includes('AUR'));
  assert.deepEqual(plain(world().s.repLoad(SH)).areas, ['Everywhere', 'Gulberg']);
});

test('repLoad: pick-lists in sort order, and a card per site with plain values only', () => {
  const reply = world().s.repLoad(RIA);
  assert.equal(holdsDate(reply), false);
  const plainReply = plain(reply);
  assert.deepEqual(plainReply.categories, ['Tile Adhesives', 'Waterproofing Job', 'Mortars, Plasters & Putties']);
  assert.deepEqual(plainReply.buyerTypes, ['Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer']);
  assert.deepEqual(plainReply.sites[1], {
    id: 'S000001', name: 'F-11 Tower', area: 'DHA', buyerType: 'Dealer', stage: 'Visited / Lead',
    contactName: 'F-11 Tower contact', phone: '923001234567', followUp: '2026-10-01', created: '2026-10-01',
    value: null, terms: '', lostReason: '', note: '', products: ['Tile Adhesives'],
  });
  assert.deepEqual(plainReply.lostReasons, [], 'this test sheet has no lost reasons');
  assert.match(plainReply.today, /^\d{4}-\d{2}-\d{2}$/);
});

test("repCheckPhone: another salesman's number → only 'yes, someone in the team'", () => {
  const reply = plain(world().s.repCheckPhone(RIA, '+92 300 7654321'));
  assert.deepEqual(reply, { ok: true, valid: true, team: true, mine: [] });
});

test('repCheckPhone: his own number → the names of his sites with it', () => {
  assert.deepEqual(plain(world().s.repCheckPhone(RIA, '0300-1234567')),
    { ok: true, valid: true, team: false, mine: ['F-11 Tower'] });
  assert.deepEqual(plain(world().s.repCheckPhone(SH, '0300-1234567')),
    { ok: true, valid: true, team: true, mine: [] }, 'SH only learns "yes" about RIA');
});

test('repCheckPhone: a new number, a blank one and a wrong one', () => {
  const w = world();
  assert.deepEqual(plain(w.s.repCheckPhone(RIA, '0321 0000000')), { ok: true, valid: true, team: false, mine: [] });
  assert.deepEqual(plain(w.s.repCheckPhone(RIA, '')), { ok: true, valid: true, team: false, mine: [] });
  assert.deepEqual(plain(w.s.repCheckPhone(RIA, '0300-12')), { ok: true, valid: false, team: false, mine: [] });
  assert.deepEqual(w.diary._writes(), []);
});

// ------------------------------------------------------------------------------------ Saving

test('repAddSite: the exact Sites and Activity rows, who and where from the link', () => {
  const w = world();
  const tomorrow = karachiDay(1);
  const reply = w.s.repAddSite(RIA, { ...GOOD, rep: 'SH', region: 'South' });
  assert.equal(reply.ok, true);
  assert.equal(reply.savedId, undefined, 'the reply never shows team-wide IDs');
  assert.equal(w.diary.getSheetByName('Sites').getDataRange().getValues()[4][0], 'S000004');
  const sitesRows = w.diary.getSheetByName('Sites').getDataRange().getValues();
  const row = Object.fromEntries(SITES.map((h, i) => [h, sitesRows[4][i]]));
  const followUp = row.next_followup;
  assert.equal(followUp.toISOString(), new Date(`${tomorrow}T00:00:00+05:00`).toISOString());
  assert.equal(row.created_at.getTime(), row.updated_at.getTime());
  assert.deepEqual({ ...row, next_followup: 'D', created_at: 'D', updated_at: 'D' }, {
    site_id: 'S000004', rep: 'RIA', region: 'North', site_name: 'New Site', buyer_type: 'Project Owner',
    area: 'DHA', contact_name: 'Bilal', contact_phone: '923331112222',
    products: 'Waterproofing Job | Mortars, Plasters & Putties', stage: 'Visited / Lead', value_rs: '',
    payment_terms: '', lost_reason: '', next_followup: 'D', last_note: '', created_at: 'D', updated_at: 'D',
  });
  assert.equal(w.diary.getSheetByName('Sites')._numberFormat(5, 8), '@', 'phone cell set to text first');

  const activityRows = w.diary.getSheetByName('Activity').getDataRange().getValues();
  const act = Object.fromEntries(ACTIVITY.map((h, i) => [h, activityRows[2][i]]));
  assert.equal(act.timestamp.getTime(), row.created_at.getTime());
  assert.equal(act.next_followup.getTime(), followUp.getTime());
  assert.deepEqual({ ...act, timestamp: 'D', next_followup: 'D' }, {
    activity_id: 'A0000004', timestamp: 'D', rep: 'RIA', site_id: 'S000004', action: 'created', from_stage: '',
    to_stage: 'Visited / Lead', value_rs: '', payment_terms: '', lost_reason: '', note: '', next_followup: 'D',
  });
});

test('repAddSite: the reply is his refreshed page, new site first, plain values only', () => {
  const reply = world().s.repAddSite(RIA, GOOD);
  assert.equal(holdsDate(reply), false);
  assert.deepEqual(plain(reply).sites.map((x) => x.id), ['S000004', 'S000003', 'S000001']);
  assert.ok(!JSON.stringify(plain(reply)).includes('Gulberg Mall'));
});

test('repAddSite: a new area goes into Lists for his region, and only his region sees it', () => {
  const w = world();
  const reply = plain(w.s.repAddSite(RIA, { ...GOOD, area: ' Saddar ' }));
  const listRows = plain(w.diary.getSheetByName('Lists').getDataRange().getValues());
  assert.deepEqual(listRows[listRows.length - 1], ['area', 'Saddar', 'North', 'RIA', true, 40]);
  assert.ok(reply.areas.includes('Saddar'));
  assert.ok(!plain(w.s.repLoad(SH)).areas.includes('Saddar'));
});

test('repAddSite: an existing area typed differently is reused, not added again', () => {
  const w = world();
  const before = w.diary.getSheetByName('Lists').getLastRow();
  w.s.repAddSite(RIA, { ...GOOD, area: 'f 11' });
  assert.equal(w.diary.getSheetByName('Lists').getLastRow(), before);
  assert.equal(w.diary.getSheetByName('Sites').getDataRange().getValues()[4][5], 'F-11');
});

test('saving re-checks areas inside the lock: one added a moment ago is reused', () => {
  const w = world();
  const before = w.diary.getSheetByName('Lists').getLastRow();
  const siteValues = { name: 'X', buyerType: 'Dealer', contactName: '', phone: '', products: [], area: 'd.h.a', newArea: true, followUp: '2026-11-05' };
  w.s.saveNewSite_(w.diary, { rep: 'RIA', region: 'North' }, siteValues, new Date('2026-11-04T05:00:00Z'));
  assert.equal(w.diary.getSheetByName('Lists').getLastRow(), before);
  assert.equal(w.diary.getSheetByName('Sites').getDataRange().getValues()[4][5], 'DHA');
});

test('repAddSite: something to fix → a plain message, and nothing is written', () => {
  const w = world();
  assert.deepEqual(plain(w.s.repAddSite(RIA, { ...GOOD, name: '' })), { ok: false, message: 'Type the site name.' });
  assert.deepEqual(plain(w.s.repAddSite(RIA, { ...GOOD, phone: '0300-12' })), { ok: false, message: 'Check the number.' });
  assert.deepEqual(plain(w.s.repAddSite(RIA, { ...GOOD, area: 'Gulberg' })).ok, true, "another region's area name is simply a new area for him");
  const w2 = world();
  w2.s.repAddSite(RIA, { ...GOOD, buyerType: 'Builder' });
  assert.deepEqual(w2.diary._writes(), []);
});

test('repAddSite: saving without a number is allowed (the page asks twice)', () => {
  const w = world();
  const reply = plain(w.s.repAddSite(RIA, { ...GOOD, phone: '' }));
  assert.equal(reply.sites[0].phone, '');
});

test('IDs are never reused, even when a site row was deleted by hand', () => {
  const w = world({
    sites: [SITES, site('S000001', 'RIA', 'North', 'A', '', D1)],
    activity: [ACTIVITY, ['A0000009', D1, 'RIA', 'S000009', 'created', '', 'Visited / Lead', '', '', '', '', D1]],
  });
  w.s.repAddSite(RIA, GOOD);
  assert.equal(w.diary.getSheetByName('Sites').getDataRange().getValues().pop()[0], 'S000010');
  const act = w.diary.getSheetByName('Activity').getDataRange().getValues();
  assert.equal(act[act.length - 1][0], 'A0000010');
});

test('typed text is always stored as text: no formulas, no numbers (formula injection)', () => {
  const w = world();
  const attack = {
    ...GOOD, name: '=TEXTJOIN(",",1,Links!C:C)', contactName: '+92 0300', area: '=IMPORTXML("http://x")',
    products: [],
  };
  w.s.repAddSite(RIA, attack);
  const sitesRow = w.diary.getSheetByName('Sites').getDataRange().getValues()[4];
  assert.equal(sitesRow[3], '=TEXTJOIN(",",1,Links!C:C)', 'site name kept as text');
  assert.equal(sitesRow[6], '+92 0300', 'contact name kept as text');
  assert.equal(sitesRow[5], '=IMPORTXML("http://x")', 'area kept as text');
  const listRows = w.diary.getSheetByName('Lists').getDataRange().getValues();
  assert.equal(listRows[listRows.length - 1][1], '=IMPORTXML("http://x")', 'new area kept as text');
  const everything = JSON.stringify(w.diary._snapshot());
  assert.ok(!everything.includes('FORMULA('), 'no formula anywhere in the sheet');
  const reply = JSON.stringify(plain(w.s.repLoad(RIA)));
  for (const code of [SH, OWNER, CANCELLED_SJ, MUB]) assert.ok(!reply.includes(code));
  // A name of digits keeps its leading 0.
  w.s.repAddSite(RIA, { ...GOOD, name: '0300', contactName: '007' });
  const last = w.diary.getSheetByName('Sites').getDataRange().getValues().pop();
  assert.deepEqual([last[3], last[6]], ['0300', '007']);
});

test('the same form saved twice (reply lost on a weak signal) is saved once', () => {
  const w = world();
  const first = plain(w.s.repAddSite(RIA, { ...GOOD, saveId: 'abc12345XYZ' }));
  const again = plain(w.s.repAddSite(RIA, { ...GOOD, saveId: 'abc12345XYZ' }));
  assert.equal(w.diary.getSheetByName('Sites').getLastRow(), 5, 'one new row, not two');
  assert.equal(w.diary.getSheetByName('Activity').getLastRow(), 3);
  assert.deepEqual(again.sites.map((x) => x.id), first.sites.map((x) => x.id));
  w.s.repAddSite(RIA, { ...GOOD, saveId: 'anotherForm1' });
  assert.equal(w.diary.getSheetByName('Sites').getLastRow(), 6, 'a new form saves again');
  // The one-time ID is per salesman: SH can't block RIA's save by guessing it.
  w.s.repAddSite(SH, { ...GOOD, saveId: 'abc12345XYZ' });
  assert.equal(w.diary.getSheetByName('Sites').getLastRow(), 7);
  // A badly shaped ID is ignored (the save still happens).
  w.s.repAddSite(RIA, { ...GOOD, saveId: 'x' });
  w.s.repAddSite(RIA, { ...GOOD, saveId: 'x' });
  assert.equal(w.diary.getSheetByName('Sites').getLastRow(), 9);
});

test('the save reply repeats the duplicate check (in case Save beat the check while typing)', () => {
  const w = world();
  assert.deepEqual(plain(w.s.repAddSite(RIA, { ...GOOD, phone: '0300 7654321' })).warning, { team: true, mine: [] });
  assert.deepEqual(plain(w.s.repAddSite(RIA, { ...GOOD, phone: '0300 1234567', saveId: 'second001' })).warning,
    { team: false, mine: ['F-11 Tower'] });
  assert.deepEqual(plain(w.s.repAddSite(RIA, { ...GOOD, phone: '', saveId: 'third0001' })).warning, { team: false, mine: [] });
});

test('a busy lock says "Busy right now", not something that reads like no signal', () => {
  const w = world({ busyLock: true });
  assert.throws(() => w.s.repAddSite(RIA, GOOD), (e) => e.message === 'Busy right now. Try again in a moment.');
  assert.deepEqual(w.diary._writes(), []);
});

test("Google's own error text never reaches a salesman: only our plain messages", () => {
  const w = world({ diaryOpens: false });
  for (const call of [() => w.s.repLoad(RIA), () => w.s.repCheckPhone(RIA, '03001234567'), () => w.s.repAddSite(RIA, GOOD)]) {
    assert.throws(call, (e) => e.message === 'Something went wrong. Try again in a minute.');
  }
});

test('saving runs inside the script lock and saves before letting go', () => {
  const w = world();
  w.s.repAddSite(RIA, GOOD);
  assert.deepEqual(w.lockService._events, ['waitLock 10000', 'flush', 'releaseLock']);
});

test('the Meta-Data sheet is never written by any salesman function', () => {
  // The fake Meta-Data throws on any write; these all succeed, so none was attempted.
  const w = world();
  w.s.repLoad(RIA);
  w.s.repCheckPhone(RIA, '03001234567');
  w.s.repAddSite(RIA, GOOD);
});

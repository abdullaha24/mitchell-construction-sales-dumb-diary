'use strict';
// Spec 005 → Server speed: how many sheet opens and tab reads each salesman call costs, and the
// salesmen list kept for 24 hours (Refresh salesmen, Check setup).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeCacheService,
  makePropertiesService, makeSession, makeHtmlService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const RIA = 'a'.repeat(64);
const D = new Date('2026-10-01T05:00:00Z');
const OWNER = 'owner@example.com';

function world({ activeEmail = OWNER, metaTabs = metaDataTabs() } = {}) {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, SITES.map((h) => ({ site_id: 'S000001', rep: 'RIA', region: 'North', site_name: 'F-11', buyer_type: 'Dealer',
      contact_phone: '923001234567', stage: 'Visited / Lead', next_followup: D, created_at: D, updated_at: D })[h] ?? '')],
    Activity: [ACTIVITY],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, D]],
  }, { name: 'Sales Diary' });
  const metaData = metaTabs && makeSpreadsheet(metaTabs, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const byId = { [SALES_DIARY_ID]: diary };
  if (metaData) byId[META_DATA_ID] = metaData;
  const app = makeSpreadsheetApp({ byId, active: diary });
  const opened = [];
  const props = makePropertiesService();
  const src = loadSrc({
    SpreadsheetApp: { ...app, openById(id) { opened.push(id === SALES_DIARY_ID ? 'diary' : 'meta'); return app.openById(id); } },
    Utilities: makeUtilities(), LockService: makeLockService(), CacheService: makeCacheService(),
    PropertiesService: props, HtmlService: makeHtmlService(),
    Session: makeSession({ activeEmail, effectiveEmail: OWNER }),
  });
  /** What the next call costs: sheet opens, and reads per tab. */
  function cost(call) {
    opened.length = 0;
    const tabs = ['Links', 'Sites', 'Activity', 'Lists'];
    const before = Object.fromEntries(tabs.map((t) => [t, diary.getSheetByName(t)._reads]));
    const result = call();
    return {
      result,
      opens: opened.slice(),
      reads: Object.fromEntries(tabs.map((t) => [t, diary.getSheetByName(t)._reads - before[t]]).filter(([, n]) => n > 0)),
    };
  }
  return { s: src.sandbox, diary, props, cost, ui: app._ui };
}

const kept = (w) => JSON.parse(w.props._store.get('salesmen'));

// ------------------------------------------------------------------------- Cost per call

test('a save opens Sales Diary once, not Meta-Data, and reads each tab once', () => {
  const w = world();
  w.s.repLoad(RIA); // the first call of the day reads Rep_Mapping and keeps it
  const add = w.cost(() => w.s.repAddSite(RIA, { name: 'X', buyerType: 'Dealer', followUp: 'tomorrow' }));
  assert.equal(add.result.ok, true);
  assert.deepEqual(add.opens, ['diary']);
  assert.deepEqual(add.reads, { Links: 1, Sites: 1, Activity: 1, Lists: 1 });

  const update = w.cost(() => w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: '3days', note: 'x' }));
  assert.equal(update.result.ok, true);
  assert.deepEqual(update.opens, ['diary']);
  assert.deepEqual(update.reads, { Links: 1, Sites: 1, Activity: 1, Lists: 1 });

  const edit = w.cost(() => w.s.repEditSite(RIA, 'S000001', { name: 'F-11 B', buyerType: 'Dealer', phone: '923001234567' }));
  assert.equal(edit.result.ok, true, edit.result.message);
  assert.deepEqual(edit.opens, ['diary']);
  assert.deepEqual(edit.reads, { Links: 1, Sites: 1, Activity: 1, Lists: 1 });

  const check = w.cost(() => w.s.repCheckPhone(RIA, '0300 1234567'));
  assert.deepEqual(check.opens, ['diary']);
  assert.deepEqual(check.reads, { Links: 1, Sites: 1 });
});

test('opening his page costs one Sales Diary open and one read of Links, Sites and Lists', () => {
  const w = world();
  w.s.repLoad(RIA);
  const page = w.cost(() => w.s.doGet({ parameter: { k: RIA } }));
  assert.deepEqual(page.opens, ['diary']);
  assert.deepEqual(page.reads, { Links: 1, Sites: 1, Lists: 1 });
});

test('junk codes cost nothing: no sheet is opened', () => {
  const w = world();
  for (const call of [() => w.s.repAddSite('junk', {}), () => w.s.repUpdateSite('junk', 'S000001', {}), () => w.s.repLoad(undefined)]) {
    const result = w.cost(() => { try { call(); } catch (e) { return e.message; } return ''; });
    assert.equal(result.result, "This link doesn't work. Ask the owner for a new one.");
    assert.deepEqual(result.opens, []);
  }
});

// ----------------------------------------------------------------------- Salesmen kept 24 h

test('the salesmen list is read once and then kept: Meta-Data is not opened again that day', () => {
  const w = world();
  const first = w.cost(() => w.s.repLoad(RIA));
  assert.deepEqual(first.opens, ['diary', 'meta']);
  assert.equal(kept(w).salesmen.length, 7);
  assert.deepEqual(Object.keys(kept(w).salesmen[0]).sort(), ['region', 'rep'], 'codes and regions only');
  const second = w.cost(() => w.s.repLoad(RIA));
  assert.deepEqual(second.opens, ['diary']);
});

test('the kept list is used for up to 24 hours, then read again', () => {
  const w = world();
  const now = Date.now();
  w.props._store.set('salesmen', JSON.stringify({ at: now - 60 * 60 * 1000, salesmen: [{ rep: 'SH', region: 'Center', row: 5 }] }));
  assert.throws(() => w.s.repLoad(RIA), /This link doesn't work/, 'RIA is not in the kept list, so not yet known');
  w.props._store.set('salesmen', JSON.stringify({ at: now - 25 * 60 * 60 * 1000, salesmen: [{ rep: 'SH', region: 'Center', row: 5 }] }));
  assert.equal(w.s.repLoad(RIA).ok, true, 'older than a day: read again, and RIA is there');
  assert.ok(kept(w).at >= now);
  w.props._store.set('salesmen', 'not json');
  assert.equal(w.s.repLoad(RIA).ok, true, 'an unreadable copy is simply read again');
});

test('cancelling a link still works at once, whatever the kept list says', () => {
  const w = world();
  w.s.repLoad(RIA);
  w.diary.getSheetByName('Links').getRange(2, 4).setValues([[false]]);
  assert.throws(() => w.s.repLoad(RIA), /This link doesn't work/);
});

// ---------------------------------------------------------- Refresh salesmen and Check setup

test('Sales Diary → Refresh salesmen reads Rep_Mapping now and shows who is there', () => {
  const w = world();
  w.props._store.set('salesmen', JSON.stringify({ at: Date.now(), salesmen: [] }));
  w.s.menuRefreshSalesmen();
  assert.equal(kept(w).salesmen.length, 7);
  const [title, message] = w.ui.alerts[0].args;
  assert.equal(title, 'Refresh salesmen');
  assert.deepEqual(message.split('\n').slice(0, 4), ['Salesmen: 7', '  North: RIA, AUR, WAK', '  Center: SH, SJ, SM', '  South: IB']);
  assert.ok(message.endsWith('Nothing to fix.'));
});

test('Refresh salesmen: owner only; and a Meta-Data problem is shown, the old list kept', () => {
  assert.throws(() => world({ activeEmail: '' }).s.menuRefreshSalesmen(), /only be run by the owner/);
  const w = world({ metaTabs: null });
  w.props._store.set('salesmen', JSON.stringify({ at: 1, salesmen: [{ rep: 'SH', region: 'Center', row: 5 }] }));
  w.s.menuRefreshSalesmen();
  assert.match(w.ui.alerts[0].args[1], /^Can't open the Meta-Data sheet/);
  assert.equal(kept(w).salesmen[0].rep, 'SH', 'a failed refresh does not wipe the kept list');
});

test('Check setup refreshes the kept list too', () => {
  const w = world();
  w.props._store.set('salesmen', JSON.stringify({ at: Date.now(), salesmen: [] }));
  w.s.menuCheckSetup();
  assert.equal(kept(w).salesmen.length, 7);
  assert.equal(plain(w.ui.alerts.length), 1);
});

// --------------------------------------------------------------- Fixes from the 4b review

test('a salesman the owner has just added can use his new link at once (the Links window keeps the list)', () => {
  const w = world();
  // The kept list is from before he was added.
  w.props._store.set('salesmen', JSON.stringify({ at: Date.now(), salesmen: [{ rep: 'SH', region: 'Center' }] }));
  const list = plain(w.s.ownerListLinks());
  assert.ok(list.rows.some((r) => r.who === 'RIA'), 'the Links window reads Rep_Mapping fresh');
  assert.equal(kept(w).salesmen.length, 7, '...and keeps it');
  assert.equal(w.s.repLoad(RIA).ok, true, 'so his link works straight away');
});

test('Check setup refreshes the salesmen list even when a targets tab has a problem', () => {
  const tabs = metaDataTabs();
  tabs['Rep-Targets'][0] = ['Rep', 'Month', 'Amount'];
  const w = world({ metaTabs: tabs });
  w.props._store.set('salesmen', JSON.stringify({ at: Date.now(), salesmen: [] }));
  w.s.menuCheckSetup();
  assert.equal(kept(w).salesmen.length, 7);
});

test('repSaveStatus: which of his saves landed; never anyone else\'s; nothing written', () => {
  const w = world();
  w.s.repAddSite(RIA, { name: 'X', buyerType: 'Dealer', followUp: 'tomorrow', saveId: 'landed0001' });
  const writes = w.diary._writes().length;
  assert.deepEqual(plain(w.s.repSaveStatus(RIA, ['landed0001', 'neverSent01', 'x', 42, null])),
    { ok: true, landed: ['landed0001'] });
  assert.deepEqual(plain(w.s.repSaveStatus(RIA, 'landed0001')), { ok: true, landed: [] }, 'not a list: nothing');
  assert.equal(w.diary._writes().length, writes);
  assert.throws(() => w.s.repSaveStatus('junk', ['landed0001']), /This link doesn't work/);
});

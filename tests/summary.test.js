'use strict';
// Spec 009: weekly and monthly summaries. The kept copy of targets (last month too), revised
// prices recorded only when they change (S9-13), periods, every count, the team parts, the
// WhatsApp text, privacy (ADR-0004) and what a summary costs. Amounts are made up.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSrc, plain, SRC_DIR } = require('./helpers/load-src');
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
  const src = loadSrc({
    PropertiesService: props,
    SpreadsheetApp: { ...app, openById(id) { opened.push(id === SALES_DIARY_ID ? 'diary' : 'meta'); return app.openById(id); } },
    Utilities: makeUtilities(), LockService: makeLockService(), CacheService: makeCacheService(), HtmlService: makeHtmlService(),
  });
  return { s: src.sandbox, diary, metaData, opened, props };
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

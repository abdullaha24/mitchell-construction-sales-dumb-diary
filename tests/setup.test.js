'use strict';
// Spec 001 → Tests → Setup.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const { makeSpreadsheet } = require('./helpers/fakes');

const src = loadSrc();
const setUp = (diary) => plain(src.sandbox.setUpSalesDiary_(diary));

const SITES = [
  'site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at',
];
const ACTIVITY = [
  'activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup',
];
const LISTS = ['list', 'value', 'region', 'added_by', 'active', 'sort'];
const CATEGORIES = [
  'Tile Adhesives', 'Waterproofing Job', 'Floor Hardeners', 'Bonding Agents & Sealants',
  'Waterproofing Products', 'Tile Grouts', 'Structural Grouts', 'Restoration & Repair Products',
  'Admixtures', 'Surface Protection', 'Mortars, Plasters & Putties',
];
const LOST_REASONS = ['Price Too High', 'Credit Terms', 'Competitor Approved', 'Site Delayed', 'Other'];
const BUYER_TYPES = ['Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer'];

/** The rows setup adds for one list, as [list, value, region, added_by, active, sort]. */
const startingRows = (list, values) =>
  values.map((value, i) => [list, value, '', 'owner', true, (i + 1) * 10]);
const ALL_STARTING_ROWS = [
  ...startingRows('product_category', CATEGORIES),
  ...startingRows('lost_reason', LOST_REASONS),
  ...startingRows('buyer_type', BUYER_TYPES),
];

/** A spreadsheet as Google makes it: one empty Sheet1, in some other timezone. */
const newSpreadsheet = () => makeSpreadsheet({ Sheet1: [] }, { timeZone: 'America/New_York' });
const tabNames = (ss) => ss.getSheets().map((s) => s.getName());
const valuesOf = (ss, tab) => ss.getSheetByName(tab).getDataRange().getValues();

test('new spreadsheet: creates Sites, Activity and Lists with exact headers', () => {
  const diary = newSpreadsheet();
  assert.deepEqual(setUp(diary), { problems: [] });
  assert.deepEqual(tabNames(diary), ['Sites', 'Activity', 'Lists']);
  assert.deepEqual(valuesOf(diary, 'Sites'), [SITES]);
  assert.deepEqual(valuesOf(diary, 'Activity'), [ACTIVITY]);
  assert.deepEqual(valuesOf(diary, 'Lists')[0], LISTS);
});

test('new spreadsheet: headers are bold and frozen', () => {
  const diary = newSpreadsheet();
  setUp(diary);
  for (const [tab, headers] of [['Sites', SITES], ['Activity', ACTIVITY], ['Lists', LISTS]]) {
    const sheet = diary.getSheetByName(tab);
    assert.equal(sheet.getFrozenRows(), 1, tab);
    for (let c = 1; c <= headers.length; c++) assert.equal(sheet._fontWeight(1, c), 'bold', `${tab} col ${c}`);
    assert.equal(sheet._fontWeight(2, 1), undefined, `${tab} row 2 should not be bold`);
  }
});

test('new spreadsheet: contact_phone is plain text, and only that column', () => {
  const diary = newSpreadsheet();
  setUp(diary);
  const sites = diary.getSheetByName('Sites');
  const phone = SITES.indexOf('contact_phone') + 1;
  assert.equal(phone, 8);
  for (const row of [2, 500, sites.getMaxRows()]) assert.equal(sites._numberFormat(row, phone), '@');
  for (const column of [1, phone - 1, phone + 1, SITES.length]) {
    assert.equal(sites._numberFormat(2, column), undefined, `column ${column}`);
  }
  for (const tab of ['Activity', 'Lists']) {
    assert.deepEqual(diary.getSheetByName(tab)._snapshot().numberFormats, {}, tab);
  }
});

test('new spreadsheet: timezone set to Asia/Karachi', () => {
  const diary = newSpreadsheet();
  setUp(diary);
  assert.equal(diary.getSpreadsheetTimeZone(), 'Asia/Karachi');
});

test('new spreadsheet: Lists filled with categories, lost reasons and buyer types, in order', () => {
  const diary = newSpreadsheet();
  setUp(diary);
  assert.deepEqual(valuesOf(diary, 'Lists'), [LISTS, ...ALL_STARTING_ROWS]);
  assert.ok(!valuesOf(diary, 'Lists').some((row) => row[0] === 'area'), 'area starts empty');
});

test('new spreadsheet: the empty Sheet1 is deleted', () => {
  const diary = newSpreadsheet();
  setUp(diary);
  assert.equal(diary.getSheetByName('Sheet1'), null);
});

test('run again: changes nothing at all', () => {
  const diary = newSpreadsheet();
  setUp(diary);
  const before = diary._snapshot();
  const writesBefore = diary._writes().length;
  assert.deepEqual(setUp(diary), { problems: [] });
  assert.deepEqual(diary._snapshot(), before);
  assert.deepEqual(diary._writes().slice(writesBefore), []);
});

test('an existing tab is left exactly as it was, even with other headers', () => {
  const diary = makeSpreadsheet({
    Sites: [['Site', 'Phone', 'my notes'], ['Tower', 923001234567, 'x']],
    Sheet1: [],
  });
  const sitesBefore = diary.getSheetByName('Sites')._snapshot();
  setUp(diary);
  assert.deepEqual(diary.getSheetByName('Sites')._snapshot(), sitesBefore);
  assert.deepEqual(tabNames(diary), ['Sites', 'Activity', 'Lists']);
  assert.ok(!diary._writes().some((w) => w.includes('on Sites')), diary._writes().join());
});

test('a Sheet1 with anything in it is kept', () => {
  const withValue = makeSpreadsheet({ Sheet1: [['', ''], ['', 'owner notes']] });
  setUp(withValue);
  assert.deepEqual(tabNames(withValue), ['Sheet1', 'Sites', 'Activity', 'Lists']);

  const withChart = newSpreadsheet();
  withChart.getSheetByName('Sheet1')._addChart();
  setUp(withChart);
  assert.ok(tabNames(withChart).includes('Sheet1'));

  const withImage = newSpreadsheet();
  withImage.getSheetByName('Sheet1')._addImage();
  setUp(withImage);
  assert.ok(tabNames(withImage).includes('Sheet1'));
});

test('no Sheet1 (already deleted or renamed) is fine', () => {
  const diary = makeSpreadsheet({ Summary: [['kept']] });
  assert.deepEqual(setUp(diary), { problems: [] });
  assert.deepEqual(tabNames(diary), ['Summary', 'Sites', 'Activity', 'Lists']);
});

test('a list with rows is not refilled; empty lists are, below the last row', () => {
  const diary = makeSpreadsheet({
    Lists: [
      LISTS,
      ['product_category', 'Tile Glue', '', 'owner', true, 10],
      ['', '', '', '', '', ''],
      ['area', 'DHA', 'North', 'RIA', true, 10],
      [' Lost_Reason ', 'Too far', '', 'owner', false, 10],
    ],
  });
  setUp(diary);
  assert.deepEqual(valuesOf(diary, 'Lists'), [
    LISTS,
    ['product_category', 'Tile Glue', '', 'owner', true, 10],
    ['', '', '', '', '', ''],
    ['area', 'DHA', 'North', 'RIA', true, 10],
    [' Lost_Reason ', 'Too far', '', 'owner', false, 10],
    ...startingRows('buyer_type', BUYER_TYPES),
  ]);
});

test('if the owner deletes every row of a list, the next run refills it', () => {
  const diary = newSpreadsheet();
  setUp(diary);
  const lists = diary.getSheetByName('Lists');
  const kept = lists.getDataRange().getValues().filter((row) => row[0] !== 'buyer_type');
  const blank = Array.from({ length: BUYER_TYPES.length }, () => new Array(LISTS.length).fill(''));
  lists.getRange(1, 1, kept.length + blank.length, LISTS.length).setValues([...kept, ...blank]);
  setUp(diary);
  assert.deepEqual(valuesOf(diary, 'Lists'), [...kept, ...startingRows('buyer_type', BUYER_TYPES)]);
});

test('Lists columns are found by name: reordered and extra columns are respected', () => {
  const diary = makeSpreadsheet({
    Lists: [['Sort', 'VALUE', 'notes', 'list', 'active', 'added_by', 'region', 'last col']],
  });
  setUp(diary);
  const rows = valuesOf(diary, 'Lists');
  assert.equal(rows.length, 1 + 20);
  assert.deepEqual(rows[1], [10, 'Tile Adhesives', '', 'product_category', true, 'owner', '', '']);
  assert.deepEqual(rows[20], [40, 'Dealer', '', 'buyer_type', true, 'owner', '', '']);
});

test('a nearly full Lists tab gets more rows before the starting lists are added', () => {
  const areas = Array.from({ length: 994 }, (_, i) => ['area', `Area ${i}`, 'North', 'RIA', true, 10]);
  const diary = makeSpreadsheet({ Lists: [LISTS, ...areas] }); // rows 1-995 of 1000
  setUp(diary);
  const lists = diary.getSheetByName('Lists');
  assert.equal(lists.getMaxRows(), 995 + 20);
  assert.deepEqual(valuesOf(diary, 'Lists').slice(995), ALL_STARTING_ROWS);
});

test('Lists missing a column: nothing is written there, and it is reported', () => {
  const diary = makeSpreadsheet({ Lists: [['list', 'value', 'region', 'added_by', 'active']] });
  const listsBefore = diary.getSheetByName('Lists')._snapshot();
  assert.deepEqual(setUp(diary), {
    problems: ["Lists has no 'sort' column in row 1. The starting lists were not added."],
  });
  assert.deepEqual(diary.getSheetByName('Lists')._snapshot(), listsBefore);
});

test('a timezone already set to Asia/Karachi is not written again', () => {
  const diary = makeSpreadsheet({ Sheet1: [] }, { timeZone: 'Asia/Karachi' });
  setUp(diary);
  assert.ok(!diary._writes().includes('setSpreadsheetTimeZone'));
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  makeSpreadsheet, makeUtilities, makeSpreadsheetApp, makeSession, makeHtmlService,
  makeLockService,
} = require('./helpers/fakes');

test('read-only spreadsheet: every write method throws, reads still work', () => {
  const ss = makeSpreadsheet({ Tab: [['a', 'b'], [1, 2]] }, { readOnly: true, name: 'Meta-Data' });
  const sheet = ss.getSheetByName('Tab');
  assert.deepEqual(sheet.getDataRange().getValues(), [['a', 'b'], [1, 2]]);
  const writes = [
    () => sheet.getRange(1, 1).setValues([['x']]),
    () => sheet.getRange(1, 1).setFontWeight('bold'),
    () => sheet.getRange(1, 1).setNumberFormat('@'),
    () => sheet.setFrozenRows(1),
    () => ss.insertSheet('New'),
    () => ss.deleteSheet(sheet),
    () => ss.setSpreadsheetTimeZone('UTC'),
  ];
  for (const doWrite of writes) assert.throws(doWrite, /Meta-Data is read-only/);
  assert.deepEqual(sheet.getDataRange().getValues(), [['a', 'b'], [1, 2]]);
});

test('formatDate: 2026-07-31T19:00:00Z is 1 Aug 2026 in Karachi, so 2026-08', () => {
  const utilities = makeUtilities();
  const date = new Date('2026-07-31T19:00:00Z');
  assert.equal(utilities.formatDate(date, 'Asia/Karachi', 'yyyy-MM'), '2026-08');
  assert.equal(utilities.formatDate(date, 'UTC', 'yyyy-MM'), '2026-07');
  assert.throws(() => utilities.formatDate(date, 'UTC', 'dd/MM/yyyy'), /does not support/);
});

test('formatDate d MMM yyyy: Karachi day, short English month', () => {
  const utilities = makeUtilities();
  assert.equal(utilities.formatDate(new Date('2026-11-04T08:00:00Z'), 'Asia/Karachi', 'd MMM yyyy'), '4 Nov 2026');
  assert.equal(utilities.formatDate(new Date('2026-09-30T20:00:00Z'), 'Asia/Karachi', 'd MMM yyyy'), '1 Oct 2026');
  assert.equal(utilities.formatDate(new Date('2026-09-15T12:00:00Z'), 'Asia/Karachi', 'd MMM yyyy'), '15 Sep 2026');
});

test('formatDate yyyy-MM-dd and parseDate: Pakistan days', () => {
  const utilities = makeUtilities();
  assert.equal(utilities.formatDate(new Date('2026-11-04T19:30:00Z'), 'Asia/Karachi', 'yyyy-MM-dd'), '2026-11-05');
  assert.equal(utilities.formatDate(new Date('2026-11-04T18:59:00Z'), 'Asia/Karachi', 'yyyy-MM-dd'), '2026-11-04');
  assert.equal(utilities.parseDate('2026-11-05', 'Asia/Karachi', 'yyyy-MM-dd').toISOString(), '2026-11-04T19:00:00.000Z');
  assert.equal(utilities.parseDate('2026-11-05', 'UTC', 'yyyy-MM-dd').toISOString(), '2026-11-05T00:00:00.000Z');
});

test('getUuid: random v4 UUIDs, all kept for tests', () => {
  const utilities = makeUtilities();
  const a = utilities.getUuid();
  const b = utilities.getUuid();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
  assert.deepEqual(utilities._uuids, [a, b]);
});

test('LockService: waitLock and releaseLock are recorded; busy makes waitLock throw', () => {
  const locks = makeLockService();
  const lock = locks.getScriptLock();
  lock.waitLock(10000);
  assert.equal(lock.hasLock(), true);
  lock.releaseLock();
  assert.deepEqual(locks._events, ['waitLock 10000', 'releaseLock']);
  assert.throws(() => makeLockService({ busy: true }).getScriptLock().waitLock(1), /Lock timeout/);
});

test('like Google: an empty sheet reads as one blank cell, last row and column 0', () => {
  const sheet = makeSpreadsheet({ Empty: [] }).getSheetByName('Empty');
  assert.deepEqual(sheet.getDataRange().getValues(), [['']]);
  assert.equal(sheet.getLastRow(), 0);
  assert.equal(sheet.getLastColumn(), 0);
});

test('like Google: getValues is a full rectangle with blanks as empty text', () => {
  const sheet = makeSpreadsheet({ T: [['a'], [], [null, undefined, 'c']] }).getSheetByName('T');
  assert.deepEqual(sheet.getDataRange().getValues(), [['a', '', ''], ['', '', ''], ['', '', 'c']]);
  assert.equal(sheet.getLastRow(), 3);
  assert.equal(sheet.getLastColumn(), 3);
});

test('like Google: setValues must exactly fit the range', () => {
  const sheet = makeSpreadsheet({ T: [] }).getSheetByName('T');
  assert.throws(() => sheet.getRange(1, 1, 1, 2).setValues([['only one']]), /does not fit/);
  assert.throws(() => sheet.getRange(1, 1, 2, 1).setValues([['one row']]), /does not fit/);
  sheet.getRange(2, 2, 1, 2).setValues([['x', 'y']]);
  assert.deepEqual(sheet.getDataRange().getValues(), [['', '', ''], ['', 'x', 'y']]);
});

test('like Google: a range past the last row or column throws; rows can be added at the end', () => {
  const sheet = makeSpreadsheet({ T: [] }).getSheetByName('T');
  assert.equal(sheet.getMaxRows(), 1000);
  assert.equal(sheet.getMaxColumns(), 26);
  assert.throws(() => sheet.getRange(1000, 1, 2, 1), /outside the dimensions/);
  assert.throws(() => sheet.getRange(1, 26, 1, 2), /outside the dimensions/);
  sheet.insertRowsAfter(1000, 5);
  assert.equal(sheet.getMaxRows(), 1005);
  sheet.getRange(1005, 1).setValues([['last']]);
  assert.equal(sheet.getLastRow(), 1005);
});

test('like Google: setValues reads text as typed, unless the cell is plain text', () => {
  const sheet = makeSpreadsheet({ T: [] }).getSheetByName('T');
  sheet.getRange(1, 1, 1, 5).setValues([['=SUM(1)', '0300', "'=SUM(1)", "'0300", 'plain words']]);
  assert.deepEqual(sheet.getRange(1, 1, 1, 5).getValues(), [['FORMULA(SUM(1))', 300, '=SUM(1)', '0300', 'plain words']]);
  sheet.getRange(2, 1).setNumberFormat('@');
  sheet.getRange(2, 1).setValues([['=SUM(1)']]);
  assert.equal(sheet.getRange(2, 1).getValues()[0][0], '=SUM(1)');
});

test('like Google: sheet names are unique and the last tab cannot be deleted', () => {
  const ss = makeSpreadsheet({ Sheet1: [] });
  assert.throws(() => ss.insertSheet('sheet1'), /already exists/);
  assert.throws(() => ss.deleteSheet(ss.getSheetByName('Sheet1')), /remove all the sheets/);
  const added = ss.insertSheet('Sites', 1);
  assert.deepEqual(ss.getSheets().map((s) => s.getName()), ['Sheet1', 'Sites']);
  ss.deleteSheet(ss.getSheetByName('Sheet1'));
  assert.deepEqual(ss.getSheets(), [added]);
});

test('snapshot records values, formats, bold and frozen rows; writes are logged', () => {
  const ss = makeSpreadsheet({ T: [] }, { timeZone: 'UTC' });
  const sheet = ss.getSheetByName('T');
  sheet.getRange(1, 1, 1, 2).setValues([['h1', 'h2']]);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.getRange(1, 2, 3, 1).setNumberFormat('@');
  sheet.setFrozenRows(1);
  ss.setSpreadsheetTimeZone('Asia/Karachi');
  assert.deepEqual(ss._snapshot(), {
    timeZone: 'Asia/Karachi',
    sheets: [{
      name: 'T',
      values: [['h1', 'h2']],
      fontWeights: { '1,1': 'bold', '1,2': 'bold' },
      numberFormats: { '1,2': '@', '2,2': '@', '3,2': '@' },
      frozenRows: 1,
    }],
  });
  assert.equal(ss._writes().length, 5);
});

test('SpreadsheetApp: openById opens known IDs only; UI records menus and alerts', () => {
  const meta = makeSpreadsheet({});
  const app = makeSpreadsheetApp({ byId: { abc: meta }, active: null });
  assert.equal(app.openById('abc'), meta);
  assert.throws(() => app.openById('missing'), /openById/);
  assert.equal(app.getActiveSpreadsheet(), null);
  const ui = app.getUi();
  ui.createMenu('M').addItem('Do it', 'doIt').addToUi();
  ui.alert('Title', 'Body', ui.ButtonSet.OK);
  assert.deepEqual(ui.menus, [{ name: 'M', items: [{ caption: 'Do it', functionName: 'doIt' }] }]);
  assert.deepEqual(ui.alerts, [{ args: ['Title', 'Body', 'OK'] }]);
});

test('Session: active and effective emails, blank by default', () => {
  const none = makeSession();
  assert.equal(none.getActiveUser().getEmail(), '');
  assert.equal(none.getEffectiveUser().getEmail(), '');
  const owner = makeSession({ activeEmail: 'a@x', effectiveEmail: 'b@x' });
  assert.equal(owner.getActiveUser().getEmail(), 'a@x');
  assert.equal(owner.getEffectiveUser().getEmail(), 'b@x');
});

test('HtmlService templates: <?= ?> prints escaped; unset names throw', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = makeHtmlService();
  const template = html.createTemplateFromFile('Page');
  assert.throws(() => template.evaluate(), /not defined/);
  template.heading = '<b>"Tom" & Jerry\'s</b>';
  template.note = 'ok';
  const content = template.evaluate().getContent();
  assert.ok(content.includes('&lt;b&gt;&quot;Tom&quot; &amp; Jerry&#39;s&lt;/b&gt;'), content);
  assert.ok(!content.includes('<b>'));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'src', 'Page.html')));
});

test('HtmlService: a missing file throws', () => {
  assert.throws(() => makeHtmlService().createHtmlOutputFromFile('NoSuchFile'), /ENOENT/);
});

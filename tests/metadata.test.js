'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSrc, srcFiles, plain, SRC_DIR } = require('./helpers/load-src');
const { makeSpreadsheet, makeSpreadsheetApp, makeUtilities } = require('./helpers/fakes');
const { META_TIME_ZONE, fakeTarget, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const CANT_OPEN = "Can't open the Meta-Data sheet. Check it still exists and your Google " +
  'account can open it.';

/** Loads src with a read-only Meta-Data fake reachable only by its real ID. */
function withMetaData(tabs, timeZone = META_TIME_ZONE) {
  const metaData = makeSpreadsheet(tabs, { readOnly: true, timeZone, name: 'Meta-Data' });
  const src = loadSrc({
    Utilities: makeUtilities(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [META_DATA_ID]: metaData } }),
  });
  return { metaData, read: () => src.sandbox.readMetaData_(), src };
}

test('reads the fixture: 7 salesmen and their targets, without writing anything', () => {
  const { metaData, read } = withMetaData(metaDataTabs());
  const before = JSON.stringify(metaData._snapshot());
  const data = read();
  assert.equal(data.ok, true);
  assert.deepEqual(plain(data.salesmen.map((s) => `${s.rep}:${s.region}`)), [
    'RIA:North', 'AUR:North', 'WAK:North', 'SH:Center', 'SJ:Center', 'SM:Center', 'IB:South',
  ]);
  assert.deepEqual(plain(data.problems), []);
  assert.equal(data.repTargets['SM|2026-11'], fakeTarget('SM', '2026-11'));
  assert.equal(data.repTargets['IB|2026-11'], 1740000);
  assert.equal(data.repTargets['SJ|2026-08'], fakeTarget('SJ', '2026-08'));
  assert.equal(data.regionTargets['UNASSIGNED|2026-11'], fakeTarget('UNASSIGNED', '2026-11'));
  assert.deepEqual(metaData._writes(), []);
  assert.equal(JSON.stringify(metaData._snapshot()), before);
});

test('date months are read in the Meta-Data sheet\'s own timezone', () => {
  // A sheet kept in UTC stores "1 Nov 2026" as UTC midnight; it must still read as November.
  const tabs = {
    Rep_Mapping: [['Rep', 'Region'], ['RIA', 'North']],
    'Rep-Targets': [['Rep', 'Month', 'Target'], ['RIA', new Date('2026-11-01T00:00:00Z'), 5]],
    Targets: [['Region', 'Month', 'Target']],
  };
  assert.equal(withMetaData(tabs, 'UTC').read().repTargets['RIA|2026-11'], 5);
  // The same cell in a Karachi sheet is 1 Nov, 5 am: still November.
  assert.equal(withMetaData(tabs, 'Asia/Karachi').read().repTargets['RIA|2026-11'], 5);
  // And in a sheet five hours behind UTC it is 31 Oct, 7 pm: October.
  assert.equal(withMetaData(tabs, 'America/Bogota').read().repTargets['RIA|2026-10'], 5);
});

test("can't open the sheet → the message, and nothing else", () => {
  const src = loadSrc({ Utilities: makeUtilities(), SpreadsheetApp: makeSpreadsheetApp({ byId: {} }) });
  assert.deepEqual(plain(src.sandbox.readMetaData_()), { ok: false, message: CANT_OPEN });
});

test('a missing tab → the message naming it', () => {
  for (const missing of ['Rep_Mapping', 'Rep-Targets', 'Targets']) {
    const tabs = metaDataTabs();
    delete tabs[missing];
    assert.deepEqual(plain(withMetaData(tabs).read()), {
      ok: false, message: `The Meta-Data sheet has no '${missing}' tab.`,
    });
  }
});

test('a missing column → the message naming the tab and column', () => {
  const tabs = metaDataTabs();
  tabs['Rep-Targets'][0] = ['Rep', 'Month', 'Amount'];
  assert.deepEqual(plain(withMetaData(tabs).read()), {
    ok: false, message: "Rep-Targets has no 'Target' column in row 1.",
  });
});

test('only metadata.js opens Meta-Data, only diary.js opens Sales Diary, nothing else opens a sheet', () => {
  const opens = /\bopenBy(Id|Url)\b|\bSpreadsheetApp\.open\b/g;
  for (const name of srcFiles()) {
    const source = fs.readFileSync(path.join(SRC_DIR, name), 'utf8');
    const calls = source.match(opens) || [];
    if (name === 'metadata.js') {
      assert.deepEqual(source.match(/openById\(([^)]*)\)/g), ['openById(META_DATA_ID)'], name);
    } else if (name === 'diary.js') {
      assert.deepEqual(source.match(/openById\(([^)]*)\)/g), ['openById(SALES_DIARY_ID)'], name);
    } else {
      assert.deepEqual(calls, [], `${name} opens a spreadsheet`);
    }
    if (!['metadata.js', 'config.js'].includes(name)) {
      assert.ok(!source.includes('META_DATA_ID'), `${name} uses META_DATA_ID`);
    }
    if (!['diary.js', 'config.js'].includes(name)) {
      assert.ok(!source.includes('SALES_DIARY_ID'), `${name} uses SALES_DIARY_ID`);
    }
  }
});

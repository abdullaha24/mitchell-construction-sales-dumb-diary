'use strict';
// Spec 001 → Tests: Columns, Salesmen, Months, Amounts, Targets, Region targets, Summary.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const { makeUtilities } = require('./helpers/fakes');
const {
  META_TIME_ZONE, karachiMonthStart, fakeTarget, metaDataTabs,
} = require('./fixtures/meta-data');

const src = loadSrc({ Utilities: makeUtilities() });
const {
  findColumns_, tidyCode_, monthKey_, monthLabel_, currentMonthKey_, parseRs_, formatRs_,
  readSalesmen_, readTargets_, targetFor_, parseMetaData_, buildSummary_,
} = src.sandbox;

/** 1 Nov 2026, 00:30 in Karachi (still 31 Oct in UTC). */
const NOW_NOV_2026 = new Date('2026-10-31T19:30:00Z');

function repOptions(keys) {
  return { tabName: 'Rep-Targets', keyColumn: 'Rep', keys, unknownKeys: 'ignore', timeZone: META_TIME_ZONE };
}
const REGION_OPTIONS = {
  tabName: 'Targets', keyColumn: 'Region', keys: ['North', 'Center', 'South', 'UNASSIGNED'],
  unknownKeys: 'problem', timeZone: META_TIME_ZONE,
};
const FIXTURE_REPS = ['RIA', 'AUR', 'WAK', 'SH', 'SJ', 'SM', 'IB'];

function fixtureTables() {
  const tabs = metaDataTabs();
  return {
    salesmen: tabs.Rep_Mapping,
    repTargets: tabs['Rep-Targets'],
    regionTargets: tabs.Targets,
    timeZone: META_TIME_ZONE,
  };
}

// ---------------------------------------------------------------------------------- Columns

test('columns: found by name in any order, ignoring capitals and edge spaces', () => {
  const found = findColumns_([['  TARGET ', 'month', 'Rep', 'Extra']], ['Rep', 'Month', 'Target'], 'Rep-Targets');
  assert.deepEqual(plain(found), { ok: true, columns: { Rep: 2, Month: 1, Target: 0 } });
});

test('columns: a missing column gives a clear message naming the tab and column', () => {
  const found = findColumns_([['Rep', 'Month']], ['Rep', 'Month', 'Target'], 'Rep-Targets');
  assert.deepEqual(plain(found), { ok: false, message: "Rep-Targets has no 'Target' column in row 1." });
  const empty = findColumns_([['']], ['Rep'], 'Rep_Mapping');
  assert.equal(empty.message, "Rep_Mapping has no 'Rep' column in row 1.");
});

test('columns: only row 1 is the header', () => {
  const values = [['Name', 'Month', 'Target'], ['rep', 'x', 'y']];
  assert.equal(findColumns_(values, ['Rep'], 'Rep-Targets').ok, false);
  // On the fixture, the 'rep' text in E74 is not taken for the Rep column.
  const found = findColumns_(metaDataTabs()['Rep-Targets'], ['Rep', 'Month', 'Target'], 'Rep-Targets');
  assert.deepEqual(plain(found.columns), { Rep: 0, Month: 1, Target: 2 });
});

// --------------------------------------------------------------------------------- Salesmen

test('salesmen: the 7 from the fixture, in sheet order, with their regions', () => {
  const read = readSalesmen_(metaDataTabs().Rep_Mapping, 'Rep_Mapping');
  assert.deepEqual(plain(read), {
    ok: true,
    salesmen: [
      { rep: 'RIA', region: 'North', row: 2 }, { rep: 'AUR', region: 'North', row: 3 },
      { rep: 'WAK', region: 'North', row: 4 }, { rep: 'SH', region: 'Center', row: 5 },
      { rep: 'SJ', region: 'Center', row: 6 }, { rep: 'SM', region: 'Center', row: 7 },
      { rep: 'IB', region: 'South', row: 8 },
    ],
    problems: [],
  });
});

test('salesmen: blank rows skipped; codes and regions tidied', () => {
  const read = readSalesmen_([
    ['Region', ' rep '],
    ['', ''],
    ['north', ' ria'],
    [null, '   '],
    ['  CENTER ', 'sj'],
  ], 'Rep_Mapping');
  assert.deepEqual(plain(read.salesmen), [
    { rep: 'RIA', region: 'North', row: 3 },
    { rep: 'SJ', region: 'Center', row: 5 },
  ]);
  assert.deepEqual(plain(read.problems), []);
});

test('salesmen: unknown region left out and listed with its row', () => {
  const read = readSalesmen_([['Rep', 'Region'], ['RIA', 'North'], ['XYZ', 'East']], 'Rep_Mapping');
  assert.deepEqual(plain(read.salesmen.map((s) => s.rep)), ['RIA']);
  assert.equal(read.problems.length, 1);
  assert.match(read.problems[0], /^Rep_Mapping row 3: .*XYZ.*'East'/);
});

test('salesmen: a half-filled row is listed either way round', () => {
  const read = readSalesmen_([['Rep', 'Region'], ['RIA', ''], ['', 'South']], 'Rep_Mapping');
  assert.deepEqual(plain(read.salesmen), []);
  assert.equal(read.problems.length, 2);
  assert.match(read.problems[0], /^Rep_Mapping row 2: RIA has no Region/);
  assert.match(read.problems[1], /^Rep_Mapping row 3: .*Rep is blank/);
});

test('salesmen: the same Rep twice is listed and the first row is used', () => {
  const read = readSalesmen_([
    ['Rep', 'Region'], ['RIA', 'North'], ['SH', 'Center'], ['ria ', 'South'],
  ], 'Rep_Mapping');
  assert.deepEqual(plain(read.salesmen), [
    { rep: 'RIA', region: 'North', row: 2 }, { rep: 'SH', region: 'Center', row: 3 },
  ]);
  assert.equal(read.problems.length, 1);
  assert.match(read.problems[0], /^Rep_Mapping row 4: RIA .*row 2/);
});

test('salesmen: the first row counts even when it has a problem', () => {
  const read = readSalesmen_([
    ['Rep', 'Region'], ['RIA', 'East'], ['SH', 'Center'], ['RIA', 'North'],
  ], 'Rep_Mapping');
  assert.deepEqual(plain(read.salesmen.map((s) => s.rep)), ['SH']);
  assert.equal(read.problems.length, 2);
  assert.match(read.problems[0], /^Rep_Mapping row 2: RIA's region 'East'/);
  assert.match(read.problems[1], /^Rep_Mapping row 4: RIA is listed again \(first in row 2\)/);
});

test('salesmen: a missing column fails with the message', () => {
  const read = readSalesmen_([['Rep', 'Area']], 'Rep_Mapping');
  assert.deepEqual(plain(read), { ok: false, message: "Rep_Mapping has no 'Region' column in row 1." });
});

test('tidyCode_: trims and upper-cases', () => {
  assert.equal(tidyCode_(' ria'), 'RIA');
  assert.equal(tidyCode_(''), '');
  assert.equal(tidyCode_(null), '');
});

// ----------------------------------------------------------------------------------- Months

test('months: 1 Aug 2026 00:00 Karachi reads as 2026-08, not 2026-07', () => {
  const aug1 = karachiMonthStart(2026, 8);
  assert.equal(aug1.toISOString(), '2026-07-31T19:00:00.000Z');
  assert.equal(monthKey_(aug1, 'Asia/Karachi'), '2026-08');
  // Why the sheet's own timezone matters: read in UTC it would be a month early.
  assert.equal(monthKey_(aug1, 'UTC'), '2026-07');
});

test('months: YYYY-MM text works; anything else is refused', () => {
  assert.equal(monthKey_('2026-11', META_TIME_ZONE), '2026-11');
  assert.equal(monthKey_(' 2027-01 ', META_TIME_ZONE), '2027-01');
  for (const bad of ['2026-13', '2026-00', '2026-1', 'Nov 2026', '11/2026', '', 46000, true, null,
    new Date('not a date')]) {
    assert.equal(monthKey_(bad, META_TIME_ZONE), null, `should refuse ${String(bad)}`);
  }
});

test('months: bad month text is listed with its row', () => {
  const read = readTargets_([['Rep', 'Month', 'Target'], ['RIA', 'Nov 2026', 100]], repOptions(['RIA']));
  assert.deepEqual(plain(read.amounts), {});
  assert.equal(read.problems.length, 1);
  assert.match(read.problems[0], /^Rep-Targets row 2: month 'Nov 2026'/);
});

test('months: labels and "this month" in Pakistan time', () => {
  assert.equal(monthLabel_('2026-11'), 'November 2026');
  assert.equal(monthLabel_('2027-01'), 'January 2027');
  assert.equal(currentMonthKey_(NOW_NOV_2026), '2026-11');
  assert.equal(currentMonthKey_(new Date('2026-11-30T18:59:00Z')), '2026-11');
  assert.equal(currentMonthKey_(new Date('2026-11-30T19:00:00Z')), '2026-12');
});

// ---------------------------------------------------------------------------------- Amounts

test('amounts: number, comma text and Rs. text all read as whole rupees', () => {
  for (const ok of [12345000, '12345000', '12,345,000', 'Rs. 12,345,000', 'rs 12,345,000',
    'Rs.12345000', ' 12 345 000 ']) {
    assert.equal(parseRs_(ok), 12345000, `should read ${ok}`);
  }
  assert.equal(parseRs_(0), 0);
  assert.equal(parseRs_('0'), 0);
  assert.ok(Object.is(parseRs_(-0), 0));
});

test('amounts: formula results a hair off a whole number count as that number', () => {
  // getValues() gives the raw number: =7000000*1.1 shows 7,700,000 in the sheet.
  assert.notEqual(7000000 * 1.1, 7700000);
  assert.equal(parseRs_(7000000 * 1.1), 7700000);
  assert.notEqual(3000000 * 1.15, 3450000);
  assert.equal(parseRs_(3000000 * 1.15), 3450000);
  assert.equal(parseRs_(1.00001), null);
  assert.equal(parseRs_(1234.5), null);
});

test('amounts: not a whole number of 0 or more is refused', () => {
  for (const bad of ['abc', -5, '-5', 1.5, '1.5', '', true, null, undefined, NaN, Infinity,
    'Rs.', '12,345,000 Rs', 2 ** 60, new Date(2026, 0, 1)]) {
    assert.equal(parseRs_(bad), null, `should refuse ${String(bad)}`);
  }
});

test('amounts: bad targets are listed with their rows and ignored', () => {
  const read = readTargets_([
    ['Rep', 'Month', 'Target'],
    ['RIA', '2026-11', 'abc'],
    ['AUR', '2026-11', -5],
    ['WAK', '2026-11', 1.5],
    ['SH', '2026-11', '1,000'],
  ], repOptions(['RIA', 'AUR', 'WAK', 'SH']));
  assert.deepEqual(plain(read.amounts), { 'SH|2026-11': 1000 });
  assert.deepEqual(plain(read.problems), [
    "Rep-Targets row 2: target 'abc' is not a number.",
    "Rep-Targets row 3: target '-5' is not a whole number of 0 or more.",
    "Rep-Targets row 4: target '1.5' is not a whole number of 0 or more.",
  ]);
});

test('amounts: a target of 0 means no target', () => {
  const read = readTargets_([['Rep', 'Month', 'Target'], ['RIA', '2026-11', 0]], repOptions(['RIA']));
  assert.deepEqual(plain(read.problems), []);
  assert.equal(targetFor_(read.amounts, 'RIA', '2026-11'), null);
});

test('amounts: a 0 row is like a missing row, so it never makes a duplicate', () => {
  const read = readTargets_([
    ['Rep', 'Month', 'Target'],
    ['RIA', '2026-11', 0],
    ['RIA', '2026-11', 700],
    ['SH', '2026-11', '0'],
    ['SH', '2026-11', 0],
  ], repOptions(['RIA', 'SH']));
  assert.deepEqual(plain(read.problems), []);
  assert.equal(targetFor_(read.amounts, 'RIA', '2026-11'), 700);
  assert.equal(targetFor_(read.amounts, 'SH', '2026-11'), null);
});

test('amounts: formatting', () => {
  assert.equal(formatRs_(12345000), 'Rs. 12,345,000');
  assert.equal(formatRs_(2500000), 'Rs. 2,500,000');
  assert.equal(formatRs_(1000), 'Rs. 1,000');
  assert.equal(formatRs_(999), 'Rs. 999');
  assert.equal(formatRs_(0), 'Rs. 0');
});

// ---------------------------------------------------------------------------------- Targets

test('targets: the fixture reads cleanly; stray cells and the E74:I90 block are ignored', () => {
  const read = readTargets_(metaDataTabs()['Rep-Targets'], repOptions(FIXTURE_REPS));
  assert.deepEqual(plain(read.problems), []);
  const keys = Object.keys(read.amounts);
  // 4 x 12 (RIA, SH, AUR, WAK) + 11 (SJ) + 12 (IB) + 11 (SM); nothing from columns E-I.
  assert.equal(keys.length, 82);
  assert.ok(keys.every((k) => FIXTURE_REPS.includes(k.split('|')[0])), keys.join());
  assert.ok(!Object.values(read.amounts).includes(98765432), 'E2 value was read');
});

test('targets: date months, comma text and SM rows beside the block are read', () => {
  const { amounts } = readTargets_(metaDataTabs()['Rep-Targets'], repOptions(FIXTURE_REPS));
  assert.equal(targetFor_(amounts, 'RIA', '2026-11'), fakeTarget('RIA', '2026-11'));
  assert.equal(targetFor_(amounts, 'RIA', '2026-07'), fakeTarget('RIA', '2026-07'));
  assert.equal(targetFor_(amounts, 'RIA', '2027-06'), fakeTarget('RIA', '2027-06'));
  assert.equal(targetFor_(amounts, 'IB', '2026-11'), 1740000); // typed as '1,740,000'
  assert.equal(targetFor_(amounts, 'SM', '2026-08'), fakeTarget('SM', '2026-08')); // row 74
  assert.equal(targetFor_(amounts, 'SM', '2026-11'), fakeTarget('SM', '2026-11'));
  assert.equal(targetFor_(amounts, 'SM', '2027-06'), fakeTarget('SM', '2027-06')); // row 84
});

test('targets: someone not in Rep_Mapping (MUB) is ignored without a message', () => {
  const read = readTargets_(metaDataTabs()['Rep-Targets'], repOptions(FIXTURE_REPS));
  assert.equal(targetFor_(read.amounts, 'MUB', '2026-07'), null);
  assert.ok(!read.problems.some((p) => p.includes('MUB')));
  // Even a broken row for someone who has left stays silent.
  const broken = readTargets_([['Rep', 'Month', 'Target'], ['MUB', 'junk', '']], repOptions(['RIA']));
  assert.deepEqual(plain(broken.problems), []);
});

test('targets: a typo in a code shows up, because that salesman then has no target', () => {
  const read = readTargets_([['Rep', 'Month', 'Target'], ['RAI', '2026-11', 500]], repOptions(['RIA']));
  assert.deepEqual(plain(read.problems), []);
  assert.equal(targetFor_(read.amounts, 'RIA', '2026-11'), null);
});

test('targets: a missing row means no target', () => {
  const { amounts } = readTargets_(metaDataTabs()['Rep-Targets'], repOptions(FIXTURE_REPS));
  assert.equal(targetFor_(amounts, 'SJ', '2026-07'), null); // SJ starts in August
  assert.equal(targetFor_(amounts, 'RIA', '2027-07'), null); // after the data ends
});

test('targets: the same salesman and month twice means no target, and is listed', () => {
  const read = readTargets_([
    ['Rep', 'Month', 'Target'],
    ['RIA', '2026-11', 100],
    ['SH', '2026-11', 300],
    ['ria', karachiMonthStart(2026, 11), 200],
  ], repOptions(['RIA', 'SH']));
  assert.equal(targetFor_(read.amounts, 'RIA', '2026-11'), null);
  assert.equal(targetFor_(read.amounts, 'SH', '2026-11'), 300);
  assert.equal(read.problems.length, 1);
  assert.match(read.problems[0], /^Rep-Targets rows 2 and 4: RIA has 2 targets for November 2026/);
});

test('targets: a half-filled row is listed with what is blank', () => {
  const read = readTargets_([
    ['Rep', 'Month', 'Target'],
    ['RIA', '2026-11', ''],
    ['', '2026-11', 5],
    ['', '', 5],
  ], repOptions(['RIA']));
  assert.deepEqual(plain(read.problems), [
    'Rep-Targets row 2: Target is blank.',
    'Rep-Targets row 3: Rep is blank.',
    'Rep-Targets row 4: Rep and Month are blank.',
  ]);
});

test('targets: a missing column fails with the message', () => {
  const read = readTargets_([['Rep', 'Month', 'Amount']], repOptions(['RIA']));
  assert.deepEqual(plain(read), { ok: false, message: "Rep-Targets has no 'Target' column in row 1." });
});

// --------------------------------------------------------------------------- Region targets

test('region targets: North, Center, South and UNASSIGNED (house / office sales)', () => {
  const read = readTargets_(metaDataTabs().Targets, REGION_OPTIONS);
  assert.deepEqual(plain(read.problems), []);
  for (const region of ['North', 'Center', 'South', 'UNASSIGNED']) {
    assert.equal(targetFor_(read.amounts, region, '2026-11'), fakeTarget(region, '2026-11'));
  }
});

test('region targets: capitals are tidied; an unknown region is listed', () => {
  const read = readTargets_([
    ['Region', 'Month', 'Target'],
    ['north', '2026-11', 10],
    ['Unassigned ', '2026-11', 20],
    ['East', '2026-11', 30],
  ], REGION_OPTIONS);
  assert.deepEqual(plain(read.amounts), { 'North|2026-11': 10, 'UNASSIGNED|2026-11': 20 });
  assert.deepEqual(plain(read.problems), [
    "Targets row 4: region 'East' is not North, Center, South or UNASSIGNED.",
  ]);
});

// -------------------------------------------------------------------------- All of Meta-Data

test('parseMetaData_: the fixture gives 7 salesmen, all targets, no problems', () => {
  const data = parseMetaData_(fixtureTables());
  assert.equal(data.ok, true);
  assert.equal(data.salesmen.length, 7);
  assert.deepEqual(plain(data.problems), []);
  assert.equal(targetFor_(data.repTargets, 'SJ', '2026-11'), fakeTarget('SJ', '2026-11'));
  assert.equal(targetFor_(data.regionTargets, 'UNASSIGNED', '2026-11'), fakeTarget('UNASSIGNED', '2026-11'));
});

test('parseMetaData_: a salesman left out of Rep_Mapping has his targets ignored', () => {
  const tables = fixtureTables();
  tables.salesmen = tables.salesmen.filter((row) => row[0] !== 'IB');
  const data = parseMetaData_(tables);
  assert.deepEqual(plain(data.problems), []);
  assert.equal(targetFor_(data.repTargets, 'IB', '2026-11'), null);
});

test('parseMetaData_: problems from every tab are collected, tab by tab', () => {
  const tables = fixtureTables();
  tables.salesmen.push(['ZZ', 'West']);
  tables.repTargets[2][2] = 'abc'; // RIA, row 3
  tables.regionTargets.push(['Nowhere', '2026-11', 1]);
  const data = parseMetaData_(tables);
  assert.equal(data.problems.length, 3);
  assert.match(data.problems[0], /^Rep_Mapping row 9:/);
  assert.match(data.problems[1], /^Rep-Targets row 3:/);
  assert.match(data.problems[2], /^Targets row 50:/);
});

test('parseMetaData_: a missing column in any tab stops with that one message', () => {
  for (const [tab, header, message] of [
    ['salesmen', ['Rep', 'Zone'], "Rep_Mapping has no 'Region' column in row 1."],
    ['repTargets', ['Rep', 'Month', 'Amount'], "Rep-Targets has no 'Target' column in row 1."],
    ['regionTargets', ['Zone', 'Month', 'Target'], "Targets has no 'Region' column in row 1."],
  ]) {
    const tables = fixtureTables();
    tables[tab][0] = header;
    assert.deepEqual(plain(parseMetaData_(tables)), { ok: false, message });
  }
});

// ---------------------------------------------------------------------------------- Summary

test('summary: salesmen by region, this month\'s targets, region targets, nothing to fix', () => {
  const text = buildSummary_(parseMetaData_(fixtureTables()), NOW_NOV_2026);
  const lines = text.split('\n');
  assert.equal(lines[0], 'Salesmen: 7');
  assert.ok(lines.includes('  North: RIA, AUR, WAK'));
  assert.ok(lines.includes('  Center: SH, SJ, SM'));
  assert.ok(lines.includes('  South: IB'));
  assert.ok(lines.includes('Targets for November 2026'));
  assert.ok(lines.includes('Region targets for November 2026'));
  for (const rep of FIXTURE_REPS) {
    const line = lines.find((l) => l.trim().startsWith(`${rep} `));
    assert.ok(line, `no line for ${rep}`);
    assert.ok(line.endsWith(formatRs_(fakeTarget(rep, '2026-11'))), line);
  }
  // Salesmen's targets are listed North, Center, South, in sheet order within a region.
  const order = lines.filter((l) => /^ {2}[A-Z]+ +Rs\./.test(l)).map((l) => l.trim().split(' ')[0]);
  assert.deepEqual(order, ['RIA', 'AUR', 'WAK', 'SH', 'SJ', 'SM', 'IB']);
  for (const [name, key] of [['North', 'North'], ['Center', 'Center'], ['South', 'South'],
    ['House / office sales', 'UNASSIGNED']]) {
    const line = lines.find((l) => l.trim().startsWith(`${name} `));
    assert.ok(line && line.endsWith(formatRs_(fakeTarget(key, '2026-11'))), `${name}: ${line}`);
  }
  assert.equal(lines[lines.length - 1], 'Nothing to fix.');
  assert.ok(!text.includes('Check these'));
  assert.ok(!text.includes('UNASSIGNED'));
});

test('summary: "no target" where there is none', () => {
  const tables = fixtureTables();
  tables.repTargets = tables.repTargets.filter((row) => !(row[0] === 'SJ'));
  tables.regionTargets = tables.regionTargets.filter((row) => row[0] !== 'UNASSIGNED');
  const lines = buildSummary_(parseMetaData_(tables), NOW_NOV_2026).split('\n');
  assert.match(lines.find((l) => l.trim().startsWith('SJ ')), /no target$/);
  assert.match(lines.find((l) => l.trim().startsWith('House / office sales')), /no target$/);
  assert.match(lines.find((l) => l.trim().startsWith('SM ')), /Rs\. /);
});

test('summary: "Check these:" lists every problem, including ones from outside Meta-Data', () => {
  const tables = fixtureTables();
  tables.repTargets[2][2] = 'abc';
  const text = buildSummary_(parseMetaData_(tables), NOW_NOV_2026, ["Lists has no 'sort' column in row 1."]);
  const lines = text.split('\n');
  const at = lines.indexOf('Check these:');
  assert.ok(at > 0);
  assert.deepEqual(lines.slice(at + 1), [
    "- Rep-Targets row 3: target 'abc' is not a number.",
    "- Lists has no 'sort' column in row 1.",
  ]);
  assert.ok(!text.includes('Nothing to fix.'));
});

test('summary: the month is the current month in Pakistan time, not UTC', () => {
  // 31 Oct 2026, 19:30 UTC is already 1 Nov in Karachi.
  const text = buildSummary_(parseMetaData_(fixtureTables()), NOW_NOV_2026);
  assert.ok(text.includes('Targets for November 2026'));
  assert.ok(!text.includes('October'));
});

test('summary: a region with nobody says none', () => {
  const tables = fixtureTables();
  tables.salesmen = tables.salesmen.filter((row) => row[1] !== 'South');
  assert.ok(buildSummary_(parseMetaData_(tables), NOW_NOV_2026).split('\n').includes('  South: none'));
});

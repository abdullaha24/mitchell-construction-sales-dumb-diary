'use strict';
// A stand-in for the owner's "Mitchell Sales Meta-Data" sheet. Same SHAPE as the live sheet
// (checked 2026-11-04, see docs/architecture/data-model.md); every AMOUNT IS MADE UP.
// The owner's real targets stay out of git.
//
// Rep-Targets layout, as on the live sheet:
//   rows 2-13 RIA, 14-25 SH, 26-37 AUR, 38-49 WAK  (Jul 2026 - Jun 2027)
//   row 50    MUB, Jul 2026 only (he has left; not in Rep_Mapping)
//   rows 51-61 SJ, 62-73 IB, 74-84 SM  (SJ and SM from Aug 2026)
//   E2        a stray value (the owner's formula)
//   E74:I90   the owner's hand-made October progress table, with 'rep' text in E74,
//             sitting beside SM's rows
// Months are date cells at midnight Karachi time, which is 7 pm the day before in UTC.
// IB's November 2026 target is typed as comma text.

const META_TIME_ZONE = 'Asia/Karachi';

/** Midnight on the 1st of a month in Karachi (UTC+5, no daylight saving). */
function karachiMonthStart(year, month) {
  return new Date(Date.UTC(year, month - 1, 1) - 5 * 60 * 60 * 1000);
}

/** The 12 months Jul 2026 - Jun 2027 as [year, month]. */
const MONTHS = Array.from({ length: 12 }, (_, i) => [i < 6 ? 2026 : 2027, ((6 + i) % 12) + 1]);

/** Made-up amounts: a base per code, plus 10,000 per month after July 2026. */
const BASE = {
  RIA: 1100000, SH: 1200000, AUR: 1300000, WAK: 1400000, MUB: 1500000,
  SJ: 1600000, IB: 1700000, SM: 1800000,
  North: 2100000, Center: 2200000, South: 2300000, UNASSIGNED: 2400000,
};

/**
 * The made-up target for a code or region in a month, as the fixture holds it.
 * @param {string} key e.g. 'RIA' or 'North'
 * @param {string} month 'yyyy-MM'
 */
function fakeTarget(key, month) {
  const index = MONTHS.findIndex(([y, m]) => `${y}-${String(m).padStart(2, '0')}` === month);
  if (index < 0) throw new Error(`fixture has no month ${month}`);
  return BASE[key] + index * 10000;
}

function targetRows(key, fromMonthIndex = 0, toMonthIndex = 11) {
  return MONTHS.slice(fromMonthIndex, toMonthIndex + 1).map(([y, m], i) => [
    key, karachiMonthStart(y, m), BASE[key] + (fromMonthIndex + i) * 10000,
  ]);
}

/** Fresh tables each call, so a test can change its copy. */
function metaDataTabs() {
  const repTargets = [
    ['Rep', 'Month', 'Target'],
    ...targetRows('RIA'),
    ...targetRows('SH'),
    ...targetRows('AUR'),
    ...targetRows('WAK'),
    ...targetRows('MUB', 0, 0),
    ...targetRows('SJ', 1),
    ...targetRows('IB'),
    ...targetRows('SM', 1),
  ];
  // IB, November 2026 (row 62 + 4 = row 66) typed as comma text.
  const ibNovember = repTargets.findIndex((r) => r[0] === 'IB') + 4;
  repTargets[ibNovember][2] = '1,740,000';

  // The stray formula value in E2.
  repTargets[1][4] = 98765432;

  // The October progress table in E74:I90 (rows 74-90 = indexes 73-89).
  const block = [
    ['rep', 'Oct Target', 'Oct Sales', '%', 'Balance'],
    ['RIA', 1130000, 500000, 0.44, 630000],
    ['AUR', 1330000, 700000, 0.53, 630000],
    ['WAK', 1430000, 200000, 0.14, 1230000],
    ['SH', 1230000, 900000, 0.73, 330000],
    ['SJ', 1620000, 100000, 0.06, 1520000],
    ['SM', 1820000, 150000, 0.08, 1670000],
    ['IB', 1730000, 300000, 0.17, 1430000],
    ['Total', 10290000, 2850000, 0.28, 7440000],
    ['', '', '', '', ''],
    ['note', 'checked', 'with', 'accounts', ''],
    ['', 1, 2, 3, 4],
    ['', 5, 6, 7, 8],
    ['', 9, 10, 11, 12],
    ['', 13, 14, 15, 16],
    ['', 17, 18, 19, 20],
    ['end', '', '', '', ''],
  ];
  block.forEach((cells, i) => {
    const index = 73 + i;
    while (repTargets.length <= index) repTargets.push([]);
    const row = repTargets[index];
    while (row.length < 4) row.push('');
    row.splice(4, 5, ...cells);
  });

  return {
    Rep_Mapping: [
      ['Rep', 'Region'],
      ['RIA', 'North'],
      ['AUR', 'North'],
      ['WAK', 'North'],
      ['SH', 'Center'],
      ['SJ', 'Center'],
      ['SM', 'Center'],
      ['IB', 'South'],
    ],
    'Rep-Targets': repTargets,
    Targets: [
      ['Region', 'Month', 'Target'],
      ...targetRows('North'),
      ...targetRows('Center'),
      ...targetRows('South'),
      ...targetRows('UNASSIGNED'),
    ],
  };
}

module.exports = { META_TIME_ZONE, karachiMonthStart, fakeTarget, metaDataTabs };

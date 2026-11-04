// @ts-check
// Plain rules for reading the Meta-Data sheet. Nothing here opens a spreadsheet: every function
// takes values (as returned by range.getValues()) and returns results. The only Google call is
// Utilities.formatDate, for months. "Now" is always a parameter. See spec 001 → Rules.

/** @typedef {{ rep: string, region: string, row: number }} Salesman */
/**
 * Targets by `KEY|yyyy-MM` (KEY is a salesman code or a region). Only real targets are kept:
 * a target of 0, a missing row, or a salesman/month listed twice all mean "no target".
 * @typedef {Object<string, number>} TargetAmounts
 */
/** @typedef {{ ok: false, message: string }} Failure */
/** @typedef {{ ok: true, columns: Object<string, number> }} ColumnsFound */
/** @typedef {{ ok: true, salesmen: Salesman[], problems: string[] }} SalesmenRead */
/** @typedef {{ ok: true, amounts: TargetAmounts, problems: string[] }} TargetsRead */
/**
 * Everything Check setup needs from Meta-Data.
 * @typedef {{
 *   ok: true,
 *   salesmen: Salesman[],
 *   repTargets: TargetAmounts,
 *   regionTargets: TargetAmounts,
 *   problems: string[],
 * }} MetaData
 */
/**
 * The three Meta-Data tabs as values, plus the sheet's own timezone.
 * @typedef {{
 *   salesmen: any[][],
 *   repTargets: any[][],
 *   regionTargets: any[][],
 *   timeZone: string,
 * }} MetaDataTables
 */

/**
 * How far a number may be from a whole number and still count as one. A formula can give
 * 13799999.999999998 for a cell that shows 13,800,000; getValues() returns the raw number.
 */
const WHOLE_NUMBER_TOLERANCE = 1e-6;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * True for an empty cell: '', null, undefined, or only spaces.
 * @param {any} value
 */
function isBlank_(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

/**
 * A cell as short text, for messages.
 * @param {any} value
 */
function cellText_(value) {
  return isBlank_(value) ? '' : String(value).trim();
}

/**
 * True for a Date, including one made in another JavaScript realm (as in tests), where
 * `instanceof Date` would be false.
 * @param {any} value
 * @returns {value is Date}
 */
function isDate_(value) {
  return Object.prototype.toString.call(value) === '[object Date]';
}

/**
 * A header or code compared loosely: edge spaces dropped, capitals ignored.
 * @param {any} value
 */
function looseText_(value) {
  return isBlank_(value) ? '' : String(value).trim().toLowerCase();
}

/**
 * A salesman code tidied: `" ria"` → `RIA`.
 * @param {any} value
 */
function tidyCode_(value) {
  return isBlank_(value) ? '' : String(value).trim().toUpperCase();
}

/**
 * Joins words for a message: `a`, `a or b`, `a, b or c`.
 * @param {string[]} words
 * @param {string} last 'or' / 'and'
 */
function joinWords_(words, last) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} ${last} ${words[words.length - 1]}`;
}

/**
 * Finds columns by their header name in row 1 only, in any order, ignoring capitals and edge
 * spaces. If a name appears twice in row 1, the first is used.
 * @param {any[][]} values the whole tab
 * @param {string[]} names the headers needed
 * @param {string} tabName for the message
 * @returns {ColumnsFound | Failure}
 */
function findColumns_(values, names, tabName) {
  const header = (values[0] || []).map(looseText_);
  /** @type {Object<string, number>} */
  const columns = {};
  for (const name of names) {
    const index = header.indexOf(looseText_(name));
    if (index < 0) return { ok: false, message: `${tabName} has no '${name}' column in row 1.` };
    columns[name] = index;
  }
  return { ok: true, columns };
}

/**
 * A month cell as `yyyy-MM`, or null if it isn't a month.
 * A date cell is read in `timeZone`, which must be the timezone of the sheet it came from:
 * the cell "1 Aug 2026" in a Karachi sheet is 31 Jul, 7 pm in UTC.
 * Text must be exactly `YYYY-MM`.
 * @param {any} value
 * @param {string} timeZone
 * @returns {string | null}
 */
function monthKey_(value, timeZone) {
  if (isDate_(value)) {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, timeZone, 'yyyy-MM');
  }
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${match[1]}-${match[2]}` : null;
}

/**
 * `2026-11` → `November 2026`.
 * @param {string} key a `yyyy-MM` month
 */
function monthLabel_(key) {
  const [year, month] = key.split('-');
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

/**
 * This month in Pakistan time, as `yyyy-MM`.
 * @param {Date} now
 */
function currentMonthKey_(now) {
  return Utilities.formatDate(now, APP_TIME_ZONE, 'yyyy-MM');
}

/**
 * An amount cell as whole rupees, or null if it isn't a whole number of zero or more.
 * Accepts a number (within WHOLE_NUMBER_TOLERANCE of a whole number, so formula results
 * count), or text such as `12,345,000` or `Rs. 12,345,000` (commas, a leading `Rs.` and
 * spaces are removed).
 * @param {any} value
 * @returns {number | null}
 */
function parseRs_(value) {
  if (typeof value === 'number') {
    if (!isFinite(value)) return null;
    const whole = Math.round(value);
    if (Math.abs(value - whole) > WHOLE_NUMBER_TOLERANCE) return null;
    return Number.isSafeInteger(whole) && whole >= 0 ? whole + 0 : null; // + 0 turns -0 into 0
  }
  if (typeof value !== 'string') return null;
  const digits = value.trim().replace(/^rs\.?/i, '').replace(/[,\s]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : null;
}

/**
 * Why an amount cell was refused, for the problem list.
 * @param {any} value a cell parseRs_ returned null for
 */
function badAmountReason_(value) {
  const cleaned = typeof value === 'number' ? value
    : Number(String(value).trim().replace(/^rs\.?/i, '').replace(/[,\s]/g, ''));
  return isFinite(cleaned) && typeof value !== 'boolean'
    ? 'is not a whole number of 0 or more'
    : 'is not a number';
}

/**
 * `12345000` → `Rs. 12,345,000`. Built by hand so it doesn't depend on the server's locale.
 * @param {number} amount whole rupees
 */
function formatRs_(amount) {
  return `Rs. ${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Reads the salesmen from the `Rep_Mapping` tab.
 * @param {any[][]} values the whole tab
 * @param {string} tabName for messages
 * @returns {SalesmenRead | Failure}
 */
function readSalesmen_(values, tabName) {
  const found = findColumns_(values, ['Rep', 'Region'], tabName);
  if (!found.ok) return found;
  const repColumn = found.columns.Rep;
  const regionColumn = found.columns.Region;
  /** @type {Salesman[]} */
  const salesmen = [];
  /** @type {string[]} */
  const problems = [];
  /** @type {Object<string, number>} */
  const firstRow = {};

  for (let i = 1; i < values.length; i++) {
    const row = i + 1;
    const repCell = values[i][repColumn];
    const regionCell = values[i][regionColumn];
    if (isBlank_(repCell) && isBlank_(regionCell)) continue;
    if (isBlank_(repCell)) {
      problems.push(`${tabName} row ${row}: Region is filled in but Rep is blank.`);
      continue;
    }
    const rep = tidyCode_(repCell);
    // The first row for a salesman is the one that counts, even if it has a problem.
    if (firstRow[rep]) {
      problems.push(`${tabName} row ${row}: ${rep} is listed again (first in row ` +
        `${firstRow[rep]}). Only row ${firstRow[rep]} counts.`);
      continue;
    }
    firstRow[rep] = row;
    if (isBlank_(regionCell)) {
      problems.push(`${tabName} row ${row}: ${rep} has no Region.`);
      continue;
    }
    const region = REGIONS.find((r) => looseText_(r) === looseText_(regionCell));
    if (!region) {
      problems.push(`${tabName} row ${row}: ${rep}'s region '${cellText_(regionCell)}' is not ` +
        `${joinWords_(REGIONS, 'or')}. ${rep} is left out until it's fixed.`);
      continue;
    }
    salesmen.push({ rep, region, row });
  }
  return { ok: true, salesmen, problems };
}

/**
 * Reads a targets tab: `Rep-Targets` (key column `Rep`) or `Targets` (key column `Region`).
 * Only the key, `Month` and `Target` columns are read; every other cell is ignored.
 * @param {any[][]} values the whole tab
 * @param {{
 *   tabName: string,
 *   keyColumn: string,
 *   keys: string[],
 *   unknownKeys: 'ignore' | 'problem',
 *   timeZone: string,
 * }} options
 *   keys: the valid keys, as they should be written (matched ignoring capitals and spaces).
 *   unknownKeys: 'ignore' skips rows for anyone else without a message (people who have left);
 *   'problem' lists them. timeZone: the sheet's own timezone, for date months.
 * @returns {TargetsRead | Failure}
 */
function readTargets_(values, options) {
  const { tabName, keyColumn, keys, unknownKeys, timeZone } = options;
  const found = findColumns_(values, [keyColumn, 'Month', 'Target'], tabName);
  if (!found.ok) return found;
  const columns = found.columns;
  /** @type {string[]} */
  const problems = [];
  /** @type {Object<string, { key: string, month: string, amount: number, rows: number[] }>} */
  const byKeyAndMonth = {};

  for (let i = 1; i < values.length; i++) {
    const row = i + 1;
    const keyCell = values[i][columns[keyColumn]];
    const monthCell = values[i][columns.Month];
    const targetCell = values[i][columns.Target];
    if (isBlank_(keyCell) && isBlank_(monthCell) && isBlank_(targetCell)) continue;

    const key = keys.find((k) => tidyCode_(k) === tidyCode_(keyCell));
    if (!isBlank_(keyCell) && !key && unknownKeys === 'ignore') continue;

    const blanks = [[keyColumn, keyCell], ['Month', monthCell], ['Target', targetCell]]
      .filter(([, cell]) => isBlank_(cell))
      .map(([name]) => name);
    if (blanks.length > 0) {
      problems.push(`${tabName} row ${row}: ${joinWords_(blanks, 'and')} ` +
        `${blanks.length > 1 ? 'are' : 'is'} blank.`);
      continue;
    }
    if (!key) {
      problems.push(`${tabName} row ${row}: ${looseText_(keyColumn)} '${cellText_(keyCell)}' ` +
        `is not ${joinWords_(keys, 'or')}.`);
      continue;
    }
    const month = monthKey_(monthCell, timeZone);
    if (!month) {
      problems.push(`${tabName} row ${row}: month '${cellText_(monthCell)}' is not a month. ` +
        `Use a date or YYYY-MM.`);
      continue;
    }
    const amount = parseRs_(targetCell);
    if (amount === null) {
      problems.push(`${tabName} row ${row}: target '${cellText_(targetCell)}' ` +
        `${badAmountReason_(targetCell)}.`);
      continue;
    }
    // 0 means no target, the same as a missing row, so it never makes a duplicate either.
    if (amount === 0) continue;
    const id = `${key}|${month}`;
    if (byKeyAndMonth[id]) byKeyAndMonth[id].rows.push(row);
    else byKeyAndMonth[id] = { key, month, amount, rows: [row] };
  }

  /** @type {TargetAmounts} */
  const amounts = {};
  for (const [id, entry] of Object.entries(byKeyAndMonth)) {
    if (entry.rows.length > 1) {
      problems.push(`${tabName} rows ${joinWords_(entry.rows.map(String), 'and')}: ` +
        `${entry.key} has ${entry.rows.length} targets for ${monthLabel_(entry.month)}. ` +
        `Until only one is left, ${entry.key} has no target that month.`);
    } else {
      amounts[id] = entry.amount;
    }
  }
  return { ok: true, amounts, problems };
}

/**
 * The target for a salesman or region in a month, or null for "no target".
 * @param {TargetAmounts} amounts
 * @param {string} key
 * @param {string} month `yyyy-MM`
 * @returns {number | null}
 */
function targetFor_(amounts, key, month) {
  const id = `${key}|${month}`;
  return Object.prototype.hasOwnProperty.call(amounts, id) ? amounts[id] : null;
}

/**
 * Reads all three Meta-Data tabs. Salesmen come first: `Rep-Targets` rows for anyone not in
 * `Rep_Mapping` are ignored without a message.
 * @param {MetaDataTables} tables
 * @returns {MetaData | Failure}
 */
function parseMetaData_(tables) {
  const salesmen = readSalesmen_(tables.salesmen, META_TABS.salesmen);
  if (!salesmen.ok) return salesmen;
  const repTargets = readTargets_(tables.repTargets, {
    tabName: META_TABS.repTargets,
    keyColumn: 'Rep',
    keys: salesmen.salesmen.map((s) => s.rep),
    unknownKeys: 'ignore',
    timeZone: tables.timeZone,
  });
  if (!repTargets.ok) return repTargets;
  const regionTargets = readTargets_(tables.regionTargets, {
    tabName: META_TABS.regionTargets,
    keyColumn: 'Region',
    keys: REGIONS.concat([HOUSE_REGION]),
    unknownKeys: 'problem',
    timeZone: tables.timeZone,
  });
  if (!regionTargets.ok) return regionTargets;
  return {
    ok: true,
    salesmen: salesmen.salesmen,
    repTargets: repTargets.amounts,
    regionTargets: regionTargets.amounts,
    problems: salesmen.problems.concat(repTargets.problems, regionTargets.problems),
  };
}

/**
 * Pads text with spaces on the right.
 * @param {string} text
 * @param {number} width
 */
function padRight_(text, width) {
  return text + ' '.repeat(Math.max(0, width - text.length));
}

/**
 * The problem list that ends every Check setup message.
 * @param {string[]} problems
 * @returns {string[]} lines
 */
function problemLines_(problems) {
  return problems.length === 0
    ? ['Nothing to fix.']
    : ['Check these:'].concat(problems.map((p) => `- ${p}`));
}

/**
 * The Check setup summary: salesmen by region, this month's targets, region targets, and
 * either "Nothing to fix." or "Check these:" with every problem.
 * @param {MetaData} data
 * @param {Date} now
 * @param {string[]} [moreProblems] problems found outside Meta-Data (e.g. in Sales Diary)
 */
function buildSummary_(data, now, moreProblems = []) {
  const month = currentMonthKey_(now);
  const label = monthLabel_(month);
  /** @param {number | null} amount */
  const amountText = (amount) => (amount === null ? 'no target' : formatRs_(amount));
  const lines = [`Salesmen: ${data.salesmen.length}`];

  /** @type {Salesman[]} */
  const ordered = [];
  for (const region of REGIONS) {
    const inRegion = data.salesmen.filter((s) => s.region === region);
    ordered.push(...inRegion);
    lines.push(`  ${region}: ${inRegion.length ? inRegion.map((s) => s.rep).join(', ') : 'none'}`);
  }

  lines.push('', `Targets for ${label}`);
  const repWidth = Math.max(0, ...ordered.map((s) => s.rep.length)) + 2;
  for (const s of ordered) {
    lines.push(`  ${padRight_(s.rep, repWidth)}${amountText(targetFor_(data.repTargets, s.rep, month))}`);
  }
  if (ordered.length === 0) lines.push('  No salesmen.');

  lines.push('', `Region targets for ${label}`);
  const regions = REGIONS.map((r) => ({ key: r, name: r }))
    .concat([{ key: HOUSE_REGION, name: HOUSE_REGION_LABEL }]);
  const regionWidth = Math.max(...regions.map((r) => r.name.length)) + 2;
  for (const r of regions) {
    lines.push(`  ${padRight_(r.name, regionWidth)}${amountText(targetFor_(data.regionTargets, r.key, month))}`);
  }

  lines.push('', ...problemLines_(data.problems.concat(moreProblems)));
  return lines.join('\n');
}

// @ts-check
// Private links (spec 002, ADR-0002, ADR-0006). A link is WEB_APP_URL + '?k=' + a code of
// 64 random letters and digits. The `Links` tab maps codes to people.
//
// SECRETS: codes must never go into a log, an error message, the Activity tab, or any page
// except the owner's Links window. Nothing in this file puts a code into a message.

/** @typedef {{ kind: 'rep', rep: string, region: string } | { kind: 'owner' } | { kind: 'none' }} Visitor */
/**
 * One row of the `Links` tab, tidied.
 * @typedef {{
 *   row: number,
 *   role: string,
 *   rep: string,
 *   token: string,
 *   active: boolean,
 *   issuedAt: any,
 * }} LinkRow
 */
/** @typedef {{ ok: true, rows: LinkRow[], columns: Object<string, number> }} LinksRead */

const OWNER_ROLE = 'owner';
const REP_ROLE = 'rep';
const LINK_PARAM = 'k';
const LOCK_WAIT_MS = 10000;

/**
 * A new link code: two of Google's random IDs joined, dashes removed. 64 letters and digits,
 * about 244 bits of randomness (ADR-0002 asks for at least 128).
 */
function makeCode_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
}

/**
 * True only for something shaped like a code we make. Anything else is refused before any
 * sheet is opened.
 * @param {any} code
 */
function isWellFormedCode_(code) {
  return typeof code === 'string' && /^[0-9a-f]{64}$/.test(code);
}

/**
 * The full link for a code.
 * @param {string} code
 */
function linkFor_(code) {
  return `${WEB_APP_URL}?${LINK_PARAM}=${code}`;
}

/**
 * True when an `active` cell means "working": the TRUE checkbox, or the text TRUE typed by hand.
 * @param {any} value
 */
function isActiveCell_(value) {
  return value === true || (typeof value === 'string' && value.trim().toUpperCase() === 'TRUE');
}

/**
 * Who a row belongs to: 'owner', a salesman code, or '' if the row makes no sense.
 * @param {LinkRow} row
 */
function personOf_(row) {
  if (row.role === OWNER_ROLE) return OWNER_ROLE;
  if (row.role === REP_ROLE && row.rep) return row.rep;
  return '';
}

/**
 * Reads the `Links` tab. Columns are found by header name.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {LinksRead | Failure}
 */
function readLinks_(sheet) {
  const values = sheet.getDataRange().getValues();
  const found = findColumns_(values, DIARY_HEADERS[DIARY_TABS.links], DIARY_TABS.links);
  if (!found.ok) return found;
  const c = found.columns;
  /** @type {LinkRow[]} */
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    rows.push({
      row: i + 1,
      role: looseText_(values[i][c.role]),
      rep: tidyCode_(values[i][c.rep]),
      token: isBlank_(values[i][c.token]) ? '' : String(values[i][c.token]).trim(),
      active: isActiveCell_(values[i][c.active]),
      issuedAt: values[i][c.issued_at],
    });
  }
  return { ok: true, rows, columns: c };
}

/**
 * The `Links` tab of a Sales Diary spreadsheet, read. Throws (with no code in the message) if
 * the tab or a column is missing: Check setup creates and reports those.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @returns {{ sheet: GoogleAppsScript.Spreadsheet.Sheet, links: LinksRead }}
 */
function openLinks_(diary) {
  const sheet = diary.getSheetByName(DIARY_TABS.links);
  if (!sheet) throw new Error("The Sales Diary sheet has no 'Links' tab. Run Check setup.");
  const links = readLinks_(sheet);
  if (!links.ok) throw new Error(links.message);
  return { sheet, links };
}

/**
 * Works out who a link code belongs to, checked on the server on every page load.
 * - Not shaped like a code → none, without opening any sheet.
 * - No active `Links` row with exactly this code → none.
 * - Owner row → owner. A salesman's row → that salesman, but only while he is still in
 *   `Rep_Mapping`. The two are told apart by `role`, never by the code.
 * Throws if Google fails (a sheet can't be opened), so the page can say "try again" instead of
 * "this link doesn't work".
 * @param {any} code the `k` value from the address
 * @returns {Visitor}
 */
function whoIsVisiting_(code) {
  if (!isWellFormedCode_(code)) return { kind: 'none' };
  const { links } = openLinks_(openSalesDiary_());
  const match = links.rows.find((r) => r.active && r.token === code);
  if (!match) return { kind: 'none' };
  if (match.role === OWNER_ROLE) return { kind: 'owner' };
  if (match.role !== REP_ROLE || !match.rep) return { kind: 'none' };

  const salesmen = readSalesmenOnly_();
  if (!salesmen.ok) throw new Error(salesmen.message);
  const salesman = salesmen.salesmen.find((s) => s.rep === match.rep);
  return salesman ? { kind: 'rep', rep: salesman.rep, region: salesman.region } : { kind: 'none' };
}

/**
 * Runs `work` while holding the script lock, so two quick taps can't both make a link.
 * Google holds sheet edits back until a run ends, so they are saved (flush) before the lock is
 * let go; otherwise the next run could read the tab as it was.
 * @template T
 * @param {() => T} work
 * @returns {T}
 */
function withScriptLock_(work) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    return work();
  } finally {
    try {
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
}

/**
 * Everyone who has a working link row right now: 'owner' and/or salesman codes, whether or not
 * they are still in Rep_Mapping.
 * @param {LinksRead} links
 * @returns {string[]}
 */
function peopleWithWorkingLinks_(links) {
  /** @type {string[]} */
  const people = [];
  for (const row of links.rows) {
    const who = personOf_(row);
    if (row.active && who && !people.includes(who)) people.push(who);
  }
  return people;
}

/**
 * Sets `active` to FALSE on every working row of one person.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {LinksRead} links
 * @param {string} who 'owner' or a salesman code
 * @returns {number} how many links were cancelled
 */
function cancelRows_(sheet, links, who) {
  let cancelled = 0;
  for (const row of links.rows) {
    if (row.active && personOf_(row) === who) {
      sheet.getRange(row.row, links.columns.active + 1).setValues([[false]]);
      cancelled++;
    }
  }
  return cancelled;
}

/**
 * Makes a new link for one person, cancelling any older ones first. The caller has already
 * checked that `who` is 'owner' or a current salesman.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {string} who 'owner' or a salesman code
 * @param {Date} now
 * @returns {string} the new code
 */
function newLink_(diary, who, now) {
  return withScriptLock_(() => {
    const { sheet, links } = openLinks_(diary);
    cancelRows_(sheet, links, who);
    const c = links.columns;
    const row = new Array(Math.max(...Object.values(c)) + 1).fill('');
    const code = makeCode_();
    row[c.role] = who === OWNER_ROLE ? OWNER_ROLE : REP_ROLE;
    row[c.rep] = who === OWNER_ROLE ? '' : who;
    row[c.token] = code;
    row[c.active] = true;
    row[c.issued_at] = now;
    appendRows_(sheet, [row]);
    return code;
  });
}

/**
 * Cancels every working link of one person.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {string} who 'owner' or a salesman code
 * @returns {number} how many links were cancelled
 */
function cancelLinks_(diary, who) {
  return withScriptLock_(() => {
    const { sheet, links } = openLinks_(diary);
    return cancelRows_(sheet, links, who);
  });
}

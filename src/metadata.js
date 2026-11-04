// @ts-check
// The ONLY code that opens the owner's Meta-Data sheet (ADR-0005). It only ever reads it:
// nothing in this file, or anywhere else, may write to it. Tests run it against a fake that
// throws on any write.

const META_DATA_UNREADABLE = "Can't open the Meta-Data sheet. Check it still exists and your " +
  'Google account can open it.';

/**
 * Opens the Meta-Data sheet, or returns null if it can't be opened.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet | null}
 */
function openMetaData_() {
  try {
    return SpreadsheetApp.openById(META_DATA_ID);
  } catch (e) {
    return null;
  }
}

/**
 * One Meta-Data tab's values, or a message if the tab is missing.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} metaData
 * @param {string} tabName
 * @returns {{ ok: true, values: any[][] } | Failure}
 */
function readMetaTab_(metaData, tabName) {
  const sheet = metaData.getSheetByName(tabName);
  if (!sheet) return { ok: false, message: `The Meta-Data sheet has no '${tabName}' tab.` };
  return { ok: true, values: sheet.getDataRange().getValues() };
}

/**
 * Reads salesmen and targets from the Meta-Data sheet.
 * Returns the results, or one clear message if the sheet, a tab or a column can't be found.
 * @returns {MetaData | Failure}
 */
function readMetaData_() {
  const metaData = openMetaData_();
  if (!metaData) return { ok: false, message: META_DATA_UNREADABLE };

  /** @type {Object<string, any[][]>} */
  const values = {};
  for (const tabName of [META_TABS.salesmen, META_TABS.repTargets, META_TABS.regionTargets]) {
    const tab = readMetaTab_(metaData, tabName);
    if (!tab.ok) return tab;
    values[tabName] = tab.values;
  }

  return parseMetaData_({
    salesmen: values[META_TABS.salesmen],
    repTargets: values[META_TABS.repTargets],
    regionTargets: values[META_TABS.regionTargets],
    // Date months must be read in the Meta-Data sheet's own timezone (spec 001).
    timeZone: metaData.getSpreadsheetTimeZone(),
  });
}

/**
 * Reads only the salesmen (`Rep_Mapping`). Used on every page load, so it skips the targets.
 * @returns {SalesmenRead | Failure}
 */
function readSalesmenOnly_() {
  const metaData = openMetaData_();
  if (!metaData) return { ok: false, message: META_DATA_UNREADABLE };
  const tab = readMetaTab_(metaData, META_TABS.salesmen);
  if (!tab.ok) return tab;
  return readSalesmen_(tab.values, META_TABS.salesmen);
}

/** Where the salesmen list is kept between calls (Script Properties), and for how long. */
const SALESMEN_KEY = 'salesmen';
const SALESMEN_KEEP_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps the salesmen list (codes and regions only) for SALESMEN_KEEP_MS. A salesman moved to
 * another region keeps his old region on new sites until the list is refreshed.
 * @param {Salesman[]} salesmen
 * @param {Date} now
 */
function keepSalesmen_(salesmen, now) {
  PropertiesService.getScriptProperties().setProperty(SALESMEN_KEY, JSON.stringify({
    at: now.getTime(),
    salesmen: salesmen.map((s) => ({ rep: s.rep, region: s.region })),
  }));
}

/**
 * Reads `Rep_Mapping` now and keeps it (Refresh salesmen, Check setup, or when the kept list is
 * older than a day).
 * @param {Date} now
 * @returns {SalesmenRead | Failure}
 */
function refreshSalesmen_(now) {
  const read = readSalesmenOnly_();
  if (read.ok) keepSalesmen_(read.salesmen, now);
  return read;
}

/**
 * The salesmen list for salesman calls (spec 005, owner P4b-3): the kept copy if it is less than
 * a day old, so a save doesn't open the Meta-Data sheet; otherwise read and kept again.
 * @param {Date} now
 * @returns {SalesmenRead | Failure}
 */
function knownSalesmen_(now) {
  const stored = PropertiesService.getScriptProperties().getProperty(SALESMEN_KEY);
  if (stored) {
    try {
      const kept = JSON.parse(stored);
      if (Array.isArray(kept.salesmen) && now.getTime() - kept.at >= 0 && now.getTime() - kept.at < SALESMEN_KEEP_MS) {
        return { ok: true, salesmen: kept.salesmen, problems: [] };
      }
    } catch (e) {
      // Unreadable copy: read again below.
    }
  }
  return refreshSalesmen_(now);
}

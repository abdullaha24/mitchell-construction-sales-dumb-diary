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

// @ts-check
// The ONLY code that opens the owner's Meta-Data sheet (ADR-0005). It only ever reads it:
// nothing in this file, or anywhere else, may write to it. Tests run it against a fake that
// throws on any write.

const META_DATA_UNREADABLE = "Can't open the Meta-Data sheet. Check it still exists and your " +
  'Google account can open it.';

/**
 * Reads salesmen and targets from the Meta-Data sheet.
 * Returns the results, or one clear message if the sheet, a tab or a column can't be found.
 * @returns {MetaData | Failure}
 */
function readMetaData_() {
  /** @type {GoogleAppsScript.Spreadsheet.Spreadsheet} */
  let metaData;
  try {
    metaData = SpreadsheetApp.openById(META_DATA_ID);
  } catch (e) {
    return { ok: false, message: META_DATA_UNREADABLE };
  }

  /** @type {Object<string, any[][]>} */
  const values = {};
  for (const tabName of [META_TABS.salesmen, META_TABS.repTargets, META_TABS.regionTargets]) {
    const sheet = metaData.getSheetByName(tabName);
    if (!sheet) return { ok: false, message: `The Meta-Data sheet has no '${tabName}' tab.` };
    values[tabName] = sheet.getDataRange().getValues();
  }

  return parseMetaData_({
    salesmen: values[META_TABS.salesmen],
    repTargets: values[META_TABS.repTargets],
    regionTargets: values[META_TABS.regionTargets],
    // Date months must be read in the Meta-Data sheet's own timezone (spec 001).
    timeZone: metaData.getSpreadsheetTimeZone(),
  });
}

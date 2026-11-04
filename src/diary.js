// @ts-check
// Opening the Sales Diary sheet and adding rows to it. The ONLY code that opens Sales Diary by
// its ID (ADR-0008); everything else gets the spreadsheet from here or from the open sheet.

/**
 * The Sales Diary spreadsheet. A web app has no "open sheet", so it is found by its ID.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function openSalesDiary_() {
  return SpreadsheetApp.openById(SALES_DIARY_ID);
}

/**
 * Writes rows below the last row in use. Google refuses to write past a tab's last row, so
 * rows are added first when needed. All rows must be the same width; columns beyond that
 * width are left alone.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {any[][]} rows
 * @returns {number} the row number of the first row written (0 if there were none)
 */
function appendRows_(sheet, rows) {
  if (rows.length === 0) return 0;
  const firstNewRow = sheet.getLastRow() + 1;
  const shortBy = firstNewRow + rows.length - 1 - sheet.getMaxRows();
  if (shortBy > 0) sheet.insertRowsAfter(sheet.getMaxRows(), shortBy);
  sheet.getRange(firstNewRow, 1, rows.length, rows[0].length).setValues(rows);
  return firstNewRow;
}

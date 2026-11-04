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
 * width are left alone. Columns listed in `textColumns` (0-based) are set to plain text on the
 * new rows before writing, so phone numbers and codes are never turned into numbers.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {any[][]} rows
 * @param {number[]} [textColumns]
 * @returns {number} the row number of the first row written (0 if there were none)
 */
function appendRows_(sheet, rows, textColumns = []) {
  if (rows.length === 0) return 0;
  const firstNewRow = sheet.getLastRow() + 1;
  const shortBy = firstNewRow + rows.length - 1 - sheet.getMaxRows();
  if (shortBy > 0) sheet.insertRowsAfter(sheet.getMaxRows(), shortBy);
  for (const column of textColumns) {
    sheet.getRange(firstNewRow, column + 1, rows.length, 1).setNumberFormat('@');
  }
  sheet.getRange(firstNewRow, 1, rows.length, rows[0].length).setValues(rows);
  return firstNewRow;
}

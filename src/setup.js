// @ts-check
// Sets up the Sales Diary sheet: creates the tabs that are missing and fills the starting
// pick-lists. Safe to run any time. It never deletes or changes the owner's data:
// - a tab that already exists is never touched, even if its headers differ;
// - a list in `Lists` is filled only when it has no rows at all;
// - only a completely empty `Sheet1` is deleted.
// See spec 001 → "Setting up the Sales Diary sheet".

/**
 * Sets up the Sales Diary sheet.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary the Sales Diary spreadsheet
 * @returns {{ problems: string[] }} things the owner needs to fix by hand
 */
function setUpSalesDiary_(diary) {
  for (const tabName of [DIARY_TABS.sites, DIARY_TABS.activity, DIARY_TABS.lists, DIARY_TABS.links]) {
    if (!diary.getSheetByName(tabName)) createDiaryTab_(diary, tabName);
  }

  // Only when different, so running setup again makes no edit at all.
  if (diary.getSpreadsheetTimeZone() !== APP_TIME_ZONE) {
    diary.setSpreadsheetTimeZone(APP_TIME_ZONE);
  }

  const lists = diary.getSheetByName(DIARY_TABS.lists);
  const problems = lists ? fillStartingLists_(lists) : [];

  // Last: the other tabs exist by now, so this is never the spreadsheet's only tab.
  deleteEmptyFirstTab_(diary);
  return { problems };
}

/**
 * Adds a tab at the end with its header row from the data model, bold and frozen.
 * Columns in TEXT_COLUMNS are plain text (e.g. `923001234567` keeps its digits).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {string} tabName
 */
function createDiaryTab_(diary, tabName) {
  const headers = DIARY_HEADERS[tabName];
  const sheet = diary.insertSheet(tabName, diary.getSheets().length);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
  for (const name of TEXT_COLUMNS[tabName] || []) {
    sheet.getRange(1, headers.indexOf(name) + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
  }
}

/**
 * Adds the starting rows of each list in STARTING_LISTS that has no rows yet, below the last
 * row in use. Columns are found by header name, so the owner may reorder or add columns.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet the `Lists` tab
 * @returns {string[]} problems
 */
function fillStartingLists_(sheet) {
  const values = sheet.getDataRange().getValues();
  const found = findColumns_(values, DIARY_HEADERS[DIARY_TABS.lists], DIARY_TABS.lists);
  if (!found.ok) return [`${found.message} The starting lists were not added.`];
  const columns = found.columns;

  /** @type {Object<string, boolean>} */
  const hasRows = {};
  for (let i = 1; i < values.length; i++) {
    hasRows[looseText_(values[i][columns.list])] = true;
  }

  // Write only as wide as the columns we fill, so other columns are left alone.
  const width = Math.max(...Object.values(columns)) + 1;
  /** @type {any[][]} */
  const newRows = [];
  for (const [list, items] of Object.entries(STARTING_LISTS)) {
    if (hasRows[looseText_(list)]) continue;
    items.forEach((value, i) => {
      const row = new Array(width).fill('');
      row[columns.list] = list;
      row[columns.value] = value;
      row[columns.region] = '';
      row[columns.added_by] = STARTING_LISTS_ADDED_BY;
      row[columns.active] = true;
      row[columns.sort] = (i + 1) * LIST_SORT_STEP;
      newRows.push(row);
    });
  }
  appendRows_(sheet, newRows);
  return [];
}

/**
 * Deletes Google's blank first tab, but only if it is completely empty (no values, charts or
 * images) and is not the only tab.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 */
function deleteEmptyFirstTab_(diary) {
  const sheet = diary.getSheetByName(DEFAULT_FIRST_TAB);
  if (!sheet) return;
  const empty = sheet.getLastRow() === 0 && sheet.getLastColumn() === 0 &&
    sheet.getCharts().length === 0 && sheet.getImages().length === 0;
  if (empty && diary.getSheets().length > 1) diary.deleteSheet(sheet);
}

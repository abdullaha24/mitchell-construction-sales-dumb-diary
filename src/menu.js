// @ts-check
// The Sales Diary menu in the Sales Diary sheet.
//
// SAFETY: a web page can call any function whose name doesn't end in `_` (google.script.run),
// and the web app runs as the owner. So menuCheckSetup refuses to run unless a signed-in person
// is running it as themselves, which is true when the owner taps the menu and never true for a
// web app visitor. See spec 001 → "Safety rules for all code".

/**
 * Adds the Sales Diary menu when the sheet opens. No signed-in check here: it only adds the
 * menu, and it runs in a limited mode where Google may not give the user's email.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sales Diary')
    .addItem('Check setup', 'menuCheckSetup')
    .addToUi();
}

/**
 * True only when a signed-in person is running the script as themselves: the active user's
 * email is known and is the same as the effective user's (the account the script runs as).
 */
function isSignedInSelf_() {
  const active = Session.getActiveUser().getEmail() || '';
  const effective = Session.getEffectiveUser().getEmail() || '';
  return active !== '' && active === effective;
}

/**
 * Sales Diary → Check setup. Creates any missing Sales Diary tabs, then shows the salesmen,
 * this month's targets and anything to fix. Never writes to Meta-Data.
 */
function menuCheckSetup() {
  if (!isSignedInSelf_()) {
    throw new Error('Check setup can only be run by the owner, from the Sales Diary menu.');
  }
  const diary = SpreadsheetApp.getActiveSpreadsheet();
  if (!diary) throw new Error('Open the Sales Diary sheet and use its Sales Diary menu.');

  // Setup first, so the tabs exist even when Meta-Data can't be read.
  const setup = setUpSalesDiary_(diary);
  const metaData = readMetaData_();
  const message = metaData.ok
    ? buildSummary_(metaData, new Date(), setup.problems)
    : [metaData.message]
      .concat(setup.problems.length ? [''].concat(problemLines_(setup.problems)) : [])
      .join('\n');

  const ui = SpreadsheetApp.getUi();
  ui.alert('Check setup', message, ui.ButtonSet.OK);
}

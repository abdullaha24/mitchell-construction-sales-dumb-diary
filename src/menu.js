// @ts-check
// The Sales Diary menu in the Sales Diary sheet.
//
// SAFETY: a web page can call any function whose name doesn't end in `_` (google.script.run),
// and the web app runs as the owner. So menuCheckSetup refuses to run unless a signed-in person
// is running it as themselves. That is true when the owner taps the menu, and false for every
// web app visitor except the owner himself while signed in to his Google account. (If he ever
// triggered it from a page, setup would only add what's missing, and showing the pop-up would
// fail.) See spec 001 → "Safety rules for all code".

/**
 * Adds the Sales Diary menu when the sheet opens. No signed-in check here: it only adds the
 * menu, and it runs in a limited mode where Google may not give the user's email.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sales Diary')
    .addItem('Check setup', 'menuCheckSetup')
    .addItem('Links', 'menuLinks')
    .addItem('Refresh salesmen', 'menuRefreshSalesmen')
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
  // Check setup also refreshes the salesmen list the app keeps (spec 005).
  if (metaData.ok) keepSalesmen_(metaData.salesmen, new Date());
  const problems = setup.problems.slice();
  /** @type {string[]} */
  let siteLines = [];
  if (metaData.ok) {
    try {
      siteLines = noNumberLines_(readTab_(diary, DIARY_TABS.sites), metaData.salesmen);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  const message = metaData.ok
    ? buildSummary_(metaData, new Date(), problems, siteLines)
    : [metaData.message]
      .concat(setup.problems.length ? [''].concat(problemLines_(setup.problems)) : [])
      .join('\n');

  const ui = SpreadsheetApp.getUi();
  ui.alert('Check setup', message, ui.ButtonSet.OK);
}

/**
 * Sales Diary → Refresh salesmen (spec 005): reads `Rep_Mapping` now, so a salesman added,
 * moved or removed there takes effect at once instead of within a day.
 */
function menuRefreshSalesmen() {
  if (!isSignedInSelf_()) {
    throw new Error('Refresh salesmen can only be run by the owner, from the Sales Diary menu.');
  }
  const read = refreshSalesmen_(new Date());
  const ui = SpreadsheetApp.getUi();
  const message = read.ok
    ? [`Salesmen: ${read.salesmen.length}`]
      .concat(REGIONS.map((region) => {
        const reps = read.salesmen.filter((s) => s.region === region).map((s) => s.rep);
        return `  ${region}: ${reps.length ? reps.join(', ') : 'none'}`;
      }), [''], problemLines_(read.problems)).join('\n')
    : read.message;
  ui.alert('Refresh salesmen', message, ui.ButtonSet.OK);
}

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
 * Reads the salesmen (`Rep_Mapping`) and their targets (`Rep-Targets`), skipping the region
 * targets: what the app keeps for salesman calls (specs 005, 006). A problem with `Rep-Targets`
 * never stops the salesmen list: it is listed, and nobody has a target until it's fixed.
 * @returns {SalesmenRead & { repTargets: TargetAmounts } | Failure}
 */
function readSalesmenAndTargets_() {
  const metaData = openMetaData_();
  if (!metaData) return { ok: false, message: META_DATA_UNREADABLE };
  const tab = readMetaTab_(metaData, META_TABS.salesmen);
  if (!tab.ok) return tab;
  const salesmen = readSalesmen_(tab.values, META_TABS.salesmen);
  if (!salesmen.ok) return salesmen;
  const targetsTab = readMetaTab_(metaData, META_TABS.repTargets);
  const targets = targetsTab.ok
    ? readTargets_(targetsTab.values, {
      tabName: META_TABS.repTargets,
      keyColumn: 'Rep',
      keys: salesmen.salesmen.map((s) => s.rep),
      unknownKeys: 'ignore',
      timeZone: metaData.getSpreadsheetTimeZone(),
    })
    : targetsTab;
  if (!targets.ok) {
    return { ...salesmen, repTargets: {}, problems: salesmen.problems.concat([targets.message]) };
  }
  return { ...salesmen, repTargets: targets.amounts, problems: salesmen.problems.concat(targets.problems) };
}

/** Where the salesmen list is kept between calls (Script Properties), and for how long. */
const SALESMEN_KEY = 'salesmen';
const SALESMEN_KEEP_MS = 24 * 60 * 60 * 1000;

/**
 * The targets worth keeping (spec 006): each current salesman's for this month and next month
 * (Pakistan time), so the 1st of a month rolls over without a refresh. Nothing else.
 * @param {Salesman[]} salesmen
 * @param {TargetAmounts} repTargets
 * @param {Date} now
 * @returns {TargetAmounts}
 */
function targetsToKeep_(salesmen, repTargets, now) {
  const months = [currentMonthKey_(now), nextMonthKey_(currentMonthKey_(now))];
  /** @type {TargetAmounts} */
  const keep = {};
  for (const s of salesmen) {
    for (const month of months) {
      const amount = targetFor_(repTargets, s.rep, month);
      if (amount !== null) keep[`${s.rep}|${month}`] = amount;
    }
  }
  return keep;
}

/**
 * Keeps the salesmen list (codes and regions only) and their targets (targetsToKeep_) for
 * SALESMEN_KEEP_MS. A salesman moved to another region keeps his old region on new sites until
 * the list is refreshed.
 * @param {Salesman[]} salesmen
 * @param {TargetAmounts} repTargets
 * @param {Date} now
 */
function keepSalesmen_(salesmen, repTargets, now) {
  PropertiesService.getScriptProperties().setProperty(SALESMEN_KEY, JSON.stringify({
    at: now.getTime(),
    salesmen: salesmen.map((s) => ({ rep: s.rep, region: s.region })),
    targets: targetsToKeep_(salesmen, repTargets, now),
  }));
}

/**
 * Reads `Rep_Mapping` and `Rep-Targets` now and keeps them (Refresh salesmen & targets, Check
 * setup, the Links window, or when the kept copy is older than a day).
 * @param {Date} now
 * @returns {SalesmenRead & { repTargets: TargetAmounts } | Failure}
 */
function refreshSalesmen_(now) {
  const read = readSalesmenAndTargets_();
  if (read.ok) keepSalesmen_(read.salesmen, read.repTargets, now);
  return read;
}

/**
 * The salesmen list and kept targets for salesman calls (specs 005, 006, owner P4b-3): the kept
 * copy if it is less than a day old, so a save doesn't open the Meta-Data sheet; otherwise read
 * and kept again. A copy kept before targets were (no `targets`) is read again too.
 * @param {Date} now
 * @returns {SalesmenRead & { repTargets: TargetAmounts } | Failure}
 */
function knownSalesmen_(now) {
  const stored = PropertiesService.getScriptProperties().getProperty(SALESMEN_KEY);
  if (stored) {
    try {
      const kept = JSON.parse(stored);
      const age = now.getTime() - kept.at;
      if (Array.isArray(kept.salesmen) && kept.targets && typeof kept.targets === 'object' &&
          age >= 0 && age < SALESMEN_KEEP_MS) {
        return { ok: true, salesmen: kept.salesmen, repTargets: kept.targets, problems: [] };
      }
    } catch (e) {
      // Unreadable copy: read again below.
    }
  }
  return refreshSalesmen_(now);
}

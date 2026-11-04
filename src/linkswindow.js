// @ts-check
// The owner's Links window (spec 002): Sales Diary → Links, on a computer.
//
// SAFETY: ownerListLinks, ownerNewLink and ownerCancelLink are public (the window calls them
// with google.script.run), so ANY page of this script could try to call them. Each one first
// checks that the signed-in owner is running it (isSignedInSelf_); a salesman isn't signed in
// as the owner, so Google gives the script no email for him and the check fails.
// Values returned to the window must be plain (no Dates: Google drops them).

/**
 * One row of the Links window.
 * @typedef {{
 *   who: string,
 *   label: string,
 *   region: string,
 *   link: string,
 *   made: string,
 *   message: string,
 * }} LinkListRow
 */
/** @typedef {{ ok: true, rows: LinkListRow[] } | Failure} LinkList */

/** Throws unless the signed-in owner is running this. */
function requireOwner_() {
  if (!isSignedInSelf_()) {
    throw new Error('Only the owner can manage links, from the Sales Diary menu.');
  }
}

/**
 * Sales Diary → Links: opens the Links window.
 */
function menuLinks() {
  requireOwner_();
  const page = HtmlService.createHtmlOutputFromFile('Links').setWidth(760).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(page, 'Links');
}

/**
 * Everyone who can have a link, with their current link if any.
 * @returns {LinkList}
 */
function ownerListLinks() {
  requireOwner_();
  return listLinks_();
}

/**
 * Makes a new link for `who`, cancelling his old one, and returns the updated list.
 * @param {any} who 'owner' or a salesman code in Rep_Mapping
 * @returns {LinkList}
 */
function ownerNewLink(who) {
  requireOwner_();
  newLink_(openSalesDiary_(), checkPerson_(who), new Date());
  return listLinks_();
}

/**
 * Cancels `who`'s link and returns the updated list.
 * @param {any} who 'owner' or a salesman code in Rep_Mapping
 * @returns {LinkList}
 */
function ownerCancelLink(who) {
  requireOwner_();
  cancelLinks_(openSalesDiary_(), checkPerson_(who));
  return listLinks_();
}

/**
 * 'owner', or a salesman code that is in Rep_Mapping right now. Anything else throws.
 * @param {any} who
 * @returns {string}
 */
function checkPerson_(who) {
  if (who === OWNER_ROLE) return OWNER_ROLE;
  if (typeof who !== 'string' || isBlank_(who)) throw new Error("That isn't one of your salesmen.");
  const salesmen = readSalesmenOnly_();
  if (!salesmen.ok) throw new Error(salesmen.message);
  const rep = tidyCode_(who);
  if (!salesmen.salesmen.some((s) => s.rep === rep)) {
    throw new Error("That isn't one of your salesmen.");
  }
  return rep;
}

/**
 * The Links window's list: the owner first, then salesmen North, Center, South, in
 * Rep_Mapping order. Each shows his working link (the newest, if somehow there are several).
 * @returns {LinkList}
 */
function listLinks_() {
  const salesmen = readSalesmenOnly_();
  if (!salesmen.ok) return salesmen;
  /** @type {LinksRead} */
  let links;
  try {
    links = openLinks_(openSalesDiary_()).links;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  /** @type {Object<string, LinkRow>} */
  const working = {};
  for (const row of links.rows) {
    if (row.active && row.token && personOf_(row)) working[personOf_(row)] = row; // newest wins
  }

  const people = [{ who: OWNER_ROLE, label: 'You (owner)', region: '' }].concat(
    REGIONS.flatMap((region) => salesmen.salesmen
      .filter((s) => s.region === region)
      .map((s) => ({ who: s.rep, label: s.rep, region }))));

  return {
    ok: true,
    rows: people.map((person) => {
      const row = working[person.who];
      const link = row ? linkFor_(row.token) : '';
      return {
        who: person.who,
        label: person.label,
        region: person.region,
        link,
        made: row && isDate_(row.issuedAt) && !isNaN(row.issuedAt.getTime())
          ? Utilities.formatDate(row.issuedAt, APP_TIME_ZONE, 'd MMM yyyy') : '',
        message: !link ? ''
          : person.who === OWNER_ROLE
            ? `My Sales Diary owner link. Keep it private: anyone with it can see everything. ${link}`
            : `${person.who}, this is your Sales Diary link. Keep it private: anyone with it can ` +
              `use the diary as you. ${link}`,
      };
    }),
  };
}

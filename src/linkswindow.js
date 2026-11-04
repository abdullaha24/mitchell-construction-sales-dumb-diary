// @ts-check
// The owner's Links window (spec 002): Sales Diary → Links, on a computer.
//
// SAFETY: ownerListLinks, ownerNewLink and ownerCancelLink are public (the window calls them
// with google.script.run), so ANY page of this script could try to call them. Each one first
// checks that the signed-in owner is running it (isSignedInSelf_); a salesman isn't signed in
// as the owner, so Google gives the script no email for him and the check fails.
// Values returned to the window must be plain (no Dates: Google drops them).

/**
 * One row of the Links window. `former`: no longer in Rep_Mapping but still has a working
 * `Links` row; the window offers only Cancel link, so a reused code can't bring it back.
 * @typedef {{
 *   who: string,
 *   label: string,
 *   region: string,
 *   former: boolean,
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
  newLink_(openSalesDiary_(), checkPerson_(who, false), new Date());
  return listLinks_();
}

/**
 * Cancels `who`'s link and returns the updated list.
 * @param {any} who 'owner', a salesman code in Rep_Mapping, or someone no longer there who
 *   still has a working link
 * @returns {LinkList}
 */
function ownerCancelLink(who) {
  requireOwner_();
  cancelLinks_(openSalesDiary_(), checkPerson_(who, true));
  return listLinks_();
}

/**
 * 'owner', or a salesman code that is in Rep_Mapping right now. With `formerToo`, also someone
 * no longer in Rep_Mapping who still has a working link (so it can be cancelled). Anything
 * else throws.
 * @param {any} who
 * @param {boolean} formerToo
 * @returns {string}
 */
function checkPerson_(who, formerToo) {
  if (who === OWNER_ROLE) return OWNER_ROLE;
  if (typeof who !== 'string' || isBlank_(who)) throw new Error("That isn't one of your salesmen.");
  const salesmen = readSalesmenOnly_();
  if (!salesmen.ok) throw new Error(salesmen.message);
  const rep = tidyCode_(who);
  if (salesmen.salesmen.some((s) => s.rep === rep)) return rep;
  if (formerToo && peopleWithWorkingLinks_(openLinks_(openSalesDiary_()).links).includes(rep)) {
    return rep;
  }
  throw new Error("That isn't one of your salesmen.");
}

/**
 * The Links window's list: the owner first, then salesmen North, Center, South, in
 * Rep_Mapping order, each with his working link (the newest, if somehow there are several).
 * Last, anyone no longer in Rep_Mapping who still has a working link row, so the owner can
 * cancel it (otherwise reusing that code for a new salesman would bring the old link back).
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

  const current = salesmen.salesmen.map((s) => s.rep);
  const people = [{ who: OWNER_ROLE, label: 'You (owner)', region: '', former: false }].concat(
    REGIONS.flatMap((region) => salesmen.salesmen
      .filter((s) => s.region === region)
      .map((s) => ({ who: s.rep, label: s.rep, region, former: false }))),
    peopleWithWorkingLinks_(links)
      .filter((who) => who !== OWNER_ROLE && !current.includes(who))
      .map((who) => ({ who, label: who, region: '', former: true })));

  return {
    ok: true,
    rows: people.map((person) => {
      const row = working[person.who];
      // A former salesman's link doesn't work now: it is not shown, only offered for cancelling.
      const link = row && !person.former ? linkFor_(row.token) : '';
      return {
        who: person.who,
        label: person.label,
        region: person.region,
        former: person.former,
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

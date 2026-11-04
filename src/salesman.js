// @ts-check
// The functions a salesman's page calls (spec 003). Public, so ANYONE can call them with any
// arguments: each one first checks the link code and accepts only a working salesman link.
// Who he is (code, region) always comes from the server, never from the page. Replies hold
// only his own sites; about other salesmen, only yes/no (ADR-0004). No Dates in replies.

const NO_LINK_MESSAGE = "This link doesn't work. Ask the owner for a new one.";

/**
 * The salesman behind a link code, or an error with the "doesn't work" message.
 * @param {any} k
 * @returns {{ rep: string, region: string }}
 */
function requireRep_(k) {
  const visitor = whoIsVisiting_(k);
  if (visitor.kind !== 'rep') throw new Error(NO_LINK_MESSAGE);
  return { rep: visitor.rep, region: visitor.region };
}

/**
 * Everything his page needs: his sites and the pick-lists.
 * @param {{ rep: string, region: string }} salesman
 */
function loadFor_(salesman) {
  const diary = openSalesDiary_();
  const lists = readTab_(diary, DIARY_TABS.lists);
  return {
    ok: true,
    rep: salesman.rep,
    region: salesman.region,
    today: dayKey_(new Date()),
    sites: sitesOf_(readTab_(diary, DIARY_TABS.sites), salesman.rep),
    ...choicesFor_(lists, salesman.region),
  };
}

/**
 * His page's data.
 * @param {any} k his link code
 */
function repLoad(k) {
  return loadFor_(requireRep_(k));
}

/**
 * Checks a number as he types it: is it a real number, does someone else in the team have it
 * (yes/no only), and which of his own sites have it.
 * @param {any} k his link code
 * @param {any} phone
 */
function repCheckPhone(k, phone) {
  const salesman = requireRep_(k);
  const tidy = tidyPhone_(phone);
  if (!tidy.ok) return { ok: true, valid: false, team: false, mine: [] };
  if (!tidy.phone) return { ok: true, valid: true, team: false, mine: [] };
  const owners = phoneOwners_(readTab_(openSalesDiary_(), DIARY_TABS.sites), tidy.phone, salesman.rep);
  return { ok: true, valid: true, team: owners.team, mine: owners.mine };
}

/**
 * Saves a new site for him and returns his updated page data, or { ok: false, message } if
 * something he typed needs fixing.
 * @param {any} k his link code
 * @param {any} input { name, buyerType, contactName, phone, products, area, followUp }
 */
function repAddSite(k, input) {
  const salesman = requireRep_(k);
  const diary = openSalesDiary_();
  const now = new Date();
  const choices = choicesFor_(readTab_(diary, DIARY_TABS.lists), salesman.region);
  const checked = checkNewSite_(input, choices, dayKey_(now));
  if (!checked.ok) return checked;
  const siteId = saveNewSite_(diary, salesman, checked.site, now);
  return { ...loadFor_(salesman), savedId: siteId };
}

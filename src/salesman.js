// @ts-check
// The functions a salesman's page calls (spec 003). Public, so ANYONE can call them with any
// arguments: each one first checks the link code and accepts only a working salesman link.
// Who he is (code, region) always comes from the server, never from the page. Replies hold
// only his own sites; about other salesmen, only yes/no (ADR-0004). No Dates in replies.

const NO_LINK_MESSAGE = "This link doesn't work. Ask the owner for a new one.";
const TRY_AGAIN_MESSAGE = 'Something went wrong. Try again in a minute.';

/**
 * Runs a salesman function so that only our own plain messages reach his page; Google's own
 * error text (which can name sheets or IDs) becomes "Something went wrong".
 * @template T
 * @param {() => T} work
 * @returns {T}
 */
function forSalesman_(work) {
  try {
    return work();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    throw new Error([NO_LINK_MESSAGE, BUSY_MESSAGE, NOT_YOURS_MESSAGE].includes(message) ? message : TRY_AGAIN_MESSAGE);
  }
}

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
  return forSalesman_(() => loadFor_(requireRep_(k)));
}

/**
 * Checks a number as he types it: is it a real number, does someone else in the team have it
 * (yes/no only), and which of his own sites have it.
 * @param {any} k his link code
 * @param {any} phone
 */
function repCheckPhone(k, phone) {
  return forSalesman_(() => {
    const salesman = requireRep_(k);
    const tidy = tidyPhone_(phone);
    if (!tidy.ok) return { ok: true, valid: false, team: false, mine: [] };
    if (!tidy.phone) return { ok: true, valid: true, team: false, mine: [] };
    const owners = phoneOwners_(readTab_(openSalesDiary_(), DIARY_TABS.sites), tidy.phone, salesman.rep);
    return { ok: true, valid: true, team: owners.team, mine: owners.mine };
  });
}

/**
 * Saves a new site for him and returns his updated page data, or { ok: false, message } if
 * something he typed needs fixing. `warning` repeats the duplicate check for the number, so he
 * sees it even if he tapped Save before the check while typing came back.
 * @param {any} k his link code
 * @param {any} input { name, buyerType, contactName, phone, products, area, followUp, saveId }
 */
function repAddSite(k, input) {
  return forSalesman_(() => {
    const salesman = requireRep_(k);
    const diary = openSalesDiary_();
    const now = new Date();
    const choices = choicesFor_(readTab_(diary, DIARY_TABS.lists), salesman.region);
    const checked = checkNewSite_(input, choices, dayKey_(now));
    if (!checked.ok) return checked;
    const saveId = saveIdOf_(input);
    const warning = checked.site.phone
      ? phoneOwners_(readTab_(diary, DIARY_TABS.sites), checked.site.phone, salesman.rep)
      : { team: false, mine: [] };
    saveNewSite_(diary, salesman, checked.site, now, saveId);
    return { ...loadFor_(salesman), warning };
  });
}

/**
 * A one-time save ID from the page, or '' if it isn't one.
 * @param {any} input
 */
function saveIdOf_(input) {
  return input && typeof input.saveId === 'string' && /^[A-Za-z0-9]{8,40}$/.test(input.saveId) ? input.saveId : '';
}

/**
 * His site as it is now, or the "isn't in your list" error. Only his own sites are found.
 * @param {Tab} sites
 * @param {any} siteId
 * @param {string} rep
 */
function hisSite_(sites, siteId, rep) {
  const row = findHisRow_(sites, siteId, rep);
  if (!row) throw new Error(NOT_YOURS_MESSAGE);
  return currentSiteOf_(row);
}

/**
 * Saves an Update to one of his sites (spec 004) and returns his refreshed page data, or
 * { ok: false, message } if something needs fixing. If he added a number on the way, `warning`
 * repeats the duplicate check for it.
 * @param {any} k his link code
 * @param {any} siteId
 * @param {any} input { stage, value, terms, lostReason, followUp, note, phone, saveId }
 */
function repUpdateSite(k, siteId, input) {
  return forSalesman_(() => {
    const salesman = requireRep_(k);
    const diary = openSalesDiary_();
    const now = new Date();
    const sites = readTab_(diary, DIARY_TABS.sites);
    const current = hisSite_(sites, siteId, salesman.rep);
    const choices = choicesFor_(readTab_(diary, DIARY_TABS.lists), salesman.region);
    const checked = checkUpdate_(input, current, choices, dayKey_(now));
    if (!checked.ok) return checked;
    const warning = checked.update.phone
      ? phoneOwners_(sites, checked.update.phone, salesman.rep)
      : { team: false, mine: [] };
    saveUpdate_(diary, salesman, siteId, checked.update, now, saveIdOf_(input));
    return { ...loadFor_(salesman), warning };
  });
}

/**
 * Saves Edit details for one of his sites (spec 004) and returns his refreshed page data, or
 * { ok: false, message }. If the number changed, `warning` repeats the duplicate check for it
 * (his other sites only; this site itself isn't counted).
 * @param {any} k his link code
 * @param {any} siteId
 * @param {any} input { name, buyerType, contactName, phone, products, area, saveId }
 */
function repEditSite(k, siteId, input) {
  return forSalesman_(() => {
    const salesman = requireRep_(k);
    const diary = openSalesDiary_();
    const sites = readTab_(diary, DIARY_TABS.sites);
    const current = hisSite_(sites, siteId, salesman.rep);
    const choices = choicesFor_(readTab_(diary, DIARY_TABS.lists), salesman.region);
    const checked = checkDetails_(input, current, choices);
    if (!checked.ok) return checked;
    let warning = { team: false, mine: /** @type {string[]} */ ([]) };
    if (checked.fields.phone && checked.fields.phone !== current.phone) {
      const others = { ...sites, rows: sites.rows.filter((r) => text_(r.site_id) !== siteId) };
      warning = phoneOwners_(others, checked.fields.phone, salesman.rep);
    }
    saveDetails_(diary, salesman, siteId, checked.fields, checked.changes, new Date(), saveIdOf_(input));
    return { ...loadFor_(salesman), warning };
  });
}

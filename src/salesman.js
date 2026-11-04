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
    // The stage rules, so the page asks for the same things the server checks (spec 004).
    rules: {
      stages: STAGES, valueStages: VALUE_STAGES, numberStages: NUMBER_STAGES,
      closedStages: CLOSED_STAGES, lostStage: LOST_STAGE, paymentTerms: PAYMENT_TERMS,
    },
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
    const outcome = saveNewSite_(diary, salesman, checked.site, now, saveId, fingerprintOf_('', input));
    // The same form sent again with changes after its first save landed: never make the site
    // twice; tell him it's already saved.
    const notice = outcome.repeat && outcome.changed
      ? 'This site was already saved. Open it from your list to change anything.' : '';
    return { ...loadFor_(salesman), warning, notice };
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
 * Saves an Update to one of his sites (spec 004) and returns his refreshed page data, or
 * { ok: false, message } if something needs fixing. The check runs inside the lock (see
 * saveUpdate_). If he added a number on the way, `warning` repeats the duplicate check.
 * @param {any} k his link code
 * @param {any} siteId
 * @param {any} input { stage, value, terms, lostReason, followUp, note, phone, saveId }
 */
function repUpdateSite(k, siteId, input) {
  return forSalesman_(() => {
    const salesman = requireRep_(k);
    const diary = openSalesDiary_();
    const choices = choicesFor_(readTab_(diary, DIARY_TABS.lists), salesman.region);
    const outcome = saveUpdate_(diary, salesman, siteId, input, choices, new Date(), saveIdOf_(input));
    if (!outcome.result.ok) return outcome.result;
    return { ...loadFor_(salesman), warning: outcome.result.warning };
  });
}

/**
 * Saves Edit details for one of his sites (spec 004) and returns his refreshed page data, or
 * { ok: false, message }. The check runs inside the lock (see saveDetails_). If the number
 * changed, `warning` repeats the duplicate check (his other sites only).
 * @param {any} k his link code
 * @param {any} siteId
 * @param {any} input { name, buyerType, contactName, phone, products, area, saveId }
 */
function repEditSite(k, siteId, input) {
  return forSalesman_(() => {
    const salesman = requireRep_(k);
    const diary = openSalesDiary_();
    const choices = choicesFor_(readTab_(diary, DIARY_TABS.lists), salesman.region);
    const outcome = saveDetails_(diary, salesman, siteId, input, choices, new Date(), saveIdOf_(input));
    if (!outcome.result.ok) return outcome.result;
    return { ...loadFor_(salesman), warning: outcome.result.warning };
  });
}

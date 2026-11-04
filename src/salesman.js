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
 * The salesman behind a link code, and the Sales Diary opened once for the whole call
 * (spec 005), or an error with the "doesn't work" message.
 * @param {any} k
 * @returns {{ salesman: { rep: string, region: string }, diary: GoogleAppsScript.Spreadsheet.Spreadsheet }}
 */
function requireRep_(k) {
  if (!isWellFormedCode_(k)) throw new Error(NO_LINK_MESSAGE); // no sheet opened for junk
  const diary = openSalesDiary_();
  const visitor = whoIsVisiting_(k, diary);
  if (visitor.kind !== 'rep') throw new Error(NO_LINK_MESSAGE);
  return { salesman: { rep: visitor.rep, region: visitor.region }, diary };
}

/**
 * Everything his page needs: his sites and the pick-lists.
 * @param {{ rep: string, region: string }} salesman
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 */
function loadFor_(salesman, diary) {
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
  return forSalesman_(() => {
    const { salesman, diary } = requireRep_(k);
    return loadFor_(salesman, diary);
  });
}

/**
 * Checks a number as he types it: is it a real number, does someone else in the team have it
 * (yes/no only), and which of his own sites have it.
 * @param {any} k his link code
 * @param {any} phone
 */
function repCheckPhone(k, phone) {
  return forSalesman_(() => {
    const tidy = tidyPhone_(phone);
    const { salesman, diary } = requireRep_(k);
    if (!tidy.ok) return { ok: true, valid: false, team: false, mine: [] };
    if (!tidy.phone) return { ok: true, valid: true, team: false, mine: [] };
    const owners = phoneOwners_(readTab_(diary, DIARY_TABS.sites), tidy.phone, salesman.rep);
    return { ok: true, valid: true, team: owners.team, mine: owners.mine };
  });
}

/**
 * Saves a new site for him. The reply carries only the new site's card (and his areas if one was
 * added), or { ok: false, message } if something he typed needs fixing. `warning` repeats the
 * duplicate check, in case he tapped Save before the check while typing came back.
 * @param {any} k his link code
 * @param {any} input { name, buyerType, contactName, phone, products, area, followUp, saveId }
 */
function repAddSite(k, input) {
  return forSalesman_(() => {
    const { salesman, diary } = requireRep_(k);
    const outcome = saveNewSite_(diary, salesman, input, new Date(), saveIdOf_(input));
    if (!outcome.result || !outcome.result.ok) return outcome.result;
    // The same form sent again with changes after its first save landed: never make the site
    // twice; tell him it's already saved.
    const notice = outcome.repeat && outcome.changed
      ? 'This site was already saved. Open it from your list to change anything.' : '';
    return { ...outcome.result, notice };
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
 * Saves an Update to one of his sites (spec 004). The reply carries only that site's card, or
 * { ok: false, message }. Checks run inside the lock (saveUpdate_).
 * @param {any} k his link code
 * @param {any} siteId
 * @param {any} input { stage, value, terms, lostReason, followUp, note, phone, saveId }
 */
function repUpdateSite(k, siteId, input) {
  return forSalesman_(() => {
    const { salesman, diary } = requireRep_(k);
    return saveUpdate_(diary, salesman, siteId, input, new Date(), saveIdOf_(input)).result;
  });
}

/**
 * Saves Edit details for one of his sites (spec 004). The reply carries only that site's card
 * (and his areas if one was added), or { ok: false, message }. Checks run inside the lock.
 * @param {any} k his link code
 * @param {any} siteId
 * @param {any} input { name, buyerType, contactName, phone, products, area, saveId }
 */
function repEditSite(k, siteId, input) {
  return forSalesman_(() => {
    const { salesman, diary } = requireRep_(k);
    return saveDetails_(diary, salesman, siteId, input, new Date(), saveIdOf_(input)).result;
  });
}

/**
 * Which of his recent saves already reached the sheet (spec 005): asked once when his page
 * reopens with saves it never heard back about, so they aren't shown as unsaved or sent twice.
 * Only his own save IDs can match (the record is keyed by his code). Sends nothing new.
 * @param {any} k his link code
 * @param {any} saveIds up to 50 one-time save IDs
 * @returns {{ ok: true, landed: string[] }}
 */
function repSaveStatus(k, saveIds) {
  return forSalesman_(() => {
    const { salesman } = requireRep_(k);
    const ids = Array.isArray(saveIds) ? saveIds.slice(0, 50) : [];
    const cache = CacheService.getScriptCache();
    const landed = ids.filter((id) => typeof id === 'string' && /^[A-Za-z0-9]{8,40}$/.test(id) &&
      cache.get(`save:${salesman.rep}:${id}`) !== null);
    return { ok: true, landed };
  });
}

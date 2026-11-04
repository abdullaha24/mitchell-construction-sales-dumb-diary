// @ts-check
// Plain rules for sites (spec 003): tidying phone numbers, areas and "Did you mean",
// follow-up dates in Pakistan time, checking a new site, and IDs. No spreadsheet access.

/** @typedef {{ ok: true, phone: string } | { ok: false }} TidyPhone */
/**
 * A new site's values, checked and tidied. Since spec 005 it starts at any stage, with the same
 * value, terms, reason and note rules as an Update; `followUp` is '' at Won / Lost.
 * @typedef {{
 *   name: string,
 *   buyerType: string,
 *   contactName: string,
 *   phone: string,
 *   products: string[],
 *   area: string,
 *   newArea: boolean,
 *   followUp: string,
 *   stage: string,
 *   value: number | null,
 *   terms: string,
 *   lostReason: string,
 *   note: string,
 * }} NewSite
 */

/**
 * A phone number in the one tidy form (spec 003): digits only, Pakistani numbers as 92…
 * Blank is fine (the number is optional). A Pakistani mobile (92 3…) must be exactly 12
 * digits; any other number 10–15 digits. Anything else is refused.
 * @param {any} raw
 * @returns {TidyPhone}
 */
function tidyPhone_(raw) {
  if (isBlank_(raw)) return { ok: true, phone: '' };
  const text = String(raw).trim();
  if (!/^[+\d\s\-().]+$/.test(text)) return { ok: false };
  let digits = text.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith('3')) digits = `92${digits}`;
  // '+92 0300…', '+92 (0)300…', '0092 0300…': the 0 after 92 is a habit, not part of the number.
  if (digits.startsWith('920')) digits = `92${digits.slice(3)}`;
  const fits = digits.startsWith('923') ? digits.length === 12 : digits.length >= 10 && digits.length <= 15;
  return fits ? { ok: true, phone: digits } : { ok: false };
}

/**
 * Typed text tidied: spaces squeezed and trimmed. Null if longer than `max`.
 * @param {any} value
 * @param {number} max
 * @returns {string | null}
 */
function tidyText_(value, max) {
  const text = isBlank_(value) ? '' : String(value).replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : null;
}

/**
 * An area compared loosely: lower case, letters and digits only ("D.H.A" → "dha").
 * @param {string} name
 */
function areaKey_(name) {
  return String(name).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * How many single-letter changes turn `a` into `b` (Levenshtein distance).
 * @param {string} a
 * @param {string} b
 */
function editDistance_(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * What a typed area matches among existing ones: `same` is an existing area equal apart from
 * capitals, dots and spaces; `close` lists up to 3 near ones (3+ characters: one starts with
 * the other, or 2 or fewer letters differ), closest first.
 * @param {string} typed
 * @param {string[]} areas existing area names
 * @returns {{ same: string | null, close: string[] }}
 */
function areaMatches_(typed, areas) {
  const key = areaKey_(typed);
  if (!key) return { same: null, close: [] };
  const same = areas.find((a) => areaKey_(a) === key) || null;
  if (same || key.length < 3) return { same, close: [] };
  const close = areas
    .map((name) => {
      const other = areaKey_(name);
      const prefix = other.length >= 3 && (other.startsWith(key) || key.startsWith(other));
      return { name, distance: prefix ? 0 : editDistance_(key, other) };
    })
    .filter((m) => m.distance <= 2)
    .sort((x, y) => x.distance - y.distance || x.name.localeCompare(y.name))
    .slice(0, 3)
    .map((m) => m.name);
  return { same: null, close };
}

/**
 * A day as yyyy-MM-dd in Pakistan time.
 * @param {Date} date
 */
function dayKey_(date) {
  return Utilities.formatDate(date, APP_TIME_ZONE, 'yyyy-MM-dd');
}

/**
 * yyyy-MM-dd plus some days, on the calendar.
 * @param {string} key
 * @param {number} days
 */
function addDays_(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * The follow-up day for a button ('tomorrow', '3days', '1week') or a picked yyyy-MM-dd, which
 * must be a real date from today to a year ahead. Null if not allowed.
 * @param {any} choice
 * @param {string} todayKey
 * @returns {string | null}
 */
function followUpKey_(choice, todayKey) {
  if (typeof choice !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(FOLLOW_UP_DAYS, choice)) {
    return addDays_(todayKey, FOLLOW_UP_DAYS[choice]);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(choice) || addDays_(choice, 0) !== choice) return null;
  return choice >= todayKey && choice <= addDays_(todayKey, LIMITS.followUpDays) ? choice : null;
}

/**
 * Midnight at the start of a yyyy-MM-dd day in Pakistan time, as stored in the sheet.
 * @param {string} key
 */
function dayStart_(key) {
  return Utilities.parseDate(key, APP_TIME_ZONE, 'yyyy-MM-dd');
}

/**
 * A site's details, checked and tidied (shared by + New Site and Edit details).
 * @typedef {{
 *   name: string, buyerType: string, contactName: string, phone: string, products: string[],
 *   area: string, newArea: boolean,
 * }} SiteFields
 */

/** @param {string} message @returns {Failure} */
function fail_(message) {
  return { ok: false, message };
}

/**
 * Checks and tidies a site's details as the page sent them. Never trusts the page.
 * @param {any} input { name, buyerType, contactName, phone, products, area }
 * @param {{ buyerTypes: string[], categories: string[], areas: string[] }} choices
 *   the active pick-list values; `areas` are his region's
 * @returns {{ ok: true, fields: SiteFields } | Failure}
 */
function checkSiteFields_(input, choices) {
  const fail = fail_;
  if (!input || typeof input !== 'object') return fail('Something went wrong. Try again.');

  const name = tidyText_(input.name, LIMITS.siteName);
  if (name === null) return fail(`Site name is too long (${LIMITS.siteName} letters at most).`);
  if (!name) return fail('Type the site name.');

  if (typeof input.buyerType !== 'string' || !choices.buyerTypes.includes(input.buyerType)) {
    return fail('Tap a buyer type.');
  }

  const contactName = tidyText_(input.contactName, LIMITS.contactName);
  if (contactName === null) return fail(`Contact name is too long (${LIMITS.contactName} letters at most).`);

  const phone = tidyPhone_(input.phone);
  if (!phone.ok) return fail('Check the number.');

  /** @type {any[]} */
  const picked = Array.isArray(input.products) ? input.products : [];
  if (!Array.isArray(input.products) && input.products !== undefined) return fail('Something went wrong. Try again.');
  if (picked.some((p) => typeof p !== 'string' || !choices.categories.includes(p))) {
    return fail('A product is not in the list. Reload and try again.');
  }
  const products = choices.categories.filter((c) => picked.includes(c));

  const typedArea = tidyText_(input.area, LIMITS.area);
  if (typedArea === null) return fail(`Area is too long (${LIMITS.area} letters at most).`);
  let area = '';
  let newArea = false;
  if (typedArea) {
    const { same } = areaMatches_(typedArea, choices.areas);
    if (same) {
      area = same;
    } else if (areaKey_(typedArea)) {
      area = typedArea;
      newArea = true;
    } else {
      return fail('Type an area name with letters or numbers.');
    }
  }

  return {
    ok: true,
    fields: { name, buyerType: input.buyerType, contactName, phone: phone.phone, products, area, newArea },
  };
}

/**
 * Checks and tidies what the salesman's page sent for a new site. Never trusts the page.
 * The stage (Visited / Lead if none was sent) and its value, terms, lost reason, follow-up and
 * note follow the same rules as an Update (spec 005); a stage that needs a number needs one now.
 * @param {any} input { name, buyerType, contactName, phone, products, area, followUp, stage,
 *   value, terms, lostReason, note }
 * @param {{ buyerTypes: string[], categories: string[], areas: string[], lostReasons?: string[] }} choices
 * @param {string} todayKey yyyy-MM-dd today in Pakistan
 * @returns {{ ok: true, site: NewSite } | Failure}
 */
function checkNewSite_(input, choices, todayKey) {
  const checked = checkSiteFields_(input, choices);
  if (!checked.ok) return checked;
  const fields = checked.fields;
  const stage = input.stage === undefined ? FIRST_STAGE : input.stage;
  if (NUMBER_STAGES.includes(stage) && !fields.phone) {
    return fail_(`Type the contact's number: a site at ${stage} needs one.`);
  }
  /** @type {CurrentSite} */
  const nothingYet = {
    stage: '', value: null, terms: '', lostReason: '', followUp: '', phone: fields.phone,
    name: fields.name, buyerType: fields.buyerType, contactName: fields.contactName,
    products: fields.products, area: fields.area,
  };
  const staged = checkUpdate_({ ...input, stage, phone: '' }, nothingYet,
    { lostReasons: choices.lostReasons || [] }, todayKey);
  if (!staged.ok) return staged;
  const u = staged.update;
  return {
    ok: true,
    site: {
      ...fields, stage: u.stage, followUp: u.followUp, value: u.value, terms: u.terms,
      lostReason: u.lostReason, note: u.note,
    },
  };
}

/**
 * The next ID after every one already used, e.g. S000123 → S000124. IDs are never reused, so
 * the caller passes IDs from every tab that mentions them.
 * @param {any[]} used
 * @param {string} prefix 'S' or 'A'
 * @param {number} digits
 */
function nextId_(used, prefix, digits) {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let highest = 0;
  for (const id of used) {
    const match = pattern.exec(String(id).trim());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}${String(highest + 1).padStart(digits, '0')}`;
}

/**
 * A site as it is now, for checking an update against (what the page shows on its card).
 * @typedef {{
 *   stage: string, value: number | null, terms: string, lostReason: string, followUp: string,
 *   phone: string, name: string, buyerType: string, contactName: string, products: string[],
 *   area: string,
 * }} CurrentSite
 */
/**
 * An update, checked: what the site becomes. `phone` is a number added through the gate ('' if
 * none); `value` and `terms` carry over when the new stage doesn't ask for them.
 * @typedef {{
 *   stage: string, value: number | null, terms: string, lostReason: string, followUp: string,
 *   note: string, phone: string,
 * }} SiteUpdate
 */

/**
 * Checks an Update (spec 004) against the site as it is now. Never trusts the page.
 * @param {any} input { stage, value, terms, lostReason, followUp, note, phone }
 * @param {CurrentSite} current
 * @param {{ lostReasons: string[] }} choices
 * @param {string} todayKey
 * @returns {{ ok: true, update: SiteUpdate } | Failure}
 */
function checkUpdate_(input, current, choices, todayKey) {
  const fail = fail_;
  if (!input || typeof input !== 'object') return fail('Something went wrong. Try again.');
  const stage = input.stage;
  if (typeof stage !== 'string' || !STAGES.includes(stage)) return fail('Tap a stage.');

  const note = tidyText_(input.note, LIMITS.note);
  if (note === null) return fail(`The note is too long (${LIMITS.note} letters at most).`);

  /** @type {SiteUpdate} */
  const update = {
    stage, value: current.value, terms: current.terms, lostReason: '', followUp: '', note, phone: '',
  };

  if (VALUE_STAGES.includes(stage)) {
    const value = isBlank_(input.value) ? null : parseRs_(input.value);
    if (value === null || value < 1) return fail('Type the total Rs. value.');
    if (value > LIMITS.valueRs) return fail(`The Rs. value must be at most ${formatRs_(LIMITS.valueRs)}.`);
    if (typeof input.terms !== 'string' || !PAYMENT_TERMS.includes(input.terms)) return fail('Tap Cash or Credit.');
    update.value = value;
    update.terms = input.terms;
  }

  if (stage === LOST_STAGE) {
    if (typeof input.lostReason !== 'string' || !choices.lostReasons.includes(input.lostReason)) {
      return fail('Tap a lost reason.');
    }
    if (looseText_(input.lostReason) === 'other' && !note) return fail('Write a short note for Other.');
    update.lostReason = input.lostReason;
  }

  if (!CLOSED_STAGES.includes(stage)) {
    const followUp = followUpKey_(input.followUp, todayKey);
    if (!followUp) return fail('Pick a follow-up date from today to a year ahead.');
    update.followUp = followUp;
  }

  if (NUMBER_STAGES.includes(stage) && !current.phone) {
    const phone = tidyPhone_(input.phone);
    if (!phone.ok) return fail('Check the number.');
    if (!phone.phone) return fail(`Add the contact's number to move this site to ${stage}.`);
    update.phone = phone.phone;
  }

  const unchanged = stage === current.stage && !note && !update.phone &&
    update.followUp === current.followUp && update.value === current.value &&
    update.terms === current.terms && update.lostReason === current.lostReason;
  if (unchanged) return fail('Nothing to save.');
  return { ok: true, update };
}

/**
 * Two people, one site (spec 008). An Update form says what it was opened on (`seen`: stage,
 * Rs. value + Cash / Credit, lost reason, follow-up). Each of those he **left as he saw it** keeps
 * whatever the site has **now** (someone else may have changed it meanwhile: his old screen must
 * not undo that). What he **changed** is saved. Only when he and someone else changed the same
 * thing differently is the save refused (`conflict`), so he can look and decide. A form without
 * `seen` (a page from before spec 008) is taken as it is.
 * @param {any} input what the page sent
 * @param {CurrentSite} current the site now (inside the lock)
 * @param {string} todayKey
 * @returns {{ conflict: boolean, input: any }} the input to check and save
 */
function mergeSeen_(input, current, todayKey) {
  const seen = input && typeof input === 'object' ? input.seen : null;
  if (!seen || typeof seen !== 'object' || Array.isArray(seen)) return { conflict: false, input };
  /** @param {any} v */
  const textOf = (v) => (typeof v === 'string' ? v.trim() : '');
  /** @param {any} v */
  const rsOf = (v) => {
    const n = isBlank_(v) ? null : parseRs_(typeof v === 'number' ? v : String(v));
    return n !== null && n > 0 ? n : null;
  };
  const followUp = followUpKey_(input.followUp, todayKey);
  // Each thing the form can change, as [his, what he saw, now].
  const parts = {
    stage: [textOf(input.stage), textOf(seen.stage), current.stage],
    money: [`${rsOf(input.value)}|${textOf(input.terms)}`, `${rsOf(seen.value)}|${textOf(seen.terms)}`,
      `${current.value}|${current.terms}`],
    lostReason: [textOf(input.lostReason), textOf(seen.lostReason), current.lostReason],
    followUp: [followUp || textOf(input.followUp), textOf(seen.followUp), current.followUp],
  };
  const merged = { ...input };
  const stage = parts.stage[0] !== parts.stage[1] ? parts.stage[0] : current.stage;
  // Only what the stage being saved uses can clash (a hidden field is never saved).
  const used = {
    stage: true, money: VALUE_STAGES.includes(stage), lostReason: stage === LOST_STAGE,
    followUp: !CLOSED_STAGES.includes(stage),
  };
  for (const [name, [his, saw, now]] of Object.entries(parts)) {
    if (!used[/** @type {'stage'} */ (name)]) continue;
    if (his !== saw) {
      if (now !== saw && now !== his) return { conflict: true, input };
      continue; // his change
    }
    // Left as he saw it: the site keeps what it has now.
    if (name === 'stage') merged.stage = current.stage;
    if (name === 'money') {
      merged.value = current.value === null ? '' : String(current.value);
      merged.terms = current.terms;
    }
    if (name === 'lostReason') merged.lostReason = current.lostReason;
    if (name === 'followUp' && followUpKey_(current.followUp, todayKey)) merged.followUp = current.followUp;
  }
  return { conflict: false, input: merged };
}

/**
 * Checks Edit details (spec 004) against the site as it is now: the same field rules as a new
 * site, plus "a number can be changed, not removed". Lists what changed, with old → new number,
 * for the history.
 * @param {any} input { name, buyerType, contactName, phone, products, area }
 * @param {CurrentSite} current
 * @param {{ buyerTypes: string[], categories: string[], areas: string[] }} choices
 * @returns {{ ok: true, fields: SiteFields, changes: string[] } | Failure}
 */
function checkDetails_(input, current, choices) {
  // What the site already has stays allowed even if the owner has since turned it off in Lists
  // (an old area or product category); it is never added to Lists again.
  const own = {
    ...choices,
    categories: choices.categories.concat(current.products.filter((p) => !choices.categories.includes(p))),
    areas: current.area && !choices.areas.includes(current.area) ? choices.areas.concat([current.area]) : choices.areas,
  };
  const checked = checkSiteFields_(input, own);
  if (!checked.ok) return checked;
  const fields = checked.fields;
  if (current.phone && !fields.phone) return fail_("A site's number can be changed, not removed.");

  /** @type {string[]} */
  const changes = [];
  if (fields.name !== current.name) changes.push('Site name');
  if (fields.buyerType !== current.buyerType) changes.push('Buyer type');
  if (fields.contactName !== current.contactName) changes.push('Contact name');
  if (fields.phone !== current.phone) {
    changes.push(current.phone ? `Phone ${current.phone} → ${fields.phone}` : `Phone added ${fields.phone}`);
  }
  if (fields.products.join(PRODUCTS_SEPARATOR) !== current.products.join(PRODUCTS_SEPARATOR)) changes.push('Products');
  if (fields.area !== current.area) changes.push('Area');
  if (changes.length === 0) return fail_('Nothing to save.');
  return { ok: true, fields, changes };
}

/**
 * A yyyy-MM-dd day the way the salesman reads it: "12 Nov".
 * @param {string} key
 */
function shortDay_(key) {
  const [, month, day] = key.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1].slice(0, 3)}`;
}

/**
 * Checks a Snooze (spec 007, owner P6-1) against the site as it is now. Never trusts the page.
 * Only the three buttons, counted from today; only an open site. `already` is true when the
 * site's follow-up is already on or after that day: a snooze never brings a follow-up earlier.
 * @param {any} input { followUp: 'tomorrow' | '3days' | '1week' }
 * @param {CurrentSite} current
 * @param {string} todayKey yyyy-MM-dd today in Pakistan
 * @returns {{ ok: true, followUp: string, already: boolean } | Failure}
 */
function checkSnooze_(input, current, todayKey) {
  if (!input || typeof input !== 'object') return fail_('Something went wrong. Try again.');
  const choice = input.followUp;
  if (typeof choice !== 'string' || !Object.prototype.hasOwnProperty.call(FOLLOW_UP_DAYS, choice)) {
    return fail_('Tap Tomorrow, 3 days or 1 week.');
  }
  if (CLOSED_STAGES.includes(current.stage)) return fail_('Won and Lost sites have no follow-up.');
  const followUp = addDays_(todayKey, FOLLOW_UP_DAYS[choice]);
  return { ok: true, followUp, already: !!current.followUp && current.followUp >= followUp };
}

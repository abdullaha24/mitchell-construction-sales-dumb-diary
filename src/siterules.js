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
  const staged = checkUpdate_({ ...input, stage, phone: '', contact: undefined }, nothingYet,
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
 * none); `value` and `terms` carry over when the new stage doesn't ask for them. `contact` is a
 * new main contact person (spec 011); `contactOnly` says nothing else changes.
 * @typedef {{
 *   stage: string, value: number | null, terms: string, lostReason: string, followUp: string,
 *   note: string, phone: string, contact: NewContact | null, contactOnly: boolean,
 * }} SiteUpdate
 */

/**
 * Checks an Update (spec 004) against the site as it is now. Never trusts the page.
 * @param {any} input { stage, value, terms, lostReason, followUp, note, phone, contact }
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

  const added = checkNewContact_(input.contact);
  if (!added.ok) return added;
  const contact = added.contact;

  /** @type {SiteUpdate} */
  const update = {
    stage, value: current.value, terms: current.terms, lostReason: '', followUp: '', note, phone: '', contact,
    contactOnly: false,
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

  // A follow-up left as it is stays (spec 008: an untouched one is never changed, even if late).
  // A missing one may stay only on a contact-only Update (spec 011), checked below.
  const followUpProblem = 'Pick a follow-up date from today to a year ahead.';
  if (!CLOSED_STAGES.includes(stage)) {
    const followUp = input.followUp === current.followUp && (current.followUp || contact) ? current.followUp
      : followUpKey_(input.followUp, todayKey);
    if (followUp === null) return fail(followUpProblem);
    update.followUp = followUp;
  }

  // A new contact person replaces the "add the number" gate: his number does that job (spec 011).
  if (NUMBER_STAGES.includes(stage) && contact && !contact.phone) {
    return fail(`Type the new contact's number: a site at ${stage} needs one.`);
  }
  if (NUMBER_STAGES.includes(stage) && !current.phone && !contact) {
    const phone = tidyPhone_(input.phone);
    if (!phone.ok) return fail('Check the number.');
    if (!phone.phone) return fail(`Add the contact's number to move this site to ${stage}.`);
    update.phone = phone.phone;
  }

  const unchanged = stage === current.stage && !note && !update.phone &&
    update.followUp === current.followUp && update.value === current.value &&
    update.terms === current.terms && update.lostReason === current.lostReason;
  if (unchanged && !contact) return fail('Nothing to save.');
  if (!CLOSED_STAGES.includes(stage) && !update.followUp && !unchanged) return fail(followUpProblem);
  update.contactOnly = unchanged;
  return { ok: true, update };
}

/**
 * Two people, one site (spec 008). An Update form says what Google had when it opened (`seen`:
 * stage, Rs. value + Cash / Credit, lost reason, follow-up) and which of those he changes
 * (`touched`: 'stage', 'money', 'lostReason', 'followUp'). Only touched things are saved: each
 * untouched one keeps whatever the site has **now**, whatever value the form still holds, so an
 * old screen never writes a stale value back. A touched thing clashes only when the site's value
 * now differs from what he saw **and** from his new value (someone else changed that same thing
 * to something else; equal to his = his own earlier save, e.g. one whose reply was lost). If
 * someone else moved the stage while he left it, a touched thing the new stage doesn't use
 * clashes too (it would be dropped without a word). A clash refuses the save (`conflict`). A form
 * without `seen` and `touched` (a page from before spec 008) is taken as it is.
 * @param {any} input what the page sent
 * @param {CurrentSite} current the site now (inside the lock)
 * @param {string} todayKey
 * @returns {{ conflict: boolean, input: any }} the input to check and save
 */
function mergeTouched_(input, current, todayKey) {
  const seen = input && typeof input === 'object' ? input.seen : null;
  if (!seen || typeof seen !== 'object' || Array.isArray(seen) || !Array.isArray(input.touched)) {
    return { conflict: false, input };
  }
  const touched = new Set(input.touched.filter((/** @type {any} */ t) => ['stage', 'money', 'lostReason', 'followUp'].includes(t)));
  /** @param {any} v */
  const textOf = (v) => (typeof v === 'string' ? v.trim() : '');
  /** @param {any} v */
  const rsOf = (v) => {
    const n = isBlank_(v) ? null : parseRs_(typeof v === 'number' ? v : String(v));
    return n !== null && n > 0 ? n : null;
  };
  // Each thing, as [his, what he saw, now]. His follow-up as a day: the server's own reading of
  // the button, done again by checkUpdate_.
  const followUp = followUpKey_(input.followUp, todayKey);
  const parts = {
    stage: [textOf(input.stage), textOf(seen.stage), current.stage],
    money: [`${rsOf(input.value)}|${textOf(input.terms)}`, `${rsOf(seen.value)}|${textOf(seen.terms)}`,
      `${current.value}|${current.terms}`],
    lostReason: [textOf(input.lostReason), textOf(seen.lostReason), current.lostReason],
    followUp: [followUp || textOf(input.followUp), textOf(seen.followUp), current.followUp],
  };
  const stage = touched.has('stage') ? parts.stage[0] : current.stage;
  const used = {
    stage: true, money: VALUE_STAGES.includes(stage), lostReason: stage === LOST_STAGE,
    followUp: !CLOSED_STAGES.includes(stage),
  };
  const movedByOther = !touched.has('stage') && current.stage !== parts.stage[1];
  const merged = { ...input };
  for (const [name, [his, saw, now]] of Object.entries(parts)) {
    if (touched.has(name)) {
      if (!used[/** @type {'stage'} */ (name)]) {
        if (movedByOther) return { conflict: true, input };
        continue;
      }
      if (now !== saw && now !== his) return { conflict: true, input };
      continue; // his change
    }
    // Not touched: never written. The site keeps what it has now.
    if (name === 'stage') merged.stage = current.stage;
    if (name === 'money') {
      merged.value = current.value === null ? '' : String(current.value);
      merged.terms = current.terms;
    }
    if (name === 'lostReason') merged.lostReason = current.lostReason;
    if (name === 'followUp') merged.followUp = current.followUp;
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
 * @returns {{ ok: true, fields: SiteFields, changes: string[], other: string[] } | Failure} `other`:
 *   the changes apart from the contact person's name and number (spec 011)
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
  const contactAt = changes.length;
  if (fields.contactName !== current.contactName) changes.push('Contact name');
  if (fields.phone !== current.phone) {
    changes.push(current.phone ? `Phone ${current.phone} → ${fields.phone}` : `Phone added ${fields.phone}`);
  }
  const contactEnd = changes.length;
  if (fields.products.join(PRODUCTS_SEPARATOR) !== current.products.join(PRODUCTS_SEPARATOR)) changes.push('Products');
  if (fields.area !== current.area) changes.push('Area');
  if (changes.length === 0) return fail_('Nothing to save.');
  const other = changes.slice(0, contactAt).concat(changes.slice(contactEnd));
  return { ok: true, fields, changes, other };
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

// ---- Earlier contacts (spec 011, ADR-0011) ----

/**
 * A new main contact person sent with an Update (spec 011), checked: `again` when it is an
 * earlier contact made main again (Make main).
 * @typedef {{ name: string, phone: string, again: boolean }} NewContact
 */
/**
 * One line of `Sites.earlier_contacts`: `<phone or -> · <name> · <yyyy-MM-dd>`. `line` is the
 * line as it is in the cell (kept unchanged when the app rewrites the cell). A line that doesn't
 * parse has `till` '' and the whole line as its name (no number, so no Call).
 * @typedef {{ name: string, phone: string, till: string, line: string }} EarlierContact
 */
/** @typedef {{ name: string, phone: string }} Person */

/**
 * The earlier contacts in a cell, newest first, as the owner may have left them.
 * @param {any} cell
 * @returns {EarlierContact[]}
 */
function earlierContacts_(cell) {
  if (isBlank_(cell)) return [];
  return String(cell).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const first = line.indexOf('·');
    const last = line.lastIndexOf('·');
    const phoneText = line.slice(0, first).trim();
    const till = line.slice(last + 1).trim();
    const tidy = phoneText === '-' ? { ok: true, phone: '' } : tidyPhone_(phoneText);
    const phone = tidy.ok ? tidy.phone : '';
    const parses = first >= 0 && first < last && tidy.ok && (phoneText === '-' || !!phone) &&
      /^\d{4}-\d{2}-\d{2}$/.test(till) && addDays_(till, 0) === till;
    return parses ? { name: line.slice(first + 1, last).trim(), phone, till, line } : { name: line, phone: '', till: '', line };
  });
}

/**
 * A name compared loosely: capitals and spaces don't matter.
 * @param {string} name
 */
function looseName_(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, '');
}

/**
 * The same person (spec 011): the same number; or both without a number and the same name.
 * @param {Person} a
 * @param {Person} b
 */
function samePerson_(a, b) {
  return a.phone || b.phone ? a.phone === b.phone : looseName_(a.name) === looseName_(b.name);
}

/**
 * The same main contact, as a page saw it: the same number and the same name.
 * @param {Person} a
 * @param {Person} b
 */
function sameMain_(a, b) {
  return a.phone === b.phone && looseName_(a.name) === looseName_(b.name);
}

/**
 * A main contact a page sent (`seen.contact`, one of `seen.via`), or null if it isn't one.
 * @param {any} c
 * @returns {Person | null}
 */
function seenMain_(c) {
  if (!c || typeof c !== 'object') return null;
  return { name: typeof c.name === 'string' ? c.name : '', phone: phoneText_(c.phone) };
}

/**
 * Has the main contact changed under his form (spec 011)? His form says what Google had when it
 * opened (`seen.contact`) and the contacts his own saves still on their way set (`seen.via`, newest
 * first: the first 20 are read); the
 * main contact now is none of them. A page from before spec 011 (no `seen.contact`): no.
 * @param {any} seen
 * @param {Person} now
 */
function contactMovedUnder_(seen, now) {
  const saw = seen && typeof seen === 'object'
    ? [seen.contact].concat(Array.isArray(seen.via) ? seen.via.slice(0, 20) : []).map(seenMain_) : [];
  return !!saw[0] && !saw.some((x) => !!x && sameMain_(x, now));
}

/**
 * The earlier contacts cell without the lines of a number that is now the main one (spec 011: the
 * main number is never also kept as an earlier one), or null when there is none.
 * @param {any} cell
 * @param {string} phone
 */
function earlierWithout_(cell, phone) {
  const list = earlierContacts_(cell);
  const kept = list.filter((e) => !phone || e.phone !== phone);
  return kept.length === list.length ? null : kept.map((e) => e.line).join('\n');
}

/**
 * A `Sites` row's main contact, as it moves to Earlier contacts: a number that isn't a real one
 * goes, as typed, into the name.
 * @param {Object<string, any>} r
 * @returns {Person}
 */
function mainPerson_(r) {
  const phone = phoneText_(r.contact_phone);
  return { name: tidyText_(`${text_(r.contact_name)} ${phone ? '' : text_(r.contact_phone)}`, Infinity) || '', phone };
}

/**
 * Checks a new contact person sent with an Update (spec 011): the same name and number rules as
 * a new site; a name or a number. None sent: null.
 * @param {any} raw { name, phone, again }
 * @returns {{ ok: true, contact: NewContact | null } | Failure}
 */
function checkNewContact_(raw) {
  if (raw === undefined || raw === null) return { ok: true, contact: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return fail_('Something went wrong. Try again.');
  const name = tidyText_(raw.name, LIMITS.contactName);
  if (name === null) return fail_(`Contact name is too long (${LIMITS.contactName} letters at most).`);
  const phone = tidyPhone_(raw.phone);
  if (!phone.ok) return fail_('Check the number.');
  if (!name && !phone.phone) return fail_("Type the new contact's name or number.");
  return { ok: true, contact: { name, phone: phone.phone, again: raw.again === true } };
}

/**
 * The earlier contacts cell after `next` becomes the main contact in place of `main`: the old one
 * on top with today's date (if it has a name or a number); the new one's number is never kept as
 * an earlier one (Make main without a number: the first entry with its name goes); at most
 * EARLIER_CONTACTS_MAX people (a line typed by hand is never dropped, and stays where it is).
 * Every other line stays exactly as it is.
 * @param {any} cell
 * @param {Person} main
 * @param {Person & { again?: boolean }} next
 * @param {string} todayKey
 */
function earlierAfter_(cell, main, next, todayKey) {
  let list = earlierContacts_(cell);
  if (next.phone) {
    list = list.filter((e) => e.phone !== next.phone);
  } else if (next.again) {
    const at = list.findIndex((e) => e.till && !e.phone && looseName_(e.name) === looseName_(next.name));
    if (at >= 0) list.splice(at, 1);
  }
  if (main.name || main.phone) list.unshift({ ...main, till: todayKey, line: `${main.phone || '-'} · ${main.name} · ${todayKey}` });
  let people = 0;
  return list.filter((e) => !e.till || ++people <= EARLIER_CONTACTS_MAX).map((e) => e.line).join('\n');
}

/**
 * The `contact` row's note (spec 011): "New contact: Bilal · 923001234567 (was Asif ·
 * 923331112222)", or "Main contact again: …" for Make main.
 * @param {Person} next
 * @param {Person} main
 * @param {boolean} again
 */
function contactNote_(next, main, again) {
  const who = (/** @type {Person} */ p) => [p.name, p.phone].filter(Boolean).join(' · ');
  return `${again ? 'Main contact again' : 'New contact'}: ${who(next)}${who(main) ? ` (was ${who(main)})` : ''}`;
}

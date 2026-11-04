// @ts-check
// Plain rules for sites (spec 003): tidying phone numbers, areas and "Did you mean",
// follow-up dates in Pakistan time, checking a new site, and IDs. No spreadsheet access.

/** @typedef {{ ok: true, phone: string } | { ok: false }} TidyPhone */
/**
 * A new site's values, checked and tidied.
 * @typedef {{
 *   name: string,
 *   buyerType: string,
 *   contactName: string,
 *   phone: string,
 *   products: string[],
 *   area: string,
 *   newArea: boolean,
 *   followUp: string,
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
 * Checks and tidies what the salesman's page sent for a new site. Never trusts the page.
 * @param {any} input { name, buyerType, contactName, phone, products, area, followUp }
 * @param {{ buyerTypes: string[], categories: string[], areas: string[] }} choices
 *   the active pick-list values; `areas` are his region's
 * @param {string} todayKey yyyy-MM-dd today in Pakistan
 * @returns {{ ok: true, site: NewSite } | Failure}
 */
function checkNewSite_(input, choices, todayKey) {
  /** @param {string} message @returns {Failure} */
  const fail = (message) => ({ ok: false, message });
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

  const followUp = followUpKey_(input.followUp, todayKey);
  if (!followUp) return fail('Pick a follow-up date from today to a year ahead.');

  return {
    ok: true,
    site: { name, buyerType: input.buyerType, contactName, phone: phone.phone, products, area, newArea, followUp },
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

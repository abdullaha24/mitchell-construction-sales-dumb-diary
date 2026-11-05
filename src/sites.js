// @ts-check
// Reading and saving sites in the Sales Diary sheet (spec 003). Everything here works on one
// salesman at a time; only phoneOwners_ looks across salesmen, and it answers yes/no for
// everyone else (ADR-0004).

/**
 * A Sales Diary tab, read by header name.
 * @typedef {{
 *   sheet: GoogleAppsScript.Spreadsheet.Sheet,
 *   columns: Object<string, number>,
 *   rows: Array<Object<string, any>>,
 * }} Tab
 */
/**
 * One site as the salesman's page shows it. Plain values only (no Dates). `worked` is the day
 * it was last really worked (added or updated, spec 007: drives going cold); `noteDay` the day
 * its note was written ('' if unknown).
 * @typedef {CurrentSite & { id: string, note: string, created: string, worked: string, noteDay: string }} SiteCard
 */

/**
 * Reads a Sales Diary tab: every non-blank row as { header: value }, plus `_row` (its row
 * number). Throws if the tab or one of its data-model headers is missing (no code or data in
 * the message).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {string} tabName
 * @returns {Tab}
 */
function readTab_(diary, tabName) {
  const sheet = diary.getSheetByName(tabName);
  if (!sheet) throw new Error(`The Sales Diary sheet has no '${tabName}' tab. Run Check setup.`);
  const values = sheet.getDataRange().getValues();
  const found = findColumns_(values, DIARY_HEADERS[tabName], tabName);
  if (!found.ok) throw new Error(found.message);
  const columns = found.columns;
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i].every(isBlank_)) continue;
    /** @type {Object<string, any>} */
    const row = { _row: i + 1 };
    for (const [name, index] of Object.entries(columns)) row[name] = values[i][index];
    rows.push(row);
  }
  return { sheet, columns, rows };
}

/**
 * Text that Google Sheets must store exactly as it is. A leading apostrophe makes the cell
 * plain text (the apostrophe is hidden and not read back), so '=…' never becomes a formula
 * (formula injection: a formula could read other tabs, e.g. everyone's link codes) and '0300'
 * never becomes the number 300. Use it for every typed or picked text written to a
 * normal-format cell.
 * @param {string} text
 */
function asText_(text) {
  return text === '' ? '' : `'${text}`;
}

/**
 * A row built from { header: value }, as wide as the tab's known columns.
 * @param {Object<string, number>} columns
 * @param {Object<string, any>} values
 */
function rowFor_(columns, values) {
  const row = new Array(Math.max(...Object.values(columns)) + 1).fill('');
  for (const [name, value] of Object.entries(values)) row[columns[name]] = value;
  return row;
}

/**
 * The active pick-list values for a salesman: buyer types and product categories, and the
 * areas of his region (plus any with no region). Sorted by `sort`, then sheet order.
 * @param {Tab} lists
 * @param {string} region
 * @returns {{ buyerTypes: string[], categories: string[], areas: string[], lostReasons: string[] }}
 */
function choicesFor_(lists, region) {
  /** @param {string} list @param {(row: Object<string, any>) => boolean} [keep] */
  const values = (list, keep = () => true) => lists.rows
    .filter((r) => looseText_(r.list) === list && isActiveCell_(r.active) && !isBlank_(r.value) && keep(r))
    .map((r, i) => ({ value: String(r.value).trim(), sort: Number(r.sort), i }))
    .sort((a, b) => (isFinite(a.sort) ? a.sort : Infinity) - (isFinite(b.sort) ? b.sort : Infinity) || a.i - b.i)
    .map((r) => r.value)
    .filter((v, i, all) => all.indexOf(v) === i);
  return {
    buyerTypes: values('buyer_type'),
    categories: values('product_category'),
    areas: values('area', (r) => isBlank_(r.region) || looseText_(r.region) === looseText_(region)),
    lostReasons: values('lost_reason'),
  };
}

/**
 * A cell as trimmed text ('' for blank).
 * @param {any} value
 */
function text_(value) {
  return isBlank_(value) ? '' : String(value).trim();
}

/**
 * A `Sites` row as it is now, the way the update rules see it.
 * @param {Object<string, any>} r
 * @returns {CurrentSite}
 */
function currentSiteOf_(r) {
  const value = parseRs_(typeof r.value_rs === 'number' ? r.value_rs : text_(r.value_rs));
  return {
    stage: text_(r.stage),
    value: value !== null && value > 0 ? value : null,
    terms: text_(r.payment_terms),
    lostReason: text_(r.lost_reason),
    followUp: dayText_(r.next_followup),
    phone: phoneText_(r.contact_phone),
    name: text_(r.site_name),
    buyerType: text_(r.buyer_type),
    contactName: text_(r.contact_name),
    products: text_(r.products) ? text_(r.products).split(PRODUCTS_SEPARATOR.trim()).map((p) => p.trim()).filter(Boolean) : [],
    area: text_(r.area),
  };
}

/**
 * His row for a site: found by its ID **and** his code, so nobody can reach another
 * salesman's site by guessing an ID. Null if it isn't his.
 * @param {Tab} sites
 * @param {any} siteId
 * @param {string} rep
 */
function findHisRow_(sites, siteId, rep) {
  if (typeof siteId !== 'string' || !/^S\d{6,}$/.test(siteId)) return null;
  return sites.rows.find((r) => text_(r.site_id) === siteId && tidyCode_(r.rep) === rep) || null;
}

/**
 * Writes only the given cells of one row (never the whole row: the owner may have added
 * columns). Columns in `textHeaders` are set to plain text first.
 * @param {Tab} tab
 * @param {number} rowNumber
 * @param {Object<string, any>} values { header: value }
 * @param {string[]} [textHeaders]
 */
function setCells_(tab, rowNumber, values, textHeaders = []) {
  for (const [header, value] of Object.entries(values)) {
    const range = tab.sheet.getRange(rowNumber, tab.columns[header] + 1);
    if (textHeaders.includes(header)) range.setNumberFormat('@');
    range.setValues([[value]]);
  }
}

/**
 * An area to save: an existing one of his region if it is the same (someone may have added it
 * a moment ago), otherwise added to `Lists` for his region.
 * @param {Tab} lists
 * @param {{ rep: string, region: string }} salesman
 * @param {string} area
 * @param {boolean} newArea
 * @returns {string} the area name to store
 */
function saveArea_(lists, salesman, area, newArea) {
  if (!newArea) return area;
  const same = areaMatches_(area, choicesFor_(lists, salesman.region).areas).same;
  if (same) return same;
  const sorts = lists.rows.filter((r) => looseText_(r.list) === 'area').map((r) => Number(r.sort)).filter(isFinite);
  appendRows_(lists.sheet, [rowFor_(lists.columns, {
    list: 'area', value: asText_(area), region: asText_(salesman.region), added_by: asText_(salesman.rep), active: true,
    sort: (sorts.length ? Math.max(...sorts) : 0) + LIST_SORT_STEP,
  })]);
  return area;
}

/**
 * A date cell as yyyy-MM-dd in Pakistan time, or '' if it isn't a date.
 * @param {any} value
 */
function dayText_(value) {
  return isDate_(value) && !isNaN(value.getTime()) ? dayKey_(value) : '';
}

/**
 * A phone cell in tidy form, or '' if it isn't a real number (blank, or junk typed by hand such
 * as "-" or "n/a"): such a site has "No number yet" and must get one before Sample / Trial,
 * Rate Quoted or Won (owner P3-4).
 * @param {any} value
 */
function phoneText_(value) {
  const tidy = tidyPhone_(value);
  return tidy.ok ? tidy.phone : '';
}

/**
 * A `Sites` row as the card his page shows (plain values only).
 * @param {Object<string, any>} r
 * @returns {SiteCard}
 */
function cardOf_(r) {
  return {
    id: text_(r.site_id), ...currentSiteOf_(r), note: text_(r.last_note), created: dayText_(r.created_at),
    // A row without worked_at (typed by hand) goes cold from the day it was added (spec 007).
    worked: dayText_(r.worked_at) || dayText_(r.created_at),
    noteDay: dayText_(r.note_at),
  };
}

/**
 * One salesman's sites as cards, newest first. Only his rows; nobody else's.
 * @param {Tab} sites
 * @param {string} rep
 * @returns {SiteCard[]}
 */
function sitesOf_(sites, rep) {
  return sites.rows
    .filter((r) => tidyCode_(r.rep) === rep)
    .map((r) => ({ card: cardOf_(r), when: isDate_(r.created_at) ? r.created_at.getTime() : 0, row: r._row }))
    .sort((a, b) => b.when - a.when || b.row - a.row)
    .map((x) => x.card);
}

/**
 * Values ready to write: every text as plain text (asText_, no formulas), except the phone,
 * whose cell is plain-text formatted already (an apostrophe there would be kept).
 * @param {Object<string, any>} values
 * @returns {Object<string, any>}
 */
function textify_(values) {
  /** @type {Object<string, any>} */
  const out = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = key !== 'contact_phone' && typeof value === 'string' ? asText_(value) : value;
  }
  return out;
}

/**
 * Who has a tidy phone number. For everyone else, only yes/no (ADR-0004); for him, the names
 * of his own sites with it.
 * @param {Tab} sites
 * @param {string} phone tidy form, not blank
 * @param {string} rep
 * @returns {{ team: boolean, mine: string[] }}
 */
function phoneOwners_(sites, phone, rep) {
  let team = false;
  /** @type {string[]} */
  const mine = [];
  for (const r of sites.rows) {
    const tidy = tidyPhone_(r.contact_phone);
    if (!tidy.ok || tidy.phone !== phone) continue;
    if (tidyCode_(r.rep) === rep) mine.push(isBlank_(r.site_name) ? String(r.site_id) : String(r.site_name));
    else team = true;
  }
  return { team, mine };
}

/**
 * The Check setup lines on sites with no phone number (spec 003, owner P3-4): each current
 * salesman with at least one site, North, Center, South, as "RIA  2 of 5".
 * @param {Tab} sites
 * @param {Salesman[]} salesmen
 * @returns {string[]}
 */
function noNumberLines_(sites, salesmen) {
  const ordered = REGIONS.flatMap((region) => salesmen.filter((s) => s.region === region));
  const counts = ordered
    .map((s) => {
      const his = sites.rows.filter((r) => tidyCode_(r.rep) === s.rep);
      return { rep: s.rep, total: his.length, none: his.filter((r) => !phoneText_(r.contact_phone)).length };
    })
    .filter((c) => c.total > 0);
  if (counts.length === 0) return ['Sites with no phone number: no sites yet.'];
  const width = Math.max(...counts.map((c) => c.rep.length)) + 2;
  return ['Sites with no phone number'].concat(
    counts.map((c) => `  ${padRight_(c.rep, width)}${c.none} of ${c.total}`));
}

/** How long a save's one-time ID is remembered (6 hours, Google's longest). */
const SAVE_ID_SECONDS = 21600;

/**
 * Checks and saves a new site (spec 003) **inside the lock**: reads `Sites`, `Activity` and
 * `Lists` once, checks what the page sent, writes the `Sites` row, the `created` row and a new
 * area if any. The result carries only the new site's card (spec 005).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {{ rep: string, region: string }} salesman
 * @param {any} input what the page sent
 * @param {Date} now
 * @param {string} [saveId]
 * @returns {SaveOutcome} result: { ok: true, site, warning, areas? } or { ok: false, message }
 */
function saveNewSite_(diary, salesman, input, now, saveId) {
  return oncePerSave_(salesman.rep, saveId, fingerprintOf_('', input), 'report', () => {
    const sites = readTab_(diary, DIARY_TABS.sites);
    const activity = readTab_(diary, DIARY_TABS.activity);
    const lists = readTab_(diary, DIARY_TABS.lists);
    const checked = checkNewSite_(input, choicesFor_(lists, salesman.region), dayKey_(now));
    if (!checked.ok) return checked;
    const site = checked.site;
    const warning = site.phone ? phoneOwners_(sites, site.phone, salesman.rep) : { team: false, mine: [] };

    const area = saveArea_(lists, salesman, site.area, site.newArea);
    const siteId = nextId_(sites.rows.map((r) => r.site_id).concat(activity.rows.map((r) => r.site_id)), 'S', 6);
    const followUp = site.followUp ? dayStart_(site.followUp) : '';
    const valueStage = VALUE_STAGES.includes(site.stage);
    const row = {
      site_id: siteId, rep: salesman.rep, region: salesman.region, site_name: site.name,
      buyer_type: site.buyerType, area, contact_name: site.contactName, contact_phone: site.phone,
      products: site.products.join(PRODUCTS_SEPARATOR), stage: site.stage,
      value_rs: valueStage && site.value !== null ? site.value : '', payment_terms: valueStage ? site.terms : '',
      lost_reason: site.lostReason, next_followup: followUp, last_note: site.note,
      created_at: now, updated_at: now, worked_at: now, note_at: site.note ? now : '',
    };
    appendRows_(sites.sheet, [rowFor_(sites.columns, textify_(row))], [sites.columns.contact_phone]);
    appendRows_(activity.sheet, [rowFor_(activity.columns, textify_({
      activity_id: nextId_(activity.rows.map((r) => r.activity_id), 'A', 7), timestamp: now,
      rep: salesman.rep, site_id: siteId, action: 'created', to_stage: site.stage,
      value_rs: row.value_rs, payment_terms: row.payment_terms, lost_reason: site.lostReason,
      note: site.note, next_followup: followUp,
    }))]);
    return { ok: true, site: cardOf_(row), warning, ...(site.newArea ? { areas: areasAfter_(lists, salesman, area) } : {}) };
  });
}

/**
 * His region's areas after one was added (so his page can show the new one).
 * @param {Tab} lists read before the area was added
 * @param {{ region: string }} salesman
 * @param {string} added
 */
function areasAfter_(lists, salesman, added) {
  const areas = choicesFor_(lists, salesman.region).areas;
  return areas.includes(added) ? areas : areas.concat([added]);
}





/**
 * What oncePerSave_ did: `repeat` when this one-time save ID was already saved; `changed` when
 * the repeat carried different content (then `redo` ran the work again, `report` didn't).
 * @typedef {{ repeat: boolean, changed: boolean, result: any }} SaveOutcome
 */

/**
 * Runs a save inside the script lock, once per one-time save ID: if a save with this ID already
 * went through (the reply was lost and he tapped Save again), it isn't done twice. A failure
 * ({ ok: false }) is never remembered, so he can fix it and save again.
 * @param {string} rep
 * @param {string | undefined} saveId
 * @param {string} fingerprint what was sent
 * @param {'redo' | 'report'} ifChanged a repeat with different content: run again (updates
 *   just set the latest state) or only report it (a new site must not be made twice)
 * @param {() => any} work
 * @returns {SaveOutcome}
 */
function oncePerSave_(rep, saveId, fingerprint, ifChanged, work) {
  return withScriptLock_(() => {
    const cache = CacheService.getScriptCache();
    const cacheKey = saveId ? `save:${rep}:${saveId}` : '';
    const stored = cacheKey ? cache.get(cacheKey) : null;
    if (stored) {
      /** @type {{ fingerprint?: string, result?: any }} */
      let earlier = {};
      try { earlier = JSON.parse(stored); } catch (e) { /* from an older version: a plain repeat */ }
      const changed = earlier.fingerprint !== undefined && earlier.fingerprint !== fingerprint;
      if (!changed || ifChanged === 'report') return { repeat: true, changed, result: earlier.result };
    }
    const result = work();
    // Remember the save only once the sheet has really taken it.
    if (cacheKey && !(result && result.ok === false)) SpreadsheetApp.flush();
    if (cacheKey && !(result && result.ok === false)) {
      cache.put(cacheKey, JSON.stringify({ fingerprint, result }), SAVE_ID_SECONDS);
    }
    return { repeat: false, changed: false, result };
  });
}

const NOT_YOURS_MESSAGE = "That site isn't in your list.";

/**
 * His site as it is right now, found by ID and his code (inside the lock when called from a
 * save). Throws the "isn't in your list" message if it isn't his.
 * @param {Tab} sites
 * @param {any} siteId
 * @param {string} rep
 */
function hisRow_(sites, siteId, rep) {
  const row = findHisRow_(sites, siteId, rep);
  if (!row) throw new Error(NOT_YOURS_MESSAGE);
  return row;
}

/**
 * Who is saving an Update: a salesman (his own sites only, ADR-0004) or the admin from his
 * screen (any site, spec 008, ADR-0010).
 * @typedef {{ rep: string, region: string } | { admin: true }} Saver
 */

const CHANGED_MESSAGE = 'This site was changed a moment ago. Here it is now: check it and save again.';
const NOT_IN_DIARY_MESSAGE = "That site isn't in the diary.";

/**
 * Any salesman's site, found by its ID (the admin's Update, spec 008). Throws the "isn't in the
 * diary" message if there is none.
 * @param {Tab} sites
 * @param {any} siteId
 */
function anySiteRow_(sites, siteId) {
  const row = typeof siteId === 'string' && /^S\d{6,}$/.test(siteId)
    ? sites.rows.find((r) => text_(r.site_id) === siteId) : undefined;
  if (!row) throw new Error(NOT_IN_DIARY_MESSAGE);
  return row;
}

/**
 * A site's card as a save's reply carries it: the admin's card also names its salesman.
 * @param {Saver} saver
 * @param {Object<string, any>} row
 */
function replyCard_(saver, row) {
  const card = cardOf_(row);
  return 'admin' in saver ? { ...card, rep: tidyCode_(row.rep), region: text_(row.region) } : card;
}

/**
 * Checks and saves an Update (spec 004) to a site, **inside the lock**, against the row as it is
 * at that moment (so a save that landed a moment earlier can't be undone or bypassed). Writes
 * only the cells that change, plus one `Activity` row. A salesman reaches only his own sites; the
 * admin any site (spec 008): his row says `admin` in `Activity`, his note starts "Admin: ", and
 * he never resets going cold (`worked_at`, owner P7-5). Only what he touched is written; a clash
 * with someone else's change refuses the save (mergeTouched_), with the site as it is now. An
 * `update` row carries Rs. and Cash / Credit only when they changed (spec 009, S9-13).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {Saver} saver
 * @param {any} siteId
 * @param {any} input what the page sent
 * @param {Date} now
 * @param {string} saveId
 * @returns {SaveOutcome} result: { ok: true, site, warning }, { ok: false, message } or
 *   { ok: false, changed: true, message, site }
 */
function saveUpdate_(diary, saver, siteId, input, now, saveId) {
  const admin = 'admin' in saver;
  const key = 'admin' in saver ? ADMIN_ACTOR : saver.rep;
  return oncePerSave_(key, saveId, fingerprintOf_(siteId, input), 'redo', () => {
    const sites = readTab_(diary, DIARY_TABS.sites);
    const activity = readTab_(diary, DIARY_TABS.activity);
    const row = 'admin' in saver ? anySiteRow_(sites, siteId) : hisRow_(sites, siteId, saver.rep);
    const rep = tidyCode_(row.rep);
    const before = currentSiteOf_(row);
    const merge = mergeTouched_(input, before, dayKey_(now));
    if (merge.conflict) {
      return { ok: false, changed: true, message: CHANGED_MESSAGE, site: replyCard_(saver, row) };
    }
    const region = 'admin' in saver ? text_(row.region) : saver.region;
    const choices = choicesFor_(readTab_(diary, DIARY_TABS.lists), region);
    const checked = checkUpdate_(merge.input, before, choices, dayKey_(now));
    if (!checked.ok) return checked;
    const update = checked.update;
    const warning = update.phone ? phoneOwners_(sites, update.phone, rep) : { team: false, mine: [] };
    const followUp = update.followUp ? dayStart_(update.followUp) : '';
    const valueStage = VALUE_STAGES.includes(update.stage);
    const note = admin && update.note ? ADMIN_NOTE_PREFIX + update.note : update.note;

    // Only what changes: a value or reason the owner typed by hand is never overwritten by an
    // unrelated update. A salesman's Update is work on the site: it resets going cold (spec 007,
    // P6-2); the admin's never does (P7-5).
    /** @type {Object<string, any>} */
    const cells = admin ? { updated_at: now } : { updated_at: now, worked_at: now };
    if (update.stage !== before.stage) cells.stage = update.stage;
    const moneyChanged = valueStage && (update.value !== before.value || update.terms !== before.terms);
    if (moneyChanged) {
      cells.value_rs = update.value;
      cells.payment_terms = update.terms;
    }
    if (update.lostReason !== before.lostReason) cells.lost_reason = update.lostReason;
    if (update.followUp !== before.followUp) cells.next_followup = followUp;
    if (note) {
      cells.last_note = note;
      cells.note_at = now;
    }
    if (update.phone) cells.contact_phone = update.phone;
    setCells_(sites, row._row, textify_(cells), ['contact_phone']);

    const stageChanged = update.stage !== before.stage;
    // A stage change carries the Rs. at that stage; an `update` (same stage) only a changed Rs. or
    // Cash / Credit, so a revised price can be told from a plain note (spec 009, owner S9-13).
    const money = valueStage && (stageChanged || moneyChanged);
    appendRows_(activity.sheet, [rowFor_(activity.columns, {
      activity_id: nextId_(activity.rows.map((r) => r.activity_id), 'A', 7),
      timestamp: now, rep: asText_(admin ? ADMIN_ACTOR : rep), site_id: siteId,
      action: stageChanged ? 'stage_change' : 'update',
      from_stage: stageChanged ? asText_(before.stage) : '',
      to_stage: stageChanged ? asText_(update.stage) : '',
      value_rs: money && update.value !== null ? update.value : '',
      payment_terms: money ? asText_(update.terms) : '',
      lost_reason: asText_(update.lostReason),
      note: asText_([note, update.phone ? `Phone added ${update.phone}` : ''].filter(Boolean).join(' · ')),
      next_followup: followUp,
    })]);
    return { ok: true, site: replyCard_(saver, { ...row, ...cells }), warning };
  });
}

/**
 * Checks and saves Edit details (spec 004) for one of his sites, **inside the lock**, against
 * the row as it is at that moment (so a number added a moment ago can't be removed). Writes the
 * fields, a new area if any, and one `details` row in `Activity` listing what changed.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {{ rep: string, region: string }} salesman
 * @param {any} siteId
 * @param {any} input what the page sent
 * @param {Date} now
 * @param {string} saveId
 * @returns {SaveOutcome} result: { ok: true, site, warning, areas? } or { ok: false, message }
 */
function saveDetails_(diary, salesman, siteId, input, now, saveId) {
  return oncePerSave_(salesman.rep, saveId, fingerprintOf_(siteId, input), 'redo', () => {
    const sites = readTab_(diary, DIARY_TABS.sites);
    const activity = readTab_(diary, DIARY_TABS.activity);
    const lists = readTab_(diary, DIARY_TABS.lists);
    const row = hisRow_(sites, siteId, salesman.rep);
    const before = currentSiteOf_(row);
    const checked = checkDetails_(input, before, choicesFor_(lists, salesman.region));
    if (!checked.ok) return checked;
    const fields = checked.fields;
    let warning = { team: false, mine: /** @type {string[]} */ ([]) };
    if (fields.phone && fields.phone !== before.phone) {
      warning = phoneOwners_({ ...sites, rows: sites.rows.filter((r) => r !== row) }, fields.phone, salesman.rep);
    }
    const area = saveArea_(lists, salesman, fields.area, fields.newArea);
    const cells = {
      site_name: fields.name, buyer_type: fields.buyerType, contact_name: fields.contactName,
      contact_phone: fields.phone, products: fields.products.join(PRODUCTS_SEPARATOR), area, updated_at: now,
    };
    setCells_(sites, row._row, textify_(cells), ['contact_phone']);
    appendRows_(activity.sheet, [rowFor_(activity.columns, {
      activity_id: nextId_(activity.rows.map((r) => r.activity_id), 'A', 7),
      timestamp: now, rep: asText_(salesman.rep), site_id: siteId, action: 'details',
      note: asText_(checked.changes.join('; ')),
    })]);
    return {
      ok: true, site: cardOf_({ ...row, ...cells }), warning,
      ...(fields.newArea ? { areas: areasAfter_(lists, salesman, area) } : {}),
    };
  });
}

/**
 * Saves a Snooze (spec 007) for one of his sites, **inside the lock**, against the row as it is
 * at that moment: only `next_followup` and `updated_at`, plus one `snooze` row in `Activity`.
 * Never `worked_at` (a snooze is not work on the site: going cold keeps counting, owner P6-2),
 * `note_at`, the note, stage or value. A follow-up already on or after the day is left alone.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {{ rep: string, region: string }} salesman
 * @param {any} siteId
 * @param {any} input what the page sent
 * @param {Date} now
 * @param {string} saveId
 * @returns {SaveOutcome} result: { ok: true, site, notice? } or { ok: false, message }
 */
function saveSnooze_(diary, salesman, siteId, input, now, saveId) {
  return oncePerSave_(salesman.rep, saveId, fingerprintOf_(siteId, input), 'redo', () => {
    const sites = readTab_(diary, DIARY_TABS.sites);
    const activity = readTab_(diary, DIARY_TABS.activity);
    const row = hisRow_(sites, siteId, salesman.rep);
    const before = currentSiteOf_(row);
    const checked = checkSnooze_(input, before, dayKey_(now));
    if (!checked.ok) return checked;
    if (checked.already) {
      // Nothing to write (e.g. he snoozed it on another phone): he gets the card as it is.
      return { ok: true, site: cardOf_(row), notice: `Follow-up is already ${shortDay_(before.followUp)}.` };
    }
    const followUp = dayStart_(checked.followUp);
    const cells = { next_followup: followUp, updated_at: now };
    setCells_(sites, row._row, cells);
    appendRows_(activity.sheet, [rowFor_(activity.columns, textify_({
      activity_id: nextId_(activity.rows.map((r) => r.activity_id), 'A', 7),
      timestamp: now, rep: salesman.rep, site_id: siteId, action: 'snooze', next_followup: followUp,
    }))]);
    return { ok: true, site: cardOf_({ ...row, ...cells }) };
  });
}

/**
 * What a save sent, as text: tells a plain repeat from a resend with different content. Not
 * `seen` (spec 008): it says what Google had when the form opened, not what he is saving (that is
 * the fields and `touched`, which stay part of it); a retry of a save keeps the same form, so it
 * is still recognised as the same save.
 * @param {any} siteId
 * @param {any} input
 */
function fingerprintOf_(siteId, input) {
  const { saveId, seen, ...rest } = input && typeof input === 'object' ? input : { saveId: '', seen: null };
  return JSON.stringify([siteId, rest]);
}

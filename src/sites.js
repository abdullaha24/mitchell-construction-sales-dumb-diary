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
 * One site as the salesman's page shows it. Plain values only (no Dates).
 * @typedef {CurrentSite & { id: string, note: string, created: string }} SiteCard
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
 * A phone cell in tidy form; if it can't be tidied (typed by hand), as it is.
 * @param {any} value
 */
function phoneText_(value) {
  const tidy = tidyPhone_(value);
  return tidy.ok ? tidy.phone : String(value).trim();
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
    .map((r) => ({
      card: /** @type {SiteCard} */ ({
        id: text_(r.site_id), ...currentSiteOf_(r), note: text_(r.last_note), created: dayText_(r.created_at),
      }),
      when: isDate_(r.created_at) ? r.created_at.getTime() : 0,
      row: r._row,
    }))
    .sort((a, b) => b.when - a.when || b.row - a.row)
    .map((x) => x.card);
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
 * Saves a checked new site for a salesman, inside the script lock: the `Sites` row, the
 * `created` row in `Activity`, and a new area in `Lists` if needed. Returns the new site ID.
 * `saveId` is the page's one-time ID for this form: if a save with it already went through
 * (the reply was lost on a weak signal and he tapped Save again), nothing is saved twice.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {{ rep: string, region: string }} salesman
 * @param {NewSite} site
 * @param {Date} now
 * @param {string} [saveId]
 */
function saveNewSite_(diary, salesman, site, now, saveId) {
  return oncePerSave_(salesman.rep, saveId, () => {
    const sites = readTab_(diary, DIARY_TABS.sites);
    const activity = readTab_(diary, DIARY_TABS.activity);
    const lists = readTab_(diary, DIARY_TABS.lists);

    const area = saveArea_(lists, salesman, site.area, site.newArea);

    const siteId = nextId_(sites.rows.map((r) => r.site_id).concat(activity.rows.map((r) => r.site_id)), 'S', 6);
    const activityId = nextId_(activity.rows.map((r) => r.activity_id), 'A', 7);
    const followUp = dayStart_(site.followUp);

    appendRows_(sites.sheet, [rowFor_(sites.columns, {
      site_id: siteId, rep: asText_(salesman.rep), region: asText_(salesman.region),
      site_name: asText_(site.name), buyer_type: asText_(site.buyerType), area: asText_(area),
      contact_name: asText_(site.contactName), contact_phone: site.phone,
      products: asText_(site.products.join(PRODUCTS_SEPARATOR)), stage: asText_(FIRST_STAGE),
      next_followup: followUp, created_at: now, updated_at: now,
    })], [sites.columns.contact_phone]);

    appendRows_(activity.sheet, [rowFor_(activity.columns, {
      activity_id: activityId, timestamp: now, rep: asText_(salesman.rep), site_id: siteId,
      action: 'created', to_stage: asText_(FIRST_STAGE), next_followup: followUp,
    })]);

    return siteId;
  });
}

/**
 * Runs a save inside the script lock, once per one-time save ID: if a save with this ID
 * already went through (the reply was lost and he tapped Save again), it isn't done twice.
 * @param {string} rep
 * @param {string | undefined} saveId
 * @param {() => string} work returns the site ID it saved
 * @returns {string}
 */
function oncePerSave_(rep, saveId, work) {
  return withScriptLock_(() => {
    const cache = CacheService.getScriptCache();
    const cacheKey = saveId ? `save:${rep}:${saveId}` : '';
    const already = cacheKey ? cache.get(cacheKey) : null;
    if (already) return already;
    const result = work();
    if (cacheKey) cache.put(cacheKey, result, SAVE_ID_SECONDS);
    return result;
  });
}

const NOT_YOURS_MESSAGE = "That site isn't in your list.";

/**
 * Saves an Update (spec 004) to one of his sites: only the cells that change, plus one
 * `Activity` row. The row is found again inside the lock, by site ID and his code.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {{ rep: string, region: string }} salesman
 * @param {string} siteId
 * @param {SiteUpdate} update
 * @param {Date} now
 * @param {string} [saveId]
 */
function saveUpdate_(diary, salesman, siteId, update, now, saveId) {
  return oncePerSave_(salesman.rep, saveId, () => {
    const sites = readTab_(diary, DIARY_TABS.sites);
    const activity = readTab_(diary, DIARY_TABS.activity);
    const row = findHisRow_(sites, siteId, salesman.rep);
    if (!row) throw new Error(NOT_YOURS_MESSAGE);
    const before = currentSiteOf_(row);
    const followUp = update.followUp ? dayStart_(update.followUp) : '';

    /** @type {Object<string, any>} */
    const cells = {
      stage: asText_(update.stage),
      value_rs: update.value === null ? '' : update.value,
      payment_terms: asText_(update.terms),
      lost_reason: asText_(update.lostReason),
      next_followup: followUp,
      updated_at: now,
    };
    if (update.note) cells.last_note = asText_(update.note);
    if (update.phone) cells.contact_phone = update.phone;
    setCells_(sites, row._row, cells, ['contact_phone']);

    const stageChanged = update.stage !== before.stage;
    const valueStage = VALUE_STAGES.includes(update.stage);
    appendRows_(activity.sheet, [rowFor_(activity.columns, {
      activity_id: nextId_(activity.rows.map((r) => r.activity_id), 'A', 7),
      timestamp: now, rep: asText_(salesman.rep), site_id: siteId,
      action: stageChanged ? 'stage_change' : 'update',
      from_stage: stageChanged ? asText_(before.stage) : '',
      to_stage: stageChanged ? asText_(update.stage) : '',
      value_rs: valueStage && update.value !== null ? update.value : '',
      payment_terms: valueStage ? asText_(update.terms) : '',
      lost_reason: asText_(update.lostReason),
      note: asText_([update.note, update.phone ? `Phone added ${update.phone}` : ''].filter(Boolean).join(' · ')),
      next_followup: followUp,
    })]);
    return siteId;
  });
}

/**
 * Saves Edit details (spec 004) to one of his sites: the changed fields, a new area if any,
 * and one `details` row in `Activity` listing what changed (old → new number).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {{ rep: string, region: string }} salesman
 * @param {string} siteId
 * @param {SiteFields} fields
 * @param {string[]} changes
 * @param {Date} now
 * @param {string} [saveId]
 */
function saveDetails_(diary, salesman, siteId, fields, changes, now, saveId) {
  return oncePerSave_(salesman.rep, saveId, () => {
    const sites = readTab_(diary, DIARY_TABS.sites);
    const activity = readTab_(diary, DIARY_TABS.activity);
    const lists = readTab_(diary, DIARY_TABS.lists);
    const row = findHisRow_(sites, siteId, salesman.rep);
    if (!row) throw new Error(NOT_YOURS_MESSAGE);
    const area = saveArea_(lists, salesman, fields.area, fields.newArea);
    setCells_(sites, row._row, {
      site_name: asText_(fields.name), buyer_type: asText_(fields.buyerType),
      contact_name: asText_(fields.contactName), contact_phone: fields.phone,
      products: asText_(fields.products.join(PRODUCTS_SEPARATOR)), area: asText_(area), updated_at: now,
    }, ['contact_phone']);
    appendRows_(activity.sheet, [rowFor_(activity.columns, {
      activity_id: nextId_(activity.rows.map((r) => r.activity_id), 'A', 7),
      timestamp: now, rep: asText_(salesman.rep), site_id: siteId, action: 'details',
      note: asText_(changes.join('; ')),
    })]);
    return siteId;
  });
}

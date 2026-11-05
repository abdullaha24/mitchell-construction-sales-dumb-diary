// @ts-check
// The admin's screen (spec 008, ADR-0010): the company owner, called "Admin" on every screen
// (owner P7-7), opens it with his private link (ADR-0006). The ONLY place where every salesman's
// sites and history appear, and only for a working admin link.
//
// SAFETY: adminPageLoad, adminPageUpdateSite and adminPageSaveStatus are public, so ANYONE can
// call them with any arguments. Each one first checks the link code (requireAdminLink_): only an
// active `Links` row with role `owner` and exactly that code passes. A salesman's code, a
// cancelled code or junk gets "This link doesn't work." and nothing else. (The `owner…` functions
// of the Links window are a different kind: they run from the sheet's menu and use the signed-in
// check. This page is opened by link and run as the owner for anonymous visitors, so Google gives
// it no email: only the code can tell it's him.) No Dates in replies.

/** How many `Activity` rows are read at a time, from the bottom up (spec 008: never the whole tab). */
const ACTIVITY_BLOCK = 500;

/**
 * Runs an admin function so that only our own plain messages reach his page.
 * @template T
 * @param {() => T} work
 * @returns {T}
 */
function forAdminPage_(work) {
  try {
    return work();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    throw new Error([NO_LINK_MESSAGE, BUSY_MESSAGE, NOT_IN_DIARY_MESSAGE].includes(message) ? message : TRY_AGAIN_MESSAGE);
  }
}

/**
 * The Sales Diary, opened once for the whole call, if `k` is the admin's working link; otherwise
 * an error with the "doesn't work" message (no sheet opened for junk). Also which salesmen have a
 * working link (yes/no per code; never a link code).
 * @param {any} k
 * @returns {{ diary: GoogleAppsScript.Spreadsheet.Spreadsheet, linked: string[] }}
 */
function requireAdminLink_(k) {
  if (!isWellFormedCode_(k)) throw new Error(NO_LINK_MESSAGE);
  const diary = openSalesDiary_();
  const visitor = whoIsVisiting_(k, diary);
  if (visitor.kind !== 'owner') throw new Error(NO_LINK_MESSAGE);
  return { diary, linked: visitor.linked };
}

/**
 * One `Activity` row (of this month, or of a summary's period), tidied.
 * @typedef {{
 *   when: Date, by: string, site: string, action: string, from: string, to: string,
 *   value: number | null, terms: string, lostReason: string, note: string, followUp: string,
 * }} MonthMove
 */

/**
 * This month's `Activity` rows (Pakistan time), oldest first (activitySince_).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {Date} now
 * @returns {MonthMove[]}
 */
function monthActivity_(diary, now) {
  return activitySince_(diary, dayStart_(`${currentMonthKey_(now)}-01`).getTime());
}

/**
 * The `Activity` rows from `start` on, oldest first, read **from the bottom up** in blocks of
 * ACTIVITY_BLOCK rows, stopping at the first block that reaches a row from before `start`: the
 * app only ever adds rows at the bottom, so they are in time order, and the tab (which only
 * grows) is never read whole (specs 008, 009). Which rows count is decided by each row's own
 * time, never by a block edge. `by` is a salesman's code, or ADMIN_ACTOR.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {number} start ms
 * @returns {MonthMove[]}
 */
function activitySince_(diary, start) {
  const tabName = DIARY_TABS.activity;
  const sheet = diary.getSheetByName(tabName);
  if (!sheet) throw new Error(`The Sales Diary sheet has no '${tabName}' tab. Run Check setup.`);
  const width = Math.max(sheet.getLastColumn(), 1);
  const found = findColumns_(sheet.getRange(1, 1, 1, width).getValues(), DIARY_HEADERS[tabName], tabName);
  if (!found.ok) throw new Error(found.message);
  const c = found.columns;
  /** @type {MonthMove[]} */
  const moves = [];
  for (let bottom = sheet.getLastRow(); bottom >= 2;) {
    const top = Math.max(2, bottom - ACTIVITY_BLOCK + 1);
    /** @type {MonthMove[]} */
    const block = [];
    let older = false;
    for (const line of sheet.getRange(top, 1, bottom - top + 1, width).getValues()) {
      const when = line[c.timestamp];
      if (!isDate_(when) || isNaN(when.getTime())) continue;
      if (when.getTime() < start) {
        older = true;
        continue;
      }
      const value = parseRs_(typeof line[c.value_rs] === 'number' ? line[c.value_rs] : text_(line[c.value_rs]));
      block.push({
        when,
        by: looseText_(line[c.rep]) === ADMIN_ACTOR ? ADMIN_ACTOR : tidyCode_(line[c.rep]),
        site: text_(line[c.site_id]),
        action: looseText_(line[c.action]),
        from: text_(line[c.from_stage]),
        to: text_(line[c.to_stage]),
        value: value !== null && value > 0 ? value : null,
        terms: text_(line[c.payment_terms]),
        lostReason: text_(line[c.lost_reason]),
        note: text_(line[c.note]),
        followUp: dayText_(line[c.next_followup]),
      });
    }
    moves.unshift(...block);
    if (older) break;
    bottom = top - 1;
  }
  return moves;
}

/**
 * A positive whole-Rs. target, or null for "no target".
 * @param {TargetAmounts} amounts
 * @param {string} key
 * @param {string} month
 */
function shownTarget_(amounts, key, month) {
  const amount = targetFor_(amounts || {}, key, month);
  return typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

/**
 * Everything the admin's screen needs (spec 008): every salesman's open sites, the sites won or
 * lost this month (with the day: the last move to that stage this month, owner P7-1) and those
 * in today's saves; salesmen with this month's target, a working link yes/no and snoozes this
 * month; region and house / office targets; today's saves, newest first. Read: `Sites`, `Lists`
 * once, `Activity` this month only, Meta-Data through the kept copy.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {string[]} linked salesmen with a working link
 * @param {Date} now
 */
function adminDataFor_(diary, linked, now) {
  const kept = knownSalesmen_(now);
  if (!kept.ok) throw new Error(kept.message);
  const sites = readTab_(diary, DIARY_TABS.sites);
  const lists = readTab_(diary, DIARY_TABS.lists);
  const moves = monthActivity_(diary, now);
  const month = currentMonthKey_(now);
  const today = dayKey_(now);

  /** @type {Object<string, Object<string, string>>} site → stage → last day it moved there */
  const movedTo = {};
  /** @type {Object<string, number>} */
  const siteSnoozes = {};
  /** @type {Object<string, number>} */
  const repSnoozes = {};
  /** @type {MonthMove[]} */
  const todays = [];
  for (const m of moves) {
    if ((m.action === 'created' || m.action === 'stage_change') && m.to) {
      (movedTo[m.site] = movedTo[m.site] || {})[m.to] = dayKey_(m.when);
    }
    if (m.action === 'snooze') {
      siteSnoozes[m.site] = (siteSnoozes[m.site] || 0) + 1;
      repSnoozes[m.by] = (repSnoozes[m.by] || 0) + 1;
    }
    if (dayKey_(m.when) === today) todays.push(m);
  }
  const inFeed = new Set(todays.map((m) => m.site));

  /** @type {Object<string, string>} */
  const names = {};
  const cards = sites.rows
    .map((r) => {
      const card = cardOf_(r);
      names[card.id] = card.name;
      const closedStage = CLOSED_STAGES.includes(card.stage);
      const closed = closedStage ? ((movedTo[card.id] || {})[card.stage] || '') : '';
      if (closedStage && !closed && !inFeed.has(card.id)) return null;
      return {
        card: { ...card, rep: tidyCode_(r.rep), region: text_(r.region), snoozes: siteSnoozes[card.id] || 0, closed },
        when: isDate_(r.created_at) ? r.created_at.getTime() : 0,
        row: r._row,
      };
    })
    .filter((x) => x !== null)
    .sort((a, b) => b.when - a.when || b.row - a.row)
    .map((x) => x.card);

  return {
    ok: true,
    admin: true,
    today,
    now: now.getTime(),
    month,
    salesmen: kept.salesmen.map((s) => ({
      rep: s.rep, region: s.region, target: shownTarget_(kept.repTargets, s.rep, month),
      linked: linked.includes(s.rep), snoozes: repSnoozes[s.rep] || 0,
    })),
    regionTargets: Object.fromEntries(REGIONS.concat([HOUSE_REGION])
      .map((key) => [key, shownTarget_(kept.regionTargets, key, month)])),
    houseRegion: HOUSE_REGION,
    sites: cards,
    feed: todays.reverse().map((m) => ({
      time: Utilities.formatDate(m.when, APP_TIME_ZONE, 'HH:mm'), by: m.by, site: m.site, name: names[m.site] || m.site,
      action: m.action, from: m.from, to: m.to, value: m.value, terms: m.terms, lostReason: m.lostReason,
      note: m.note, followUp: m.followUp,
    })),
    lostReasons: choicesFor_(lists, '').lostReasons,
    rules: pageRules_(),
  };
}

/**
 * The admin's screen data (spec 008), for Refresh and coming back to the page.
 * @param {any} k his link code
 */
function adminPageLoad(k) {
  return forAdminPage_(() => {
    const { diary, linked } = requireAdminLink_(k);
    return adminDataFor_(diary, linked, new Date());
  });
}

/**
 * Saves an admin Update to any site (spec 008, owner P7-3, ADR-0010): the same checks as a
 * salesman's Update; `Activity.rep` = `admin`; never `worked_at` (P7-5). The reply carries only
 * that site's card (with its salesman), or { ok: false, message }.
 * @param {any} k his link code
 * @param {any} siteId
 * @param {any} input { stage, value, terms, lostReason, followUp, note, phone, seen, saveId }
 */
function adminPageUpdateSite(k, siteId, input) {
  return forAdminPage_(() => {
    const { diary } = requireAdminLink_(k);
    return saveUpdate_(diary, { admin: true }, siteId, input, new Date(), saveIdOf_(input)).result;
  });
}

/**
 * Which of the admin's recent saves already reached the sheet (spec 005), asked when his page
 * reopens with saves it never heard back about. Only his own (`save:admin:…`) can match.
 * @param {any} k his link code
 * @param {any} saveIds up to 50 one-time save IDs
 * @returns {{ ok: true, landed: string[] }}
 */
function adminPageSaveStatus(k, saveIds) {
  return forAdminPage_(() => {
    requireAdminLink_(k);
    return { ok: true, landed: landedSaves_(ADMIN_ACTOR, saveIds) };
  });
}

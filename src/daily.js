// @ts-check
// The daily region message (spec 012, ADR-0012): one day of a region's work as a WhatsApp text the
// admin pastes into that region's group, so the salesmen see that what they log is read. The text is
// built HERE, on the server, for all three regions in one trip. It only reads: nothing is written,
// no lock.
//
// SAFETY: adminPageDaily is public, so ANYONE can call it with any arguments. It first checks the
// admin's link (requireAdminLink_): a salesman's code, a cancelled code or junk gets "This link
// doesn't work." and nothing else. What a text may hold is fixed by ADR-0012: for each current
// salesman of THAT region only, his code, how many sites he worked, and the names of the sites,
// with Rs. on wins only and the reason on losses. Never quote Rs., Cash / Credit, notes, contacts,
// areas, another region's salesmen or the admin's own changes. No Dates in replies.

/** How many days back ‹ goes (spec 012): today and the 31 days before it. */
const DAILY_DAYS_BACK = 31;
/** A site in `Activity` that is no longer in `Sites` (deleted by hand). */
const DAILY_GONE_NAME = '(not in the sheet)';

/**
 * The day the page asked for (spec 012): '' is the last working day (yesterday, or Saturday when
 * yesterday was Sunday); otherwise a real yyyy-MM-dd from DAILY_DAYS_BACK days ago to today.
 * Anything else throws the usual "Something went wrong".
 * @param {any} day
 * @param {string} today yyyy-MM-dd in Pakistan
 * @returns {string}
 */
function dailyDay_(day, today) {
  if (day === '') {
    const yesterday = addDays_(today, -1);
    return weekdayOf_(yesterday) === 0 ? addDays_(yesterday, -1) : yesterday;
  }
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || addDays_(day, 0) !== day ||
      day < addDays_(today, -DAILY_DAYS_BACK) || day > today) {
    throw new Error(TRY_AGAIN_MESSAGE);
  }
  return day;
}

/**
 * One salesman's day: `sites` every site he worked (a created, stage_change or update row by him), in
 * the order he first worked it; `made` those he added; `sample` / `quote` those he moved to Sample /
 * Trial or Rate Quoted; `followed` those with an update or stage_change row by him; `last` the stage
 * his last created / stage_change row on each site moved it to.
 * @typedef {{
 *   sites: Set<string>, made: Set<string>, sample: Set<string>, quote: Set<string>, followed: Set<string>,
 *   last: Map<string, string>,
 * }} DailyWork
 */
/**
 * The day's facts: each salesman's work (by `Activity.rep`; the admin's rows are never anyone's), and
 * per site the last Rs. and the last lost reason saved that day (by anyone, as spec 009's "as the
 * period ended"). Snoozes, Edit details and contact rows are never work. Rows outside the day (or
 * with no site) are not counted.
 * @param {MonthMove[]} moves `Activity` rows from the day's start on, oldest first
 * @param {number} start the day's first ms
 * @param {number} end the next day's first ms
 */
function dailyFacts_(moves, start, end) {
  const st = summaryStages_();
  /** @type {Map<string, DailyWork>} */
  const work = new Map();
  /** @type {Map<string, number>} */
  const value = new Map();
  /** @type {Map<string, string>} */
  const reason = new Map();
  for (const m of moves) {
    const at = m.when.getTime();
    if (at < start || at >= end || !m.site) continue;
    if (m.value !== null) value.set(m.site, m.value);
    if (m.lostReason) reason.set(m.site, m.lostReason);
    if (!m.by || m.by === ADMIN_ACTOR || !WORK_ACTIONS.includes(m.action)) continue;
    let w = work.get(m.by);
    if (!w) {
      work.set(m.by, w = { sites: new Set(), made: new Set(), sample: new Set(), quote: new Set(), followed: new Set(), last: new Map() });
    }
    w.sites.add(m.site);
    if (m.action === 'created') w.made.add(m.site);
    else w.followed.add(m.site);
    if ((m.action === 'created' || m.action === 'stage_change') && m.to) {
      w.last.set(m.site, m.to);
      if (m.to === st.sample) w.sample.add(m.site);
      if (m.to === st.quote) w.quote.add(m.site);
    }
  }
  return { work, value, reason };
}

/**
 * `1 activity` / `11 activities`.
 * @param {number} n
 */
function activities_(n) {
  return n === 1 ? '1 activity' : `${n} activities`;
}

/**
 * One region's message (spec 012, owner S12-1 to S12-8): the heading, the region's total line, then
 * one block per current salesman in `Rep_Mapping` order (`no activity` when he did nothing). His
 * groups, each left out when empty: Won (Rs., biggest first), Lost (reason), Quoted, Sample given,
 * New, Followed up (only sites not named in Won / Lost / Quoted / Sample given); within a group
 * (except Won) in the order first worked. Every name, reason and code goes through waSafe_.
 * @param {string} region
 * @param {string[]} reps the region's current salesmen, in order
 * @param {ReturnType<typeof dailyFacts_>} facts
 * @param {Map<string, { name: string, value: number | null }>} sites each site in `Sites` now
 * @param {string} day yyyy-MM-dd
 * @param {boolean} running the day is today: "(so far)"
 */
function dailyText_(region, reps, facts, sites, day, running) {
  const st = summaryStages_();
  const total = { n: 0, made: 0, sample: 0, quote: 0, won: 0, wonRs: 0, lost: 0 };
  /** @param {string} id */
  const nameOf = (id) => {
    const site = sites.get(id);
    return site ? site.name || id : DAILY_GONE_NAME;
  };
  const blocks = reps.map((rep) => {
    const w = facts.work.get(rep);
    if (!w) return `*${waSafe_(rep)}* · no activity`;
    const order = [...w.sites];
    /** @param {(id: string) => boolean} test */
    const pick = (test) => order.filter(test);
    const wonIds = pick((id) => w.last.get(id) === st.won);
    const won = biggestFirst_(wonIds.map((id) => {
      const site = sites.get(id);
      const saved = facts.value.get(id);
      return { name: nameOf(id), value: saved !== undefined ? saved : (site && site.value) || 0 };
    }));
    const lost = pick((id) => w.last.get(id) === st.lost);
    const quoted = pick((id) => w.quote.has(id));
    const sample = pick((id) => w.sample.has(id));
    const made = pick((id) => w.made.has(id));
    const named = new Set([...wonIds, ...lost, ...quoted, ...sample]);
    const followed = pick((id) => w.followed.has(id) && !named.has(id));
    total.n += order.length;
    total.made += made.length;
    total.sample += sample.length;
    total.quote += quoted.length;
    total.won += won.length;
    total.wonRs += won.reduce((sum, x) => sum + x.value, 0);
    total.lost += lost.length;
    /** @param {string[]} ids */
    const names = (ids) => ids.map((id) => waSafe_(nameOf(id))).join(', ');
    return [
      `*${waSafe_(rep)}* · ${activities_(order.length)}`,
      ...(won.length ? [`Won: ${won.map((x) => waSafe_(x.name) + (x.value ? ` ${formatRs_(x.value)}` : '')).join(', ')}`] : []),
      ...(lost.length ? [`Lost: ${lost.map((id) => {
        const why = facts.reason.get(id);
        return waSafe_(nameOf(id)) + (why ? ` (${waSafe_(why)})` : '');
      }).join(', ')}`] : []),
      ...(quoted.length ? [`Quoted: ${names(quoted)}`] : []),
      ...(sample.length ? [`Sample given: ${names(sample)}`] : []),
      ...(made.length ? [`New: ${names(made)}`] : []),
      ...(followed.length ? [`Followed up: ${names(followed)}`] : []),
    ].join('\n');
  });
  const line = !total.n ? 'No activity' : [
    activities_(total.n),
    ...(total.made ? [`New ${total.made}`] : []),
    ...(total.sample ? [`Sample given ${total.sample}`] : []),
    ...(total.quote ? [`Quoted ${total.quote}`] : []),
    ...(total.won ? [`Won ${total.won}${total.wonRs ? ` ${formatRs_(total.wonRs)}` : ''}`] : []),
    ...(total.lost ? [`Lost ${total.lost}`] : []),
  ].join(' · ');
  return [`*${region} · ${weekdayDay_(day)}${running ? ' (so far)' : ''}*\n${line}`, ...blocks].join('\n\n');
}

/**
 * The three regions' messages for one day (spec 012). The day is checked first (the link check,
 * which comes before, has opened Sales Diary and read `Links`); then the kept copy of `Rep_Mapping`,
 * `Sites` once (names) and `Activity` from the day's start, bottom up. `prev` / `next` are the days
 * ‹ and › go to ('' at the limits).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {any} dayArg '' or yyyy-MM-dd
 * @param {Date} now
 */
function dailyFor_(diary, dayArg, now) {
  const today = dayKey_(now);
  const day = dailyDay_(dayArg, today);
  const kept = knownSalesmen_(now);
  if (!kept.ok) throw new Error(kept.message);
  /** @type {Map<string, { name: string, value: number | null }>} */
  const sites = new Map();
  for (const r of readTab_(diary, DIARY_TABS.sites).rows) {
    const id = text_(r.site_id);
    if (id && !sites.has(id)) {
      const s = currentSiteOf_(r);
      sites.set(id, { name: s.name, value: s.value });
    }
  }
  const start = dayStart_(day).getTime();
  const facts = dailyFacts_(activitySince_(diary, start), start, dayStart_(addDays_(day, 1)).getTime());
  return {
    ok: true,
    day,
    prev: day > addDays_(today, -DAILY_DAYS_BACK) ? addDays_(day, -1) : '',
    next: day < today ? addDays_(day, 1) : '',
    regions: REGIONS.map((region) => ({
      region,
      text: dailyText_(region, kept.salesmen.filter((s) => s.region === region).map((s) => s.rep), facts, sites, day, day === today),
    })),
  };
}

/**
 * The Daily message (spec 012): all three regions' texts for one day, in one trip. Writes nothing.
 * @param {any} k his link code
 * @param {any} day '' (the last working day) or yyyy-MM-dd, from 31 days ago to today
 */
function adminPageDaily(k, day) {
  return forAdminPage_(() => {
    const { diary } = requireAdminLink_(k);
    return dailyFor_(diary, day, new Date());
  });
}

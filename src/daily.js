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
 * Trial or Rate Quoted.
 * @typedef {{ sites: Set<string>, made: Set<string>, sample: Set<string>, quote: Set<string> }} DailyWork
 */
/**
 * The day's facts: each salesman's work (by `Activity.rep`; the admin's rows are never anyone's), and
 * per site, as the day ended (spec 009's "as the period ended", by anyone): `last` the final created /
 * stage_change row (its stage and who saved it), the last Rs. and the last lost reason saved that
 * day. Snoozes, Edit details and contact rows are never work. Rows outside the day (or with no site)
 * are not counted.
 * @param {MonthMove[]} moves `Activity` rows from the day's start on, oldest first
 * @param {number} start the day's first ms
 * @param {number} end the next day's first ms
 */
function dailyFacts_(moves, start, end) {
  const st = summaryStages_();
  /** @type {Map<string, DailyWork>} */
  const work = new Map();
  /** @type {Map<string, { to: string, by: string }>} */
  const last = new Map();
  /** @type {Map<string, number>} */
  const value = new Map();
  /** @type {Map<string, string>} */
  const reason = new Map();
  for (const m of moves) {
    const at = m.when.getTime();
    if (at < start || at >= end || !m.site) continue;
    if (m.value !== null) value.set(m.site, m.value);
    if (m.lostReason) reason.set(m.site, m.lostReason);
    const move = (m.action === 'created' || m.action === 'stage_change') && !!m.to;
    if (move) last.set(m.site, { to: m.to, by: m.by });
    if (!m.by || m.by === ADMIN_ACTOR || !WORK_ACTIONS.includes(m.action)) continue;
    let w = work.get(m.by);
    if (!w) work.set(m.by, w = { sites: new Set(), made: new Set(), sample: new Set(), quote: new Set() });
    w.sites.add(m.site);
    if (m.action === 'created') w.made.add(m.site);
    if (move && m.to === st.sample) w.sample.add(m.site);
    if (move && m.to === st.quote) w.quote.add(m.site);
  }
  return { work, last, value, reason };
}

/**
 * A name, reason or code from the sheet for the daily text: every run of spaces or line breaks
 * (typed by hand in the sheet) becomes one space, then waSafe_.
 * @param {string} text
 */
function dailySafe_(text) {
  return waSafe_(text.replace(/\s+/g, ' ').trim());
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
 * New, Followed up (every other site he worked); within a group (except Won) in the order first
 * worked. Won / Lost: the site's final move that day (by anyone) went there and he made it; Rs. the
 * last saved that day, the reason the last saved that day (else the site's). Every name, reason and
 * code goes through dailySafe_.
 * @param {string} region
 * @param {string[]} reps the region's current salesmen, in order
 * @param {ReturnType<typeof dailyFacts_>} facts
 * @param {Map<string, { name: string, value: number | null, lostReason: string }>} sites each site in `Sites` now
 * @param {string} day yyyy-MM-dd
 * @param {boolean} running the day is today: "(so far)"
 */
function dailyText_(region, reps, facts, sites, day, running) {
  const st = summaryStages_();
  const total = { n: 0, made: 0, sample: 0, quote: 0, won: 0, wonRs: 0, lost: 0 };
  /** @param {string} id */
  const nameOf = (id) => {
    const site = sites.get(id);
    return dailySafe_(site ? site.name || id : DAILY_GONE_NAME);
  };
  const blocks = reps.map((rep) => {
    const w = facts.work.get(rep);
    if (!w) return `*${dailySafe_(rep)}* · no activity`;
    const order = [...w.sites];
    /** @param {(id: string) => boolean} test */
    const pick = (test) => order.filter(test);
    /** His Won / Lost: the site's final move that day went there, and he made it. @param {string} stage */
    const closed = (stage) => pick((id) => {
      const end = facts.last.get(id);
      return !!end && end.to === stage && end.by === rep;
    });
    const wonIds = closed(st.won);
    const won = biggestFirst_(wonIds.map((id) => {
      const site = sites.get(id);
      const saved = facts.value.get(id);
      return { name: nameOf(id), value: saved !== undefined ? saved : (site && site.value) || 0 };
    }));
    const lost = closed(st.lost);
    const quoted = pick((id) => w.quote.has(id));
    const sample = pick((id) => w.sample.has(id));
    const made = pick((id) => w.made.has(id));
    const named = new Set([...wonIds, ...lost, ...quoted, ...sample, ...made]);
    const followed = pick((id) => !named.has(id));
    total.n += order.length;
    total.made += made.length;
    total.sample += sample.length;
    total.quote += quoted.length;
    total.won += won.length;
    total.wonRs += won.reduce((sum, x) => sum + x.value, 0);
    total.lost += lost.length;
    /** @param {string[]} ids */
    const names = (ids) => ids.map(nameOf).join(', ');
    return [
      `*${dailySafe_(rep)}* · ${activities_(order.length)}`,
      ...(won.length ? [`Won: ${won.map((x) => x.name + (x.value ? ` ${formatRs_(x.value)}` : '')).join(', ')}`] : []),
      ...(lost.length ? [`Lost: ${lost.map((id) => {
        const site = sites.get(id);
        const why = facts.reason.get(id) || (site && site.lostReason) || '';
        return nameOf(id) + (dailySafe_(why) ? ` (${dailySafe_(why)})` : '');
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
  /** @type {Map<string, { name: string, value: number | null, lostReason: string }>} */
  const sites = new Map();
  for (const r of readTab_(diary, DIARY_TABS.sites).rows) {
    const id = text_(r.site_id);
    if (id && !sites.has(id)) {
      const s = currentSiteOf_(r);
      sites.set(id, { name: s.name, value: s.value, lostReason: s.lostReason });
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

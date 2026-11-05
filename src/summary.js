// @ts-check
// Weekly and monthly summaries (spec 009): a salesman's week or month in plain words, and the
// team's for the admin, to read out at the Friday meeting or send on WhatsApp. The lines and the
// WhatsApp text are built HERE, on the server, in one place, so his page and the admin's say
// exactly the same thing and the salesman's page needs very little new code. A summary only
// reads: nothing is written (owner S9-11), no lock.
//
// SAFETY: repSummary and adminPageSummary are public, so ANYONE can call them with any
// arguments. repSummary first checks a working salesman link (requireRep_) and returns only his
// own figures: built from his own sites (`Sites.rep`) and his own work rows (`Activity.rep`), never
// another salesman's, a team or a region figure (ADR-0004). adminPageSummary first checks the
// admin's link (requireAdminLink_). No Dates in replies.

/** The four summaries (owner S9-5). */
const SUMMARY_PERIODS = ['this-week', 'last-week', 'this-month', 'last-month'];
/** Named sites per list before "+ N more", hot sites in Coming up, sites in Late & going cold. */
const SUMMARY_LIST_MAX = 10;
const SUMMARY_HOT_MAX = 5;
const SUMMARY_LATE_MAX = 3;
/** "Follow-ups due in the next 7 days": today and the 6 days after (specs 006 to 008). */
const SUMMARY_DUE_DAYS = 7;
/** What counts as work on a site (owner S9-12): never a snooze or Edit details (P6-2). */
const WORK_ACTIONS = ['created', 'stage_change', 'update'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RS_NOTE = '(Rs. logged, not invoiced)';

/**
 * A summary's period, in Pakistan time. A save counts when start <= its time < end: `end` is the
 * next period's start, so a save at Saturday 00:00 is in that week, never the week before.
 * `month` is the period's `yyyy-MM` for a month summary, '' for a week (a week shows no target).
 * @typedef {{
 *   key: string, running: boolean, start: number, end: number, month: string, title: string,
 *   today: string,
 * }} SummaryPeriod
 */

/**
 * `2026-10-31` → `Sat 31 Oct`.
 * @param {string} key yyyy-MM-dd
 */
function weekdayDay_(key) {
  const [y, m, d] = key.split('-').map(Number);
  return `${WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${shortDay_(key)}`;
}

/**
 * Whole days from one yyyy-MM-dd day to another.
 * @param {string} from
 * @param {string} to
 */
function daysBetween_(from, to) {
  const at = (/** @type {string} */ key) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((at(to) - at(from)) / 86400000);
}

/**
 * `1 day` / `5 days`.
 * @param {number} n
 * @param {string} word
 */
function plural_(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The period a page asked for (owner S9-4, S9-5): a week is Saturday 00:00 to Friday 23:59;
 * This week / This month run up to now (everything saved up to the tap). Anything else throws
 * the usual "Something went wrong".
 * @param {any} period
 * @param {Date} now
 * @returns {SummaryPeriod}
 */
function summaryPeriod_(period, now) {
  if (typeof period !== 'string' || !SUMMARY_PERIODS.includes(period)) throw new Error(TRY_AGAIN_MESSAGE);
  const today = dayKey_(now);
  const running = period === 'this-week' || period === 'this-month';
  let from;
  let to;
  let month = '';
  let title;
  if (period === 'this-week' || period === 'last-week') {
    const [y, m, d] = today.split('-').map(Number);
    const saturday = addDays_(today, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1) % 7));
    from = running ? saturday : addDays_(saturday, -7);
    to = addDays_(from, 7);
    const last = running ? today : addDays_(to, -1);
    const days = from === last ? weekdayDay_(from) : `${weekdayDay_(from)} – ${weekdayDay_(last)}`;
    title = `${!running ? 'Last week' : last === addDays_(to, -1) ? 'This week' : 'This week so far'} · ${days}`;
  } else {
    month = running ? today.slice(0, 7) : previousMonthKey_(today.slice(0, 7));
    from = `${month}-01`;
    to = `${nextMonthKey_(month)}-01`;
    const name = MONTH_NAMES[Number(month.slice(5)) - 1];
    title = !running ? name
      : `${name} so far · ${from === today ? shortDay_(today) : `${Number(from.slice(8))}–${shortDay_(today)}`}`;
  }
  return { key: period, running, start: dayStart_(from).getTime(), end: dayStart_(to).getTime(), month, title, today };
}

/**
 * A site as a summary sees it now: its card, its current salesman (`Sites.rep`) and its place in
 * his list (newest first, as on his page).
 * @typedef {SiteCard & { rep: string, order: number }} SummarySite
 */
/**
 * A site's results in the period, which count for its **current** salesman (`Sites.rep`, P7-1).
 * `quote`: the Rs. of the latest move to Rate Quoted in the period, or null if none.
 * @typedef {{
 *   site: SummarySite, sample: boolean, quote: number | null,
 *   won: { value: number, terms: string } | null, lost: { value: number, reason: string } | null,
 * }} SiteResult
 */
/** @typedef {{ created: number, worked: Set<string>, days: Set<string> }} RepWork */
/** @typedef {{ sites: SummarySite[], results: SiteResult[], work: Map<string, RepWork> }} PeriodFacts */

/** The stages a summary counts, by their role (specs 004, 006). */
function summaryStages_() {
  return {
    sample: HOT_STAGES[0], quote: VALUE_STAGES[0], lost: LOST_STAGE,
    won: CLOSED_STAGES.filter((s) => s !== LOST_STAGE)[0],
  };
}

/**
 * Everything a period's summaries count, in one pass (spec 009 → Rules):
 * - **work** (new sites, sites worked, days logged) for the person who saved it (`Activity.rep`);
 *   the admin's saves never count as anyone's work (P7-2, P7-5);
 * - **results** (samples, quotes, won, lost) per site, for its current salesman (`Sites.rep`):
 *   This week / This month by spec 008's rule (stage now Won / Lost, and a move there in the
 *   period: Rs. and reason as they are now); Last week / Last month as the period ended (owner
 *   S9-14: the last move inside the period; the last Rs. and reason saved inside it). A row whose
 *   site is no longer in `Sites` counts as work only. Rows outside the period are never counted.
 * @param {Array<Object<string, any>>} rows the `Sites` rows (readTab_)
 * @param {MonthMove[]} moves `Activity` rows from the period's start on, oldest first
 * @param {SummaryPeriod} period
 * @returns {PeriodFacts}
 */
function summaryFacts_(rows, moves, period) {
  const st = summaryStages_();
  /** @type {SummarySite[]} */
  const sites = rows
    .map((r) => ({ card: cardOf_(r), rep: tidyCode_(r.rep), when: isDate_(r.created_at) ? r.created_at.getTime() : 0, row: r._row }))
    .sort((a, b) => b.when - a.when || b.row - a.row)
    .map((x, order) => ({ ...x.card, rep: x.rep, order }));
  /** @type {Map<string, SummarySite>} */
  const byId = new Map();
  for (const s of sites) if (s.id && !byId.has(s.id)) byId.set(s.id, s);

  /** @type {Map<string, RepWork>} */
  const work = new Map();
  /** @type {Map<string, { sample: boolean, quote: number | null, moved: Set<string>, last: string, value: number | null, terms: string, reason: string }>} */
  const seen = new Map();
  for (const m of moves) {
    const at = m.when.getTime();
    if (at < period.start || at >= period.end) continue;
    if (m.by && m.by !== ADMIN_ACTOR) {
      let w = work.get(m.by);
      if (!w) work.set(m.by, w = { created: 0, worked: new Set(), days: new Set() });
      w.days.add(dayKey_(m.when));
      if (m.action === 'created') w.created++;
      if (m.site && WORK_ACTIONS.includes(m.action)) w.worked.add(m.site);
    }
    if (!byId.has(m.site)) continue;
    let f = seen.get(m.site);
    if (!f) seen.set(m.site, f = { sample: false, quote: null, moved: new Set(), last: '', value: null, terms: '', reason: '' });
    if ((m.action === 'created' || m.action === 'stage_change') && m.to) {
      f.moved.add(m.to);
      f.last = m.to;
      if (m.to === st.sample) f.sample = true;
      if (m.to === st.quote) f.quote = m.value || 0;
    }
    if (m.value !== null) {
      f.value = m.value;
      f.terms = m.terms;
    }
    if (m.lostReason) f.reason = m.lostReason;
  }

  /** @type {SiteResult[]} */
  const results = [];
  for (const [id, f] of seen) {
    const s = /** @type {SummarySite} */ (byId.get(id));
    let won = null;
    let lost = null;
    if (period.running) {
      const closedHere = f.moved.has(s.stage);
      if (closedHere && s.stage === st.won) won = { value: s.value || 0, terms: s.terms };
      if (closedHere && s.stage === st.lost) lost = { value: s.value || 0, reason: s.lostReason };
    } else {
      const value = f.value !== null ? f.value : s.value || 0;
      if (f.last === st.won) won = { value, terms: f.value !== null ? f.terms : s.terms };
      if (f.last === st.lost) lost = { value, reason: f.reason || s.lostReason };
    }
    if (f.sample || f.quote !== null || won || lost) results.push({ site: s, sample: f.sample, quote: f.quote, won, lost });
  }
  return { sites, results, work };
}

/**
 * The Numbers of a group of codes (one salesman, a region, or all salesmen). Sites worked counts
 * each site once, so a site two of them worked counts once.
 * @param {PeriodFacts} facts
 * @param {Set<string>} reps
 */
function summaryNumbers_(facts, reps) {
  const results = facts.results.filter((r) => reps.has(r.site.rep));
  /** @type {Set<string>} */
  const worked = new Set();
  /** @type {Set<string>} */
  const days = new Set();
  let created = 0;
  for (const rep of reps) {
    const w = facts.work.get(rep);
    if (!w) continue;
    created += w.created;
    w.worked.forEach((id) => worked.add(id));
    w.days.forEach((key) => days.add(key));
  }
  const sum = (/** @type {number[]} */ list) => list.reduce((a, b) => a + b, 0);
  const quotes = results.filter((r) => r.quote !== null);
  const won = results.filter((r) => r.won);
  return {
    results, created, worked: worked.size, days: days.size,
    samples: results.filter((r) => r.sample).length,
    quotes: quotes.length, quoteRs: sum(quotes.map((r) => r.quote || 0)),
    won: won.length, wonRs: sum(won.map((r) => (r.won ? r.won.value : 0))),
    lost: results.filter((r) => r.lost).length,
  };
}
/** @typedef {ReturnType<typeof summaryNumbers_>} SummaryNumbers */

/**
 * The Numbers lines (Rs. only next to a count that isn't 0).
 * @param {SummaryNumbers} n
 */
function numberLines_(n) {
  return [
    `New sites ${n.created} · Sites worked ${n.worked}`,
    `Samples given ${n.samples} · Quotes given ${n.quotes}${n.quotes ? ` · ${formatRs_(n.quoteRs)}` : ''}`,
    `Won ${n.won}${n.won ? ` · ${formatRs_(n.wonRs)}` : ''} · Lost ${n.lost}`,
  ];
}

/**
 * `November target Rs. 12,345,000 · Won Rs. 450,000 (3%)`, or `No target for November`.
 * @param {string} month yyyy-MM
 * @param {number | null} target
 * @param {number} wonRs
 */
function targetLine_(month, target, wonRs) {
  const name = MONTH_NAMES[Number(month.slice(5)) - 1];
  if (!target) return `No target for ${name}`;
  return `${name} target ${formatRs_(target)} · Won ${formatRs_(wonRs)} (${Math.floor(wonRs * 100 / target)}%)`;
}

/**
 * A list of named sites, biggest Rs. first, at most SUMMARY_LIST_MAX, then "+ N more".
 * @param {Array<{ value: number, name: string, text: string }>} items
 */
function namedLines_(items) {
  const sorted = items.slice().sort((a, b) => b.value - a.value || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const lines = sorted.slice(0, SUMMARY_LIST_MAX).map((x) => `• ${x.text}`);
  if (sorted.length > SUMMARY_LIST_MAX) lines.push(`+ ${sorted.length - SUMMARY_LIST_MAX} more`);
  return lines;
}

/** @param {SummarySite} s */
function siteName_(s) {
  return s.name || s.id;
}

/**
 * The Rs. a site's card shows (Rate Quoted / Won), or 0.
 * @param {SummarySite} s
 */
function shownRs_(s) {
  return s.value && VALUE_STAGES.includes(s.stage) ? s.value : 0;
}

/**
 * One part of a summary: a heading ('' for none) and its lines, as the screen shows them and the
 * WhatsApp text says them. `now`: a part that is always as things are now (Coming up, Late &
 * going cold), left out of a past period's text (owner S9-15). `reps`: the admin's side-by-side
 * lines, the salesman each line is about (his page lets him tap it).
 * @typedef {{ h: string, lines: string[], now?: boolean, reps?: string[] }} SummaryBlock
 */

/**
 * Coming up and Late & going cold, as things are now (specs 006 to 008 rules): hot = Sample /
 * Trial or Rate Quoted, in Hot Pipeline order (Rs. biggest first, then soonest follow-up, owner
 * P5-1); late = open with a follow-up before today or none; going cold = hot with no real Update
 * for COLD_DAYS days (spec 007); due = an open site's follow-up today or in the 6 days after.
 * `named`: a salesman's own summary names his top sites; the team's gives counts only.
 * @param {SummarySite[]} sites
 * @param {string} today
 * @param {boolean} named
 * @returns {SummaryBlock[]}
 */
function nowBlocks_(sites, today, named) {
  const open = sites.filter((s) => !CLOSED_STAGES.includes(s.stage));
  /** @param {SummarySite} a @param {SummarySite} b */
  const byFollowUp = (a, b) => (a.followUp < b.followUp ? -1 : a.followUp > b.followUp ? 1 : a.order - b.order);
  /** @param {SummarySite} a @param {SummarySite} b */
  const order = (a, b) => shownRs_(b) - shownRs_(a) || byFollowUp(a, b);
  const hot = open.filter((s) => HOT_STAGES.includes(s.stage)).sort(order);
  const hotRs = hot.reduce((sum, s) => sum + shownRs_(s), 0);
  const lastDue = addDays_(today, SUMMARY_DUE_DAYS - 1);
  const due = open.filter((s) => s.followUp && s.followUp >= today && s.followUp <= lastDue).length;
  /** @param {SummarySite} s */
  const isLate = (s) => !s.followUp || s.followUp < today;
  /** @param {SummarySite} s */
  const coldFor = (s) => {
    const days = HOT_STAGES.includes(s.stage) && s.worked ? daysBetween_(s.worked, today) : 0;
    return days >= COLD_DAYS ? days : 0;
  };
  const late = open.filter(isLate).length;
  const cold = open.filter(coldFor).length;

  /** @param {SummarySite} s */
  const head = (s) => [siteName_(s), s.stage].concat(shownRs_(s) ? [formatRs_(shownRs_(s))] : []);
  const coming = [`Hot sites ${hot.length}${hotRs ? ` · ${formatRs_(hotRs)} quoted` : ''}`];
  if (named) coming.push(...hot.slice(0, SUMMARY_HOT_MAX).map((s) => `• ${head(s).join(' · ')}`));
  coming.push(`Follow-ups due in the next ${SUMMARY_DUE_DAYS} days: ${due}`);
  const behind = late + cold ? [`Late ${late} · Going cold ${cold}`] : ['Nothing late or going cold.'];
  if (named) {
    behind.push(...open.filter((s) => isLate(s) || coldFor(s)).sort(order).slice(0, SUMMARY_LATE_MAX).map((s) => {
      const bits = head(s);
      if (isLate(s)) bits.push(s.followUp ? `${plural_(daysBetween_(s.followUp, today), 'day')} late` : 'no follow-up date');
      if (coldFor(s)) bits.push(`no update for ${coldFor(s)} days`);
      return `• ${bits.join(' · ')}`;
    }));
  }
  return [
    { h: `Now, ${shortDay_(today)}`, lines: [], now: true },
    { h: 'Coming up', lines: coming, now: true },
    { h: 'Late & going cold', lines: behind, now: true },
  ];
}

/**
 * The WhatsApp text (and Copy): the heading line in bold, then each part, fixed headings in
 * bold, short lines. A past period leaves out the "now" parts (owner S9-15).
 * @param {string} heading
 * @param {SummaryBlock[]} blocks
 * @param {boolean} running
 */
function summaryText_(heading, blocks, running) {
  let text = `*${heading}*`;
  let gap = '\n';
  for (const b of blocks) {
    if (b.now && !running) continue;
    text += gap + (b.h ? `*${b.h}*` : '') + (b.h && b.lines.length ? '\n' : '') + b.lines.join('\n');
    gap = b.lines.length ? '\n\n' : '\n';
  }
  return text;
}

/**
 * One salesman's summary, exactly as his page shows it (owner S9-7): Numbers (month: against his
 * target), named sites, Coming up, Late & going cold. Built only from his own sites and his own
 * work rows. `days` (the admin's view only, owner S9-9) adds "Logged on 5 days".
 * @param {string} rep
 * @param {PeriodFacts} facts
 * @param {SummaryPeriod} period
 * @param {number | null} target his target for the period's month (a month summary only)
 * @param {string} title what the screen shows on top
 * @param {boolean} [withDays]
 * @returns {{ title: string, blocks: SummaryBlock[], text: string }}
 */
function salesmanSummary_(rep, facts, period, target, title, withDays) {
  const n = summaryNumbers_(facts, new Set([rep]));
  const numbers = numberLines_(n);
  if (withDays) numbers.splice(1, 0, `Logged on ${plural_(n.days, 'day')}`);
  numbers.push(RS_NOTE);
  if (period.month) numbers.push(targetLine_(period.month, target, n.wonRs));
  /** @type {SummaryBlock[]} */
  const blocks = [{ h: '', lines: numbers }];
  const parts = [
    ['Won', n.results.filter((r) => r.won).map((r) => {
      const won = /** @type {{ value: number, terms: string }} */ (r.won);
      return { value: won.value, name: siteName_(r.site), text: `${siteName_(r.site)} · ${formatRs_(won.value)}${won.terms ? ` ${won.terms}` : ''}` };
    })],
    ['Quotes given', n.results.filter((r) => r.quote !== null).map((r) => ({
      value: r.quote || 0, name: siteName_(r.site), text: `${siteName_(r.site)} · ${formatRs_(r.quote || 0)}`,
    }))],
    ['Lost', n.results.filter((r) => r.lost).map((r) => {
      const lost = /** @type {{ value: number, reason: string }} */ (r.lost);
      return { value: lost.value, name: siteName_(r.site), text: siteName_(r.site) + (lost.reason ? ` · ${lost.reason}` : '') };
    })],
  ];
  for (const [h, items] of /** @type {Array<[string, Array<{ value: number, name: string, text: string }>]>} */ (parts)) {
    if (items.length) blocks.push({ h, lines: namedLines_(items) });
  }
  blocks.push(...nowBlocks_(facts.sites.filter((s) => s.rep === rep), period.today, true));
  return { title, blocks, text: summaryText_(`${rep} · ${period.title}`, blocks, period.running) };
}

/**
 * A salesman's line side by side with the others (admin only): "RIA · worked 14 · quotes 3 ·
 * Rs. 1,250,000 · won 2 · Rs. 450,000 · lost 1 · logged on 5 days", month: "· 3% of target".
 * @param {string} rep
 * @param {SummaryNumbers} n
 * @param {number | null} target
 */
function sideLine_(rep, n, target) {
  if (!n.days && !n.worked && !n.created && !n.results.length) return `${rep} · nothing logged`;
  const bits = [rep, `worked ${n.worked}`, `quotes ${n.quotes}${n.quotes ? ` · ${formatRs_(n.quoteRs)}` : ''}`,
    `won ${n.won}${n.won ? ` · ${formatRs_(n.wonRs)}` : ''}`, `lost ${n.lost}`, `logged on ${plural_(n.days, 'day')}`];
  if (target) bits.push(`${Math.floor(n.wonRs * 100 / target)}% of target`);
  return bits.join(' · ');
}

/**
 * The facts of a period: `Sites` read once, `Activity` from the period's start only (bottom up),
 * Meta-Data through the kept copy. Throws "Something went wrong" for an unknown period before
 * anything is read.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {any} periodKey
 * @param {Date} now
 */
function readSummary_(diary, periodKey, now) {
  const period = summaryPeriod_(periodKey, now);
  const kept = knownSalesmen_(now);
  if (!kept.ok) throw new Error(kept.message);
  const facts = summaryFacts_(readTab_(diary, DIARY_TABS.sites).rows, activitySince_(diary, period.start), period);
  return { period, kept, facts, at: Utilities.formatDate(now, APP_TIME_ZONE, 'HH:mm') };
}

/**
 * His summary for a period (spec 009): only his own figures and only his own target.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {string} rep
 * @param {any} periodKey
 * @param {Date} now
 */
function repSummaryFor_(diary, rep, periodKey, now) {
  const { period, kept, facts, at } = readSummary_(diary, periodKey, now);
  const target = period.month ? shownTarget_(kept.repTargets, rep, period.month) : null;
  return { ok: true, period: period.key, at, ...salesmanSummary_(rep, facts, period, target, period.title) };
}

/**
 * The team's summary for a period (spec 009, owner S9-8), with every current salesman's own
 * summary and days logged, so everything opens on his phone with no further trip. Salesmen and
 * regions come from `Rep_Mapping` (the kept copy), never from `Sites.region`; a code no longer
 * there gets its own line and is in no total; Coming up and Late & going cold count every site.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {any} periodKey
 * @param {Date} now
 */
function teamSummaryFor_(diary, periodKey, now) {
  const { period, kept, facts, at } = readSummary_(diary, periodKey, now);
  const month = period.month;
  const salesmen = REGIONS.flatMap((region) => kept.salesmen.filter((s) => s.region === region));
  const known = new Set(salesmen.map((s) => s.rep));
  /** @param {string} rep */
  const repTarget = (rep) => (month ? shownTarget_(kept.repTargets, rep, month) : null);
  const regionTargets = REGIONS.map((region) => (month ? shownTarget_(kept.regionTargets, region, month) : null));

  const all = summaryNumbers_(facts, known);
  const allLines = numberLines_(all).concat([RS_NOTE]);
  /** @type {SummaryBlock[]} */
  const blocks = [{ h: 'All salesmen', lines: allLines }];
  if (month) {
    const present = regionTargets.filter((t) => t !== null);
    allLines.push(targetLine_(month, present.length ? present.reduce((a, b) => a + (b || 0), 0) : null, all.wonRs));
    const house = shownTarget_(kept.regionTargets, HOUSE_REGION, month);
    const name = MONTH_NAMES[Number(month.slice(5)) - 1];
    blocks.push({ h: HOUSE_REGION_LABEL, lines: [`${house ? `${name} target ${formatRs_(house)}` : `No target for ${name}`} · Not logged in the diary.`] });
  }
  REGIONS.forEach((region, i) => {
    const n = summaryNumbers_(facts, new Set(salesmen.filter((s) => s.region === region).map((s) => s.rep)));
    blocks.push({ h: region, lines: numberLines_(n).concat(month ? [targetLine_(month, regionTargets[i], n.wonRs)] : []) });
  });
  blocks.push({
    h: 'Salesmen', reps: salesmen.map((s) => s.rep),
    lines: salesmen.map((s) => sideLine_(s.rep, summaryNumbers_(facts, new Set([s.rep])), repTarget(s.rep))),
  });
  /** @type {Set<string>} */
  const others = new Set();
  facts.results.forEach((r) => others.add(r.site.rep));
  facts.work.forEach((_, rep) => others.add(rep));
  const former = [...others].filter((rep) => rep && !known.has(rep)).sort();
  if (former.length) {
    blocks.push({ h: 'Not in the salesmen list', lines: former.map((rep) => sideLine_(rep, summaryNumbers_(facts, new Set([rep])), null)) });
  }
  /** @type {Map<string, number>} */
  const reasons = new Map();
  for (const r of facts.results) if (r.lost) reasons.set(r.lost.reason || 'Other', (reasons.get(r.lost.reason || 'Other') || 0) + 1);
  if (reasons.size) {
    const list = [...reasons].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const total = list.reduce((sum, x) => sum + x[1], 0);
    blocks.push({ h: 'Lost reasons', lines: [`Lost ${total}: ${list.map(([reason, n]) => `${reason} ${n}`).join(' · ')}`] });
  }
  blocks.push(...nowBlocks_(facts.sites, period.today, false));
  const title = `Team · ${period.title}`;
  return {
    ok: true, period: period.key, at, title, blocks, text: summaryText_(title, blocks, period.running),
    salesmen: salesmen.map((s) => ({ rep: s.rep, ...salesmanSummary_(s.rep, facts, period, repTarget(s.rep), `${s.rep} · ${period.title}`, true) })),
  };
}

/**
 * His summary (spec 009): This week, Last week, This month or Last month, with the WhatsApp text.
 * Only his own figures (ADR-0004). Writes nothing.
 * @param {any} k his link code
 * @param {any} period 'this-week' | 'last-week' | 'this-month' | 'last-month'
 */
function repSummary(k, period) {
  return forSalesman_(() => {
    const { salesman, diary } = requireRep_(k);
    return repSummaryFor_(diary, salesman.rep, period, new Date());
  });
}

/**
 * The team's summary for the admin (spec 009), with each salesman's own, in one trip. Writes
 * nothing.
 * @param {any} k his link code
 * @param {any} period 'this-week' | 'last-week' | 'this-month' | 'last-month'
 */
function adminPageSummary(k, period) {
  return forAdminPage_(() => {
    const { diary } = requireAdminLink_(k);
    return teamSummaryFor_(diary, period, new Date());
  });
}

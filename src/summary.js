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
// another salesman's, a team or a region figure (ADR-0004); its site lists (spec 011) never carry a
// site whose `Sites.rep` isn't his, only a count of them. adminPageSummary first checks the
// admin's link (requireAdminLink_). No Dates in replies.

/** The four summaries (owner S9-5). */
const SUMMARY_PERIODS = ['this-week', 'last-week', 'this-month', 'last-month'];
/** Named sites per table before "+ N more". */
const SUMMARY_LIST_MAX = 10;
/** A salesman's NOW names his top hot sites and the biggest late / going cold ones (owner S9-7). */
const SUMMARY_HOT_MAX = 5;
const SUMMARY_LATE_MAX = 3;
/** "Follow-ups due in the next 7 days": today and the 6 days after (specs 006 to 008). */
const SUMMARY_DUE_DAYS = 7;
/** What counts as work on a site (owner S9-12): never a snooze or Edit details (P6-2). */
const WORK_ACTIONS = ['created', 'stage_change', 'update'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A summary's period, in Pakistan time. A save counts when start <= its time < end: `end` is the
 * next period's start, so a save at Saturday 00:00 is in that week, never the week before.
 * `month` is the period's `yyyy-MM` for a month summary, '' for a week (a week shows no target).
 * `name` ("November so far", "Last week", "October") and `days` ("1–20 Nov") make the heading
 * (spec 010); `title` is both in one line.
 * @typedef {{
 *   key: string, running: boolean, start: number, end: number, month: string, title: string,
 *   name: string, days: string, today: string,
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
  let name;
  let days;
  if (period === 'this-week' || period === 'last-week') {
    const [y, m, d] = today.split('-').map(Number);
    const saturday = addDays_(today, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1) % 7));
    from = running ? saturday : addDays_(saturday, -7);
    to = addDays_(from, 7);
    const last = running ? today : addDays_(to, -1);
    days = from === last ? weekdayDay_(from) : `${weekdayDay_(from)} – ${weekdayDay_(last)}`;
    name = !running ? 'Last week' : last === addDays_(to, -1) ? 'This week' : 'This week so far';
  } else {
    month = running ? today.slice(0, 7) : previousMonthKey_(today.slice(0, 7));
    from = `${month}-01`;
    to = `${nextMonthKey_(month)}-01`;
    const last = running ? today : addDays_(to, -1);
    name = MONTH_NAMES[Number(month.slice(5)) - 1] + (running ? ' so far' : '');
    days = from === last ? shortDay_(last) : `${Number(from.slice(8))}–${shortDay_(last)}`;
  }
  const title = period === 'last-month' ? name : `${name} · ${days}`;
  return { key: period, running, start: dayStart_(from).getTime(), end: dayStart_(to).getTime(), month, title, name, days, today };
}

/**
 * A site as a summary sees it now: its card, its current salesman (`Sites.rep`) and region cell,
 * its place in his list (newest first, as on his page) and when it was added (ms, `at`).
 * @typedef {SiteCard & { rep: string, region: string, order: number, at: number }} SummarySite
 */
/**
 * A site's results in the period, which count for its **current** salesman (`Sites.rep`, P7-1).
 * `quote`: the Rs. of the latest move to Rate Quoted in the period, or null if none.
 * @typedef {{
 *   site: SummarySite, sample: boolean, quote: number | null,
 *   won: { value: number, terms: string } | null, lost: { value: number, reason: string } | null,
 * }} SiteResult
 */
/**
 * A salesman's work in the period: `made` the site ID of each `created` row ('' if it had none).
 * @typedef {{ made: string[], worked: Set<string>, days: Set<string> }} RepWork
 */
/**
 * `byId`: each site in `Sites`; `movedOn`: per site, per stage, the last day a row moved it there
 * (of the rows read, from the period's start to now).
 * @typedef {{
 *   sites: SummarySite[], results: SiteResult[], work: Map<string, RepWork>, byId: Map<string, SummarySite>,
 *   movedOn: Map<string, Object<string, string>>,
 * }} PeriodFacts
 */

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
    .map((r) => ({ card: cardOf_(r), rep: tidyCode_(r.rep), region: text_(r.region),
      when: isDate_(r.created_at) ? r.created_at.getTime() : 0, row: r._row }))
    .sort((a, b) => b.when - a.when || b.row - a.row)
    .map((x, order) => ({ ...x.card, rep: x.rep, region: x.region, order, at: x.when }));
  /** @type {Map<string, SummarySite>} */
  const byId = new Map();
  for (const s of sites) if (s.id && !byId.has(s.id)) byId.set(s.id, s);

  /** @type {Map<string, RepWork>} */
  const work = new Map();
  /** @type {Map<string, { sample: boolean, quote: number | null, moved: Set<string>, last: string, value: number | null, terms: string, reason: string }>} */
  const seen = new Map();
  /** @type {Map<string, Object<string, string>>} */
  const movedOn = new Map();
  for (const m of moves) {
    if ((m.action === 'created' || m.action === 'stage_change') && m.to && m.site) {
      movedOn.set(m.site, { ...movedOn.get(m.site), [m.to]: dayKey_(m.when) });
    }
    const at = m.when.getTime();
    if (at < period.start || at >= period.end) continue;
    if (m.by && m.by !== ADMIN_ACTOR) {
      let w = work.get(m.by);
      if (!w) work.set(m.by, w = { made: [], worked: new Set(), days: new Set() });
      w.days.add(dayKey_(m.when));
      if (m.action === 'created') w.made.push(m.site);
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
  return { sites, results, work, byId, movedOn };
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
  /** @type {string[]} */
  const made = [];
  for (const rep of reps) {
    const w = facts.work.get(rep);
    if (!w) continue;
    made.push(...w.made);
    w.worked.forEach((id) => worked.add(id));
    w.days.forEach((key) => days.add(key));
  }
  const sum = (/** @type {number[]} */ list) => list.reduce((a, b) => a + b, 0);
  const quotes = results.filter((r) => r.quote !== null);
  const won = results.filter((r) => r.won);
  return {
    results, made, workedIds: [...worked], created: made.length, worked: worked.size, days: days.size,
    samples: results.filter((r) => r.sample).length,
    quotes: quotes.length, quoteRs: sum(quotes.map((r) => r.quote || 0)),
    won: won.length, wonRs: sum(won.map((r) => (r.won ? r.won.value : 0))),
    lost: results.filter((r) => r.lost).length,
  };
}
/** @typedef {ReturnType<typeof summaryNumbers_>} SummaryNumbers */

/**
 * One row of a summary table (spec 010): its cells (the first is the name, the rest numbers or a
 * reason, drawn on the right), `s` small text after the name ("· Cash"), `k` how it looks (`reg`
 * a region, `tot` the Team, `grey` a heading row, `none` nothing in the period, `late`, `cold`,
 * `m` a grey right cell, `b` a bold count) and `rep` the salesman the admin can tap.
 * @typedef {{ c: string[], s?: string, k?: string, rep?: string, reg?: string, id?: string }} SummaryRow
 */
/**
 * A table: its title and count (top row), column names (the team table), rows, "+ N more".
 * @typedef {{ h: string, n: string, cols?: string[], rows: SummaryRow[], more?: string }} SummaryTable
 */

/**
 * Rs. digits only: `1250000` → `1,250,000` (the monospace block, where Rs. is in the note).
 * @param {number} amount
 */
function rsDigits_(amount) {
  return formatRs_(amount).slice(4);
}

/**
 * Rs. in millions for the team table (owner S10-4): ÷ 1,000,000, 2 decimals, trailing zeros
 * dropped (2.45M, 1.5M, 0.25M); 0 → 0; under Rs. 5,000 (but not 0) → <0.01M.
 * @param {number} amount
 */
function millions_(amount) {
  if (!amount) return '0';
  if (amount < 5000) return '<0.01M';
  return `${Number((Math.round(amount / 10000) / 100).toFixed(2))}M`;
}

/** Monospace block lines (spec 010): at most this many characters, so a phone never wraps them. */
const MONO_WIDTH = 30;

/**
 * A monospace line: label, count right-aligned at column 16, Rs. right-aligned at column 30. Always
 * at least one space between them and never more than MONO_WIDTH characters: in the extreme (a
 * 4-digit count with a 13-character amount) the label is shortened.
 * @param {string} label
 * @param {number} count
 * @param {number} [amount]
 */
function monoRow_(label, count, amount) {
  const n = String(count);
  const rs = amount === undefined ? '' : rsDigits_(amount);
  const room = MONO_WIDTH - n.length - 1 - (rs ? rs.length + 1 : 0);
  const name = label.slice(0, Math.max(1, room));
  const left = name + ' '.repeat(Math.max(1, 16 - name.length - n.length)) + n;
  return rs ? left + ' '.repeat(Math.max(1, MONO_WIDTH - left.length - rs.length)) + rs : left;
}

/**
 * Text from the sheet (a site name, a reason, a code) made safe for the WhatsApp text (spec 010):
 * WhatsApp formats from anywhere in a message, so a name with three backticks or a star would turn
 * the rest into monospace or bold. A backtick becomes ', and *, _ and ~ become look-alikes it doesn't
 * read as formatting (∗ ˍ ∼). The screen always shows names exactly as they are.
 * @param {string} text
 */
function waSafe_(text) {
  return text.replace(/`/g, "'").replace(/\*/g, '∗').replace(/_/g, 'ˍ').replace(/~/g, '∼');
}

/**
 * A team table line in monospace: the name, then each cell right-aligned so it ends at columns
 * 11, 18, 25 and 30 (always at least one space between).
 * @param {string[]} cells
 */
function monoCols_(cells) {
  // The name is cut short if it would reach the first number column (a long code no longer in the
  // salesmen list), so the line stays within MONO_WIDTH.
  let line = waSafe_(cells[0]).slice(0, Math.max(1, 10 - cells[1].length));
  [11, 18, 25, MONO_WIDTH].forEach((edge, i) => {
    const cell = cells[i + 1];
    line += ' '.repeat(Math.max(1, edge - line.length - cell.length)) + cell;
  });
  return line;
}

/**
 * The order of a site list (spec 011) and of NOW: the Rs. its card shows, biggest first; then the
 * soonest follow-up (none first, as late sites are); then its place in the list (newest first).
 * @param {SummarySite} a
 * @param {SummarySite} b
 */
function siteOrder_(a, b) {
  return shownRs_(b) - shownRs_(a) || (a.followUp < b.followUp ? -1 : a.followUp > b.followUp ? 1 : a.order - b.order);
}

/**
 * What a tap on a count opens (spec 011): `ids` the IDs of the sites it counted that may be shown, in
 * the list's order, and `x` how many it counted that are not sent (no longer in `Sites`, or, on a
 * salesman's own summary, no longer his: ADR-0004), so the list plus "+ x …" equals the count.
 * `lh` is the list's heading.
 * @param {PeriodFacts} facts
 * @param {string[]} ids one per counted item
 * @param {(s: SummarySite) => boolean} shown
 * @param {string} lh
 */
function siteList_(facts, ids, shown, lh) {
  /** @type {SummarySite[]} */
  const sites = [];
  for (const id of ids) {
    const site = facts.byId.get(id);
    if (site && shown(site)) sites.push(site);
  }
  const x = ids.length - sites.length;
  return { lh, ids: sites.sort(siteOrder_).map((site) => site.id), ...(x ? { x } : {}) };
}

/**
 * The six number tiles (spec 010): a count of 0 shows no Rs. Each tile also carries its site list
 * (siteList_); Quotes, Won and Lost are sorted by the period's value and carry it per site in `p`
 * ("Quoted Rs. 450,000", "Won Rs. 1,150,000 · Cash", "Lost · Price Too High").
 * @param {SummaryNumbers} n
 * @param {PeriodFacts} facts
 * @param {(s: SummarySite) => boolean} shown
 * @param {string} lh the start of each list's heading ("This week so far")
 */
function summaryTiles_(n, facts, shown, lh) {
  /** @param {string} l @param {string[]} ids */
  const list = (l, ids) => siteList_(facts, ids, shown, `${lh} · ${l}`);
  /** @param {string} l @param {Array<{ value: number, name: string, id: string, line: string }>} items */
  const valued = (l, items) => {
    const sorted = biggestFirst_(items);
    return { lh: `${lh} · ${l}`, ids: sorted.map((x) => x.id), p: sorted.map((x) => x.line) };
  };
  /** @param {SiteResult} r @param {number} value @param {string} line */
  const item = (r, value, line) => ({ value, name: siteName_(r.site), id: r.site.id, line });
  return [
    { n: String(n.created), l: 'New sites', ...list('New sites', n.made) },
    { n: String(n.worked), l: 'Sites worked', ...list('Sites worked', n.workedIds) },
    { n: String(n.samples), l: 'Samples', ...list('Samples', n.results.filter((r) => r.sample).map((r) => r.site.id)) },
    { n: String(n.quotes), l: 'Quotes', ...(n.quotes ? { rs: formatRs_(n.quoteRs) } : {}),
      ...valued('Quotes', n.results.filter((r) => r.quote !== null).map((r) => item(r, r.quote || 0, `Quoted ${formatRs_(r.quote || 0)}`))) },
    { n: String(n.won), l: 'Won', c: 'won', ...(n.won ? { rs: formatRs_(n.wonRs) } : {}),
      ...valued('Won', n.results.filter((r) => r.won).map((r) => {
        const won = /** @type {{ value: number, terms: string }} */ (r.won);
        return item(r, won.value, `Won ${formatRs_(won.value)}${won.terms ? ` · ${won.terms}` : ''}`);
      })) },
    { n: String(n.lost), l: 'Lost', c: 'lost',
      ...valued('Lost', n.results.filter((r) => r.lost).map((r) => {
        const lost = /** @type {{ value: number, reason: string }} */ (r.lost);
        return item(r, lost.value, `Lost${lost.reason ? ` · ${lost.reason}` : ''}`);
      })) },
  ];
}

/**
 * The same numbers for the monospace block.
 * @param {SummaryNumbers} n
 * @param {boolean} [withDays] the admin's view of a salesman: his days logged (S9-9)
 */
function numberMono_(n, withDays) {
  return [
    monoRow_('New sites', n.created), monoRow_('Sites worked', n.worked),
    ...(withDays ? [monoRow_('Days logged', n.days)] : []),
    monoRow_('Samples', n.samples), monoRow_('Quotes', n.quotes, n.quotes ? n.quoteRs : undefined),
    monoRow_('Won', n.won, n.won ? n.wonRs : undefined), monoRow_('Lost', n.lost),
  ];
}

/**
 * % of target, rounded down, or null for no target (spec 009).
 * @param {number} wonRs
 * @param {number | null} target
 */
function pctOf_(wonRs, target) {
  return target ? Math.floor(wonRs * 100 / target) : null;
}

/**
 * The target bar (month only): the % (the bar is full at 100% and above), Won and the target; or
 * "No target for November".
 * @param {string} h
 * @param {string} month yyyy-MM
 * @param {number | null} target
 * @param {number} wonRs
 */
function targetPart_(h, month, target, wonRs) {
  const name = MONTH_NAMES[Number(month.slice(5)) - 1];
  const pct = pctOf_(wonRs, target);
  if (pct === null || !target) return { none: `No target for ${name}` };
  return { h, pct, won: `Won ${formatRs_(wonRs)}`, of: `of ${formatRs_(target)}` };
}

/**
 * The target line of the monospace block.
 * @param {string} month
 * @param {number | null} target
 * @param {number} wonRs
 */
function targetMono_(month, target, wonRs) {
  const pct = pctOf_(wonRs, target);
  return pct === null || !target ? `No target for ${MONTH_NAMES[Number(month.slice(5)) - 1]}`
    : `Target ${(pct > 999 ? '>999%' : `${pct}%`).padStart(4)} of ${rsDigits_(target)}`;
}

/**
 * Named sites, biggest Rs. first, then by name.
 * @template {{ value: number, name: string }} T
 * @param {T[]} items
 * @returns {T[]}
 */
function biggestFirst_(items) {
  return items.slice().sort((a, b) => b.value - a.value || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * A two-column table of named sites (spec 010): up to SUMMARY_LIST_MAX, then "+ N more"; and the
 * same as a WhatsApp list ("- F-11 Commercial Tower · Rs. 450,000 Cash"). Each row carries its
 * site `id` (tapping it opens the site, spec 011).
 * @param {string} h
 * @param {Array<{ value: number, name: string, id: string, s?: string, r: string, m?: boolean, text: string }>} items
 */
function siteTable_(h, items) {
  const sorted = biggestFirst_(items);
  const shown = sorted.slice(0, SUMMARY_LIST_MAX);
  const more = sorted.length > SUMMARY_LIST_MAX ? `+ ${sorted.length - SUMMARY_LIST_MAX} more` : '';
  /** @type {SummaryTable} */
  const table = {
    h, n: String(sorted.length),
    rows: shown.map((x) => ({ c: [x.name, x.r], ...(x.s ? { s: x.s } : {}), ...(x.m ? { k: 'm' } : {}), id: x.id })),
    ...(more ? { more } : {}),
  };
  return { table, list: shown.map((x) => `- ${x.text}`).concat(more ? [more] : []) };
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
 * NOW: things as they are today (specs 006 to 008 rules): hot = Sample / Trial or Rate Quoted
 * (Rs. of the Rate Quoted ones); due = an open site's follow-up today or in the 6 days after; late
 * = open with a follow-up before today or none; going cold = hot with no real Update for COLD_DAYS
 * days (spec 007). On screen under every button; in the text of This week / This month only
 * (S9-15). `named` (a salesman's own summary, owner S9-7): also his top hot sites in the Hot
 * Pipeline order (Rs. biggest first, then soonest follow-up, then newest, owner P5-1) and the
 * biggest late or going cold ones, as tables and as WhatsApp lists (each named row carries its site
 * `id`, spec 011). The team's: counts only. Each of the four rows carries its site list (`ids`, in the
 * list order) and its list heading `lh` (spec 011).
 * @param {SummarySite[]} sites
 * @param {string} today
 * @param {boolean} [named]
 * @param {string} [who] "RIA · ", "Team · " before the list headings
 */
function nowPart_(sites, today, named, who = '') {
  const open = sites.filter((s) => !CLOSED_STAGES.includes(s.stage)).sort(siteOrder_);
  const hot = open.filter((s) => HOT_STAGES.includes(s.stage));
  const hotRs = hot.reduce((sum, s) => sum + shownRs_(s), 0);
  const lastDue = addDays_(today, SUMMARY_DUE_DAYS - 1);
  const due = open.filter((s) => s.followUp && s.followUp >= today && s.followUp <= lastDue);
  /** @param {SummarySite} s */
  const isLate = (s) => !s.followUp || s.followUp < today;
  /** @param {SummarySite} s */
  const coldFor = (s) => {
    const days = HOT_STAGES.includes(s.stage) && s.worked ? daysBetween_(s.worked, today) : 0;
    return days >= COLD_DAYS ? days : 0;
  };
  const lateSites = open.filter(isLate);
  const coldSites = open.filter(coldFor);
  const late = lateSites.length;
  const cold = coldSites.length;
  const heading = `Now, ${shortDay_(today)}`;
  /** @param {string} label @param {SummarySite[]} list */
  const tap = (label, list) => ({ lh: `${who}${heading} · ${label}`, ids: list.map((s) => s.id) });
  const dueLabel = `Follow-ups next ${SUMMARY_DUE_DAYS} days`;
  const part = {
    cap: `Now · ${shortDay_(today)}`, heading,
    rows: [
      { c: ['Hot sites', `${hot.length}${hotRs ? ` · ${formatRs_(hotRs)}` : ''}`], ...tap('Hot sites', hot) },
      { c: [dueLabel, String(due.length)], ...tap(dueLabel, due) },
      { c: ['Late', String(late)], k: late ? 'late' : 'none', ...tap('Late', lateSites) },
      { c: ['Going cold', String(cold)], k: cold ? 'cold' : 'none', ...tap('Going cold', coldSites) },
    ],
    mono: [monoRow_('Hot sites', hot.length, hotRs || undefined), monoRow_(`Due in ${SUMMARY_DUE_DAYS} days`, due.length),
      monoRow_('Late', late), monoRow_('Going cold', cold)],
    /** @type {SummaryTable[]} */
    tables: [],
    /** @type {Array<{ h: string, list: string[] }>} */
    lists: [],
  };
  if (!named) return part;
  // His top hot sites: name | Rs. (Rate Quoted), or name | Sample / Trial in grey.
  const top = hot.slice(0, SUMMARY_HOT_MAX);
  if (top.length) {
    const right = (/** @type {SummarySite} */ s) => (shownRs_(s) ? formatRs_(shownRs_(s)) : s.stage);
    part.tables.push({ h: 'Hot sites', n: String(hot.length),
      rows: top.map((s) => ({ c: [siteName_(s), right(s)], ...(shownRs_(s) ? {} : { k: 'm' }), id: s.id })) });
    part.lists.push({ h: 'Hot sites', list: top.map((s) => `- ${waSafe_(siteName_(s))} · ${right(s)}`) });
  }
  // The biggest late or going cold: name | "5 days late" (red) / "no update for 9 days" (amber).
  const behind = open.filter((s) => isLate(s) || coldFor(s)).slice(0, SUMMARY_LATE_MAX);
  if (behind.length) {
    const why = (/** @type {SummarySite} */ s) => [
      ...(isLate(s) ? [s.followUp ? `${plural_(daysBetween_(s.followUp, today), 'day')} late` : 'no follow-up date'] : []),
      ...(coldFor(s) ? [`no update for ${coldFor(s)} days`] : []),
    ].join(' · ');
    part.tables.push({ h: 'Late & going cold', n: `Late ${late} · Cold ${cold}`,
      rows: behind.map((s) => ({ c: [siteName_(s), why(s)], k: `${isLate(s) ? 'late' : 'cold'} w`, id: s.id })) });
    part.lists.push({ h: 'Late & going cold', list: behind.map((s) => `- ${waSafe_(siteName_(s))} · ${why(s)}`) });
  }
  return part;
}

/**
 * The WhatsApp text (and Copy), spec 010: the heading in bold, the numbers lined up in a
 * monospace block (each line at most MONO_WIDTH characters), notes in italics, names as `- `
 * lists, and NOW in its own block for This week / This month only (S9-15).
 * @param {string} heading
 * @param {string[][]} blocks monospace blocks, each followed by its notes
 * @param {string[]} notes italic lines after the first block
 * @param {Array<{ h: string, list: string[] }>} lists
 * @param {ReturnType<typeof nowPart_>} now
 * @param {boolean} running
 */
function summaryText_(heading, blocks, notes, lists, now, running) {
  const mono = (/** @type {string[]} */ lines) => ['```', ...lines, '```'].join('\n');
  let text = `*${heading}*\n${mono(blocks[0])}${notes.map((n) => `\n_${n}_`).join('')}`;
  for (const block of blocks.slice(1)) text += `\n\n${mono(block)}`;
  for (const l of lists) if (l.list.length) text += `\n\n*${l.h}*\n${l.list.join('\n')}`;
  if (running) {
    text += `\n\n*${now.heading}*\n${mono(now.mono)}`;
    for (const l of now.lists) text += `\n\n*${l.h}*\n${l.list.join('\n')}`;
  }
  return text;
}

/**
 * One salesman's summary, exactly as his page shows it (spec 009 numbers, spec 010 layout):
 * heading, six tiles, target bar (month), Won / Quotes given / Lost tables, NOW, and the WhatsApp
 * text. Built only from his own sites and his own work rows. `withDays` (the admin's view only,
 * owner S9-9) adds "Logged on 5 days". On his own summary (`withDays` false) a list never carries
 * a site that is no longer his (ADR-0004, spec 011).
 * @param {string} rep
 * @param {PeriodFacts} facts
 * @param {SummaryPeriod} period
 * @param {number | null} target his target for the period's month (a month summary only)
 * @param {string} title what the screen shows on top
 * @param {boolean} [withDays]
 */
function salesmanSummary_(rep, facts, period, target, title, withDays) {
  return groupSummary_(new Set([rep]), rep, facts, period, target, title, withDays, !withDays);
}

/**
 * The summary of a set of salesmen (spec 011): one salesman's (salesmanSummary_), or a region's
 * (its current salesmen, the admin's only), built the same way. NOW counts the open sites whose
 * `Sites.rep` is one of them. Every tile and NOW row carries its site list (siteList_), and every
 * named row its site `id`.
 * @param {Set<string>} reps
 * @param {string} who the code or region at the top of the WhatsApp text
 * @param {PeriodFacts} facts
 * @param {SummaryPeriod} period
 * @param {number | null} target for the period's month (a month summary only)
 * @param {string} title what the screen shows on top
 * @param {boolean} [withDays] "Logged on 5 days" (the admin's view of a salesman)
 * @param {boolean} [mine] his own summary: only his own sites are ever sent
 */
function groupSummary_(reps, who, facts, period, target, title, withDays, mine) {
  const n = summaryNumbers_(facts, reps);
  const parts = [
    siteTable_('Won', n.results.filter((r) => r.won).map((r) => {
      const won = /** @type {{ value: number, terms: string }} */ (r.won);
      const name = siteName_(r.site);
      return { value: won.value, name, id: r.site.id, ...(won.terms ? { s: `· ${won.terms}` } : {}), r: formatRs_(won.value),
        text: `${waSafe_(name)} · ${formatRs_(won.value)}${won.terms ? ` ${won.terms}` : ''}` };
    })),
    siteTable_('Quotes given', n.results.filter((r) => r.quote !== null).map((r) => {
      const name = siteName_(r.site);
      return { value: r.quote || 0, name, id: r.site.id, r: formatRs_(r.quote || 0), text: `${waSafe_(name)} · ${formatRs_(r.quote || 0)}` };
    })),
    siteTable_('Lost', n.results.filter((r) => r.lost).map((r) => {
      const lost = /** @type {{ value: number, reason: string }} */ (r.lost);
      const name = siteName_(r.site);
      return { value: lost.value, name, id: r.site.id, r: lost.reason, m: true, text: waSafe_(name + (lost.reason ? ` · ${lost.reason}` : '')) };
    })),
  ];
  const now = nowPart_(facts.sites.filter((s) => reps.has(s.rep)), period.today, true, mine ? '' : `${who} · `);
  const mono = numberMono_(n, withDays);
  if (period.month) mono.push(targetMono_(period.month, target, n.wonRs));
  return {
    title, sub: `${period.days} · Rs. logged, not invoiced`,
    ...(withDays ? { logged: `Logged on ${plural_(n.days, 'day')}` } : {}),
    tiles: summaryTiles_(n, facts, (s) => !mine || reps.has(s.rep), title),
    ...(period.month ? { target: targetPart_('Target', period.month, target, n.wonRs) } : {}),
    tables: parts.filter((p) => p.table.rows.length).map((p) => p.table),
    now: { cap: now.cap, rows: now.rows, tables: now.tables },
    text: summaryText_(`${waSafe_(who)} · ${period.name} (${period.days})`, [mono], ['Rs. logged, not invoiced'],
      parts.map((p) => ({ h: p.table.h, list: p.list })), now, period.running),
  };
}

/**
 * A row of the team table (spec 010): name, sites worked, quotes, Won in millions (S10-4), and %
 * of target (months; '—' with no target) or lost (weeks). A salesman with nothing in the period
 * shows '—'.
 * @param {string} name
 * @param {SummaryNumbers} n
 * @param {SummaryPeriod} period
 * @param {number | null} target
 * @param {boolean} [salesman] a current salesman: "nothing" shows as '—', and the row can be tapped
 */
function teamRow_(name, n, period, target, salesman) {
  const pct = pctOf_(n.wonRs, target);
  // A % over 999 shows as 999+, so the column (and a WhatsApp line) keeps its width.
  const last = period.month ? (pct === null ? '—' : pct > 999 ? '999+' : String(pct)) : String(n.lost);
  if (salesman && !n.days && !n.worked && !n.created && !n.results.length) {
    return { c: [name, '—', '—', '—', period.month ? last : '—'], k: 'none', rep: name };
  }
  return { c: [name, String(n.worked), String(n.quotes), millions_(n.wonRs), last], ...(salesman ? { rep: name } : {}) };
}

/**
 * The facts of a period: `Sites` read once, `Activity` from the period's start only (bottom up),
 * Meta-Data through the kept copy. An unknown period throws "Something went wrong" before any of
 * this is read (the link check, which comes first, has already opened Sales Diary and read
 * `Links`).
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
  return { ok: true, period: period.key, at, ...salesmanSummary_(rep, facts, period, target, period.name) };
}

/**
 * The team's summary for a period (spec 009, owner S9-8), with every current salesman's own
 * summary and days logged, so everything opens on his phone with no further trip. Salesmen and
 * regions come from `Rep_Mapping` (the kept copy), never from `Sites.region`; a code no longer
 * there gets its own line and is in no total; Coming up and Late & going cold count every site.
 * Spec 011: each region's summary (`regions`, built as a salesman's, for its current salesmen), and
 * `cards`: the cards of the listed sites his page may not hold, so every tap opens with no trip:
 * those now at Won or Lost (his page holds only this month's: those closed in the month his page
 * loaded, before that day, are left out), with `closed` = the day of their last move to that stage (of
 * the rows read; '' if none), and those added since his page loaded (`since`, ms).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary
 * @param {any} periodKey
 * @param {Date} now
 * @param {any} [since] when his page's data was read (ms, `data.now`)
 */
function teamSummaryFor_(diary, periodKey, now, since) {
  const { period, kept, facts, at } = readSummary_(diary, periodKey, now);
  const month = period.month;
  const salesmen = REGIONS.flatMap((region) => kept.salesmen.filter((s) => s.region === region));
  const known = new Set(salesmen.map((s) => s.rep));
  /** @param {string} rep */
  const repTarget = (rep) => (month ? shownTarget_(kept.repTargets, rep, month) : null);
  const regionTargets = REGIONS.map((region) => (month ? shownTarget_(kept.regionTargets, region, month) : null));

  const all = summaryNumbers_(facts, known);
  const name = month ? MONTH_NAMES[Number(month.slice(5)) - 1] : '';
  const teamTarget = regionTargets.some((t) => t !== null) ? regionTargets.reduce((sum, t) => (sum || 0) + (t || 0), 0) : null;
  const house = month ? shownTarget_(kept.regionTargets, HOUSE_REGION, month) : null;
  const houseNote = house ? `House / office target ${formatRs_(house)} · not in the diary` : `No house / office target for ${name}`;

  /** @type {SummaryRow[]} */
  const rows = [];
  REGIONS.forEach((region, i) => {
    const reps = salesmen.filter((s) => s.region === region);
    rows.push({ ...teamRow_(region, summaryNumbers_(facts, new Set(reps.map((s) => s.rep))), period, regionTargets[i]), k: 'reg', reg: region });
    reps.forEach((s) => rows.push(teamRow_(s.rep, summaryNumbers_(facts, new Set([s.rep])), period, repTarget(s.rep), true)));
  });
  rows.push({ ...teamRow_('Team', all, period, teamTarget), k: 'tot' });
  /** @type {Set<string>} */
  const others = new Set();
  facts.results.forEach((r) => others.add(r.site.rep));
  facts.work.forEach((_, rep) => others.add(rep));
  const former = [...others].filter((rep) => rep && !known.has(rep)).sort();
  if (former.length) {
    rows.push({ c: ['Not in the salesmen list'], k: 'grey' });
    former.forEach((rep) => rows.push(teamRow_(rep, summaryNumbers_(facts, new Set([rep])), period, null)));
  }
  const cols = ['Name', 'Worked', 'Quotes', 'Won Rs.', month ? '%' : 'Lost'];
  /** @type {SummaryTable[]} */
  const tables = [{ h: 'Salesmen', n: 'tap a name', cols, rows }];

  // The current salesmen's lost sites, so "Lost N" here equals the Lost tile; a former code's loss
  // shows on his own row under "Not in the salesmen list".
  /** @type {Map<string, number>} */
  const reasons = new Map();
  for (const r of all.results) if (r.lost) reasons.set(r.lost.reason || 'Other', (reasons.get(r.lost.reason || 'Other') || 0) + 1);
  const reasonList = [...reasons].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (reasonList.length) {
    tables.push({ h: 'Lost reasons', n: String(all.lost), rows: reasonList.map(([reason, count]) => ({ c: [reason, String(count)], k: 'b' })) });
  }

  const mono = numberMono_(all);
  if (month) {
    mono.push(targetMono_(month, teamTarget, all.wonRs),
      house ? 'House target'.padEnd(16) + rsDigits_(house).padStart(MONO_WIDTH - 16) : `No house target for ${name}`);
  }
  const table = [monoCols_(['Name'].concat(cols.slice(1).map((c) => c.replace(' Rs.', ''))))]
    .concat(rows.map((r) => (r.c.length === 1 ? 'Not in list' : monoCols_(r.c))));
  const nowPart = nowPart_(facts.sites, period.today, false, 'Team · ');
  const title = `Team · ${period.name}`;
  const views = {
    salesmen: salesmen.map((s) => ({ rep: s.rep, ...salesmanSummary_(s.rep, facts, period, repTarget(s.rep), `${s.rep} · ${period.name}`, true) })),
    regions: REGIONS.map((region, i) => ({ reg: region, ...groupSummary_(new Set(salesmen.filter((s) => s.region === region).map((s) => s.rep)),
      region, facts, period, regionTargets[i], `${region} · ${period.name}`) })),
  };
  const team = {
    ok: true, period: period.key, at, title, sub: `${period.days} · Rs. logged, not invoiced`,
    tiles: summaryTiles_(all, facts, () => true, title),
    ...(month ? { target: { ...targetPart_('Team target', month, teamTarget, all.wonRs), note: houseNote } } : {}),
    tables, now: { cap: nowPart.cap, rows: nowPart.rows },
    text: summaryText_(`Team · ${period.name} (${period.days})`, [mono, table],
      ['Rs. logged, not invoiced'].concat(month ? ['House / office sales are not in the diary'] : []),
      [{ h: `Lost reasons (${all.lost})`, list: reasonList.map(([reason, count]) => `- ${waSafe_(reason)} · ${count}`) }], nowPart, period.running),
    ...views,
  };
  const after = typeof since === 'number' && isFinite(since) ? since : Infinity;
  // His page holds the sites closed in its month before the day it loaded (adminDataFor_).
  const loaded = after < Infinity ? dayKey_(new Date(after)) : '';
  /** @type {Set<string>} */
  const listed = new Set();
  for (const view of [team, ...views.salesmen, ...views.regions]) {
    for (const part of [...view.tiles, ...view.now.rows]) part.ids.forEach((id) => listed.add(id));
    for (const t of [...view.tables, ...(('tables' in view.now && view.now.tables) || [])]) t.rows.forEach((r) => r.id && listed.add(r.id));
  }
  /** @type {Object<string, any>[]} */
  const cards = [];
  for (const id of listed) {
    const { order, at: added, ...card } = /** @type {SummarySite} */ (facts.byId.get(id));
    const closed = CLOSED_STAGES.includes(card.stage) ? (facts.movedOn.get(id) || {})[card.stage] || '-' : '';
    const onPage = closed > '-' && closed < loaded && closed.slice(0, 7) === loaded.slice(0, 7);
    if ((closed && !onPage) || added >= after) cards.push({ ...card, closed: closed === '-' ? '' : closed });
  }
  return { ...team, cards };
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
 * The team's summary for the admin (spec 009), with each salesman's and region's own, in one trip.
 * Writes nothing.
 * @param {any} k his link code
 * @param {any} period 'this-week' | 'last-week' | 'this-month' | 'last-month'
 * @param {any} [since] when his page's data was read (ms): sites added after it come with their cards
 */
function adminPageSummary(k, period, since) {
  return forAdminPage_(() => {
    const { diary } = requireAdminLink_(k);
    return teamSummaryFor_(diary, period, new Date(), since);
  });
}

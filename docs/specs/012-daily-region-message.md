# 012: Daily region message (yesterday's activity, for the region's WhatsApp group)

- **Status:** Approved (built 2026-11-12; not yet live)
- **Owner approval:** approved by the owner on 2026-11-12 (session 7), after the interview (2026-11-12, answers **S12-1 to S12-8** in
  [open questions](../product/open-questions.md))
- **Related:** roadmap phase 7e · [ADR-0012](../decisions/0012-daily-message-shared-with-the-region.md)
  (Accepted: what the message may show to a salesman's region colleagues) · ADR-0004 (private lists) ·
  ADR-0010 (admin link) · specs 008 (Today tab), 009 / 010 (summaries: periods, WhatsApp text, Share /
  Copy), 011 (Plan tab) · the speed pass moves to spec 013

## Why
Before the app, each region (North, Center, South) had a WhatsApp group where salesmen posted
yesterday's updates each morning. What they posted was up to them, and many days nobody posted.
Now everything is logged in the diary. The owner wants one tap on his Admin screen to make
**yesterday's activity for a region** as a message he pastes into that region's group. Salesmen
then see that **management reads what they log**: their entries don't vanish into a black box, and
a day with nothing logged shows.

## What the admin sees and does

### Opening it (owner S12-6)
- On the **Today** tab, beside the heading *"Today, Thu 12 Nov"*, a button **Daily message**.
  Nothing else on Today or the other tabs changes.
- Tapping it opens the **Daily message** screen:
  - **‹ Back** (to Today, where he was);
  - a day line: **‹ Tue 10**  ·  **Wed 11 Nov**  ·  **Thu ›** (the neighbouring days, named);
  - three pills: **North · Center · South** (the last one he used is picked; first time: North);
  - the message, exactly as it will be pasted (plain text, WhatsApp's `*` marks visible);
  - **Share on WhatsApp** (green) and **Copy**, side by side, as on the summaries.
- **Which day it opens on** (owner S12-3): the **last working day**: yesterday, or Saturday when
  yesterday was Sunday (so on a Monday it shows Saturday). **‹** steps one day back (up to 31 days
  back), **›** one day forward, up to **today** (heading *"Thu 12 Nov (so far)"*). Sundays are
  reachable with the arrows (someone may have worked).
- The page asks Google for a day **only when it is shown** (one trip, a few seconds; *"Getting the
  message…"*). One trip brings **all three regions** for that day, so switching pills is instant and
  works with no signal. A past day already fetched shows at once; **Refresh** on the Admin screen
  clears them. Today's text is *"so far"*: it is never kept, so going to today always asks again.
- No signal: *"Couldn't get the message: no signal. Try again."* with **Try again** when there is
  nothing on screen yet; otherwise he stays on the day he had (see *The page and the days*).
- **Nothing is saved** in the sheet when he opens, shares or copies.

### The message (owner S12-1, S12-2, S12-4, S12-5, S12-7, S12-8)
Made-up names; real names come from the sheet.
```
*North · Wed 11 Nov*
11 activities · New 10 · Quoted 1 · Won 1 Rs. 42,250

*RIA* · no activity

*AUR* · 10 activities
Quoted: Gulberg Heights
New: Al Noor Builders, Gulberg Heights, Bilal Traders, Eng Kamran, Shah Associates, Faisal sb, Javed Brothers, Usman sb, Ali Hassan, Green Valley

*WAK* · 1 activity
Won: Askari Homes Rs. 42,250
```
- **Heading:** `*<Region> · <Day> <d> <Mon>*`, plus `(so far)` for today.
- **Region total line** (owner S12-7): `<N> activities` then, left out when 0, in this order:
  `New n` · `Sample given n` · `Quoted n` · `Won n Rs. <sum>` · `Lost n`. Nobody in the region did
  anything: the line says `No activity`. No closing line.
- **One block per current salesman of the region**, in `Rep_Mapping` order, every day the same
  (owner S12-8): `*<CODE>* · <N> activities` (`1 activity`), then his groups; a salesman with
  nothing that day: `*<CODE>* · no activity` (owner S12-1: the word is **activity**, never "saves").
- **Groups** (owner S12-4, S12-5), one line each, left out when empty, in this order, site names
  joined with `, `:
  1. `Won:` each site with its Rs.: `Askari Homes Rs. 42,250, Metro Plaza Rs. 18,700` (biggest
     first);
  2. `Lost:` each site with its reason: `DHA Plaza (Price Too High)`;
  3. `Quoted:` site names only (**no quote Rs.**, owner S12-2);
  4. `Sample given:` site names;
  5. `New:` sites he added that day;
  6. `Followed up:` every other site he worked that day (an Update with a note, a new follow-up
     date, a changed Rs., or a stage moved back), only if it is not already named in 1–5 (owner
     S12-9: a site added and updated the same day shows once, under New).
  Within a group (except Won), sites in the order they were first worked that day.
- **Never in the message** (owner S12-2, ADR-0012): quote Rs., Cash / Credit, notes, contact names
  or numbers, areas, another region's salesmen, the admin's own changes as anyone's activity (his
  same-day correction of a **won** Rs. is used as the Won amount, owner S12-10). **Snoozes, Edit details and
  contact changes are not activity** and never show (as "sites worked", S9-12).
- Names, reasons and codes from the sheet go through `waSafe_` (as the summaries), so a name can't
  switch on WhatsApp formatting; a line break or run of spaces typed in the sheet becomes one space.

## Rules
- **The day** = 00:00 to 24:00 Pakistan time (`Asia/Karachi`); each `Activity` row counts by its own
  time.
- **Who:** the region's **current** salesmen (`Rep_Mapping`, the kept copy), including one with no
  working link. A row counts for the person who saved it (`Activity.rep`), whoever owns the site now.
  Rows by the admin (`rep` = `admin`) and by codes no longer in `Rep_Mapping` never show.
- **Activity** (the count) = how many **different sites** he had a `created`, `stage_change` or
  `update` row on that day (the same as "sites worked", S9-12). The region's count = the sum of its
  salesmen's counts.
- **New** = sites with a `created` row by him that day.
- **Sample given / Quoted** = sites he moved to Sample / Trial / Rate Quoted that day (`created` at
  that stage or `stage_change` to it), as the summaries count them (spec 009).
- **Won / Lost** = as the day ended (the rule spec 009 uses for a finished period, S9-14), per
  site: the **last** `created` / `stage_change` row saved on that site that day, **by anyone**,
  moved it to Won (Order) / Lost / Dead, and **he** saved that row. If the admin or a former
  salesman made the last move, it is nobody's Won / Lost in the message; a salesman whose win was
  undone that day still shows the site in his other groups (Quoted, New, Followed up). Won Rs. =
  the last value saved on that site that day, by anyone (so the admin's same-day correction of a
  won amount is the one shown, owner S12-10; else the site's Rs. in `Sites`); the reason = the
  last lost reason saved that day (else the site's own). Won and reopened the same day: not Won.
- **Site name** = the site's name in `Sites` now; a site no longer in `Sites` shows as
  `(not in the sheet)`.
- **Totals** add up the salesmen's groups (a site Quoted and New counts in both, as in the blocks).

### Server
- **New public function `adminPageDaily(k, day)`**: `requireAdminLink_(k)` inside `forAdminPage_`.
  `day` is `''` (the last working day) or `yyyy-MM-dd` from 31 days ago to today; anything else
  gets *"Something went wrong. Try again in a minute."*, checked right after the link check.
  Reply: `{ day, prev, next, regions: [{ region, text }] }` (`next` blank on today, `prev` blank 31
  days back); the text is built **on the server** (as all summary text is) and tested word for word.
- **Reads:** Sales Diary opened once; `Links` (the link check), `Sites` once (names); `Activity`
  **from the bottom up** with `activitySince_` from the day's start (never whole); Meta-Data only
  through the kept copy. Rows after the day's end are read but not counted. **No writes**, no lock.
- **Public functions:** allow-list in `tests/menu.test.js` 20 → **21**.
- **The salesman's page gets nothing new** (zero bytes): the screen lives in `Admin.html`. The
  admin's served page pin may rise from 110,000 to at most **114,000** bytes (it is ~106.7 KB now).
  *Built:* the salesman's page grew by 34 bytes only (82,530 served: guards so a summary reply that
  comes after he left the Summary screen is kept, not drawn); the admin's ~111.7 KB, pin 111,800.
- **The page and the days** (review round 3: kept simple on purpose):
  - The server is the only source of days. The **Daily message** button opens on the day it opens
    on: it asks with `''` (once that day is known and kept for today's date, it shows at once); ‹ ›
    go to the reply's `prev` / `next`.
  - Every ask has a number; only the **latest** ask's reply or failure is acted on (a kept day
    shown at once also makes older asks void). Every reply is still kept for later, except today's.
  - The screen changes only when a reply comes: a day that can't be fetched leaves him on the day
    he had (text, pills, arrows), with *"Couldn't get Mon 9 Nov: no signal."* and **Try again**,
    which asks again for the day of the latest ask. Only an open with nothing on screen yet says
    *"Couldn't get the message: no signal. Try again."*
  - Only a *"(so far)"* text can go stale. A past day's text stays valid across midnight: kept past
    days are never cleared by a date change and he is never moved to another day. When the page's
    date has moved on (checked on a pill, Copy / Share, and coming back to the page) and the screen
    shows the old today, it asks again for **that same day** (now a whole day, no *"(so far)"*);
    Copy / Share of the stale text are held back until it comes (one tap later copies the whole day).
  - The **Refresh** button clears the kept days. The automatic refresh (after 10 minutes away) asks
    again only when today *"(so far)"* is on screen; on a past day it does nothing.
  - A seeded random browser test (`tests/browser/daily-random.check.js`, 300 sequences of 30 random
    taps, reply fates and midnights) checks these rules after every step.

## Data
- **No new tab, column or stored value; writes nothing.** Meta-Data only read, as always.
- [`data-model.md`](../architecture/data-model.md): unchanged.
- Glossary gains **Daily message** and **activity** (the count).

## Acceptance criteria
- [x] Day tests: the default day on every weekday (Monday → Saturday; Sunday → Saturday; Tuesday →
      Monday), the 1st of a month, 1 January; a row at 23:59 and 00:00 Pakistan time; ‹ / › limits
      (31 days back, today), today headed `(so far)`; a bad `day` refused.
- [x] Count tests: activity = different sites with created / stage_change / update; snoozes, Edit
      details and contact changes never counted or named; New; Sample given; Quoted; Won / Lost as
      the day ended (won then reopened: not Won; won twice: once; Rs. and reason the last of the
      day); Followed up lists only sites not named in Won / Lost / Quoted / Sample given / New; a stage
      moved back is Followed up; the admin's rows never show; a former salesman never shows; a
      handed-over site counts for whoever did the work; a site deleted by hand shows `(not in the
      sheet)`.
- [x] Exact text tests: a region with a busy salesman, one with a win and a loss, one with nothing
      (`No activity`), singular `1 activity`, every group in order, Won biggest first, `waSafe_` on
      names; totals equal the sum of the blocks.
- [x] Privacy tests (ADR-0012): the text never holds quote Rs., Cash / Credit, notes, contact names
      or numbers, areas, or another region's salesmen; `adminPageDaily` refuses a junk (no sheet
      opened), cancelled, or salesman's code with *"This link doesn't work."*; no `rep…` function
      or salesman page changes.
- [x] Speed tests: one Sales Diary open, `Sites` read once, `Activity` never read whole (5,000 old
      rows + 40 of the day: at most one block beyond the day plus the header), Meta-Data not opened
      with a fresh kept copy, no writes.
- [x] Browser check (360 px and 1280 px): Daily message on Today opens the screen on the last
      working day; ‹ / › step and name the days; the pills switch instantly; the text matches the
      server's; Share on WhatsApp is a `wa.me/?text=` link with the encoded text; Copy and its
      fallbacks; no signal; Back returns to Today; no sideways scroll; all existing checks pass.
- [x] `npm run check` and `npm run check:browser` green; served-size pins (salesman unchanged,
      admin ≤ 114,000).
- [ ] Live (agent, admin link): the three messages for a recent day match the sheet read through
      the connector.
- [ ] Live (owner): he pastes a message into a region group from his phone.

## Out of scope
- **Today's plan** in the message (owner S12-1: yesterday only, for now). The Plan tab has it.
- Sending automatically (e.g. every morning at 9), or posting to the group by the app (WhatsApp
  allows no posting from a web page; the owner pastes).
- A team-wide (all regions) message; salesmen making the message themselves.
- Showing who logged nothing as a separate call-out line (S12-8: the fixed order already shows it).
- Snoozes as a "Pushed back" line (S12-5: not chosen).
- Urdu labels.

## Open questions
_None._ All answered in the interview (S12-1 to S12-8) and at build (S12-9, S12-10). The agent's own choices (each can be
changed at review): the 31-day limit for ‹; Sundays reachable with the arrows; arrows allowed up
to today *(so far)*; the region's activity = the sum of its salesmen's; the admin's rows left out;
work counted for whoever saved it; the text shown on screen exactly as it will paste.

Choices made while building (each can be changed at review): `(so far)` sits inside the bold
heading (`*North · Thu 12 Nov (so far)*`); both arrows name their day the same way (**‹ Tue 10**,
**Thu 12 ›**); Followed up is every other site he worked, so a site he added and then updated the
same day is in **New** only (review round 1); a site moved to Rate
Quoted or Sample / Trial that day is Quoted / Sample given even if it moved on later that day (as
spec 009 counts them), so a site won, reopened and won again shows under Won and Quoted; Won / Lost
are decided per site by its final move that day by anyone (see Rules); a Won site with no Rs. at all
shows its name only; a site with no name shows its ID; the reply also carries `ok: true`, as every other reply.
The Share on WhatsApp / Copy row (and Copy's fallbacks) is the summary's own, moved onto this
screen while it shows; the only change to the salesman's page is the 34-byte Summary guard.

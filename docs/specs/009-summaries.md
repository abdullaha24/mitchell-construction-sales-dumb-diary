# 009: Weekly and monthly summaries (one tap, share on WhatsApp)

- **Status:** Draft
- **Owner approval:** _pending_ (interview done 2026-11-05, session 5: answers S9-1 to S9-12)
- **Related:** roadmap phase 7b (before the speed pass and launch, owner S9-2) ·
  [vision](../product/vision.md) · ADR-0004 (a salesman gets only his own data) · ADR-0006 /
  ADR-0010 (admin link) · [glossary](../product/glossary.md) → Summary · owner answers Q12c, P5-1,
  P5-2, P6-2, P7-1, P7-2, **S9-1 to S9-12** · builds on [spec 006](006-focus-tabs.md),
  [spec 007](007-card-helpers-areas.md), [spec 008](008-owner-screen.md)

## Why
Every **Friday** the salesmen each present their week to the owner, and once a month there is a
**business review**. Today they do it from memory. The diary already holds every save, so one tap
should give a salesman his week (or month) in plain words, ready to read out or send on WhatsApp,
and give the admin the same for the whole team. It is also a reason for salesmen to log
everything: **the app writes their Friday report for them.**

## What the salesman sees and does

### Opening his summary
- At the top of his page, beside his target, a button **Summary** (owner S9-10). His three tabs
  stay as they are.
- Tapping it opens the summary screen with four buttons across the top: **This week** ·
  **Last week** · **This month** · **Last month** (owner S9-5). **This week** is picked first.
- The page asks Google for that summary **only now** (one trip, a few seconds; opening the app is
  not slowed). Meanwhile: *"Getting your summary…"*. Each button fetches its own summary the first
  time it is tapped; tapping it again fetches it fresh.
- No signal: *"Couldn't get the summary: no signal. Try again."* with a **Try again** button. A
  summary already shown stays, with *"As of 10:42"*.
- If he has saves still **Saving…** or **Not saved** (orange), a line says *"2 saves not sent yet
  are not in this summary."*
- **Back** returns to his list as he left it.

### What it says (owner S9-7)
A heading with the days, Pakistan time:
- **This week:** *"This week so far · Sat 31 Oct – Wed 4 Nov"*. On a Friday:
  *"This week · Sat 31 Oct – Fri 6 Nov"*.
- **Last week:** *"Last week · Sat 24 Oct – Fri 30 Oct"*.
- **This month:** *"November so far · 1–5 Nov"*. **Last month:** *"October"*.

Then four parts:

1. **Numbers**
   - *New sites 4 · Sites worked 14*
   - *Samples given 2 · Quotes given 3 · Rs. 1,250,000*
   - *Won 2 · Rs. 450,000 · Lost 1*
   - *Rs. logged, not invoiced.*
   - **Month only** (owner S9-6): *"November target Rs. 12,345,000 · Won Rs. 450,000 (3%)"*. No
     target for that month: *"No target for November"* and no %. Weeks show no target (a week can
     cross two months).
2. **Named sites**: each **won** site (*"F-11 Commercial Tower · Rs. 450,000 Cash"*), each
   **quote given** (*"Bahria Villas · Rs. 800,000"*), each **lost** site with its reason
   (*"DHA Plaza · Price Too High"*). Up to 10 of each, biggest Rs. first, then *"+ 3 more"*.
   An empty list is left out.
3. **Coming up**: *"Hot sites 6 · Rs. 3,200,000 quoted"*, then his top 5 hot sites in the Hot
   Pipeline order (owner P5-1: Rate Quoted by Rs., biggest first, then Sample / Trial by soonest
   follow-up): *"Gulberg Heights · Rate Quoted · Rs. 1,200,000"*. Then *"Follow-ups due in the
   next 7 days: 9"*.
4. **Late & going cold**: *"Late 3 · Going cold 2"*, then the 3 biggest of those by Rs. (*"DHA
   Plaza · Rate Quoted · Rs. 600,000 · 5 days late"* / *"… · no update for 9 days"*). Nothing late
   or cold: *"Nothing late or going cold."*

**Coming up** and **Late & going cold** always show things **as they are now**, also under Last
week and Last month (the diary can't rebuild how a past day looked). The heading of these two
parts says *"Now"*.

### Sharing
- Under the summary: **Share on WhatsApp** and **Copy** (owner S9-3).
- **Share on WhatsApp** opens WhatsApp with the summary as the message, and he picks the chat
  (owner or team group). The message is the same text as the screen, short lines, headings in
  WhatsApp bold (`*Won*`), with his code and the days at the top:
  ```
  *RIA · Week Sat 31 Oct – Fri 6 Nov*
  New sites 4 · Sites worked 14
  Samples given 2 · Quotes given 3 · Rs. 1,250,000
  Won 2 · Rs. 450,000 · Lost 1
  (Rs. logged, not invoiced)

  *Won*
  • F-11 Commercial Tower · Rs. 450,000 Cash
  ...
  ```
- **Copy** puts the same text on the phone's clipboard (*"Copied"*), for when WhatsApp doesn't
  open from the page.
- **Nothing is saved** in the sheet when he views or shares (owner S9-11).

## What the admin sees and does
- A **Summary** button in his top bar (owner S9-10). His four tabs stay as they are.
- The same four buttons, the same loading, no-signal and *"As of"* behaviour, and the same
  *"not sent yet"* line for his own unsent Updates.
- **One trip** brings the whole team's summary for that period, so everything below (including
  each salesman's own summary) opens instantly and works with no signal.

### The team summary (owner S9-8)
1. **All salesmen**: the same **Numbers** as a salesman's, for the whole team. **Month only:**
   *"November target Rs. 45,000,000 · Won Rs. 4,200,000 (9%)"* (target = North + Center + South,
   as on the Team tab), and **House / office sales** *"November target Rs. 3,500,000 · Not logged in
   the diary."*
2. **One block per region** (North, Center, South): its Numbers; month: against its target.
3. **Salesmen side by side**: one line per salesman, North, Center, South in `Rep_Mapping` order:
   *"RIA · worked 14 · quotes 3 · Rs. 1,250,000 · won 2 · Rs. 450,000 · lost 1 · logged on 5 days"*;
   month: also *"3% of target"*. **Logged on … days** is shown **only here** (owner S9-9), never on
   the salesman's own page. A salesman with nothing in the period: *"AUR · nothing logged"*.
4. **Lost reasons**: *"Lost 9: Price Too High 6 · Site Delayed 2 · Other 1"*, most first.
5. **Coming up** and **Late & going cold** for the team (now): hot sites and Rs., follow-ups due in
   the next 7 days, late and going cold counts.

Sites whose salesman is **no longer in `Rep_Mapping`** are never dropped: they appear under a
**"Not in the salesmen list"** line, as on the Team tab.

- **Share on WhatsApp** / **Copy** share the team summary as one message.
- **Tapping a salesman** opens **exactly his summary** (the same text he sees) plus his
  *"Logged on 5 days"* line, with its own **Share on WhatsApp** / **Copy** and **Back** to the team.

## Rules
- **Time:** Pakistan time (`Asia/Karachi`), from Google's clock. A save at 23:59 Friday is in that
  week; one at 00:00 Saturday is in the next.
- **Periods** (owner S9-5, S9-4):
  - **This week** = from Saturday 00:00 (today, if today is Saturday) to now (owner S9-4:
    Saturday to Friday, so the week ends on meeting day and includes everything logged up to the
    moment he taps).
  - **Last week** = the full Saturday-to-Friday week before that.
  - **This month** = from the 1st, 00:00, to now. **Last month** = the whole previous month.
- **Who is counted for what:**
  - **Work** (new sites, sites worked, days logged) counts for the person who saved it: the
    `Activity.rep` code. The admin's saves (`rep` = `admin`) never count as anyone's work (P7-2,
    P7-5).
  - **Results** (samples, quotes, won, lost) count for the site's **current** salesman
    (`Sites.rep`), like the Team tab (P7-1): a site the owner handed over counts for the new
    salesman; a site the admin moved counts for the site's salesman.
- **New sites** = `Activity` rows with `action` = `created` in the period.
- **Sites worked** (owner S9-12) = how many **different** sites had a `created`, `stage_change` or
  `update` row in the period. **Snoozes and Edit details do not count** (as going cold, P6-2).
- **Days logged** (admin only) = how many different days in the period had **any** save by him,
  snoozes and Edit details included (the same "worked" as the Today tab, P7-2).
- **Samples given** = different sites **moved to** Sample / Trial in the period (`created` at that
  stage, or `stage_change` to it).
- **Quotes given** = different sites **moved to** Rate Quoted in the period (`created` at that
  stage, or `stage_change` to it). Rs. = the value on the latest such row in the period. *(See Open
  questions: a revised price on a site already at Rate Quoted is not counted again.)*
- **Won / Lost in a period** = the rule of spec 008 (P7-1) with the period in place of "this month":
  the site's stage **now** is Won (Order) / Lost / Dead **and** the latest row that moved it there
  is dated in the period. Its Rs. is the site's **current** `value_rs`; a lost site's reason is its
  current `lost_reason`. Won then reopened: not counted. A Won row typed by hand (no `Activity`
  row): not counted.
- **% of target** = Won Rs. ÷ target, rounded down, only when there is a target. Targets are read as
  the Team tab reads them (spec 001: missing, 0 or listed twice → no target), for the period's
  month.
- **Hot, late, going cold, follow-ups due** use the existing rules exactly (specs 006, 007, 008):
  hot = Sample / Trial or Rate Quoted; late = open and follow-up before today or none; going cold =
  spec 007 (7 days since `worked_at`); due in the next 7 days = an open site whose follow-up is
  today or within the 6 days after.
- **Privacy (ADR-0004):** a salesman's summary is built from **his own sites only** (by
  `Sites.rep`) and his own `Activity` rows; it never mentions another salesman, a team total or a
  region total. Region and house targets reach only the admin.

### Server
- **`repSummary(k, period)`** (new public function): `requireRep_(k)` inside `forSalesman_`;
  `period` must be one of `this-week`, `last-week`, `this-month`, `last-month` (anything else: the
  usual *"Something went wrong."*). Reply: his summary (the numbers, named sites, coming up, late &
  going cold) and the ready-made WhatsApp text. Only his own data.
- **`adminPageSummary(k, period)`** (new public function): `requireAdminLink_(k)` inside
  `forAdminPage_`; same periods. Reply: the team, region, salesmen-side-by-side and lost-reason
  parts, every salesman's own summary with his days logged, and the WhatsApp texts.
- Both build the text **on the server** in one shared function, so the salesman's page and the
  admin's page say exactly the same thing, the wording is tested, and the salesman's page gets very
  little new code (speed).
- **Reads:** Sales Diary opened **once**; `Sites` read once; `Activity` read **from the bottom up**
  in blocks (as spec 008's `monthActivity_`), stopping at the first block that reaches a row from
  before the period: Last month reads about two months of rows, never the whole tab. Meta-Data
  through the kept copy only. **No writes at all**, no lock.
- **Public functions:** allow-list in `tests/menu.test.js` 18 → **20**.

## Data
- **No new tab, no new column, nothing written** (owner S9-11). Meta-Data only read, as always.
- **Kept copy of targets** (Script Properties `salesmen`): now also keeps **last month's** salesman,
  region and house targets (today: this month and next month), so *Last month* can show its target
  without opening Meta-Data. A copy kept before this version is read again at once (as spec 006 and
  008 did). [`data-model.md`](../architecture/data-model.md) → "Kept by the script" is updated in
  the same change.

## Acceptance criteria
- [ ] Period tests: this week / last week / this month / last month start and end at the right
      moment in Pakistan time, including on a Saturday, a Friday at 23:59, the 1st of a month, a
      week crossing two months, and 1 January.
- [ ] Count tests, for each number: new sites, sites worked (snoozes and Edit details left out,
      one per site), days logged (any save), samples, quotes (Rs. from the latest move in the
      period), won and lost (P7-1 rule per period: won then reopened, won twice, won in the period
      before, hand-typed Won row, admin-moved site, handed-over site), lost reasons.
- [ ] Admin saves never count as work; their results count for the site's salesman.
- [ ] Month targets and %: this month and last month; no target → no %; weeks show no target; team
      target = North + Center + South; house target shown for the admin only.
- [ ] Coming up and Late & going cold match Hot Pipeline order and the Late & cold tab exactly.
- [ ] **Privacy tests:** `repSummary` for RIA, with sites and history of AUR and the admin in the
      sheet, contains nothing of AUR's (no site names, no counts, no Rs.) and no team or region
      figures; `repSummary` and `adminPageSummary` refuse a cancelled, junk, salesman-for-admin or
      admin-for-salesman code with "This link doesn't work." and open no sheet for junk; a bad
      `period` gets "Something went wrong."
- [ ] The WhatsApp text: exact wording tests for a salesman's week, a salesman's month and the
      team month; Rs. formatted `Rs. 1,250,000`; lists capped at 10 with "+ N more"; nothing
      starting with `=` or other text that could be read as a formula anywhere.
- [ ] Speed tests: each call opens Sales Diary once, reads `Sites` once, never reads `Activity`
      whole (e.g. 5,000 rows from before last month and 40 from last month: at most one block
      beyond the period plus the header), opens Meta-Data not at all with a fresh kept copy, and
      writes nothing.
- [ ] The kept copy holds last month's targets; an older copy is read again at once.
- [ ] Browser checks (salesman and admin): Summary opens the screen; the four buttons fetch and show
      their summary; no signal shows the message and keeps what was shown; "not sent yet" line;
      Share on WhatsApp opens a WhatsApp link holding the text; Copy works; Back returns to the
      list at the same place; tapping a salesman on the admin's summary shows his summary with the
      days-logged line.
- [ ] Salesman's page: opening the app makes no new trip to Google; the served page grows by at
      most a few KB (pinned), so the speed pass that follows starts from a known size.
- [ ] Live check with the TEST rows (owner S9-1): RIA's This week and This month match the sheet
      read through the connector; the admin's month numbers match the Team and This month tabs; the
      WhatsApp button opens WhatsApp on the owner's phone with the text.
- [ ] Docs updated: glossary (Summary), data model (kept copy), open questions (S9-1 to S9-12),
      AGENTS.md (20 public functions), roadmap, handoff.

## Out of scope
- Sending summaries automatically (e.g. every Friday night), reminders to send them.
- PDF or image summaries; charts.
- Saving summaries in the sheet (owner S9-11).
- Periods before last week / last month, or picking any date range.
- Salesmen seeing anyone else's figures, rankings or team totals (ADR-0004).
- Achieved vs target on the salesman's **main page** (still target only, Q12c); only his summary
  shows it.
- Invoiced figures, payment recovery (ugrahi), dealer repeat orders.
- Urdu labels.

## Open questions
- **S9-13 Revised quotes.** A salesman re-quotes a site that is already at Rate Quoted (a new Rs.
  value, same stage). Should that count as another **quote given**? The history writes the Rs.
  value on every Update at Rate Quoted, even when the price didn't change, so telling a new price
  from an unchanged one would mean reading history from before the period, without limit.
  **Recommended: no**, a quote counts when a site moves to Rate Quoted (or is added at it); the
  revised price still shows wherever the site's current Rs. is used (Won, Coming up). *(At the
  interview the agent had proposed counting revised prices too; this was found when checking the
  history format.)*

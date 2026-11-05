# 009: Weekly and monthly summaries (one tap, share on WhatsApp)

- **Status:** Draft
- **Owner approval:** _pending_ (interview 2026-11-05, session 5: answers S9-1 to S9-12; after an
  adversarial review, S9-13 to S9-15)
- **Related:** roadmap phase 7b (before the speed pass and launch, owner S9-2) ·
  [vision](../product/vision.md) · ADR-0004 (a salesman gets only his own data) · ADR-0006 /
  ADR-0010 (admin link) · [glossary](../product/glossary.md) → Summary · owner answers Q12c, P5-1,
  P5-2, P6-2, P7-1, P7-2, **S9-1 to S9-15** · builds on [spec 006](006-focus-tabs.md),
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
- **This month:** *"November so far · 1–5 Nov"* (on the 1st: *"November so far · 1 Nov"*).
  **Last month:** *"October"*.

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
   (*"DHA Plaza · Price Too High"*). Up to 10 of each, biggest Rs. first, then a line *"+ 3 more"*.
   An empty list is left out. The Rs. shown is the one the Rules give for that number (a quote: the
   Rs. it was quoted at; a win: see Won / Lost).
3. **Coming up**: *"Hot sites 6 · Rs. 3,200,000 quoted"*, then his top 5 hot sites in the Hot
   Pipeline order (owner P5-1: Rate Quoted by Rs., biggest first, then Sample / Trial by soonest
   follow-up): *"Gulberg Heights · Rate Quoted · Rs. 1,200,000"*. Then *"Follow-ups due in the
   next 7 days: 9"*.
4. **Late & going cold**: *"Late 3 · Going cold 2"* (the same counts as the admin's Late & cold
   rules), then the 3 biggest of those by Rs., biggest first (*"DHA
   Plaza · Rate Quoted · Rs. 600,000 · 5 days late"* / *"… · no update for 9 days"*). Nothing late
   or cold: *"Nothing late or going cold."*

**Coming up** and **Late & going cold** always show things **as they are now** (the diary can't
rebuild how a past day looked). On screen they show under every button, headed *"Now, 5 Nov"*. In
the **shared text** they are included for This week / This month only, and **left out for Last week
/ Last month** (owner S9-15), so a message headed *"October"* holds only October's figures.

### Sharing
- Under the summary: **Share on WhatsApp** and **Copy** (owner S9-3).
- **Share on WhatsApp** opens WhatsApp with the summary as the message, and he picks the chat
  (owner or team group). The message is the same text as the screen, short lines, headings in
  WhatsApp bold (`*Won*`, fixed headings only), with his code and the screen's heading at the
  top:
  ```
  *RIA · This week · Sat 31 Oct – Fri 6 Nov*
  New sites 4 · Sites worked 14
  Samples given 2 · Quotes given 3 · Rs. 1,250,000
  Won 2 · Rs. 450,000 · Lost 1
  (Rs. logged, not invoiced)

  *Won*
  • F-11 Commercial Tower · Rs. 450,000 Cash
  ...
  ```
- **Copy** puts the same text on the phone's clipboard (*"Copied"*), for when WhatsApp doesn't
  open from the page. The page runs inside Google's frame, where the phone may refuse the modern
  clipboard, so Copy tries, in order: the clipboard; the older select-and-copy; and if both are
  refused, shows the text selected with *"Press and hold the text, then tap Copy."*
- **Share on WhatsApp** is a plain link, `https://wa.me/?text=` + the text encoded with
  `encodeURIComponent` (newlines kept), opened in a new tab like the card's WhatsApp button
  (`target="_blank"`, `rel="noopener"`). No phone share sheet (not allowed inside Google's frame).
- **Nothing is saved** in the sheet when he views or shares (owner S9-11).

## What the admin sees and does
- A **Summary** button in his top bar (owner S9-10). His four tabs stay as they are.
- The same four buttons, the same loading, no-signal and *"As of"* behaviour, and the same
  *"not sent yet"* line for his own unsent Updates.
- **One trip** brings the whole team's summary for that period, so everything below (including
  each salesman's own summary) opens instantly and works with no signal.

### The team summary (owner S9-8)
The shared text starts *"*Team · This week · Sat 31 Oct – Fri 6 Nov*"* (or *"*Team · October*"*).
1. **All salesmen**: the same **Numbers** as a salesman's, for the current salesmen together
   (North + Center + South, as the Team tab adds up). **Month only:**
   *"November target Rs. 45,000,000 · Won Rs. 4,200,000 (9%)"* (target = North + Center + South,
   as on the Team tab), and **House / office sales** *"November target Rs. 3,500,000 · Not logged in
   the diary."*
2. **One block per region** (North, Center, South): its salesmen's Numbers; month: against its
   target. A salesman's region is his region in `Rep_Mapping` (the kept copy), never the
   `Sites.region` cell, so a region always equals the sum of its salesmen's lines.
3. **Salesmen side by side**: one line per salesman, North, Center, South in `Rep_Mapping` order:
   *"RIA · worked 14 · quotes 3 · Rs. 1,250,000 · won 2 · Rs. 450,000 · lost 1 · logged on 5 days"*;
   month: also *"3% of target"*. **Logged on … days** is shown **only here** (owner S9-9), never on
   the salesman's own page. A salesman with nothing in the period: *"AUR · nothing logged"*.
4. **Lost reasons**: *"Lost 9: Price Too High 6 · Site Delayed 2 · Other 1"*, most first.
5. **Coming up** and **Late & going cold** for the team (now): hot sites and Rs., follow-ups due in
   the next 7 days, late and going cold counts. These count **every** open site, as the Late & cold
   tab does (also sites of a code no longer in the salesmen list).

Codes **no longer in `Rep_Mapping`** (someone who left, before the owner hands their sites over)
are never dropped: a **"Not in the salesmen list"** line per code holds the results of sites still
under that code and the work rows saved by it. As on the Team tab, they are **not** in All salesmen
or the regions. **Team "Sites worked"** counts each site once, so it can be less than the salesmen's
lines added up (a site worked by two people, e.g. handed over in the week).

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
  - Every period runs from its start **up to, not including,** the next period's start: a save at
    Saturday 00:00 is in this week, not last week. Rows after a past period's end (this week's,
    under Last week) are read but never counted in it.
- **Who is counted for what:**
  - **Work** (new sites, sites worked, days logged) counts for the person who saved it: the
    `Activity.rep` code. The admin's saves (`rep` = `admin`) never count as anyone's work (P7-2,
    P7-5).
  - **Results** (samples, quotes, won, lost) count for the site's **current** salesman
    (`Sites.rep`), like the Team tab (P7-1): a site the owner handed over counts for the new
    salesman; a site the admin moved counts for the site's salesman. So results are found by
    `Sites.rep` (whoever wrote the row), work by `Activity.rep`.
  - An `Activity` row whose site is no longer in `Sites` (deleted by hand) counts as work only,
    never as a result or a named site.
- **New sites** = `Activity` rows with `action` = `created` in the period.
- **Sites worked** (owner S9-12) = how many **different** sites had a `created`, `stage_change` or
  `update` row in the period. **Snoozes and Edit details do not count** (as going cold, P6-2).
- **Days logged** (admin only) = how many different days in the period had **any** save by him,
  snoozes and Edit details included (the same "worked" as the Today tab, P7-2).
- **Samples given** = different sites **moved to** Sample / Trial in the period (`created` at that
  stage, or `stage_change` to it).
- **Quotes given** = different sites **moved to** Rate Quoted in the period (`created` at that
  stage, or `stage_change` to it). Rs. = the value on the latest such row in the period (every such
  row carries one: a value is required at Rate Quoted). A **revised price** on a site already at
  Rate Quoted is **not** another quote (owner S9-13).
- **Won / Lost in a period:**
  - **This week / This month** (still running): exactly spec 008's rule (P7-1), so the numbers
    always match the Team and This month tabs: the site's stage **now** is Won (Order) / Lost /
    Dead **and** the latest row that moved it there is in the period; Rs. = the site's **current**
    `value_rs`; reason = its current `lost_reason`.
  - **Last week / Last month** (finished): **as the period ended** (owner S9-14), so a summary
    shared on Friday still says the same on Monday. A site is won (lost) in that period when the
    **last** `created` / `stage_change` row for it **inside the period** moved it to Won (Order)
    (Lost / Dead). Rs. = the last value saved for that site inside the period (the Won row's, or a
    later Update in the period that corrected it); reason = the last lost reason saved inside the
    period. What happened after the period (reopened, lost, re-priced) doesn't change it: won on
    29 Oct and lost on 3 Nov counts as won in October and lost in November.
  - Either way: won then reopened in the same period: not counted. A stage typed into the sheet by
    hand (no `Activity` row) is never counted.
- **% of target** = Won Rs. ÷ target, rounded down, only when there is a target. Targets are read as
  the Team tab reads them (spec 001: missing, 0 or listed twice → no target), for the period's
  month.
- **Hot, late, going cold, follow-ups due** use the existing rules exactly (specs 006, 007, 008):
  hot = Sample / Trial or Rate Quoted; late = open and follow-up before today or none; going cold =
  spec 007 (7 days since `worked_at`); due in the next 7 days = an open site whose follow-up is
  today or within the 6 days after.
- **Privacy (ADR-0004):** a salesman's summary is built from **his own sites** (`Sites.rep`) and
  **his own work rows** (`Activity.rep`). A row by the admin or by an earlier salesman on a site
  that is now his counts as a result of that site, with no mention of who wrote it. It never
  mentions another salesman, another salesman's site, a team total or a region total. Region and
  house targets reach only the admin.
- **Revised prices from now on** (owner S9-13): an `update` row (same stage) carries `value_rs` and
  `payment_terms` **only when they changed**, so re-quotes can be counted in a later version.
  `created` and `stage_change` rows are unchanged. This is the only write change in this spec
  (`saveUpdate_`, salesman's and admin's Updates alike); the admin's Today feed then shows Rs. on
  an Update only when the price changed (also its own instant line, `src/Admin.html`). Rows saved
  before this version keep the value either way; nothing is rewritten.

### Server
- **`repSummary(k, period)`** (new public function): `requireRep_(k)` inside `forSalesman_`;
  `period` must be one of `this-week`, `last-week`, `this-month`, `last-month` (anything else: the
  usual *"Something went wrong. Try again in a minute."*). Reply: his summary (the numbers, named
  sites, coming up, late & going cold) and the ready-made WhatsApp text. Only his own data. His
  month target comes from the kept copy, read by this function itself (the link check gives this
  month's only), and only his own amount is returned.
- **`adminPageSummary(k, period)`** (new public function): `requireAdminLink_(k)` inside
  `forAdminPage_`; same periods. Reply: the team, region, salesmen-side-by-side and lost-reason
  parts, every salesman's own summary with his days logged, and the WhatsApp texts.
- Both build the text **on the server** in one shared function, so the salesman's page and the
  admin's page say exactly the same thing, the wording is tested, and the salesman's page gets very
  little new code (speed).
- **Reads:** Sales Diary opened **once**; `Sites` read once; `Activity` read **from the bottom up**
  in blocks (as spec 008's `monthActivity_`), stopping at the first block that reaches a row from
  before the period: Last month reads about two months of rows (~6,500 at today's estimate of
  ~3,000 a month, about 13 reads of 500), never the whole tab. A larger block may be used if it
  measures faster. Meta-Data through the kept copy only. **No writes at all**, no lock.
- Saves take Google's time just before the lock, so two saves can land a few seconds out of order
  in `Activity`. Harmless: a period boundary is never decided by a block edge alone.
- **Public functions:** allow-list in `tests/menu.test.js` 18 → **20**.

## Data
- **No new tab, no new column; summaries write nothing** (owner S9-11). Meta-Data only read, as
  always.
- **`Activity` `update` rows** carry `value_rs` / `payment_terms` only when they changed (owner
  S9-13, Rules above). [`data-model.md`](../architecture/data-model.md) → `Activity` is updated in
  the same change.
- **Kept copy of targets** (Script Properties `salesmen`): now also keeps **last month's** salesman,
  region and house targets (today: this month and next month), so *Last month* can show its target
  without opening Meta-Data. The copy gets a new part, `months` (the three months it holds); a copy
  without `months`, or whose `months` lacks last month, is read again at once (today's check looks
  only for `targets` and `regionTargets`, which a spec 008 copy already has, so without this marker
  Last month would show "No target" for up to a day after the update). `data-model.md` → "Kept by
  the script" is updated in the same change.

## Acceptance criteria
- [ ] Period tests: this week / last week / this month / last month start and end at the right
      moment in Pakistan time, including on a Saturday, a Friday at 23:59, a save at Saturday 00:00
      (this week, not last), the 1st of a month, a week crossing two months, and 1 January.
- [ ] Count tests, for each number: new sites, sites worked (snoozes and Edit details left out,
      one per site), days logged (any save), samples, quotes (Rs. from the latest move in the
      period; a revised price not counted), won and lost (this week / month: the P7-1 rule, equal to
      the Team and This month tabs; last week / month: as the period ended, e.g. won 29 Oct then
      lost 3 Nov = won in October and lost in November, re-priced after the period keeps the
      period's Rs.; won then reopened in the period, won twice, hand-typed stage, admin-moved site,
      handed-over site), lost reasons, a row whose site was deleted by hand.
- [ ] Admin saves never count as work; their results count for the site's salesman.
- [ ] Team: All salesmen = North + Center + South = the salesmen's lines (results); regions by
      `Rep_Mapping`; a code not in the salesmen list gets its own line and is in neither; team
      Sites worked counts a site worked by two people once.
- [ ] Revised prices: an Update at the same stage with an unchanged Rs. writes blank `value_rs` /
      `payment_terms` in `Activity`; a changed one writes both; stage changes and new sites as
      before; the admin's Today feed shows Rs. on an Update only when it changed. Existing update,
      interleave and feed tests still pass.
- [ ] Month targets and %: this month and last month; no target → no %; weeks show no target; team
      target = North + Center + South; house target shown for the admin only.
- [ ] Coming up matches the Hot Pipeline order; the Late and Going cold **counts** match the Late &
      cold tab's rules; the 3 named are the biggest Rs. Under Last week / Last month the shared
      text leaves both parts out; the screen shows them headed "Now, <today>".
- [ ] **Privacy tests:** `repSummary` for RIA, with sites and history of AUR and the admin in the
      sheet, contains nothing of AUR's (no site names, no counts, no Rs.) and no team or region
      figures; `repSummary` and `adminPageSummary` refuse a cancelled, junk, salesman-for-admin or
      admin-for-salesman code with "This link doesn't work." and open no sheet for junk; a bad
      `period` gets "Something went wrong. Try again in a minute."
- [ ] The WhatsApp text: exact wording tests for a salesman's week, a salesman's month (also on the
      1st), a past week and the team month; Rs. formatted `Rs. 1,250,000`; lists capped at 10 with a
      "+ N more" line. On the page, site names, notes and lost reasons are shown as text, never as
      HTML (as everywhere in the app), and the WhatsApp link encodes the whole text.
- [ ] Speed tests: each call opens Sales Diary once, reads `Sites` once, never reads `Activity`
      whole (e.g. 5,000 rows from before last month and 40 from last month: at most one block
      beyond the period plus the header), opens Meta-Data not at all with a fresh kept copy, and
      writes nothing.
- [ ] The kept copy holds last month's targets and `months`; a spec 008 copy (no `months`) and a
      copy whose months don't include last month are read again at once; the 1st of a month rolls
      over without a refresh.
- [ ] Browser checks (salesman and admin): Summary opens the screen; the four buttons fetch and show
      their summary; no signal shows the message and keeps what was shown; "not sent yet" line;
      Share on WhatsApp is a `wa.me/?text=` link holding the encoded text; Copy falls back to
      "Press and hold" when the clipboard is refused; Back returns to the list at the same place;
      tapping a salesman on the admin's summary shows his summary with the days-logged line; the
      Summary button fits the top line at 360 px on both pages.
- [ ] Salesman's page: opening the app makes no new trip to Google; `src/App.html` stays at or
      under **88,000 bytes** (83,042 today), pinned by a test, so the speed pass starts from a
      known size.
- [ ] Live check with the TEST rows (owner S9-1): RIA's This week and This month match the sheet
      read through the connector; the admin's month numbers match the Team and This month tabs; on
      the owner's phone **inside Google's frame**, Share on WhatsApp opens WhatsApp with the text and
      Copy copies it (or shows "Press and hold").
- [ ] Docs updated: glossary (Summary), data model (kept copy, `Activity` update rows), open
      questions (S9-1 to S9-15),
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
_None._ Answered after the adversarial review (2026-11-05): S9-13 revised prices (not counted;
changed values recorded from now), S9-14 past periods (as the period ended), S9-15 "Now" parts (left
out of past periods' shared text). See [open questions](../product/open-questions.md).

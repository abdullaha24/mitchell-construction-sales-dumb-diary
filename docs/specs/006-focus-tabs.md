# 006: Focus tabs (Today's Chase, Hot Pipeline, All My Parties) and his target

- **Status:** Done (live 2026-11-04, session 4, deployment version 7)
- **Owner approval:** approved by the owner on 2026-11-04 (session 4)
- **Related:** roadmap phase 5 · [vision](../product/vision.md) → Home screen · ADR-0004 (his own
  data only) · ADR-0005 (Meta-Data read only) · [glossary](../product/glossary.md) → App screens ·
  builds on [spec 003](003-my-sites.md), [spec 004](004-update-site.md), [spec 005](005-faster-saves.md)

## Why
Today his page is one long list, newest first. In the morning he has to scroll it to find who he
promised to call. Phase 5 answers his first two questions the moment he opens the app (vision):
**"Who did I promise to call today?"** and **"Which of my quotes are close to an order?"**, lets
him find any party in two seconds, and shows **his monthly target**.

## What the salesman sees and does

### The top of his page
- His code, and under it, small: **"November target: Rs. 1,740,000"** (his own target for this
  month in Pakistan time, from the owner's `Rep-Targets`). **Target only, no achieved figure**
  (owner, Q12c). If the owner has no target for him this month, the line is not shown.
- **+ New Site**, as today.
- Three tabs, each with how many sites it holds: **Today's Chase** · **Hot Pipeline** · **All My
  Parties**. The app always opens on **Today's Chase**.

### Today's Chase (his morning call list)
- Every site whose **follow-up date is today or earlier**. Won and Lost sites have no follow-up
  (owner, P4-3), so they never appear.
- **Oldest overdue first**, then today's. Same day: newest site first.
- Overdue cards have a **red edge** and say, in red, **"2 days late"** (or "1 day late"). Today's
  say **"Today"**.
- An open site with **no follow-up date** (only possible if someone clears the date in the sheet)
  shows at the very top as **"No follow-up date"**, so it can't be forgotten.
- Nothing due: *"Nothing to chase today."* and, if he has one, *"Next follow-up: 6 Nov."*
- When he updates a site and picks a new date, it **leaves Today's Chase at once** (it's done for
  today).

### Hot Pipeline (his near-term orders)
- Every site at **Sample / Trial** or **Rate Quoted**.
- **Biggest Rs. first** (owner, P5-1): Rate Quoted sites with a value, largest first. Then the
  rest (Sample / Trial, whose value isn't shown), **soonest follow-up first**.
- Each card shows its Rs. value and Cash / Credit when it has one (as today), and its follow-up
  date (red if late).
- Nothing there: *"No sites at Sample / Trial or Rate Quoted."*
- **No total Rs.** at the top (owner, P5-2): target only, as for the rest of his page.

### All My Parties (everything, with search)
- Every site he owns, Won and Lost included, **newest first** (as his list is today).
- A **search box** at the top: *"Search name, phone, area…"*. Results update as he types.
  - It looks in: site / party name, contact name, phone number, area, buyer type, products,
    stage and the last note.
  - Capitals, spaces and dashes don't matter (**"f11"** finds **"F-11 Commercial Tower"**); several
    words find sites that have all of them, in any order (**"asif dha"**).
  - A phone number matches however he types it: **0300 123**, **0300123** or **92300123** (a search
    of only digits, 7 or more, is one number; fewer, like **"66 71"**, are separate numbers).
  - Nothing found: *"No site matches "xyz"."* An **✕** clears the search.

### All tabs
- Cards look and open exactly as today (tap → site screen → Update / Edit details).
- **A save that didn't go through is never hidden:** an orange "Not saved. Tap to try again."
  card shows **at the top of every tab** until he fixes it (a site he just moved out of Today's
  Chase could otherwise vanish from view with its failed save).
- After **+ New Site → Save** he lands on **All My Parties** with the search cleared, so he sees
  the new site at the top with "Saving…". After an **Update** (or **Back**) he goes back to the
  tab he came from, **at the same place** in the list.
- **Long lists stay fast on a cheap phone:** each tab shows its first 50 cards and a **Show more**
  button for the next 50.
- **The day rolls over by itself.** "Today" is Pakistan time, worked out from Google's clock when
  the page loaded (so a wrong phone clock doesn't matter). If he leaves the app open overnight,
  Today's Chase is right the next morning when he comes back to it.

### For the owner
- The salesman's target comes from **`Rep-Targets`**, the same numbers **Check setup** shows.
- When he changes a target, salesmen see it **within a day**, or at once after **Sales Diary →
  Refresh salesmen & targets** (today's *Refresh salesmen*, renamed) or **Check setup**.

## Rules
- **Today's Chase:** stage is not Won (Order) or Lost / Dead, and follow-up date ≤ today (Pakistan
  time), or no follow-up date. Sorted: no date first, then follow-up date oldest first, then newest
  site first.
- **Days late** = today − follow-up date, in whole days (Pakistan time).
- **Hot Pipeline:** stage is Sample / Trial or Rate Quoted. Sorted: Rate Quoted with a value
  first, biggest value first; then the rest by follow-up date (no date first, then oldest first);
  ties: newest site first.
- **All My Parties:** all his sites. Search: every typed word (lower case, letters and digits
  only) must appear in the site's search text (the fields above, same clean-up). For a phone
  number the search text holds both the stored form (`923001234567`) and the way he knows it
  (`03001234567`).
- **Target:** his `Rep-Targets` amount for the current month (Pakistan time), read exactly as Check
  setup reads it (spec 001 rules: a missing row, 0, or the month listed twice → no target). He
  only ever receives **his own** target (ADR-0004); region and house / office targets never
  reach a salesman's page.
- **Speed:**
  - Tabs, counts and search all work **on the phone** from the data the page already has: no extra
    trip to Google when he switches tab or searches.
  - Opening the app still opens the Sales Diary sheet once and **never opens Meta-Data** while the
    kept copy is fresh. The target is kept together with the salesmen list (spec 005): read from
    Meta-Data at most once a day, or when the owner refreshes or runs Check setup.
  - A save's reply still carries only the changed card.

## Data
- **No sheet changes.** Reads `Rep-Targets` (`Rep`, `Month`, `Target`) as Check setup does; never
  writes to Meta-Data.
- **Kept by the script:** the Script Properties entry `salesmen` also holds **this month's and
  next month's target per current salesman** (whole Rs.), so the 1st of the month rolls over
  without a refresh. Script Properties can only be seen by the script's owner. The data model's
  "Kept by the script" table is updated.
- **Page data** (what his page receives): adds `target` (`{ month: 'yyyy-MM', amount }` or none)
  and Google's clock time (`now`). No other salesman's data.

## Acceptance criteria
Checked locally:
- [x] Tests for every rule above: Today's Chase (overdue / today / future / no date / Won / Lost),
      its order, days late, Hot Pipeline, search (words, dashes, capitals, phone forms), the
      target (his only, this month, none, month roll-over, broken `Rep-Targets` still lets him in).
- [x] The speed test still passes: opening the app opens Sales Diary once and Meta-Data not at all
      when the kept list is fresh.
- [x] Browser check at 360 px: tabs and counts, Today's Chase order and red late cards, Hot
      Pipeline, search, failed save on every tab, Show more, new site lands on All My Parties, day
      rollover with the page left open.
- [x] `npm run check` (269 tests) and `npm run check:browser` (5 checks) pass on a fresh clone;
      independent review: nothing serious; three small findings fixed with checks (a saved site keeps
      its place in the list; short number searches; the empty-tab message under a failed save).

Checked live (2026-11-04, the agent drove RIA's test link in Chromium at phone size, at the
owner's request; TEST rows deleted afterwards with his OK):
- [x] Today's Chase: a TEST site moved to 3 days ago showed first, red edge, "1 Nov · 3 days late";
      one due today showed "Today"; the tab count was red. Updating the late one to 3 days took it
      off the list at once (confirmed by Google 2.4 s later).
- [x] The target shown (Rs. 13,800,000) matches RIA's November 2026 row in `Rep-Targets`.
- [x] Search found TEST sites by name, phone (0300… and 92…), area and stage; Hot Pipeline had the
      Rs. 500,000 quote first. Saves: back on the list in ~0.3 s, confirmed in 2–5 s.
- [x] Found live and fixed (version 7): a long target line pushed "+ New Site" onto two lines on a
      360 px phone; now one line, checked in `tabs.check.js`.

## Out of scope
- Achieved vs target for salesmen (owner, Q12c; later).
- Call / WhatsApp buttons, last-spoken line, going cold, snooze, area filter (phase 6).
- The owner screen (phase 7).

## Open questions
_None open._ Answered by the owner on 2026-11-04 (session 4):
1. **(P5-1)** Hot Pipeline order: **biggest Rs. first**; sites with no value shown come after,
   soonest follow-up first.
2. **(P5-2)** A total Rs. at the top of Hot Pipeline: **no**, target only.

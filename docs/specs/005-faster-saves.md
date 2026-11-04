# 005: Instant saves, faster server, stage when adding a site

- **Status:** In progress (built, reviewed and tested locally 2026-11-04; going live next)
- **Owner approval:** approved by the owner on 2026-11-04 (session 3)
- **Related:** roadmap phase 4b (from the owner's phase 4 test) · builds on
  [spec 003](003-my-sites.md) and [spec 004](004-update-site.md) · ADR-0004 · data model

## Why
The owner tested phase 4 on his phone (2026-11-04) and found two problems:
1. **Adding a site, then reopening it to set the stage, is two jobs.** He should capture the
   lead and its stage (quote, win, loss) in one go.
2. **A save takes 4–5 seconds.** It should feel instant.

Measured on the live app the same day (anonymous requests, no real data):
- **~1 second** is Google's own overhead on every request. It can't be removed.
- **~0.6 seconds** more to open the Sales Diary sheet and read `Links`.
- One "add site" call today opens Sales Diary **3 times** and Meta-Data **once**, reads `Lists`
  **3 times** and `Sites` **twice**, then sends back his **whole list**. Updates are similar.

## What the salesman sees and does

### Saves feel instant (owner, P4b-2)
- He taps **Save** and is **straight back on his list**. The site shows at once, marked
  **"Saving…"** in grey, while it is sent in the background. He can carry on working.
- When Google confirms (a couple of seconds), "Saving…" disappears. A duplicate-number warning,
  if any, shows then as a message.
- If it fails (no signal, busy, a problem with what he typed), the card turns orange: **"Not
  saved. Tap to try again."** Tapping it reopens the form exactly as he left it, with the reason.
  Nothing he typed is lost, even if he closes the app (it stays on the phone, as today), and
  even on a phone that blocks storage (each unsaved save keeps its own copy while the app is
  open). **Back keeps it** in the list as not saved. *(Added after review.)*
- On a very weak signal, after 30 seconds the card says **"Still sending…"**; only after 2
  minutes does it count as not saved, and only then is the next save sent, so saves never
  overtake each other. A "saved" answer that arrives later still counts. *(Added after review.)*
- **Reopening the app with saves it never heard back about:** it first asks Google which of them
  landed (this sends nothing new). Those disappear quietly; the rest show *"Not sent: the app was
  closed."* *(Added after review.)*
- A newer save of the same site replaces an older one that failed.
- Saves are sent **one at a time, in order**, and only while the app is open: nothing is sent
  later on its own (owner, P3-3).
- A brand-new site that is still "Saving…" can't be opened yet (it has no ID until Google
  confirms). Tapping it says *"Still saving. One moment."*

### Stage when adding a site (owner, P4b-1)
+ New Site gets the same **Stage** buttons as Update, with **Visited / Lead** pre-picked, and the
same extra fields as Update when he picks another stage:
- **Rate Quoted / Won (Order):** total Rs. value + Cash / Credit, required.
- **Lost / Dead:** a reason, required (Other needs a note).
- **Sample / Trial, Rate Quoted, Won (Order):** the **phone number is required** (owner, P3-4).
  The "Save without a number?" second tap only applies to Visited / Lead and Lost / Dead.
- **Won / Lost:** no follow-up.
- A **Quick note** field (optional; needed for Other).

### For the owner
- **Sales Diary → Refresh salesmen** (new menu item): re-reads `Rep_Mapping` now. Check setup
  does the same.

## Rules

### Server speed
- Each call opens the Sales Diary sheet **once** and reads each tab **at most once** (the save
  itself still re-reads, inside the lock, what it must check against).
- **The salesmen list (`Rep_Mapping`) is kept by the app for 24 hours** (owner, P4b-3: it
  rarely changes), and refreshed at once by **Refresh salesmen** or **Check setup**. So a
  salesman removed from `Rep_Mapping` can keep using his link for up to 24 hours unless the
  owner refreshes or **cancels his link** (cancelling still works instantly: `Links` is read on
  every call).
- A save's reply carries **only the saved site's card** (and a new area, if one was added),
  not his whole list.

### Adding a site with a stage
- The same checks as Update (spec 004) apply to the chosen stage, value, terms, lost reason,
  follow-up and note. The site starts at that stage; its `created` row in `Activity` records the
  stage, value, terms, reason and note.

### Safety (unchanged rules, one new public function)
- New public functions `menuRefreshSalesmen` (owner-only, like Check setup) and
  `repSaveStatus(k, saveIds)` (which of **his** saves landed; reads only, keyed by his code).
  Allow-list: 14.
- The **Links window** also refreshes the kept salesmen list, so a salesman the owner has just
  added can use his new link at once; Check setup refreshes it even if a targets tab has a
  problem. A save is remembered for repeats only after the sheet has taken it. *(Added after
  review.)*
- Everything else as in specs 003–004: his own sites only, text stored as text, checks inside
  the lock, one-time save IDs.

## Data
- **Writes:** as specs 003–004. New: the salesmen list kept in the script's own storage
  (Script Properties: codes and regions only, no amounts, no link codes).
- **Data model:** `Activity` `created` rows may now carry a stage other than Visited / Lead,
  with value, terms, reason and note.

## Acceptance criteria
Checked locally:
- [x] Tests for every rule; `npm run check` (260 tests) and `npm run check:browser` (4 checks) pass on a fresh clone.
- [x] A test counts sheet opens and tab reads per call: Sales Diary once; Meta-Data not at all
      when the salesmen list is fresh. (Add site: 4 opens / 8 reads → 1 / 4; update 4 / 7 → 1 / 4.)

Checked live with the owner:
- [ ] Measured: a save is confirmed by Google in about half today's time (agent times it).
- [ ] On his phone: Save returns to the list at once with "Saving…", which clears.
- [ ] Add a site straight to Rate Quoted with a value; and one straight to Won; both correct in
      `Sites` and `Activity`.
- [ ] Refresh salesmen works from the menu.

## Out of scope
- Sending saves later when the app is closed (owner chose not to, P3-3).
- Making Google's ~1 second per request faster (not in our control).

## Open questions
_None open._ Answered by the owner on 2026-11-04 (session 3):
1. **(P4b-1)** Stage when adding a site: **yes**, capture the lead and its stage together.
2. **(P4b-2)** Saves: **instant**, finished in the background; failures shown on the card.
3. **(P4b-3)** Salesmen list: **keep it longer** (it seldom changes), with a **refresh button in
   the sheet menu**. Agent chose 24 hours + Refresh salesmen + Check setup.

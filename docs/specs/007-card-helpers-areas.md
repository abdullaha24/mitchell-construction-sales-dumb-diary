# 007: Site card helpers (Call, WhatsApp, last note, going cold, snooze) and the area filter

- **Status:** In progress (built and checked locally 2026-11-04; not live yet)
- **Owner approval:** approved by the owner on 2026-11-04 (session 4)
- **Related:** roadmap phase 6 · [vision](../product/vision.md) → 2 "Site card", 5 "Route
  planning" · ADR-0004 (his own data only) · [ADR-0009](../decisions/0009-worked-at-and-note-at.md)
  (two new `Sites` columns) · [glossary](../product/glossary.md) → Going cold, Site
  card · builds on [spec 004](004-update-site.md), [spec 005](005-faster-saves.md),
  [spec 006](006-focus-tabs.md)

## Why
His morning list tells him **who** to chase, but not **how** or **what was said**. Today he
copies the number into the dialer or WhatsApp by hand, opens each site to remember where things
stand, and must go through the full Update screen just to say "not today". Phase 6 turns each card
into the cheat sheet the vision describes: **call or WhatsApp in one tap**, the **last thing said**
on the card, a **yellow warning** when a near-order site is being neglected, a **two-tap snooze**,
and an **area filter** so that when he is in DHA he sees his other DHA parties for the same trip.

## What the salesman sees and does

### A site card (every tab)
From the top, as today plus the new lines (marked **new**):
- the site name; area · buyer type; Rs. value · Cash / Credit (Rate Quoted / Won);
  "Follow up: …" (red when late);
- **new: the last-spoken line**, e.g. *"22 Oct: Quoted WP-100 @ Rs. 1,450, waiting for
  consultant"*: the last note he wrote and the day he wrote it. At most two lines on the card
  (the rest cut off with "…"; the site screen shows it in full). No note yet: no line.
  A note from an earlier year shows the year: *"22 Oct 2025: …"*.
- the tags, as today (stage, **No number yet**, Saving…), plus **new: "Going cold · no update
  for 9 days"** on a yellow card (below);
- **new: a row of buttons at the bottom of the card**: **Call** · **WhatsApp** · **Snooze**
  (each 44 px tall, sharing the card's width; they fit one row at 360 px).
  - **Call** opens the phone's dialer with the contact's number filled in. He presses call there.
  - **WhatsApp** opens a WhatsApp chat with the contact, **empty** (owner, P6-3). Shown only for a
    mobile number (a Pakistani number starting 03…, or a number from abroad); a Pakistani
    landline (e.g. 042 …) gets **Call** only, since it has no WhatsApp.
  - **Snooze** shows only on a site that is **due** (the sites in Today's Chase: follow-up today,
    late, or no date), whichever tab he is on. A site that isn't due yet has nothing to snooze,
    and "Tomorrow" could otherwise move it *earlier*.
  - **A site with no number gets no Call or WhatsApp button** (it already says **No number
    yet**). If it has no number and isn't due, there is no button row at all.
- Tapping a **button** does only what the button says; it **never opens the site screen**.
  Tapping anywhere else on the card opens the site screen, as today.
- Call and WhatsApp taps are **not written down anywhere** (owner, P6-4): no history row, no trip
  to Google. They work even with no signal (the dialer and WhatsApp take over).

### Going cold (yellow card)
- A site at **Sample / Trial** or **Rate Quoted** whose last **real Update** was **7 or more days
  ago** (owner, Q5) turns **yellow**, with the tag **"Going cold · no update for 9 days"**.
- **Only a real Update resets it** (owner, P6-2): a save from the Update screen (stage, value,
  note or follow-up), or adding the site. **Snooze does not. Edit details does not.** So a
  near-order site he keeps snoozing still turns yellow.
- A late cold card keeps its **red edge** and red "3 days late" too: late and cold are different
  warnings (late = he missed the date he set; cold = nobody has worked the deal for a week).
- It works **on the phone** from the data the page already has, and rolls over by itself
  (a site turns yellow on the 7th morning even if the app was left open).
- The **site screen** shows the same tag.
- After an Update the card is no longer yellow **at once** (it doesn't wait for Google).

### Snooze (two taps, owner P6-1)
1. He taps **Snooze** on a due card. A panel rises from the bottom of the screen:
   **"Snooze F-11 Commercial Tower to:"** and three big buttons, each with its date under it:
   **Tomorrow** (5 Nov) · **3 days** (7 Nov) · **1 week** (11 Nov), and **Cancel** below. Tapping
   outside the panel also cancels.
2. He taps one. The panel closes and the site **leaves Today's Chase at once** (its follow-up is
   now later). A short message says *"Snoozed to 7 Nov"*. He stays at the same place in the list.
- It is a save like any other (spec 005): **instant on the phone**, sent in the background in the
  save queue with a one-time save ID, "Saving…" then gone. If it fails, the orange **"Not saved.
  Tap to try again."** card shows at the top of every tab, as for any save; tapping it reopens the
  snooze panel for that site with the reason.
- The dates count from **today**, not from the old follow-up date (a site 3 days late snoozed
  for "Tomorrow" is due tomorrow).
- **No Pick date** in Snooze: for "after Eid" or "the 15th" he uses Update (owner, P6-1: three
  choices).
- Snooze never changes the stage, value or note, and **does not reset going cold** (P6-2).
- **Not on the site screen.** There the Update form already has the follow-up buttons; a second
  way to change the date on the same screen would confuse. Snooze is the card's shortcut.
- A brand-new site still "Saving…" or a card that didn't save shows no Snooze (fix or wait first).

### The site screen
- Under the contact name and number: **Call** and **WhatsApp** buttons (same rules as the card).
- The last note shows with its day: *22 Oct: "Quoted WP-100 @ Rs. 1,450, waiting for consultant"*
  (in full).
- **Going cold** tag when it applies.
- Update and Edit details as today. Nothing else changes; still at most 5 visible inputs.

### Area filter (All My Parties, for route planning)
- On **All My Parties**, under the search box: one row of area buttons that **scrolls sideways**:
  **All areas** (picked at first), then **each area where he has at least one site**, the area
  with most of his sites first (ties A to Z), each with how many: **DHA 12** · **Gulberg 7** · …
- He taps **DHA**: only his DHA sites show (every stage, newest first, as All My Parties is).
  Tapping DHA again, or **All areas**, shows everything again.
- **Search and area work together:** with DHA picked, typing *"asif"* shows his DHA sites that
  match "asif". Nothing found: *"No site in DHA matches "asif"."* The **✕** clears the search
  and keeps the area; **All areas** clears the area and keeps the search.
- Only **his own** sites' areas are listed (not every area in his region's list: an area where he
  has nothing would only show an empty list). Areas written differently with the same letters
  (*DHA*, *D.H.A*) count as one, under the spelling most of his sites use.
- Works **on the phone**, instantly, with no trip to Google. The row is hidden if none of his
  sites has an area.
- The picked area stays while he switches tabs and comes back. After **+ New Site → Save** he
  lands on All My Parties with the search **and** the area cleared, so he sees his new site at the
  top (as spec 006). Reloading the app clears both.

### Slow connection / no signal
- Call, WhatsApp, the last-spoken line, going cold and the area filter need **no signal at all**.
- Snooze behaves exactly like Update on a weak signal (spec 005: "Still sending…" after 30 s, not
  saved after 2 minutes, never sent later when the app is closed).

### For the owner
- In `Sites`, two new columns at the end: **`worked_at`** (when the site was last really worked:
  added or updated from the Update screen) and **`note_at`** (when `last_note` was written).
  `updated_at` stays "last change of any kind".
- In `Activity`, each snooze is one row with `action` = **`snooze`** and the new `next_followup`,
  so a snooze is never mistaken for real work (phase 7's "who worked today" can leave snoozes out).

## Rules
- **Going cold:** stage is Sample / Trial or Rate Quoted, and today − the day of `worked_at`
  ≥ 7 whole days (Pakistan time). If `worked_at` is blank (a row typed by hand, or from before
  this spec), `created_at` is used; if both are blank, the site is never shown as cold.
- **`worked_at`** is set to the server time when a site is added (+ New Site) and on every
  successful **Update** save (`stage_change` or `update` in `Activity`). Never by Edit details or
  Snooze.
- **`note_at`** is set to the server time whenever `last_note` is written (+ New Site or Update
  with a note). Never otherwise. **Last-spoken line** = day of `note_at` + `last_note`. If
  `note_at` is blank but there is a note, the line shows the note without a day.
- **Call** link: `tel:+<stored number>` (e.g. `tel:+923001234567`). **WhatsApp** link:
  `https://wa.me/<stored number>` (e.g. `https://wa.me/923001234567`), no text (P6-3).
  WhatsApp only when the stored number is a Pakistani mobile (`923` + 9 digits) or doesn't start
  with `92` (from abroad).
- **Snooze** (new public function `repSnoozeSite(k, siteId, input)`; `input` = `{ followUp:
  'tomorrow' | '3days' | '1week', saveId }`):
  - his link only, his site only (found by ID **and** his code, ADR-0004; anyone else's site ID
    gets "That site isn't in your list." and nothing is written);
  - only the three buttons (a typed date is refused); the day is today (Pakistan time) + 1, 3 or 7;
  - the site must be open: a Won or Lost site gets *"Won and Lost sites have no follow-up."*;
  - **a snooze never brings a follow-up earlier:** if the site's follow-up is already on or after
    that day (e.g. he snoozed on another phone), nothing is written and the reply carries the card
    as it is, with *"Follow-up is already 12 Nov."*;
  - otherwise, **inside the lock**, against the row as it is at that moment: writes only
    `next_followup` and `updated_at`, plus one `Activity` row (`action` = `snooze`, `rep`,
    `site_id`, `timestamp`, `next_followup`; the rest blank). Not `worked_at`, `note_at`,
    `last_note`, stage or value;
  - once per save ID (spec 005: a repeat after a lost reply isn't saved twice;
    `repSaveStatus` knows it);
  - reply: only that site's card.
- **Snooze button shown** when the site is in Today's Chase (open, follow-up today or earlier or
  none), has a real site ID, and has no failed or pending save of its own.
- **Area filter:** a site matches when its area, compared loosely (lower case, letters and digits
  only, as "Did you mean"), equals the picked one. Combined with search: both must match. Areas
  listed: those of his own sites, most sites first, ties A to Z.
- **Speed (unchanged promises, now tested for the new parts):**
  - Opening the app (`doGet` / `repLoad`) opens Sales Diary once and reads `Links`, `Sites` and
    `Lists` only: **never `Activity`** (it only grows). The card's new facts come from two `Sites`
    columns read with the rest of the row.
  - A snooze opens Sales Diary once and reads `Links`, `Sites` and `Activity` once each (`Lists`
    not at all).
  - Each card carries two more short dates (`worked`, `noteDay`); nothing else is added to page
    data. Replies still carry only the changed card.
- **Text:** every text written to a sheet goes through `asText_` / `textify_` (the snooze row
  has no typed text, but `rep` and the action are still written as text).
- **Public functions:** `repSnoozeSite` is added to the allow-list in `tests/menu.test.js`
  (14 → 15). It starts with `requireRep_(k)` inside `forSalesman_`.

## Data
**Data-model change** (ADR-0009, Accepted; [data model](../architecture/data-model.md)):
- **`Sites`: two new columns at the end**, after `updated_at`:

  | Column | Example | Notes |
  | --- | --- | --- |
  | `worked_at` | | Server timestamp: when the site was added or last saved from the Update screen. **Drives going cold** (not `updated_at` any more). Not written by Edit details or Snooze (owner, P6-2). |
  | `note_at` | | Server timestamp: when `last_note` was written. The day on the last-spoken line. |

- `updated_at` stays: last change of any kind (Update, Edit details, Snooze). Its note "Drives
  going cold" moves to `worked_at`.
- **`Activity`: new `action` value `snooze`** (`next_followup` = the new date; other detail
  columns blank).
- **Existing rows:** live `Sites` is empty today, so nothing needs filling in. Any row without the
  new values (typed by hand) falls back as in Rules (going cold from `created_at`; note without a
  day).
- **Going live (order matters):** the code reads columns by header and refuses a `Sites` tab
  missing one, so the two headers go into row 1 of the live `Sites` tab **before** the new code
  goes live: the agent adds them through the Google Sheets connector with the owner's OK (he
  works from his phone, where the Sales Diary menu doesn't run). The live version 7 code ignores
  extra columns, so adding them first is safe. A fresh sheet gets them from Check setup. If one
  is ever deleted, Check setup already says *"Sites has no 'worked_at' column in row 1."*
- **Page data:** each card gains `worked` (yyyy-MM-dd) and `noteDay` (yyyy-MM-dd or ''). Still
  his own sites only.
- No Meta-Data change. No new tab.

## Acceptance criteria
Checked locally:
- [x] Tests for every rule above: going cold (6 days not cold, 7 cold; only Sample / Trial and
      Rate Quoted; `worked_at` blank → `created_at`; both blank → not cold); `worked_at` written by
      add and Update, **not** by Edit details or Snooze; `note_at` written only with a note;
      the card's `worked` and `noteDay`.
- [x] Snooze tests: Tomorrow / 3 days / 1 week from today; a typed date refused; Won / Lost
      refused; never earlier (nothing written, card returned, notice); writes only
      `next_followup` + `updated_at` and one `snooze` row; text as text; a repeated save ID saves
      once and `repSaveStatus` reports it; **another salesman's site ID: refused, nothing written,
      nothing about that site in the reply** (ADR-0004); a junk link code: "This link doesn't
      work", no sheet opened.
- [x] Speed test: opening the app never reads `Activity`; a snooze opens Sales Diary once and
      reads `Links`, `Sites`, `Activity` once each, `Lists` not at all.
- [x] Allow-list test lists 15 public functions, including `repSnoozeSite`.
- [x] Browser check at 360 px: Call and WhatsApp links carry the right number; a landline gets
      Call only; no number → no buttons; tapping a button doesn't open the site screen; Snooze →
      Tomorrow takes the card out of Today's Chase at once with "Saving…", then it clears; a
      failed snooze shows orange on every tab and its tap reopens the panel; a 7-day-old Rate
      Quoted card is yellow and a 6-day-old one isn't; after an Update it isn't yellow, after
      Snooze or Edit details it still is; the last-spoken line; the area row (counts, order,
      DHA / D.H.A as one), area + search together, ✕ and All areas; no sideways scrolling of the
      page.
- [x] `npm run check` (287 tests) and `npm run check:browser` (6 checks, new: `cards.check.js`)
      pass on a fresh clone. Key new assertions mutation-checked (each broken on purpose, the
      check failed, then restored). Secrets sweep clean.
- [ ] Independent review (not run yet: for the go-live routine).

Checked live (on RIA's test link, TEST rows deleted afterwards with the owner's OK):
- [ ] The two headers are in live `Sites` before the deploy; Check setup (or a read through the
      connector) shows nothing missing.
- [ ] **On the owner's Android phone:** **Call** opens the dialer with the number; **WhatsApp**
      opens WhatsApp on an **empty** chat with that number. (Google shows the app inside its own
      frame, so this must be seen on a real phone; the agent's Chromium can only check the links.)
- [ ] Snooze a due TEST site: gone from Today's Chase at once; `Sites` has the new
      `next_followup`, unchanged `worked_at`; `Activity` has one `snooze` row.
- [ ] A TEST site at Rate Quoted with `worked_at` set 8 days back (by the agent, in the sheet) is
      yellow; an Update clears it; Edit details and Snooze don't.
- [ ] The area filter shows only that salesman's areas and sites.
- [ ] Opening the app is no slower than version 7 (3.2–3.8 s at phone size, mostly Google's own).

## Out of scope
- Logging calls or WhatsApp messages (owner, P6-4).
- Pre-filled WhatsApp text (owner, P6-3).
- Undo for a snooze (he can change the date with Update).
- Pick date in Snooze (owner, P6-1).
- Going-cold counts on the tabs, or a "going cold" list; the owner's team-wide going-cold view
  (phase 7, which will use `worked_at`).
- An area filter on Today's Chase or Hot Pipeline; a "no area" filter; a map.
- Several contacts per site (one contact, as today).

## Open questions
_None open._ Answered by the owner on 2026-11-04 (session 4):
1. **(P6-1)** Snooze: tap **Snooze**, then pick **Tomorrow / 3 days / 1 week** (two taps).
2. **(P6-2)** Going cold: **only a real Update** (from the Update screen: stage, note, value,
   follow-up) resets the 7 days. **Snooze does not**, and **Edit details does not**.
3. **(P6-3)** WhatsApp opens an **empty chat** with the contact (no pre-filled text).
4. **(P6-4)** Call / WhatsApp taps are **not logged** in the history.
5. **(P6-5)** Snoozing again and again: **no limit.** Every snooze is kept in `Activity`; the
   owner screen (phase 7) may show it.

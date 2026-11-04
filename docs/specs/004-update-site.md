# 004: Update a site

- **Status:** Done (live 2026-11-04, session 3, deployment version 4)
- **Owner approval:** approved by the owner on 2026-11-04 (session 3)
- **Related:** roadmap phase 4 · ADR-0004 (private lists) · [glossary](../product/glossary.md) →
  Sales stages · [data model](../architecture/data-model.md) → `Sites`, `Activity` · builds on
  [spec 003](003-my-sites.md)

## Why
After a visit or call, the salesman records what happened in about two taps: the stage, a
quote or order value, why it was lost, and when to follow up. Every update is kept in the
history, so the owner always sees what happened and when, and the Won Rs. can be added up
against targets later (owner screen, phase 7).

## What the salesman sees and does

### Opening a site
He taps a site card in his list. The **site screen** shows:
- the site name, area, buyer type, contact name and phone (or **"No number yet"**), current
  stage, the last note, and the next follow-up date;
- the **Update** form below it, and an **Edit details** button.

### Update (one screen, mostly taps)
| # | Field | When | How |
| --- | --- | --- | --- |
| 1 | **Stage** | always | Five buttons: Visited / Lead · Sample / Trial · Rate Quoted · Won (Order) · Lost / Dead. The current stage is already picked. Any stage can be picked, backwards or reopening a closed site (owner, P4-4). |
| 2 | **Rs. value** | Rate Quoted, Won (Order) | **Required.** The **total** quote or order value in rupees (owner, P4-1, P4-2), number keypad. Commas allowed. Shows the last value if there is one. |
| 3 | **Cash / Credit** | Rate Quoted, Won (Order) | **Required.** Two buttons. |
| 4 | **Lost reason** | Lost / Dead | **Required.** Price Too High · Credit Terms · Competitor Approved · Site Delayed · Other. **Other needs a note.** |
| 5 | **Next follow-up** | every stage **except Won and Lost** | Tomorrow (pre-picked) · 3 days · 1 week · Pick date. If the site already has a date from today on, a first button **Keep 9 Nov** is pre-picked instead, so a note-only update never quietly moves his date. *(Added after review.)* Won and Lost sites have **no follow-up** (owner, P4-3): they leave Today's Chase. |
| 6 | **Quick note** | always | One line, optional (except Lost → Other). E.g. *"Quoted WP-100 @ 1,450, waiting for consultant"*. The phone keyboard's microphone works here. |

Then **Save** → back to his list, *"Saved"*.

- **Number needed (owner, P3-4):** if the site has no number and he picks **Sample / Trial,
  Rate Quoted or Won (Order)**, a phone box appears: *"Add the contact's number to move this
  site to Rate Quoted."* Save waits for a real number. The duplicate warning works as when
  adding a site.
- **Nothing changed** (same stage, no new note, same date and value): Save says *"Nothing to
  save."*
- **No signal / busy / saved twice:** exactly as when adding a site (spec 003): *"Not saved: no
  signal. Tap Save again."*, what he typed stays on the phone, and a repeat after a lost reply
  is saved once and says *"Saved"*. If he **corrected** something before tapping again, the
  correction is saved. *(Added after review.)* **Back** throws away an unsaved update.

### Edit details
**Edit details** opens the same fields as + New Site (name, buyer type, contact name, phone,
products, area), filled in. He fixes a typo or adds a missing number, then **Save**.
- **A number can be changed but not removed** once the site has one (owner, P3-1: numbers stay
  in the system). Clearing the box says *"A site's number can be changed, not removed."*
- Every change is in the history, including the **old and new number**, so a number can't
  quietly disappear.
- An area or product category the site already has stays allowed (and shown) even if the owner
  has since turned it off in `Lists`; it is never added to `Lists` again. *(Added after review.)*

### What the owner sees
- `Sites` always shows each site's current state; every save adds one `Activity` row.
- Activity rows: `action` = `stage_change` (stage changed), `update` (same stage: new value,
  note or follow-up), or `details` (Edit details, with what changed in `note`, e.g. *"Phone
  923001234567 → 923009876543; Contact name"*).

## Rules

### Stages and values
- `value_rs`: a whole number of rupees, **1 to 1,000,000,000**, required at Rate Quoted and Won
  (Order). Stored as a number. Moving to another stage keeps the last value (it's "the latest
  quoted or won value"); only Won sites count as won (phase 7).
- `payment_terms`: `Cash` or `Credit`, required with a value.
- `lost_reason`: one of the active `lost_reason` values in `Lists`; required at Lost / Dead,
  **cleared** when the site moves to any other stage. Other needs a note.
- `next_followup`: set from the buttons for Visited / Lead, Sample / Trial and Rate Quoted;
  **cleared** at Won (Order) and Lost / Dead. Same date rules as spec 003 (today to a year
  ahead, Pakistan time).
- `last_note`: replaced when he writes a note; kept otherwise. Notes up to 200 characters.
- `updated_at` = now on every save. **Only cells that change are written**: an update never
  erases a value, terms or reason it isn't changing (e.g. one the owner typed by hand).
- A phone cell holding something that isn't a real number (e.g. "-") counts as **no number**.
  *(Added after review.)*

### Whose site
- He can only update or edit **his own** sites: the server finds the site by its ID **and**
  his code (from his link). Anyone else's ID gets *"That site isn't in your list."* and
  nothing is written. Tested on every function.
- Who and when always come from the server, never the page.

### Safety (same as spec 003)
- New public functions: `repUpdateSite(k, siteId, update)` and `repEditSite(k, siteId,
  details)`, each checking the link first (`requireRep_`), wrapped so only our own plain
  messages reach him.
- Every typed or picked text is stored as plain text (no formulas). **The checks run inside the
  lock**, against the row as it is at that moment, so two saves landing together can't remove
  a number or skip the number gate. One-time save IDs as in spec 003; a new site resent with
  changes after it was saved is never made twice: *"This site was already saved. Open it from
  your list to change anything."* *(Added after review.)*

## Data
- **Writes:** `Sites` (the one row for that site), `Activity` (one new row per save), `Lists`
  (a new area from Edit details, as in spec 003).
- **Data model changes** (data-model.md, same change as the code): `value_rs` total order /
  quote value in whole Rs.; `payment_terms` `Cash` / `Credit`; `next_followup` blank at Won /
  Lost; `Activity.action` values `created`, `stage_change`, `update`, `details`.

## Acceptance criteria
Checked locally:
- [x] Every rule above has a test, including "B can't update A's site" and the number gate;
      `npm run check` (242 tests) and `npm run check:browser` (3 checks) pass on a fresh clone.

Checked live with the owner:
- [x] On a test site: move it to Rate Quoted with a value and Cash / Credit, then Won, then back
      to Sample / Trial, then Lost with a reason; each step shows in `Sites` and `Activity`.
- [x] A site with no number can't move to Sample / Trial until a number is added on the spot.
- [x] Edit details changes a name and a number; the old and new number are in `Activity`.
- [x] Test rows removed afterwards (with the owner's OK: 2 sites, 6 activity rows).

## Out of scope
- Today's Chase / Hot Pipeline tabs, search, his target (phase 5). Call / WhatsApp buttons,
  going cold, snooze, area filter (phase 6). Owner screen and Won Rs. totals (phase 7).
- Deleting a site (the owner can, in the sheet). Handing a site to another salesman (owner
  edits `rep` in the sheet, A9).

## Open questions
_None open._ Answered by the owner on 2026-11-04 (session 3):
1. **(P4-1) What is the Rs. value?** The **total** quote / order value (rates go in the note).
2. **(P4-2) Required?** **Yes, at both Rate Quoted and Won (Order)**, with Cash / Credit.
3. **(P4-3) Follow-up after Won or Lost?** **Neither**: both leave Today's Chase.
4. **(P4-4) Backwards / reopen?** **Yes, any stage**; every change kept in the history.

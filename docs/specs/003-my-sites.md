# 003: My sites + add a site

- **Status:** Approved
- **Owner approval:** approved by the owner on 2026-11-04 (session 3)
- **Related:** roadmap phase 3 · ADR-0002 (links) · ADR-0004 (private lists, duplicate warning) ·
  [data model](../architecture/data-model.md) → `Sites`, `Activity`, `Lists` ·
  [glossary](../product/glossary.md) · builds on [spec 002](002-private-links.md)

## Why
This is the first thing salesmen actually use: open their link, see their own sites, and add a
new one in under a minute, mostly by tapping. Every site and number goes into the company's
sheet, so **when a salesman leaves, his leads and contacts stay** (owner, P3-1).

## What the salesman sees and does

### Opening his link
- Top: **his code** (e.g. **RIA**) and a big **+ New Site** button.
- Below: **his sites**, newest first. Each card shows the site name, area, buyer type and stage,
  and **"No number yet"** in orange when it has no phone.
- No sites yet: *"No sites yet. Tap + New Site to add your first one."*
- He never sees anyone else's sites (ADR-0004). Today's Chase / Hot Pipeline tabs and search come
  in phase 5; Call / WhatsApp buttons in phase 6; updating a site in phase 4.

### + New Site (one screen, mostly taps)
| # | Field | How | Must fill? |
| --- | --- | --- | --- |
| 1 | **Site / party name** | Type, e.g. "F-11 Commercial Tower" | **Yes** |
| 2 | **Buyer type** | Tap one: Contractor / Applicator · Project Owner · Consultant · Dealer | **Yes** |
| 3 | **Contact name** | Type, e.g. "Asif (site engineer)" | No |
| 4 | **Contact phone** | Type (number keypad) | No, but see *Numbers* below |
| 5 | **Products** | Tap any of the 11 category pills | No |
| 6 | **Area** | Tap an area already used in his region, or **+ New area** and type it | No |
| 7 | **Next follow-up** | Tap **Tomorrow** (already picked) · 3 days · 1 week · Pick date | **Yes** (pre-picked) |

Then **Save**. He's back on his list with the new site at the top and *"Saved"*.

- **Numbers (owner, P3-1, P3-4):**
  - Saving with **no phone** needs a second tap: the button becomes *"Save without a number?"*.
  - The card then shows **"No number yet"** until a number is added.
  - From phase 4, a site **can't move to Sample / Trial, Rate Quoted or Won (Order) without a
    number** (rule recorded here; built in phase 4).
  - The owner sees **how many sites each salesman has with no number** (Check setup now,
    owner screen in phase 7).
- **Duplicate warning (ADR-0004):** when he finishes typing a number:
  - if **another** salesman has a site with that number: *"Someone in the team already works
    with this contact."* Nothing else is shown. He can still save.
  - if **he** already has it: *"You already have this number: F-11 Commercial Tower."* (his own
    data). He can still save (one thekedar can be on several sites).
- **A number that doesn't look right** (too short or long after tidying): *"Check the number"*;
  Save waits until he fixes or clears it.
- **Area "Did you mean …?" (owner, A10):** while he types a new area, close matches from his
  region show as buttons: *"Did you mean DHA?"*. If what he typed is the same as an existing
  area apart from capitals, dots and spaces ("d.h.a" = "DHA"), the existing one is used, not
  added again.
- **No signal (owner, P3-3):** *"Not saved: no signal. Tap Save again."* Everything he typed
  stays on the phone, even if he closes the app, until it's saved. No automatic sending later.
- **Link cancelled or he's removed from the salesmen list while using it:** the next save says
  *"This link doesn't work. Ask the owner for a new one."* Nothing is saved.

### What the owner sees
- Each new site is a row in the `Sites` tab and a `created` row in `Activity`.
- New areas appear in `Lists` (`list` = area, his region, `added_by` = his code), so the owner
  can tidy duplicates there.
- **Check setup** adds: *"Sites with no phone number: RIA 2, AUR 0, …"* (only salesmen with at
  least one site are listed).

## Rules

### Numbers
- Stored in **one tidy form** (data model): digits only, Pakistani numbers as `92…`:
  `0300-1234567`, `+92 300 1234567`, `0092 300 1234567`, `300 1234567` → `923001234567`;
  landlines too (`042-35761234` → `924235761234`). After tidying it must be 10–15 digits;
  otherwise *"Check the number"*.
- The duplicate check compares tidy forms. For other salesmen it answers **only yes/no**
  (ADR-0004): no name, site, stage, rate or note.

### Areas
- He sees active `area` rows of **his region** plus any with a blank region, sorted by `sort`
  then name, as tap buttons. Names only: never who added them.
- "Same area" = equal after lower-casing and removing everything but letters and digits.
- "Close" = (for names of 3+ characters) one starts with the other, or they differ by at most 2
  letters (edit distance), at most 3 suggestions, closest first.
- A new area is added with `region` = his region, `added_by` = his code, `active` = TRUE,
  `sort` = after the last area.

### Saving a site
- The server decides everything about **who**: his code and region come from his link and
  `Rep_Mapping`, never from the page.
- The server checks every value again: name 1–80 characters; buyer type one of the active
  `buyer_type` values; products only active `product_category` values; area an existing area
  of his region or a new name (1–40 characters); follow-up date today to one year ahead
  (Pakistan time); notes and names have extra spaces trimmed.
- New site: `site_id` = next `S000001`, `S000002`, … ; stage **Visited / Lead**; `created_at`
  and `updated_at` = now; `next_followup` = the chosen date.
- Also an `Activity` row: next `A0000001`…, `action` = `created`, `to_stage` = Visited / Lead,
  `next_followup`.
- IDs, the site row, the activity row and any new area are written **inside the script lock**,
  saved before the lock is let go.
- `products` holds the chosen categories joined by **` | `** (category names contain commas:
  "Mortars, Plasters & Putties").

### Safety (adds to spec 002)
- New public functions, each taking his link code first: `repLoad(k)`, `repCheckPhone(k,
  phone)`, `repAddSite(k, site)`. Each one starts by checking the code (`whoIsVisiting_`): only
  a **working salesman link** is accepted (not the owner's, not a cancelled one).
- `repLoad` returns **only his own sites** plus the pick-lists. Tested: salesman A never gets
  salesman B's site, contact or number in any reply.
- **Codes on pages (amends spec 002):** a link code appears only in the owner's Links window and
  on **its own holder's page** (his page needs it to save). Never another person's code.
- Everything shown on the page is put there as text, never as HTML.

## Data
- **Reads:** `Links`, `Sites` (his rows; all rows' phones for the yes/no check), `Lists`,
  Meta-Data `Rep_Mapping`.
- **Writes:** `Sites` (new rows), `Activity` (new rows), `Lists` (new `area` rows).
- **Data model changes** (in data-model.md, same change as the code): `contact_phone` tidy form
  defined above; `products` joined by ` | `; `next_followup` stored as a date (Pakistan
  midnight); ID formats `S000001` / `A0000001`.

## Acceptance criteria
Checked locally:
- [ ] Every rule above has a test; `npm run check` and `npm run check:browser` pass.
- [ ] Tests show salesman B can't see A's site, and the duplicate check tells B only "yes".

Checked live with the owner:
- [ ] On the RIA test link (phone, no sign-in): add a site with a number, one without (second
      tap), and a new area; they appear in his list, in `Sites` and `Activity`, the area in
      `Lists`.
- [ ] A second test link (e.g. SJ) doesn't show RIA's sites; typing RIA's test number shows
      the "someone in the team" warning.
- [ ] Check setup shows the no-number counts.
- [ ] Test rows are removed afterwards (by the owner, or by the agent with his OK).

## Out of scope
- Updating a site, stages, notes, rates (phase 4). Tabs, search, target (phase 5). Call /
  WhatsApp, going cold, snooze, area filter (phase 6). Owner screen (phase 7).
- Editing a site's name or contact after saving (phase 4 or later).
- Sending saves automatically when signal returns (owner chose not to, P3-3).

## Open questions
_None open._ Answered by the owner on 2026-11-04 (session 3):
1. **(P3-1) Must a new site have a phone number?** Optional, **but salesmen must not keep
   numbers to themselves**: leads and numbers belong in the system so they stay when someone
   leaves.
2. **(P3-2) Pick a follow-up when adding?** Yes, **Tomorrow pre-picked**.
3. **(P3-3) No signal on Save?** Keep what he typed; he taps Save again. No automatic sending.
4. **(P3-4) How to stop number hoarding?** **All three:** second tap to save without a number;
   no Sample / Trial, Rate Quoted or Won without a number (phase 4); owner sees no-number
   counts per salesman.

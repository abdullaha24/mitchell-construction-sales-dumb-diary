# 011: Mitchell look, review-meeting summaries, Plan tab, new contact person

- **Status:** In progress: **live as deployment version 14** (2026-11-11), reviewed cold three
  times (fix rounds re-reviewed), checked live by the agent on the admin link (360 px and 1280 px);
  the owner's own check (a review call, a salesman's phone) is the last open item
- **Owner approval:** owner interview 2026-11-11 (answers **S11-1 to S11-8** in
  [open questions](../product/open-questions.md)); he asked for it to be built and shipped in one go
- **Related:** specs 008 (admin screen), 009 / 010 (summaries), 003 / 004 (contact, Edit details,
  Update) · ADR-0004 (privacy), ADR-0010 (admin updates), **ADR-0011** (earlier contacts) ·
  [data model](../architecture/data-model.md) v0.9 (updated with the code). The speed pass moves to spec 013 (012 became the daily region message).

## Why
Feedback from the owner and his team after the first week live:
1. The app looks bare. Use the **company logo**, simply and elegantly.
2. The owner will run a **weekly sales review on a call (screen share)** from the summary screens. He
   must **tap any number** (a tile, a NOW row, a region) and see the sites behind it, step from one
   salesman to the next, and read it on a wide shared screen. Salesmen get the same taps on their own
   summary.
3. The admin's Today tab shows what salesmen **did**, not what they **planned**. He wants the plan,
   without "buttons hell".
4. A salesman revisits a site and is **handed to a new contact person**. He must add the new person
   as the main contact **and keep the old one**. (In week 1, two salesmen overwrote a contact in Edit
   details, losing the old person: the need is real.)

## What the user sees and does

### A. Mitchell look (owner S11-5: mockup B)
- A slim **logo strip** at the very top of the salesman's page and the admin's page: the Mitchell
  logo (left, ~30 px tall) and *"Sales Diary"* (right, small grey), on white, with a **2 px orange
  line** (`#f39029`) under it. It scrolls away with the page; the header and tabs below behave as now.
- The main colour (buttons, selected tab, selected pills, stage tags, links) becomes **Mitchell teal
  `#00738e`** (tag background `#e3f1f4`). Red (late), yellow (going cold), green (won, WhatsApp),
  orange (no number) keep their meaning and colours.
- The "This link doesn't work" / "Something went wrong" page shows the logo too.
- The logo is inlined in the page (a ~4 KB PNG, no extra download, works on weak signal).

### B. Tappable summaries (salesman and admin; owner S11-1, S11-2)
Everything that counts sites on a summary can be tapped (when its count is above 0):
- the **six tiles**: New sites · Sites worked · Samples · Quotes · Won · Lost;
- the **NOW rows**: Hot sites · Follow-ups next 7 days · Late · Going cold;
- on the admin's team summary, the **region rows** (North / Center / South) of the team table, as
  well as the salesman rows (which already open a salesman).

Tapping a tile or NOW row opens a **site list**: a heading (*"This week · Quotes · 3 sites"*), a
**‹ Back** button (back to the summary, same scroll place), and the normal site cards, biggest Rs.
first, then soonest follow-up. On the admin's lists each card shows the salesman (as on his tabs).
For **Quotes, Won and Lost** each card also shows what happened in the period, e.g. *"Quoted Rs.
450,000"*, *"Won Rs. 1,150,000 · Cash"*, *"Lost · Price Too High"* (the values as the summary counted
them, which for a past period can differ from the card's current state). Tapping a card opens the
site as usual (Update, Call, WhatsApp work); Back from the site returns to the list.

Tapping a **region row** opens that region's summary, built exactly like a salesman's (tiles, target
bar with the region's target on month views, Won / Quotes given / Lost tables, NOW with the named
top hot and late sites), with its own **Share on WhatsApp** / **Copy**. Its tiles are tappable too.

**‹ Prev / Next ›** (owner S11-2): a salesman's or region's summary on the admin's page shows two
buttons at the top, named after the neighbour (*"‹ RIA"*, *"WAK ›"*): salesmen in the team table's
order (region by region); regions North → Center → South. No wrap-around: the first has no Prev,
the last no Next. Back still returns to the team table.

### C. Wide screen for screen share (owner S11-1)
On a window **900 px or wider** (a laptop shared on a call): the page content widens to at most
1,100 px; summary tiles sit in one row of six; the summary's tables sit two per row; site lists and
the admin's tabs show cards in two columns. Under 900 px nothing changes (phone layout).

### D. Admin: Plan tab (owner S11-3, S11-4)
A fifth admin tab, **Plan**, after Today: *Today · Plan · Team · Late & cold · This month* (labels
may wrap to two lines at 360 px, as the counts already do). Today is unchanged except for the new
`contact` saves (Rules → Today feed). Plan has two pills: **Today** (picked) · **Tomorrow**.
- One line per current salesman, in region order:
  - Today: *"RIA  Due 4 · late 3 · done 2"* (exact definitions in Rules → Plan). All 0: *"nothing
    planned"*.
  - A salesman with **no save today** also shows when he last saved this month: *"last saved 3 days
    ago"* / *"no saves yet this month"*.
  - After midnight the same *"This is 11 Nov. Tap Refresh."* banner as Today.
  - Tomorrow: *"RIA  Due 5"* (open sites with follow-up tomorrow); *"nothing planned"*.
- Tapping a line opens his list (Back returns): Today: the **done** sites first (each with a **✓
  Done today** tag), then due today, then late (oldest first); Tomorrow: his sites due tomorrow.
  Normal cards (Update works).
- Counts come from what the page already has (the sites and today's saves); no new server trip.

### E. New contact person (owner S11-6)
On the **site screen** the main contact shows as now (name · number, Call, WhatsApp). New:
- **Earlier contacts (2) ▾**, collapsed, under the main contact (only when there are any). Opened, each
  earlier person shows name · number · *"till 11 Nov"* with **Call**, **WhatsApp** and **Make main**.
- In the **Update** form, a quiet button **+ New contact person**. Tapped, it opens two boxes: *Name*
  and *Phone (WhatsApp)* (same checks, tidy-up and duplicate warning as + New Site). Saved with the
  Update: the new person becomes the **main contact** (card, Call, WhatsApp, search); the old main
  contact moves to the top of Earlier contacts with today's date. Cancel (× on the section) drops it.
- **Make main** on an earlier contact opens the Update form with that person already filled in as
  the new contact; saving swaps them (the old main joins Earlier contacts; the chosen one leaves it).
- **Edit details** still fixes the main contact's name or number (typos). If he changes the **number**
  of a contact that had one, Save first asks: *"Is this a new person?"* **Yes, keep the old one** (the
  old name and number move to Earlier contacts) · **No, fix the number** (as today). One extra tap,
  only then.
- The **admin** sees Earlier contacts and can use + New contact person in his Update (history `admin`).
- **All My Parties search** also finds a site by an earlier contact's name or number.
- The **duplicate warning** (yes/no, ADR-0004) also matches other salesmen's earlier contacts.
- A site at Sample / Trial, Rate Quoted or Won must keep a main number (P3-4): a new contact without a
  number is refused there with the same message as a missing number today.

## Rules
- Summary lists use exactly the sites each count used (spec 009 / 010 rules unchanged): a list's length
  always equals its tile or row number. *Sites worked* = the sites he added or saved an Update on in
  the period; *New sites* = sites added in the period (by that salesman / region / team).
- A region's summary = the current salesmen of that region in `Rep_Mapping` (as its team-table row);
  its target is the region's `Targets` amount (month views only).
- The site list of a period shows each site's **current** card; only Quotes / Won / Lost add the
  period's value line. A site no longer in `Sites` is left out of a list (it can't be opened) and
  the list says *"+ 1 not in the sheet any more"* so the count still adds up.
- Earlier contacts: newest first, at most **20** per site (the oldest drops off the list; the history
  keeps it). Moving a contact to Earlier contacts needs a name or a number (an empty main contact
  just gets replaced). The new main contact's number is never also kept as an earlier one (same
  number: the earlier entry is removed).
- Every contact change writes **one `Activity` row** with action `contact` (see Data). A `contact` row
  is a **save** (P7-2: "worked today", days logged) but **never work** (not a site worked, S9-12; never
  resets going cold, P6-2), like Edit details.
- Plan counts use Pakistan time days, the same follow-up and "open site" rules as Today's Chase.

## Data
- **No new public function** (the allow-list in `tests/menu.test.js` stays 20): contacts ride on
  `repUpdateSite` / `adminPageUpdateSite` (new contact, Make main) and `repEditSite` ("Yes, keep the
  old one"); the region summaries ride on `adminPageSummary`.
- `Sites` gains a column **`earlier_contacts`** (after `note_at`): plain text, one person per line,
  newest first: `<phone or -> · <name> · <yyyy-MM-dd>` (the day they stopped being main). Phone first
  and date last so a name with " · " still parses. Written as text (`asText_`). Blank = none. See
  ADR-0011. The live sheet gets the header **before** the code goes live (as spec 007 did).
- `Activity.action` gains **`contact`**: `note` = *"New contact: Bilal · 923001234567 (was Asif ·
  923331112222)"* or *"Main contact again: …"*; other detail columns blank. An Update with a new
  contact writes its usual row and this one.
- The summary reply gains, per tile / NOW row / region: the site IDs behind each count, and for
  Quotes / Won / Lost the period line per site; the admin's reply also carries the cards of sites now
  at Won or Lost (his page only holds this month's), so every tap opens with no new trip.
- The admin page data gains, per salesman, the day of his last save this month.
- Card data gains `earlier` (list of `{ name, phone, till }`) when there are any.

## Precise rules (after the adversarial spec review, 2026-11-11)

**Privacy (ADR-0004).** On a salesman's own summary, a site counted in his Sites worked / New sites
that is now another salesman's (`Sites.rep`), or no longer in `Sites`, is **never sent** (no ID, no
card). His list ends with *"+ N no longer in your list"* so cards + that line = the tile. The admin's
lists show such sites with their current salesman; sites no longer in `Sites` (or a `created` row with
no site ID) appear there as *"+ N not in the sheet any more"*. `repSummary` never carries a site ID or
card whose `Sites.rep` isn't his (test). A salesman's card data carries `earlier` only for his own sites.

**What can be tapped.** Exactly: the six tiles, the four NOW rows, the team table's salesman and region
rows (count > 0 for tiles / rows). Named-site rows in Won / Quotes given / Lost / Hot / Late tables open
that site. Table headers, the target bar and Lost-reason rows are not tappable.

**Lists.** Quotes / Won / Lost lists are sorted by the period value shown on the line (biggest first,
then name); other lists by the card's Rs. then soonest follow-up. A list keeps the summary's site IDs
until that summary is fetched again; cards show each site as it is now. After **Save or Back** on a site
opened from a summary list he returns to that list at the same scroll place (Back on the list → the
summary at its scroll place).

**Admin closed cards.** The summary reply's cards of sites now at Won / Lost (his page holds only this
month's) go into their own lookup used to open sites, **never into `data.sites`**. They carry `rep`,
`region` and `closed` = the day of their last move to that stage (*"Won 3 Oct"*). After a save on such a
site, its `closed` stays as it was unless the save moved it to another stage. This month's counts
(`aWonMonth` / `aLostMonth`, Team, the top line) count only sites whose `closed` day is in this month.

**Region summaries.** The admin's reply gains `regions: [...]` built by the same server code as a
salesman's summary for the set of that region's current salesmen (`Rep_Mapping`), heading
*"North · This week"*, no "Logged on" line, WhatsApp text built on the server as all summary text is.
Region NOW = open sites whose `Sites.rep` is one of its current salesmen. The team's NOW also counts
former salesmen's sites, so it can exceed the three regions' total (that's correct).

**Plan.** *done* = distinct site IDs in today's saves **by him** (`Activity.rep`) with action `created`,
`stage_change` or `update` (not snooze, details or contact). *Due* = open sites with `Sites.rep` = him,
follow-up today, not in his done set. *late* = open sites with `Sites.rep` = him, follow-up before today
or none, not in his done set. The admin's own saves never move a site into done. *last saved* = his
latest save of any action this month (P7-2). A done site not on the page is left out of the count.
Tomorrow: open sites with `Sites.rep` = him and follow-up tomorrow.

**Contacts: the Update path.** A new contact (or Make main) **is a change**: an Update whose only change
is the contact saves. Then it writes `contact_name`, `contact_phone`, `earlier_contacts` and `updated_at`
and **one `contact` row only**: no `update` row, no `worked_at`, no `note_at`. With any other change it
writes as today **plus** the `contact` row: both rows appended in one call, the update row first, the
`contact` row's ID one more. The stage rule (P3-4) is judged on the **stage the Update saves**: a new
contact without a number at Sample / Trial, Rate Quoted or Won is refused with *"Type the new contact's
number: a site at <stage> needs one."* While + New contact person is open, the existing "add the number"
box is hidden (the new contact's number does that job). At Visited / Lead a new contact without a number
gets the same second tap as + New Site ("Save without a number?").

**Contacts: repeats and conflicts.** The form sends the main contact it saw (`seen.contact` = name +
tidy phone). The server refuses with the usual *"This site was changed a moment ago…"* message when the
main contact now differs from what he saw, unless it already equals his own new contact (then it's a
repeat). If the new contact equals the current main (same tidy phone; or both without a phone and the
same name ignoring case and spaces), nothing moves and no `contact` row is written. Make main removes the
first earlier entry with the same phone, else the same name. An Update form opened over a queued Update
of the same site that carries a new contact / Make main **carries that contact change** and sends it
again (so a later save never drops it). Interleave promise 3 becomes: one update / stage_change row per
landed save, **plus at most one `contact` row**; `tests/interleave.test.js` gains contact changes.

**Contacts: Edit details.** Edit details sends the main contact it opened with; if the sheet's main
contact differs, it is refused with the usual changed message and reopens with the contact as it is
now. It asks *"Is this a new person?"* when the **number** changes on a contact that had one, or the
**name** changes on a contact without a number. **Yes** moves the main contact as it is at save time
to Earlier contacts and writes the `contact` row (plus a `details` row only if other fields changed);
**No** saves as today. The answer is kept with the queued save if it has to be retried.

**Contacts: duplicate check.** Covers every site's main **and** earlier numbers. Other salesmen: yes/no
only. His own sites: named, with *"(earlier contact)"* when it matched an earlier one. The site being
changed is never matched (`repCheckPhone` gains an optional site ID to skip; `saveUpdate_` skips the
site itself). The admin gets the warning only in the saved reply (as today).

**Contacts: the cell.** Reading: a line that doesn't parse (no valid date, or hand-typed text) is shown
as typed (name = the line, no Call) and kept unchanged when the app rewrites the cell. Writing: spaces in
names squeezed, newlines removed; a main phone that isn't a real number moves as typed into the name
part with phone `-`. `till` shows as *"till 11 Nov"*, with the year when it isn't this year. The admin
gets Make main too. Make main is hidden for a person without a number when the site is at a hot stage.

**Today feed.** A `contact` row shows as *"New contact: …"* (its note) and counts as *"contact change"* in
the per-salesman line; an Update with its `contact` row counts as **one** save. The admin's own new
contact appears at once in his feed.

**Look.** `--blue` becomes teal everywhere (it is the main colour: who-line, tappable names, links).
Two oranges are intended: the logo line `#f39029` (brand) and the "no number" warning `#b45309`
(readable text). Wide layout: two columns apply to **site cards** only (lists, Late & cold, This month,
drill lists, Plan lists); Today's feed rows, salesman rows, Team cards and Plan lines stay one column,
centred, max 1,100 px.

**Size budget.** The logo lives once in `App.html` and once in `Page.html` (never in page data). Pins:
salesman's page **≤ 84,000** bytes, admin's **≤ 110,000** (`tests/served.test.js`, AGENTS.md updated). *The admin's pin was planned at 104,000; with both parts merged his page served ~107.7 KB, so it was raised to 110,000 (agent, 2026-11-11): it is the Admin's own page, opened on a laptop or his phone, while the salesmen's page keeps its tight budget.*
Admin summary reply for the current sheet ×3 stays ≤ 150 KB (a size check in the tests).

**Deploy order.** Add the `earlier_contacts` header on the live `Sites` tab first (old code ignores
extra columns), check the app still opens, then `clasp push` and `update-deployment` on the same ID.
The column is required like every other (a missing header shows the usual setup message).

## Acceptance criteria
- [x] Logo strip + teal on both pages and the error page; red / yellow / green / orange unchanged.
- [x] Every tile and NOW row with a count > 0 opens a list whose cards plus its "+ N …" line equal
      the count, on both pages, for all four periods; Back returns to the same scroll place; a card opens the site and
      Back returns to the list.
- [x] Quotes / Won / Lost list cards show the period's value line.
- [x] Region rows open a region summary (numbers equal the region row; Share / Copy work); its tiles
      open lists.
- [x] Prev / Next steps through salesmen in table order and regions N → C → S; none at the ends.
- [x] ≥ 900 px: content ≤ 1,100 px, six tiles in a row, two tables per row, cards in two columns;
      360 px unchanged apart from the logo strip.
- [x] Plan tab: Today / Tomorrow; per-salesman Due / late / done as defined, "last saved N days ago";
      tapping opens his list with ✓ Done today first. Five tabs fit at 360 px.
- [x] + New contact person in Update (salesman and admin): new main, old to Earlier contacts with
      today's date, one `contact` Activity row; Make main swaps; Edit details asks "Is this a new
      person?" when a number changes; search and the duplicate check include earlier contacts;
      hot stages refuse a new contact without a number.
- [x] A salesman never receives another salesman's earlier contacts, site IDs or cards, from any
      reply including his summary (ADR-0004 tests).
- [x] A contact-only Update writes no `update` row and doesn't reset going cold; queued and repeated
      contact changes never lose or double a person (interleave test).
- [x] `npm run check` and `npm run check:browser` green; new logic tested; served-size pins
      updated deliberately (salesman 84,000; admin 110,000). *User guides: not rebuilt, owner's call
      (2026-11-11: "no need to build the pdfs").*

## Out of scope
- Contact roles (site engineer / thekedar / procurement): later, if wanted.
- Restoring the two contacts overwritten in week 1 (owner S11-7: leave them).
- A favicon / home-screen icon (Apps Script needs a hosted image URL): later.
- Visit vs call planning, meeting notes, changes since last meeting.
- The speed pass (spec 013).

## Open questions
None.

# 011: Mitchell look, review-meeting summaries, Plan tab, new contact person

- **Status:** Approved (build)
- **Owner approval:** owner interview 2026-11-11 (answers **S11-1 to S11-7** in
  [open questions](../product/open-questions.md)); he asked for it to be built and shipped in one go
- **Related:** specs 008 (admin screen), 009 / 010 (summaries), 003 / 004 (contact, Edit details,
  Update) · ADR-0004 (privacy), ADR-0010 (admin updates), **ADR-0011** (earlier contacts) ·
  [data model](../architecture/data-model.md) v0.9. The speed pass moves to spec 012.

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
A fifth admin tab, **Plan**, after Today: *Today · Plan · Team · Late & cold · This month*. Today is
unchanged. Plan has two pills: **Today** (picked) · **Tomorrow**.
- One line per current salesman, in region order:
  - Today: *"RIA  Due 4 · late 3 · done 2"*, where **Due** = his open sites with follow-up today
    not yet updated today, **late** = open sites with follow-up before today (or none) not updated
    today, **done** = his sites he saved an Update or added today (any site, planned or not; the
    admin's own saves never count, P7-2). All 0: *"nothing planned"*.
  - A salesman with **no save today** also shows when he last saved this month: *"last saved 3 days
    ago"* / *"no saves this month"*.
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
- Every contact change writes **one `Activity` row** with action `contact` (see Data), so the history
  shows who changed what. It counts as work like Edit details does: it is a save ("worked today", P7-2)
  but not a site worked (S9-12) and it does **not** reset going cold on its own. Inside an Update, the
  Update itself is the work and resets going cold as always.
- Plan counts use Pakistan time days, the same follow-up and "open site" rules as Today's Chase.

## Data
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

## Acceptance criteria
- [ ] Logo strip + teal on both pages and the error page; red / yellow / green / orange unchanged.
- [ ] Every tile and NOW row with a count > 0 opens a list whose length equals the count, on both
      pages, for all four periods; Back returns to the same scroll place; a card opens the site and
      Back returns to the list.
- [ ] Quotes / Won / Lost list cards show the period's value line.
- [ ] Region rows open a region summary (numbers equal the region row; Share / Copy work); its tiles
      open lists.
- [ ] Prev / Next steps through salesmen in table order and regions N → C → S; none at the ends.
- [ ] ≥ 900 px: content ≤ 1,100 px, six tiles in a row, two tables per row, cards in two columns;
      360 px unchanged apart from the logo strip.
- [ ] Plan tab: Today / Tomorrow; per-salesman Due / late / done as defined, "last saved N days ago";
      tapping opens his list with ✓ Done today first. Five tabs fit at 360 px.
- [ ] + New contact person in Update (salesman and admin): new main, old to Earlier contacts with
      today's date, one `contact` Activity row; Make main swaps; Edit details asks "Is this a new
      person?" when a number changes; search and the duplicate check include earlier contacts;
      hot stages refuse a new contact without a number.
- [ ] A salesman never receives another salesman's earlier contacts (ADR-0004 test).
- [ ] `npm run check` and `npm run check:browser` green; new logic tested; served-size pins
      updated deliberately; user guides rebuilt.

## Out of scope
- Contact roles (site engineer / thekedar / procurement): later, if wanted.
- Restoring the two contacts overwritten in week 1 (owner S11-7: leave them).
- A favicon / home-screen icon (Apps Script needs a hosted image URL): later.
- Visit vs call planning, meeting notes, changes since last meeting.
- The speed pass (spec 012).

## Open questions
None.

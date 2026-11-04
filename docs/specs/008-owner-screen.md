# 008: The owner screen (team, who worked today, late and going cold, this month; owner updates)

- **Status:** In progress (built and checked locally 2026-11-04, session 4; not live yet)
- **Owner approval:** approved by the owner on 2026-11-04 (session 4), with answers P7-4 to P7-7
- **Related:** roadmap phase 7 · [vision](../product/vision.md) → "What the owner gets" ·
  ADR-0004 (salesmen see only their own data) · ADR-0006 (owner private link) ·
  [ADR-0010](../decisions/0010-owner-link-can-update-sites.md) (Accepted: the admin link can
  also change sites) · ADR-0009 (`worked_at`) · [glossary](../product/glossary.md) → Owner screen,
  Target, House / office sales · owner answers A6, A7, A8, P3-4, P6-5, **P7-1 to P7-7** ·
  builds on [spec 004](004-update-site.md), [spec 005](005-faster-saves.md),
  [spec 006](006-focus-tabs.md), [spec 007](007-card-helpers-areas.md)

> **Words on screen (owner, P7-7):** everywhere a person sees it, the app says **Admin** (or
> Administrator), not "owner": the admin screen, the salesman's card (*"Admin: …"*), the
> `Activity` value for his changes (`admin`), the Links window, Check setup and the menu
> messages, and *"Ask the admin for a new one."* In these docs "owner" and "admin" mean the same
> person. The `Links.role` value stays `owner` (it is his working link's row in the live sheet).

## Why
Today the owner's link only says "Hello, owner". To know what his 7 salesmen are doing he still
has to chase them on WhatsApp. Phase 7 gives him **his own screen on his phone**: how each
salesman and region stands against this month's target, **who worked today and who logged
nothing**, which sites are **late or going cold** across the team, and **what was won and lost
this month and why**. When he sees something to fix, he can **update the site himself** (owner,
P7-3), and the history shows it was him.

## What the owner sees and does

### Opening his link
- He opens his private owner link (ADR-0006) on his phone. The page shows at once with
  everything below inside it (no second wait), like the salesman's app.
- **The top bar:** **Admin** · *"Updated 10:42"* · a **Refresh** button. Under it, small:
  *"November: Won Rs. 4,200,000 logged, not invoiced"* (the whole team this month).
- **Four tabs**, sharing the width at 360 px: **Today** · **Team** · **Late & cold** ·
  **This month**. It opens on **Today** (his first question each day is "is everyone
  working?"; the Team numbers change slowly). The **Late & cold** tab shows how many sites it
  holds, in red when there are any.
- At the very bottom of every tab, small: *"Keep this link private: anyone with it can see and
  change everything."*
- **Refresh** fetches everything again (one trip to Google, a few seconds); the screen stays
  usable meanwhile. When he comes back to the page after **10 minutes or more** (switching from
  WhatsApp, say), it refreshes by itself in the background. A failed refresh keeps what he has
  and says *"Couldn't refresh: no signal."*

### Today (who worked today)
- A heading with the day: **"Today, Wed 4 Nov"** (Pakistan time).
- **"Nothing logged today: AUR · SM"**, in orange, when any current salesman has made no save
  today. A salesman without a working link says so: *"WAK (no link)"*. When all have worked:
  *"Everyone has logged something today."*
- **One line per salesman** (North, Center, South, in `Rep_Mapping` order): **RIA** *6 saves:
  2 new sites, 3 updates, 1 snooze*, or **AUR** *nothing yet*. Tapping a salesman shows only his
  saves in the list below (tap again, or **Everyone**, for all).
- **Today's saves, newest first**, one small card each:
  - *"10:42 · RIA · F-11 Commercial Tower"*
  - what happened, in plain words: *"New site · Rate Quoted · Rs. 450,000 Credit"*,
    *"Rate Quoted → Won (Order) · Rs. 450,000 Cash"*, *"Update · follow up 7 Nov"*,
    *"Lost / Dead · Price Too High"*, *"Details changed: Phone, Contact name"*,
    *"Snoozed to 7 Nov"*;
  - the note, if any (two lines at most).
  - His own changes show as **"You"** instead of a salesman's code.
  - Tapping a card opens that site (below).
- **Any save counts as work** (owner, P7-2): a new site, an Update, Edit details or a Snooze.
  His own changes never count as a salesman's work.
- Nothing yet today: *"No saves yet today."*

### Team (each salesman and region against target)
- At the top: **All salesmen** · *"November target Rs. 45,000,000 · Won Rs. 4,200,000 (9%)
  logged, not invoiced"* (target = North + Center + South from the `Targets` tab).
- **House / office sales** · *"November target Rs. 3,500,000"* · *"Not logged in the diary."*
  (owner A6: the `UNASSIGNED` region; nobody logs house sales in the app, so it has a target only).
- **One block per region** (North, Center, South): *"North · target Rs. 21,000,000 · Won
  Rs. 2,450,000 (11%) logged, not invoiced"*, then **one card per salesman** of that region:
  ```
  RIA
  November target Rs. 12,345,000
  Won Rs. 2,450,000 · 19% · logged, not invoiced
  [Visited / Lead 12] [Sample / Trial 4] [Rate Quoted 6 · Rs. 3,200,000]
  This month: [Won 2] [Lost 1]
  [No number 3] · Snoozed 9 times this month
  ```
  - Every bracket is a **button**: tapping it lists those sites (*"RIA · Rate Quoted · 6
    sites"*), biggest Rs. first, then soonest follow-up; tapping a site opens it. **Back**
    returns to the Team tab at the same place.
  - **Visited / Lead, Sample / Trial, Rate Quoted** count his **open** sites at that stage now.
    Only Rate Quoted shows Rs. (the other stages have no value on the salesman's cards either).
  - **Won** and **Lost** count **this month** only (rules below).
  - **No number** (owner, P3-4): his open sites with no contact number. Hidden when 0.
  - **Snoozed … times this month** (owner, P6-5): how many snoozes he saved this month. Hidden
    when 0.
  - No target this month for him: the target line says *"No target for November"* and there is
    no %.
- Sites whose salesman is **no longer in `Rep_Mapping`** (someone who left, before the owner hands
  their sites over) are never hidden: a last block **"Not in the salesmen list"** shows a card
  per such code, without target.

### Late & cold (across the team)
- Two buttons at the top: **Late 23** · **Going cold 8** (Late picked first), and under them a
  row of salesman buttons that scrolls sideways, each with a count badge, like the area filter:
  **Everyone** · **RIA 5** · **AUR 3** · …
- **Late:** every open site whose follow-up date is **before today**, or that has **no
  follow-up date**. Sites with no date first, then **most days late first**; same day: biggest
  Rs. first. Each card shows the salesman's code, the stage, Rs., *"Follow up: 1 Nov · 3 days
  late"* in red, and the last-spoken line. (Sites due **today** are not late: that is the
  salesman's morning list.)
- **Going cold:** every site at **Sample / Trial** or **Rate Quoted** with no real Update for
  **7 days or more** (the same rule and the same yellow as the salesman's cards, spec 007, so
  both always agree). **Biggest Rs. first** (where the money is, as in Hot Pipeline, owner P5-1),
  then the rest **longest without an update first**. Each card: salesman, stage, Rs.,
  *"Going cold · no update for 12 days"*, last-spoken line.
- A site can be both late and going cold; it shows in both lists.
- A card snoozed **2 or more times this month** has the tag *"Snoozed 4 times this month"*.
- 50 cards, then **Show more**. Empty: *"No late sites."* / *"Nothing going cold."*

### This month (won and lost)
- **Won:** *"November: 7 won · Rs. 4,200,000 · logged, not invoiced"*, then the won sites,
  biggest Rs. first: *"RIA · F-11 Commercial Tower · Rs. 450,000 Cash · won 3 Nov"*.
- **Lost:** *"November: 9 lost · Rs. 2,100,000 quoted"* (the last value quoted on those sites,
  where there was one), then **one button per lost reason** with its count, most first:
  **Price Too High 6** · **Site Delayed 2** · **Other 1** (the vision's *"6 lost on price"*).
  Tapping a reason lists those sites; under it the lost sites with salesman, reason and note.
- Nothing yet: *"Nothing won yet this month."* / *"Nothing lost this month."*
- Only this month (Pakistan time). Earlier months are in the sheet.

### A site (opened from any list)
- The same site screen the salesman sees (spec 007): name, area · buyer type, contact with
  **Call** / **WhatsApp**, stage, Rs. · Cash / Credit, follow-up, the last-spoken line, going cold
  tag. Plus one line at the top: **"Salesman: RIA (North)"**.
- **Update** (owner, P7-3): the **same Update form** as the salesman's (spec 004): stage, Rs.
  value + Cash / Credit, lost reason, follow-up, quick note, and the phone box when a stage needs
  a number. Same checks, same messages.
- **Save** works exactly like the salesman's (spec 005): back on the list at once, the card says
  **"Saving…"**, then it clears; a failure turns the card orange, **"Not saved. Tap to try
  again."**, at the top of every tab, with what he typed kept. Nothing is sent later when the
  page is closed.
- His change is in the history as **his**: the `Activity` row says `admin` where a salesman's
  code would be. On **Today** it shows as **"You"**.
- **No Edit details and no Snooze** on the owner screen: names, contacts and areas stay the
  salesman's (and the sheet's, as today); Snooze is the salesman's shortcut. The owner moves a
  site to another salesman in the sheet, as today (A9).
- **On the salesman's phone:** the site shows the owner's change the next time his page loads
  (opening the app, or a save's reply). A note he wrote shows there as **"Admin: …"** (owner,
  P7-4), e.g. *"5 Nov: Admin: call him Friday, he's ready"*.
- **Two people, one site:** if the salesman saved a change after the admin's screen loaded (or the
  other way round), a save **never undoes** it: what the admin left as he saw it keeps the
  salesman's change, and only what he changed is saved. If both changed the same thing (say both
  typed a new Rs. value), the later save is **refused, not merged**: *"This site was changed a
  moment ago. Here it is now: check it and save again."*; tapping the card shows his own change
  kept and the rest as the site is now. A form left open while the page refreshes, or a kept
  draft, is brought up to date the same way and says so. The same on the salesman's phone.

### Slow connection / no signal
- After the page has loaded, every tab, count, filter and list works **with no signal**: no
  trip to Google until he taps Refresh or Saves.
- Saves behave exactly as the salesman's on a weak signal (spec 005).

### For the salesmen
- **Nothing new on their page** except: a site the owner changed shows his change; and the
  "changed a moment ago" refusal above. They still see only their own sites and their own target
  (ADR-0004). Region and house targets never reach a salesman's page.

## Rules
- **Today:** Pakistan time (`Asia/Karachi`), from Google's clock, as on the salesman's page. A
  save at 23:59 counts for that day; one at 00:01 for the next. The page rolls over by itself
  (late and going cold lists); the **Today** tab, which needs fresh saves, says *"This is 4 Nov.
  Tap Refresh."* if the page was left open past midnight, and refreshes itself when he comes back.
- **This month:** from the 1st (00:00 Pakistan time) to now.
- **Worked today** (owner, P7-2): a current salesman worked today if at least one `Activity` row
  dated today has his code in `rep`, whatever the `action` (`created`, `stage_change`, `update`,
  `details`, `snooze`). Rows by the admin (`rep` = `admin`) never count for anyone. "Current
  salesmen" = `Rep_Mapping`; "(no link)" = no active `rep` row in `Links` for him.
- **Won this month** (owner, P7-1: the month it was **marked Won**):
  - a site counts when its stage **now** is Won (Order) **and** the latest `Activity` row that
    moved it to Won (`created` with `to_stage` Won, or `stage_change` to Won) is dated this month.
    (Quoted in October, won on 3 November: November.)
  - Its Rs. is the site's **current** `value_rs` (so a value corrected later with an Update is
    the one added up), counted for the site's **current** salesman (`Sites.rep`, so a site the
    owner handed over counts for the new salesman, and one the owner marked Won counts for the
    site's salesman, not for "admin").
  - Won, then moved back (reopened) this month: **not counted** (it isn't won). Won again later:
    counted in the month of the new win. A Won site typed into the sheet by hand (no `Activity`
    row) is not counted.
- **Lost this month:** the same rule with Lost / Dead; the reason is the site's current
  `lost_reason`, the Rs. is its current `value_rs` (the last value quoted) where there is one.
- **Region Won Rs.** = the sum of its current salesmen's Won Rs. **All salesmen** = North + Center
  + South. Targets: salesman from `Rep-Targets`, region and house from `Targets`, for this month,
  read exactly as Check setup reads them (spec 001: missing, 0 or listed twice → no target).
  % = Won Rs. ÷ target, rounded down, only when there is a target. No comparison of region
  targets with their salesmen's (owner, S1-5).
- **Open site** = stage not Won (Order) or Lost / Dead. **Late** = open, and follow-up before
  today or no follow-up. **Going cold** = exactly spec 007 (Sample / Trial or Rate Quoted,
  today − day of `worked_at` ≥ 7; blank → `created_at`; both blank → never).
- **No number** = open site whose phone is blank or not a real number (as the salesman's
  "No number yet").
- **Snoozes:** `Activity` rows this month with `action` = `snooze`, counted per salesman (`rep`)
  and per site.
- **Owner Update** (new public function `adminPageUpdateSite(k, siteId, input)`):
  - his working owner link only (below); any site in `Sites`, found by its ID (the owner may
    change any salesman's site); an unknown ID gets *"That site isn't in the diary."*;
  - the same checks as the salesman's Update (spec 004: stages, value + terms, lost reason,
    follow-up, note, number needed), with the lost reasons from `Lists`;
  - **inside the lock**, against the row as it is at that moment; writes only the cells that
    change, as the salesman's Update does, every text through `asText_` / `textify_`;
  - **never changes `rep` or `region`** (handing over stays in the sheet);
  - one `Activity` row, exactly like a salesman's Update, except `rep` = **`admin`**;
  - a note is stored as **"Admin: "** + the note, in `last_note` and in the `Activity` note
    (owner, P7-4);
  - `updated_at` = now; `note_at` = now when there is a note; **`worked_at` is never written**
    (owner, P7-5: only the salesman's own Update resets going cold);
  - once per save ID (spec 005), remembered under `save:admin:<saveId>` (never a salesman's key);
  - reply: only that site's card (with its salesman), or `{ ok: false, message }`.
- **Two people, one site** (salesman's Update **and** admin's Update). *(Simplified after the
  third review: earlier builds guessed what he meant from the form's values, and each review found
  a new hole. Now the page says it.)*
  - **What the form sends.** When the form opens it records what Google last confirmed for the
    site (`seen`: stage, Rs. value + Cash / Credit, lost reason, follow-up; from the page load, a
    Refresh, or a save's reply or refusal, never a card still saving or not saved). On Save it
    sends **`touched`**: the things it would save differently from `seen`. That includes changes of
    his own earlier saves still unconfirmed (the form shows them), so if one of those fails, this
    save still carries it. Only what the new stage uses is listed.
  - **What Google writes.** Only the touched things (plus the note, the times, and `worked_at` as
    before). Anything not touched is **never written**, whatever the form still holds, so an old
    screen can't put a stale value back.
  - **When Google refuses (a clash).** For each touched thing: if the site's value now is
    different from what he saw **and** different from his new value, someone else changed that same
    thing to something else, and the save is refused. (Equal to his new value is fine: e.g. his own
    save whose reply was lost.) Also, if someone else moved the stage while he left it and a touched
    thing isn't used by the new stage (a value on a site now Lost), it is refused rather than
    dropped without a word. A note alone is always added. The reply is `{ ok: false, changed: true,
    message, site }`: *"This site was changed a moment ago. Here it is now: check it and save
    again."*; his card shows the site as it is now; tapping it reopens the form with his touched
    changes kept (a pre-picked follow-up he didn't choose is refreshed) and the rest as it is now.
  - **Bringing a form up to date.** The same happens, with *"This site was changed a moment ago.
    Check and tap Save again."*, when the page refreshes under an open form or he reopens a kept
    draft and the site it showed has changed.
  - **Saved once.** A save's fingerprint leaves out `seen` only (it describes what he saw; the
    values and `touched` say what he saves). A retry unchanged keeps its save ID, form and `touched`,
    so it is the same save, saved once; any change gives a new save ID.
  - **The queue.** An Update lists the saves of his it was opened over (`carries`) and, when it
    lands, replaces only those failed saves; a late "saved" reply of a save a landed later one
    carried is ignored (it would put an older card back).
  - A form without `seen` and `touched` (kept on a phone from before this version) saves as it
    always did. Correcting the very thing a lost-reply save already changed (to another value) is
    refused once, as the server can't tell it was his; he sees it and saves again.
  - **Tested at random** (`tests/interleave.test.js`): 1,500 seeded sequences (6,000 checked once)
    of 2 to 4 saves by a salesman and the admin on one site, random things touched, random fates
    (lands, fails, lost reply then retried unchanged or edited, refused then retried), forms left
    open, refreshes. After every save: only touched things written and never over someone else's
    newer change; "saved" means it is there; one `Activity` row per save ID; nothing stays orange
    after a save that carried it landed.
- **The owner-link check** (new helper `requireAdminLink_(k)`): a code not shaped like ours →
  *"This link doesn't work."* without opening any sheet; otherwise Sales Diary is opened once and
  `Links` read: only an **active** row with `role` = `owner` and exactly this code passes. A
  salesman's code, a cancelled owner code or anything else → the same *"This link doesn't
  work."* and nothing else. Every new `adminPage…` function starts with it, inside
  `forAdminPage_` (only our own plain messages reach the page, as `forSalesman_` does).
- **Why not the signed-in check:** the existing `owner…` functions (Links window) and `menu…`
  functions run from the sheet's menu, where Google tells the script who is signed in
  (`isSignedInSelf_`). The owner screen is a web page opened by link, run as the owner for
  anonymous visitors, so Google gives no email: only the link code can tell it's him (as
  `requireRep_` does for salesmen). The prefix **`adminPage…`** keeps the two kinds apart, and a
  test checks each function starts with the right check.
- **Public functions** (allow-list in `tests/menu.test.js`, 15 → **18**):
  - `adminPageLoad(k)`: his screen's data (for Refresh);
  - `adminPageUpdateSite(k, siteId, input)`: an owner Update;
  - `adminPageSaveStatus(k, saveIds)`: which of **his** saves landed (spec 005), keyed
    `save:admin:…`, so it can never report a salesman's save.
  - `doGet` serves the owner's page for a working owner link (no new function).
- **Salesman functions are unchanged for the owner's code:** every `rep…` function refuses it
  (*"This link doesn't work."*), as today.
- **Link codes:** the owner's page carries **his own** code only (it needs it to save); never a
  salesman's code. "(no link)" is a yes/no, never a code.
- **Speed:**
  - Opening (doGet / `adminPageLoad`): Sales Diary opened **once**; `Links`, `Sites`, `Lists`
    read once each; Meta-Data **not opened** while the kept copy is fresh.
  - **`Activity` is never read whole when the page opens**: only **this month's rows, from the
    bottom up**, in blocks of 500 rows, stopping as soon as a block reaches a row from before
    this month (the app only ever adds rows at the bottom, so they are in time order; if the
    owner ever sorts the tab by hand, the month's figures can be wrong until it's back in order). With 3,000 rows a
    month (~7 salesmen × 15 saves × 26 days), that's about 3,500 rows, well under a second on
    Google's side; only totals and lists reach the phone.
  - An owner save: Sales Diary opened once; `Links`, `Sites`, `Activity`, `Lists` read once each
    (as a salesman's Update); the reply carries only the changed card.
  - Tabs, filters, Show more and the site screen work **on the phone** with what the page has.
- **What the page carries** (volume): the **open sites** of every salesman, plus the sites won or
  lost this month and any site in today's saves, each as the salesman's card plus `rep`, `region`
  and this month's snooze count (~0.45 KB each with a long name and note); the counts and targets; today's saves. No closed
  site from earlier months. At today's pace (~5 new sites a day across the team) that is under
  ~1,000 open sites in the first six months, under 500 KB before Google compresses it. A test pins the
  size for 1,000 open sites; if opening ever gets too slow, a later phase moves site details to a
  tap.
- **Words:** on screen only glossary words: stage names, Won Rs., "logged, not invoiced",
  target, house / office sales, going cold, late, snooze, no number. No "pipeline", "dashboard",
  "KPI".

## Data
- **No new tab and no new column.** Meta-Data is only read, never written.
- **Reads:** `Sites` (all rows), `Links` (the owner check and "no link"), `Lists` (lost
  reasons), `Activity` (this month's rows from the bottom on open; whole, as today, inside a
  save's lock for the next ID); `Rep_Mapping`, `Rep-Targets` and **`Targets`** through the kept
  copy.
- **Writes:** an owner Update writes `Sites` cells and one `Activity` row, as a salesman's Update.
- **Data-model changes** (made in [data model](../architecture/data-model.md) with the code):
  - `Activity.rep`: *"Who made the change: a salesman's code, or **`admin`** (an Update from the
    admin screen, spec 008)."* The site's salesman is in `Sites.rep`.
  - **Kept by the script:** the `salesmen` Script Properties entry also keeps the **region and
    house / office targets** (`Targets`: North, Center, South, `UNASSIGNED`) for this month and
    next month, in their own `regionTargets` part (never mixed with salesman codes). A kept copy
    without it is read again at once (as spec 006 did for salesman targets). Refreshed by the
    same daily read, **Refresh salesmen & targets**, Check setup and the Links window. A problem
    in `Targets` never stops salesmen working: there is just no region target until it's fixed.
  - An admin note is stored in `last_note` (and the `Activity` note) as *"Admin: …"* (P7-4).
- **Owner page data:** `today`, `now` (Google's clock), `month`, his own `k`, the salesmen
  (`rep`, `region`, this month's target, has a working link yes/no, saves today by kind, snoozes
  this month), region and house targets, the sites above (cards with `rep`, `region`,
  `snoozes`, and `closed` = the day marked Won / Lost this month, if so), today's saves (time,
  who, site ID and name, what happened, note), lost reasons and the stage rules for the Update
  form.
- **Code layout (for the build):** the admin's page is the salesman's `App.html` (site screen,
  Update form and save queue: one copy, so both save the same way) with the admin-only part,
  **`Admin.html`** (its tabs, lists and styles), inserted by `doGet` **only into the admin's
  page**. A salesman's page gets nothing of it (no extra bytes on his weak signal) and must look
  and behave exactly as before (all existing browser checks unchanged). New server code in
  **`admin.js`**; `saveUpdate_` is shared by the salesman's and the admin's Update (who is saving
  is passed in).
- **AGENTS.md** (with the code): the public-function rule gains the `adminPage…` kind.

## Acceptance criteria
(Amounts in this spec are made up; real targets never go in git, owner S3-1.)

Checked locally:
- [x] Tests for every rule: worked today (each of the five actions counts; owner rows don't;
      yesterday's don't; 23:59 / 00:01 Pakistan time); "nothing logged" and "(no link)"; won this
      month (added straight at Won; `stage_change` to Won; won last month: not counted; quoted
      last month and won this month: counted; won then reopened: not counted; won twice: counted
      once; current value; handed-over site counts for the new salesman; owner-marked Won counts
      for the site's salesman; hand-typed Won row: not counted); lost this month and the reason
      counts; region and team sums; targets for salesman, region and house (none, 0, listed
      twice); late and going cold lists and their order; no-number and snooze counts; former
      salesmen's block.
- [x] Safety tests: every `adminPage…` function with a junk code (no sheet opened), a salesman's
      code, a cancelled owner code, and no code: *"This link doesn't work."* and nothing else;
      every `rep…` function with the owner's code: refused; the owner's page holds no code but
      his own; a salesman's page data is unchanged (his sites and his target only; no region or
      house target, nobody else's site).
- [x] Owner Update tests: same checks and messages as the salesman's; `Activity.rep` = `admin`;
      only changed cells written; texts as text (a note starting `=` stays text); `rep` and
      `region` never written; once per save ID under `save:admin:`; `adminPageSaveStatus`
      reports only his saves; unknown site ID refused; `worked_at` never written; note stored as "Admin: …";
      "two people, one site" refused both ways, nothing written, fresh card in the reply; a
      salesman's two saves in a row still both land.
- [x] Speed tests: opening the owner page opens Sales Diary once, Meta-Data not at all (fresh
      copy), reads `Links`, `Sites`, `Lists` once and **never `Activity` whole**: with 5,000
      rows from earlier months and 40 from this month, at most 501 `Activity` rows are read
      (one block and the header); with 1,200 from this month, at most 1,501. An
      owner save: one open, each tab read once. Page data for 1,000 open sites stays under the
      pinned size.
- [x] Allow-list test: 18 public functions; a source test checks each `adminPage…` function
      starts with `requireAdminLink_` inside `forAdminPage_`, and each other `owner…` / `menu…`
      with the signed-in check.
- [x] Browser check at 360 px (new `admin.check.js`, against the real server code and fake
      sheets): the four tabs; Today (nothing logged, per-salesman filter, "You"); Team cards,
      targets, % and tap-through to sites and Back; Late / Going cold toggle, order, salesman
      badges; This month and lost-reason buttons; an Update from the owner screen: "Saving…" then
      cleared, a failed one orange on every tab; a "changed a moment ago" refusal; works with no
      signal after loading; no sideways scrolling. All existing salesman checks pass unchanged.
- [x] `npm run check` (315 tests) and `npm run check:browser` (7 checks, new: `admin.check.js`)
      pass on a fresh clone; secrets sweep clean. Key assertions mutation-checked: 12 server
      (`tests/admin.test.js` and others) and 4 page (`admin.check.js`), each broken on purpose, the
      check failed, then restored.
- [x] Independent review: security clean; two defects in the changed-site check and one small
      one fixed, each with a check that fails on the old code (plan 008, step 4).

Checked live (TEST rows on RIA's test link, deleted afterwards with the owner's OK):
- [ ] **On the owner's phone**, his link shows the four tabs. The agent checks the numbers against
      the sheet through the connector: RIA's TEST sites by stage, Won and Lost this month, today's
      saves, late and going cold; targets match `Rep-Targets` and `Targets` for this month
      (read live, never written into git).
- [ ] The owner updates a TEST site from his phone: `Activity` has the row with `rep` = `admin`;
      RIA's page shows the change after reloading; the Today tab shows it as "You" and RIA is not
      counted as working for it.
- [ ] From RIA's page, calling `adminPageLoad` with RIA's code gets *"This link doesn't work."*
- [ ] Opening time measured at phone size (salesman's page today: ~3.9 s warm). The agent drives
      the owner's link in Chromium **only if the owner allows** the agent to read his owner code
      (kept in a scratch file, never in logs or git); otherwise the owner times it on his phone.

## Out of scope
- **Links on the phone** (making or cancelling links from the admin screen): not in phase 7
  (owner, P7-6). Links stay in Sales Diary → Links on a computer; in an emergency he can untick
  `active` for that row in the Google Sheets app on his phone (cancels at once).
- Owner Edit details, Snooze, adding a site, handing sites to another salesman, deleting
  anything (all stay in the sheet).
- Earlier months, charts, a site's full history on screen (the `Activity` tab has it).
- Achieved vs target on the salesman's page (owner, Q12c); house / office sales logged in the app.
- Showing the owner which salesman a duplicate number belongs to (he can search the sheet).
- Google sign-in for the owner (ADR-0006 option, not chosen; ADR-0010 keeps the door open).

## Open questions
_None open._ Answered by the owner on 2026-11-04 (session 4, phase 7):
- **(P7-1)** A win counts in the **month it was marked Won** (quoted in October, won on
  3 November: November).
- **(P7-2)** "Worked today": **any save at all** counts (new site, Update, Snooze, Edit details).
  (Agent had recommended counting only new sites and Updates.)
- **(P7-3)** The owner can **update sites too** from his screen, and the history must show it was
  him. (Agent had recommended look-only.) This widens the risk he accepted in A8 / ADR-0006: see
  [ADR-0010](../decisions/0010-owner-link-can-update-sites.md) (Accepted).
- **(P7-4)** His note shows to the salesman as **"Admin: …"**.
- **(P7-5)** His Update does **not** reset going cold: only the salesman's own Update does.
- **(P7-6)** **No** making or cancelling links on the phone in phase 7.
- **(P7-7)** Say **"Admin" / "Administrator"** everywhere a person sees it, instead of "owner".

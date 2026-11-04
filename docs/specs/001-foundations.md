# 001: Foundations

- **Status:** Done (live 2026-11-04, session 3). v2.1: build clarifications are marked *(v2.1)*
  below; none changes what the owner sees in a normal run.
- **Owner approval:** approved by the owner on 2026-11-04 (session 2)
- **Related:** roadmap phase 1 · ADR-0001 (Sheets + Apps Script) · ADR-0003 (tooling) ·
  ADR-0005 (two sheets) · ADR-0007 (Meta-Data ID in code) ·
  [data model](../architecture/data-model.md) · build plan:
  [001-foundations-plan.md](../plans/001-foundations-plan.md)

## Why
Nothing can be built until there is a place to keep the data, a safe way to put code live, and a
reliable way to read salesmen and targets from the owner's Meta-Data sheet. This phase builds that
base and nothing more. **Salesmen see nothing new yet.**

## What the owner sees and does

### Result of this phase
1. A new Google Sheet called **"Sales Diary"** in the owner's Google Drive, with three tabs:
   **Sites**, **Activity**, **Lists**. Sites and Activity have only their header row. Lists comes
   filled with the product categories, lost reasons and buyer types. (The **Links** tab comes in
   phase 2.)
2. One menu at the top of that sheet: **Sales Diary → Check setup**. Tapping it creates any
   missing tabs, then shows a short summary (below). Safe to tap any time; it never deletes or
   changes the owner's data.
3. A web address for the app. For now it shows only "Sales Diary is set up", with no data, and
   **only the owner can open it**.

> The menu works in Google Sheets **on a computer** (any browser). Google's phone app for Sheets
> doesn't show custom menus. The salesmen's app itself (later phases) is phone-first.

### What Check setup shows
A plain pop-up:
```
Salesmen: 7
  North: RIA, AUR, WAK
  Center: SH, SJ, SM
  South: IB

Targets for November 2026
  RIA   Rs. 12,345,000
  AUR   Rs. 6,789,000
  ...
  IB    Rs. 1,111,000

Region targets for November 2026
  North                 Rs. 20,000,000
  Center                Rs. 6,000,000
  South                 Rs. 1,111,000
  House / office sales  Rs. 9,000,000

Nothing to fix.
```
If something is wrong, the last line becomes **"Check these:"** followed by one line per problem,
each naming the tab and row, e.g. *"Rep-Targets row 40: target 'abc' is not a number."*

If the Meta-Data sheet can't be opened, or a needed tab or column is missing, the pop-up says only
that, e.g. *"Can't open the Meta-Data sheet. Check it still exists and your Google account can
open it."* or *"Rep-Targets has no 'Target' column in row 1."*

*(v2.1)* Problems found in the **Sales Diary** sheet itself are listed under *Check these* too.
Today there is one: a `Lists` tab missing one of its columns, e.g. *"Lists has no 'sort' column in
row 1. The starting lists were not added."* It is listed even when Meta-Data can't be opened.

### One-time setup (about 15 minutes)
**The owner does three things.** The agent does the rest and guides him through each one.

| # | Who | Step |
| --- | --- | --- |
| 1 | **Owner** | Turns on the **Apps Script API** for his Google account: one switch at `script.google.com/home/usersettings`. |
| 2 | **Owner** | Logs clasp in to his Google account inside the agent's session: the agent runs `npx clasp login --no-localhost`, the owner opens the Google link it prints, signs in, and pastes back the code. |
| 3 | Agent | Runs `npx clasp create-script --type sheets --title "Sales Diary" --rootDir src`. This creates the Sales Diary sheet and its attached script, and writes `.clasp.json`. It also copies Google's starter files into `src/`, overwriting `src/appsscript.json` and adding a starter code file. The agent deletes the starter file, restores ours with `git checkout -- src/appsscript.json`, then runs `npx clasp push --force`. |
| 4 | **Owner** | Opens the Sales Diary sheet on a computer, reloads it, and taps **Sales Diary → Check setup**. Google asks him to allow the script to use his spreadsheets. It shows a "Google hasn't verified this app" warning: **this is normal for a script you made yourself, in your own account.** He clicks *Advanced*, then *Go to Sales Diary (unsafe)*, approves the permissions listed, then taps **Check setup** again. |
| 5 | Agent | Deploys the web app (`npx clasp create-deployment -d "phase 1"`), gives the owner the address, and records the deployment ID and address in `docs/plans/handoff.md`. They aren't secret: the address opens nothing useful without a link code (phase 2). |
| 6 | Agent | Runs `npx clasp logout` at the end of the session. |

**What the clasp login can do while it's active** (from clasp 3.4.1's own list of permissions):
see the **names** of files in the owner's Drive (not their contents); open only files that clasp
itself creates; create and change Apps Script projects; and manage Google Cloud projects. It
**can't** open his other sheets or documents. It lives only on the session's temporary machine
and is never committed or printed. If a session ends before `logout`, the login disappears with
the machine. The owner can also remove it any time in his Google Account's security settings,
under third-party connections.

## Rules

### General
- **The app never writes to Meta-Data** (ADR-0005). Only one file of code opens it, read-only;
  tests fail if anything tries to write to it.
- **The Meta-Data sheet's ID is in the code** (`src/config.js`, ADR-0007).
- **Columns are found by their header name in row 1**, ignoring capitals and spaces at the
  ends. Column order doesn't matter. Only row 1 counts as the header.
- **Dates and months are Pakistan time** (`Asia/Karachi`). *This month* means the current month
  in Pakistan time.

### Reading `Rep_Mapping` (salesmen)
- Columns `Rep` and `Region`. Rows with both blank are skipped.
- `Rep` is trimmed and made upper-case (`" ria"` → `RIA`).
- `Region` must be North, Center or South (any capitals). Otherwise: *Check these*, and that
  salesman is left out.
- A row with only one of the two filled in: *Check these*.
- The same `Rep` listed twice: *Check these*, and the first row is used. *(v2.1)* The first row
  counts even if it has its own problem (then that salesman is left out until it's fixed).

### Reading `Rep-Targets` (salesman targets)
- Columns `Rep`, `Month`, `Target`. **Everything else on the tab is ignored**, including the
  owner's own workings in E2 and E74:I90.
- Rows with all three blank are skipped. A row with only some filled in: *Check these*.
- **Month** may be a date cell (how the sheet stores it today) or text `YYYY-MM`. A date cell is
  turned into a month **using the Meta-Data sheet's own timezone**. *Why:* the cell "1 Aug 2026"
  is 31 Jul, 7 pm in UTC, so reading it in UTC would make every target one month early.
  Anything else: *Check these*.
- **Target** may be a number or text such as `12,345,000` or `Rs. 12,345,000` (commas, `Rs.` and
  spaces are removed). It must then be a whole number, zero or more. Anything else: *Check these*,
  and the row is ignored. *(v2.1)* A number within 0.000001 of a whole number counts as that
  whole number, because a formula such as `=7000000*1.1` shows 7,700,000 but is stored as
  7700000.000000001.
- **A target of 0 means no target**, the same as a missing row. *(v2.1)* So a 0 row never makes a
  duplicate: the owner can zero an old row and add a new one.
- **The same salesman and month twice:** *Check these*, and that salesman has **no target** for
  that month until it's fixed. The app doesn't pick one or add them up.
- Rows for people **not in `Rep_Mapping`** (e.g. MUB's July 2026 row) are **ignored silently**.
  A typo like `RAI` still shows up, because RIA then has "no target".
- A salesman without a target this month shows **"no target"** in the summary. That's not a
  problem.

### Reading `Targets` (region targets)
- Same rules as `Rep-Targets`, with `Region` in place of `Rep`.
- Regions: North, Center, South and `UNASSIGNED`, shown as **"House / office sales"**. Any other
  region: *Check these*.
- No comparing region totals with salesmen's targets (owner's choice).

### Setting up the Sales Diary sheet (inside Check setup)
- Creates **only the tabs that are missing**: `Sites`, `Activity`, `Lists`, with the headers
  listed in the [data model](../architecture/data-model.md), bold and frozen. **A tab that already
  exists is never touched**, even if its headers differ.
- On creating `Sites`, its `contact_phone` column is set to plain text, so `923001234567` keeps its
  digits instead of showing as `9.23E+11`.
- Sets the Sales Diary sheet's timezone to `Asia/Karachi`. *(v2.1)* Only when it's different, so
  running Check setup again makes no edit at all.
- Fills `Lists` **per list** (`product_category`, `lost_reason`, `buyer_type`) **only when that
  list has no rows**, with the values and order in the data model (`Lists` → starting contents),
  `added_by` = `owner`, `active` = TRUE, `region` blank, `sort` = 10, 20, 30, …
  `area` starts empty. The owner's edits are never overwritten. (If he deletes every row of a list,
  the next Check setup refills it.) *(v2.1)* `Lists` columns are found by header name like
  everywhere else. If one of the six is missing, nothing is added to `Lists` and it is listed
  under *Check these*.
- Deletes the blank `Sheet1` tab that Google adds to a new spreadsheet, **only** if it's
  completely empty, and only after the other tabs exist (Google won't delete a spreadsheet's last
  tab). *(v2.1)* "Completely empty" means no cell values, no charts and no images.

### Safety rules for all code (from now on)
- **A web page can call any public function in the script.** Apps Script lets a page call any
  function whose name doesn't end in `_`. So:
  - Every helper function's name **ends in `_`**.
  - The public functions are a fixed list. In phase 1: `doGet`, `onOpen`, `menuCheckSetup`.
    A test fails if any other public function appears.
  - `menuCheckSetup` **refuses to run** unless a signed-in person is running it as themselves
    (in code: the active user's email is non-empty and equals the effective user's email). That's
    true when the owner taps the menu, and false for every web app visitor except the owner
    himself while signed in to Google. *(v2.1, corrected: it was "never true for a web app
    visitor".)* If the owner ever triggered it from a page, setup would only add what's missing
    and the pop-up would fail, so no harm; phase 2's public functions use the link code instead.
  - `onOpen` has **no** such check. It only adds the menu, and it runs in a limited mode where
    Google may not give the user's email, so a check would hide the menu.
- The web app is deployed for **"only myself"** in this phase (`access: "MYSELF"`). In phase 2
  it must become **`ANYONE_ANONYMOUS`** ("Anyone" in Google's deploy screen), **not** `ANYONE`,
  which forces a Google sign-in that salesmen don't have (ADR-0002).
- **The Sales Diary sheet must never be shared**, and never set to "anyone with the link". From
  phase 2 it holds the link codes.

## Data
- **Reads (never writes):** Meta-Data `Rep_Mapping`, `Rep-Targets`, `Targets`.
- **Creates / writes:** Sales Diary tabs `Sites`, `Activity`, `Lists` (when missing), the starting
  rows in `Lists`, and the sheet's timezone.
- **Settings:** none. (The Meta-Data ID is in the code. How the web app finds the Sales Diary
  sheet is decided in phase 2, the first phase that needs it.)
- **Data model:** `Links` is now created in phase 2. Already updated in
  [data-model.md](../architecture/data-model.md).

## How it's built (for agents)

### Tools (exact versions, checked 2026-11-04)
| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 22 or newer | Runs clasp, tests and the type check. |
| `@google/clasp` | 3.4.1, pinned dev dependency | Sends code to Apps Script (ADR-0003). |
| `typescript` | 7.0.2, pinned dev dependency | Type check only. Checked: v7 type-checks plain JS with JSDoc, across files, with the Apps Script types. |
| `@types/google-apps-script` | 2.0.14, pinned dev dependency | Types for `SpreadsheetApp` and the rest. |
| Test runner | Node's built-in `node:test` | No extra package. |

`package-lock.json` is committed.

### Commands (go into `AGENTS.md` → `## Commands`)
| Command | Does |
| --- | --- |
| `npm install` | Installs the tools. |
| `npm test` | All tests: `node --test "tests/**/*.test.js"`. No Google account needed. |
| `npm run typecheck` | `tsc -p .`, type-checks `src/`. |
| `npm run check` | Type check, then tests. **Must pass before every commit.** |
| `npx clasp push --force` | Sends `src/` to Apps Script. Always use `--force`: without it clasp asks before replacing `appsscript.json`, and when nothing can answer (an agent session) it **skips the push silently**. Git is the source of truth. |
| `npx clasp create-deployment -d "<note>"` | Creates the web app. **Once only**: each run makes a new address. |
| `npx clasp update-deployment <deploymentId> -d "<note>"` | Puts the latest pushed code live **at the same address**. Use this for every update after the first; a new address would break every link already sent. |

### Files
| Path | Holds |
| --- | --- |
| `package.json`, `package-lock.json`, `tsconfig.json` | Tooling. `tsconfig`: `allowJs`, `checkJs`, `noEmit`, `strict`, types `google-apps-script`, includes `src/**/*.js`. |
| `.clasp.json` | Script ID and `rootDir: "src"`. Made by `clasp create-script`. Committed: IDs, not credentials. |
| `src/appsscript.json` | `timeZone: "Asia/Karachi"`, `runtimeVersion: "V8"`, `exceptionLogging: "STACKDRIVER"`, `webapp: { executeAs: "USER_DEPLOYING", access: "MYSELF" }`. |
| `src/config.js` | Meta-Data ID, tab names, header lists, starting `Lists` values. |
| `src/rules.js` | Plain logic that never touches a spreadsheet: find columns, tidy codes, read months, parse and format Rs., read salesmen and targets, build the summary text. Its only Google call is `Utilities.formatDate` for months (faked in tests). |
| `src/metadata.js` | The **only** code that opens Meta-Data. Read-only. |
| `src/setup.js` | Creates missing Sales Diary tabs, fills `Lists`. |
| `src/menu.js` | `onOpen`, `menuCheckSetup`, the signed-in-person check. |
| `src/webapp.js`, `src/Index.html` | `doGet` and the placeholder page. No data. |
| `tests/helpers/load-src.js` | Loads every `src/*.js` into one shared sandbox (like Apps Script's single global scope), with fake Google services. |
| `tests/helpers/fakes.js` | Fake spreadsheets made from plain tables, plus fake `Utilities`, `Session`, `HtmlService`. The fake Meta-Data **throws on any write**. |
| `tests/fixtures/meta-data.js` | Same **shape** as the real Meta-Data: stray E2 value, the E74:I90 block, SM's rows beside it, months as Karachi-midnight dates, MUB's July row. **Made-up amounts**: the owner's real target table stays out of git. |
| `tests/*.test.js` | The tests below. |

### Gotchas found while checking (2026-11-04)
- All `src/*.js` files share one global scope. Top-level `const` values must not depend on
  other files. *(v2.1, corrected)* A `const` defined in two files is caught by `tsc` and by the
  test loader, but a **function** defined in two files is **not** caught by `tsc` in plain JS
  (checked with TypeScript 7.0.2): in Apps Script the file loaded last silently wins. A test
  (`tests/load-src.test.js`) fails on any duplicate top-level function name.
- In the test sandbox, top-level `const` values aren't properties of the sandbox object. Read
  them with `vm.runInContext('NAME', ctx)`.
- Objects made inside the sandbox fail `assert.deepStrictEqual` against plain test objects
  (different built-in prototypes). Compare `JSON.parse(JSON.stringify(x))`.
- No `.claspignore` needed: clasp's defaults push only `appsscript.json`, `*.js`, `*.gs`, `*.ts`,
  `*.html`. If one is ever added, it goes **next to `.clasp.json`** (repo root), with patterns
  relative to `src/`.
- Use `range.getValues()` (real numbers and dates), not `getDisplayValues()`.
- Months: `Utilities.formatDate(date, metaDataTimeZone, 'yyyy-MM')`, with the timezone from
  the Meta-Data sheet's `getSpreadsheetTimeZone()`. Never `toISOString()`.
- Pure functions take "now" as a parameter, so tests don't depend on today's date.

## Tests (all local, no Google account)
- **Columns:** found by name in any order; capitals and edge spaces ignored; a missing column
  gives the clear message; only row 1 is the header (the `rep` text in E74 is ignored).
- **Salesmen:** the 7 from the fixture; blank rows skipped; codes tidied; unknown region left out
  and listed; half-filled row listed; duplicate listed, first row used.
- **Months:** 1 Aug 2026 00:00 Karachi reads as `2026-08`, not `2026-07`; text `2026-11` works;
  bad text listed with its row.
- **Amounts:** `12345000`, `"12,345,000"`, `"Rs. 12,345,000"` all give 12345000; `"abc"`, `-5`,
  `1.5` listed; 0 means no target. Formatting gives `Rs. 12,345,000`.
- **Targets:** stray cells and the E74:I90 block ignored; SM's rows beside it read; duplicate
  salesman + month → no target and listed; MUB ignored without a message; missing → no target.
- **Region targets:** `UNASSIGNED` is House / office sales; an unknown region is listed.
- **Never writes to Meta-Data:** the whole Check setup runs against the fake that throws on any
  write.
- **Setup:** on a new spreadsheet, creates the 3 tabs with exact headers, makes `contact_phone`
  plain text, sets the timezone, fills Lists, deletes the empty `Sheet1`. Run again: changes
  nothing. An existing tab is left exactly as it was. A non-empty `Sheet1` is kept. A list
  with rows isn't refilled.
- **Summary:** shows each salesman, "no target" where there is none, the region targets, and
  either "Nothing to fix." or "Check these:" with the problems. (Checks the content, not every
  word, so wording can be polished freely.)
- **Safety:** the only public functions are `doGet`, `onOpen`, `menuCheckSetup`.
  `menuCheckSetup` refuses with no signed-in person, or when the script runs as someone else.
  `doGet` returns the placeholder with no data.

## Acceptance criteria
Checked locally by the agent:
- [x] `npm install` then `npm run check` pass on a clean clone (Node 22). *(2026-11-04, `npm ci`, Node 22.23)*
- [x] Every test under *Tests* exists and passes.
- [x] No secrets in git (no `.clasprc.json`, no tokens). The fixture uses made-up amounts.
- [x] `AGENTS.md` has a `## Commands` section with these commands, and its *Status* is updated.

Checked live with the owner:
- [x] The Sales Diary sheet is in the owner's Drive with **Sites**, **Activity**, **Lists**,
      headers exactly as in the data model; Lists holds the 11 categories in order, the 5 lost
      reasons and the 4 buyer types; no `Sheet1`.
- [x] Tapping **Check setup** again changes nothing in the sheet.
- [x] The summary shows the 7 salesmen in the right regions, this month's targets matching
      `Rep-Targets` (spot-check SJ, SM, IB), the region targets including House / office sales,
      and "Nothing to fix."
- [x] Meta-Data's version history shows **no edits** at the times Check setup was run. (The
      script runs as the owner, so check the times, not the name.)
- [x] The web address opens the placeholder page for the owner, and does **not** open in a
      private browser window.
- [x] `npx clasp status` lists only `appsscript.json`, the `.js` files and `Index.html`.
- [x] `npx clasp logout` was run at the end of the session.

## Out of scope
- The `Links` tab, link codes, owner link and owner screen (phases 2 and 7).
- Any salesman screen; adding or updating sites (phases 3+).
- Repairing tabs whose headers were changed by hand; caching Meta-Data; protecting tabs; a
  lock around setup (one owner, rarely run).
- Comparing region totals with salesmen's targets (owner's choice).

## Open questions
_None open._ Answered by the owner on 2026-11-04 (session 2):
1. **Which Google account owns the app and the Sales Diary sheet?** The owner's own account, the
   one that owns Meta-Data.
2. **Where is clasp logged in?** In the agent's cloud session, when needed, with `clasp logout`
   at the end. *Checked 2026-11-04: Google's sign-in and Apps Script servers answer from the cloud
   machine. The sign-in itself is first tried in build step 8; if it fails, the owner runs the push
   and deploy commands on his own computer instead.*
3. **One menu item or two?** One: **Check setup**.
4. **Meta-Data ID?** In the code (ADR-0007).
5. **Compare region totals with salesmen's targets?** No.
6. **Rows for people who have left?** Ignored silently.

# 001: Foundations

- **Status:** Draft
- **Owner approval:** _pending_
- **Related:** roadmap phase 1 · ADR-0001 (Sheets + Apps Script) · ADR-0003 (tooling) ·
  ADR-0004 (private lists) · ADR-0005 (two sheets) · ADR-0006 (owner link) ·
  [data model](../architecture/data-model.md)

## Why
Nothing can be built until there is a place to keep the data, a safe way to put code live, and a
reliable way to read salesmen and targets from the owner's Meta-Data sheet. This phase builds that
base, so every later phase is small, tested and safe. **Salesmen see nothing new yet.**

## What the owner sees and does

### Result of this phase
1. A new Google Sheet called **"Sales Diary"** in the owner's Google Drive, with four tabs:
   **Sites**, **Activity**, **Lists**, **Links**. Each has its header row and nothing else,
   except **Lists**, which comes filled with the product categories, lost reasons and buyer types.
2. A **Sales Diary** menu at the top of that sheet with two items:
   - **Set up tabs**: creates or repairs the tabs. Safe to run any time; it never deletes your data.
   - **Check Meta-Data**: reads the Meta-Data sheet and shows a plain-English summary (below).
3. A web address for the app. For now it shows only a "Sales Diary is set up" page, with no data,
   and **only the owner can open it**. Salesmen get their links in phase 2.

> The menu works in Google Sheets **on a computer** (any browser). Google's phone app for Sheets
> does not show custom menus. The salesmen's app itself (later phases) is phone-first.

### One-time setup (about 15 minutes, with the agent guiding)
1. **Turn on the Apps Script API** for the Google account (one switch at
   `script.google.com/home/usersettings`). clasp needs it to send code.
2. **Log clasp in** to that Google account (see open question 2 for where).
3. The agent runs `npx clasp create-script --type sheets --title "Sales Diary" --rootDir src`.
   This creates the Sales Diary sheet and its attached script together, and writes `.clasp.json`.
   It also copies Google's starter files into `src/`, overwriting `src/appsscript.json` and adding
   a starter code file. The agent deletes the starter file, restores ours
   (`git checkout -- src/appsscript.json`), then runs `npx clasp push --force` to send the code.
4. The owner opens the Sales Diary sheet on a computer and reloads it. The **Sales Diary** menu
   appears.
5. He taps **Sales Diary → Set up tabs**. The first time, Google asks him to allow the script to
   use his spreadsheets. He allows it. (Expect Google's "Google hasn't verified this app" warning.
   It's his own script, so he clicks *Advanced*, then *Go to Sales Diary (unsafe)*.)
6. The first time only, a box asks: **"Paste the link to your Mitchell Sales Meta-Data sheet."**
   He pastes it. The script checks that it can open it and that it has the `Rep_Mapping`,
   `Rep-Targets` and `Targets` tabs, then saves it. If not, it says what's wrong and saves nothing.
   (**Check Meta-Data** asks the same way if the link isn't saved yet.)
7. Setup creates the tabs and shows **"Sales Diary is ready."**
8. The agent deploys the web app (`npx clasp create-deployment`) and gives the owner the address.
   The deployment ID and address are recorded in `docs/plans/handoff.md`. They aren't secret on
   their own: without a link code (phase 2), the address opens nothing useful.

### Check Meta-Data: what the summary looks like
```
Salesmen found: 7
  North: RIA, AUR, WAK
  Center: SH, SJ, SM
  South: IB

Targets for November 2026
  RIA  Rs. 13,800,000
  ...
  IB   Rs. 1,500,000

Region targets for November 2026
  North                 Rs. 21,800,000  (matches its salesmen)
  Center                Rs. 6,400,000   (matches its salesmen)
  South                 Rs. 1,500,000   (matches its salesmen)
  House / office sales  Rs. 8,300,000

Problems: none

Notes
  Targets found for people not in the salesmen list: MUB (1 month). The app ignores them.
```
Every problem names the **tab and row number** so the owner can find it, e.g.
*"Rep-Targets row 40: target 'abc' is not a number. That row is ignored."*

### When something goes wrong
- **Meta-Data can't be opened** (deleted, access removed): *"Can't open the Meta-Data sheet.
  Check it still exists and this Google account can open it."* Nothing else runs.
- **A tab or column is missing or renamed:** *"Rep-Targets has no 'Target' column in row 1."*
  The app never guesses which column to use.
- **Setup run twice, or by two people at once:** the second run waits, then finds nothing to do.

## Rules

### General
- **The app never writes to Meta-Data** (ADR-0005). Its code reads Meta-Data through one small
  set of read-only functions; tests fail if anything tries to write to it.
- **Columns are found by their header name in row 1**, ignoring capitals and spaces at the
  ends. Column order doesn't matter. Only row 1 counts as the header.
- **Dates and months are Pakistan time.** Both spreadsheets and the script use `Asia/Karachi`.
- The Meta-Data sheet's ID is kept in the script's settings (a *Script Property*), not in the
  code (ADR-0005). The Sales Diary sheet's ID is saved there too, by setup.

### Reading `Rep_Mapping` (salesmen)
- Columns `Rep` and `Region`. Rows with both blank are skipped silently. A row with only one
  filled in is reported.
- `Rep` is trimmed and made upper-case (`" ria"` → `RIA`).
- `Region` must be North, Center or South (any capitals). Anything else → reported as a problem;
  that salesman is left out until fixed.
- The same `Rep` twice → reported. Same region both times: counted once. Different regions:
  left out until fixed.

### Reading `Rep-Targets` (salesman targets)
- Columns `Rep`, `Month`, `Target`. **Everything else on the tab is ignored**, including the owner's
  workings in E2 and E74:I90. A row is read only if `Rep`, `Month` and `Target` are filled in.
  A row with all three blank is skipped silently. A row with only some filled in is reported.
- **Month** may be a date cell (how the sheet stores it today) or text `YYYY-MM`. A date
  cell is turned into a month **using the Meta-Data sheet's own timezone** (`Asia/Karachi`).
  *Why this matters:* the cell "1 Aug 2026" is 31 Jul, 7 pm in UTC. Reading it in UTC would make
  every target one month early. A test pins this down.
- **Target** may be a number or text such as `13,800,000` or `Rs. 13,800,000`. Commas, `Rs.`
  and spaces are removed. It must then be a whole number of zero or more; anything else is reported
  and the row ignored.
- **A target of 0 means "no target"**, the same as a missing row.
- **The same salesman and month twice** → reported, and that salesman has **no target** for
  that month until it's fixed. The app doesn't pick one or add them up.
- A `Rep` not in `Rep_Mapping` (e.g. MUB's July 2026 row) is ignored and listed under *Notes*,
  not *Problems*.
- A salesman with no target for a month simply has none. That's not a problem. The summary
  shows him with "no target".
- *This month* always means the current month in Pakistan time.

### Reading `Targets` (region targets)
- Same rules as `Rep-Targets`, with `Region` in place of `Rep`.
- Allowed regions: North, Center, South, and `UNASSIGNED`, shown as **"House / office sales"**.
- For North, Center and South, the summary says whether the region target **matches the sum of
  its salesmen's targets** for that month, counting only salesmen now in `Rep_Mapping`. A mismatch is a *Note* (a warning), never an error.

### Setting up the Sales Diary sheet (Set up tabs)
- Tabs and headers are exactly those in the [data model](../architecture/data-model.md), in that
  order. The code keeps one list of them; a test checks that it matches the data model doc, so the
  two can't drift apart.
- **Missing tab** → created with its header row (bold, frozen).
- **Tab exists, headers complete** → left alone.
- **Tab exists, a header missing** → the missing header is added at the **end** of row 1.
  Existing columns are never moved, renamed or deleted. Columns the owner added are left alone.
- **No row, tab or value is ever deleted**, with one exception: the blank `Sheet1` tab that
  Google adds to a new spreadsheet is removed, **only** if it is completely empty, and only after
  the four tabs exist (Google won't delete a spreadsheet's last tab).
- The `contact_phone` column in **Sites** is set to plain text, so numbers like `923001234567`
  keep their exact digits and aren't shown as `9.23E+11`.
- The sheet's timezone is set to `Asia/Karachi`.
- **Lists** is filled per list (`product_category`, `lost_reason`, `buyer_type`) **only if
  that list has no rows yet**. The owner's edits are never overwritten. (If he deletes every
  row of a list, the next setup refills it.) Values and order are those in the
  [data model](../architecture/data-model.md) (`Lists` → starting contents), with
  `added_by` = `owner`, `active` = TRUE, `region` blank, `sort` = 10, 20, 30, …
  `area` starts empty (owner's answer A2).
- Setup holds a lock while it runs, so two runs can't collide.

### Safety rules for all code (from now on)
- **A web page can call any of the script's public functions.** Apps Script lets a page call
  any function whose name doesn't end in `_`. So:
  - Helper functions **end with `_`**, which keeps pages from calling them.
  - Public functions are kept to a short, fixed list. In phase 1 that's `doGet`, `onOpen`,
    `menuSetUpTabs` and `menuCheckMetaData`. A test fails if any other public function appears.
  - The two menu functions **refuse to run** unless a signed-in person is running them as
    themselves, which is what happens when the owner uses the menu in his sheet. A web app visitor
    is never that: the app runs as the owner on their behalf, and Google doesn't tell the script
    who the visitor is. (In code: the active user's email must be non-empty and equal to the
    effective user's email.)
- The web app in this phase is deployed **"only myself"** (only the owner can open it). Phase 2
  opens it to anyone with a valid link.
- **The Sales Diary sheet must never be shared**, and never set to "anyone with the link". From
  phase 2 it holds the link codes. Salesmen never get access to the sheet.

## Data
- **Reads (never writes):** Meta-Data `Rep_Mapping`, `Rep-Targets`, `Targets`, columns found by
  header.
- **Creates / writes:** Sales Diary tabs `Sites`, `Activity`, `Lists`, `Links` (header rows), and
  the starting rows in `Lists`.
- **Script settings:** `META_DATA_SPREADSHEET_ID`, `SALES_DIARY_SPREADSHEET_ID`.
- **Data model changes:** none. This spec builds exactly what
  [data-model.md](../architecture/data-model.md) v0.3 describes.

## How it's built (for agents)

### Tools (exact versions, checked 2026-11-04)
| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 22 or newer | Runs clasp, tests and the type check. |
| `@google/clasp` | 3.4.1 (pinned, dev dependency) | Sends code to Apps Script (ADR-0003). |
| `typescript` | 7.0.2 (pinned, dev dependency) | Type check only (`tsc`, no output files). Checked: v7 type-checks plain JS with JSDoc, across files, with the Apps Script types. |
| `@types/google-apps-script` | 2.0.14 (pinned, dev dependency) | Types for `SpreadsheetApp` and the rest. |
| Test runner | Node's built-in `node:test` | No extra package. |

`package-lock.json` is committed.

### Commands (add these to `AGENTS.md` → `## Commands` in the same change)
| Command | Does |
| --- | --- |
| `npm install` | Installs the tools above. |
| `npm test` | Runs all tests: `node --test "tests/**/*.test.js"`. No Google account needed. |
| `npm run typecheck` | `tsc -p .`, type-checks `src/`. |
| `npm run check` | Type check, then tests. **Must pass before every commit.** |
| `npx clasp push --force` | Sends `src/` to Apps Script. Needs clasp logged in. Always use `--force`: without it, clasp asks before replacing `appsscript.json`, and when nothing can answer (as in an agent session) it **skips the push silently**. Git is the source of truth. |
| `npx clasp create-deployment -d "<note>"` | Creates the web app **once** (first setup). Its address is new each time, so don't run it again. |
| `npx clasp update-deployment <deploymentId> -d "<note>"` | Puts the latest pushed code live **at the same address**. Use this for every update after the first. A new deployment would get a new address and break every link already sent. |

### Files
| Path | Holds |
| --- | --- |
| `package.json`, `package-lock.json`, `tsconfig.json` | Tooling. `tsconfig`: `allowJs`, `checkJs`, `noEmit`, `strict`, types `google-apps-script`, includes `src/**/*.js`. |
| `.clasp.json` | Script ID and `rootDir: "src"`. Created by `clasp create-script`. **Committed**: it holds IDs, not credentials. |
| `src/appsscript.json` | `timeZone: "Asia/Karachi"`, `runtimeVersion: "V8"`, `exceptionLogging: "STACKDRIVER"`, `webapp: { executeAs: "USER_DEPLOYING", access: "MYSELF" }`. |
| `src/config.js` | Tab names, header lists, starting `Lists` values, Script Property names. |
| `src/rules_metadata.js` | Pure functions, no Google calls: find columns, tidy rep codes, read months, parse Rs., build salesmen and targets, compare region sums, build the summary text. |
| `src/sheet_metadata.js` | The **only** code that opens Meta-Data. Read-only. |
| `src/sheet_setup.js` | Creates and repairs Sales Diary tabs, fills `Lists`. |
| `src/menu.js` | `onOpen`, `menuSetUpTabs`, `menuCheckMetaData`, owner-only check. |
| `src/webapp.js`, `src/Index.html` | `doGet` placeholder page. No data. |
| `tests/helpers/load-src.js` | Loads every `src/*.js` into one shared sandbox (like Apps Script's single global scope), with fake Google services. |
| `tests/helpers/fake-sheets.js` | Fake spreadsheets built from plain tables. The fake Meta-Data **throws on any write**. |
| `tests/fixtures/meta-data-sample.js` | Same **shape** as the real Meta-Data, including the stray cells, the E74:I90 block, SM's rows beside it, months as Karachi-midnight dates, one comma-text target, and MUB's July row. **Made-up amounts**: the owner's real target table stays out of git. |
| `tests/*.test.js` | The tests listed below. |

### Gotchas found while checking (2026-11-04)
- All `src/*.js` files share one global scope. Two functions with the same name in different
  files clash; `tsc` reports "Duplicate function implementation". Prefer `function`
  declarations. Top-level `const` values must not depend on other files.
- In the test sandbox, top-level `const` values aren't properties of the sandbox object. Read
  them with `vm.runInContext('NAME', ctx)`.
- Objects made inside the sandbox fail `assert.deepStrictEqual` against plain test objects
  (different built-in prototypes). Compare `JSON.parse(JSON.stringify(x))` instead.
- No `.claspignore` is needed. clasp's default rules push only `appsscript.json`, `*.js`, `*.gs`,
  `*.ts` and `*.html`, so `src/README.md` stays out. If one is ever added, it goes **next to
  `.clasp.json`** (repo root), not in `src/`, and its patterns are relative to `src/`.
- Use `range.getValues()` (real numbers and dates), not `getDisplayValues()`.
- Format months with `Utilities.formatDate(date, metaDataTimeZone, 'yyyy-MM')`, where the
  timezone comes from `getSpreadsheetTimeZone()` on the Meta-Data sheet. Never `toISOString()`.

## Tests (all local, no Google account)
- **Columns:** found by name whatever their order; ignores capitals and edge spaces; a missing
  column gives the clear error; only row 1 counts as the header (the `rep` text in E74 is ignored).
- **Salesmen:** the 7 from the fixture; blank rows skipped; codes trimmed and upper-cased;
  unknown region reported and left out; duplicate rep handled as in *Rules*.
- **Months:** a date for 1 Aug 2026 00:00 Karachi reads as `2026-08` (not `2026-07`);
  `2026-11` text reads as `2026-11`; bad text is reported with its row number.
- **Amounts:** `13800000`, `"13,800,000"`, `"Rs. 13,800,000"` all give 13800000; `"abc"`, `-5`
  and `1.5` are reported; 0 means no target.
- **Targets:** stray cells and the E74:I90 block are ignored; SM's rows beside it are read;
  duplicate salesman + month → no target and a problem; MUB → a note; a missing target → none.
- **Region targets:** `UNASSIGNED` shows as House / office sales; sums that match are marked so,
  and a mismatch gives a note.
- **Never writes to Meta-Data:** the whole Check Meta-Data flow runs against the fake that throws
  on any write.
- **Setup:** on an empty spreadsheet creates the 4 tabs with exact headers, removes the empty
  `Sheet1`, fills Lists. Run a second time, it changes nothing. A tab missing a header gets it
  added at the end. An owner-added column is kept. A non-empty `Sheet1` is kept. Lists are not
  refilled when a list already has rows. `contact_phone` is plain text. Timezone is
  `Asia/Karachi`.
- **Docs match code:** the header lists in `config.js` equal the column tables for each Sales
  Diary tab in `docs/architecture/data-model.md`, and the starting Lists values match.
- **Safety:** the only public functions are `doGet`, `onOpen`, `menuSetUpTabs` and
  `menuCheckMetaData`. The menu functions refuse when there is no signed-in person, or when
  the script is running as someone other than that person (as it does for web app visitors).
- **Summary text:** the fixture produces the expected summary, word for word.

## Acceptance criteria

Checked locally by the agent:
- [ ] `npm install` then `npm run check` pass on a clean clone (Node 22).
- [ ] Every test listed under *Tests* exists and passes.
- [ ] No secrets in git: no `.clasprc.json` and no tokens. The fixture uses made-up amounts.
- [ ] `AGENTS.md` has a `## Commands` section with the exact commands, and its *Status* line is
      updated.

Checked live with the owner:
- [ ] The Sales Diary sheet exists in the owner's Drive with the 4 tabs and headers exactly as in
      the data model, and Lists holds the 11 categories in order, the 5 lost reasons and the
      4 buyer types.
- [ ] **Set up tabs** run a second time changes nothing.
- [ ] **Check Meta-Data** on the real sheet shows 7 salesmen in the right regions, this month's
      targets matching `Rep-Targets` (spot-check SJ, SM and IB), region targets including House /
      office sales, and no unexpected problems.
- [ ] Meta-Data's version history shows **no edits** at the times setup and Check Meta-Data were
      run. (The script runs as the owner, so check the times, not the name.)
- [ ] The web app address opens the placeholder page for the owner. In a private browser window
      (not signed in) it does **not** open.
- [ ] `npx clasp status` lists only `appsscript.json`, the `.js` files and `Index.html`.

## Out of scope
- Salesman and owner links, link codes, the owner screen (phases 2 and 7).
- Any screen for salesmen, adding or updating sites (phases 3+).
- Speed tweaks such as caching Meta-Data (later, if needed).
- Protecting tabs from accidental edits by the owner.

## Open questions
1. **Which Google account owns the app and the Sales Diary sheet?** It must be able to open
   Meta-Data, and the app runs as this account. *(Recommended: the account that owns Meta-Data
   today.)* Alternative: a separate company account, with Meta-Data shared to it.
2. **Where is clasp logged in?** clasp needs a one-time login to that Google account to send code.
   - *(Recommended)* **In the agent's cloud session, when needed.** The owner signs in with
     `clasp login --no-localhost` (he opens a Google link and pastes back a code). The agent can then
     push and deploy without the owner running commands. The login stays inside that session's
     temporary machine, is never committed or printed, and the agent runs `clasp logout` at the end.
     Each new session needs a fresh login. *Not yet tried from the cloud machine; if Google's
     servers can't be reached from there, fall back to the next option.*
   - **On the owner's own computer.** He installs Node 22 and runs the push and deploy commands
     himself, following a short guide. His login never leaves his computer, but every code change
     needs him at that computer.

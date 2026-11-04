# Build plan 001: Foundations

> For [spec 001](../specs/001-foundations.md) (**Approved** 2026-11-04).
> Each step is small, ends with `npm run check` passing (from step 1 on), and is one commit.
> Tick the box when the step is committed, so the next session can pick up where this one stopped.
> If a step reveals something the spec didn't foresee, stop and update the spec (and ask the owner
> if it's his call) before carrying on.

## Ground rules for every step
- Read the spec's *Rules*, *Safety rules* and *Gotchas* before writing code.
- Helper function names end in `_`. Public functions are only `doGet`, `onOpen`, `menuCheckSetup`.
- Build only what the step needs. Fakes get only the methods the code actually calls.
- No real target amounts, link codes or phone numbers in git.

---

## Steps 1–7: local, no Google account needed

### [x] Step 1: Tooling skeleton
- `package.json`: `"private": true`, `"engines": { "node": ">=22" }`, exact-pinned dev
  dependencies (`@google/clasp` 3.4.1, `typescript` 7.0.2, `@types/google-apps-script` 2.0.14),
  scripts `test` (`node --test "tests/**/*.test.js"`), `typecheck` (`tsc -p .`), `check`
  (`npm run typecheck && npm test`).
- `tsconfig.json` as in the spec. `npm install` creates `package-lock.json`.
- `src/appsscript.json` as in the spec.
- `src/config.js`: Meta-Data ID (`11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc`), tab names,
  header lists for `Sites`, `Activity`, `Lists` **copied exactly from data-model.md**, starting
  `Lists` values (11 categories in order, 5 lost reasons, 4 buyer types, from data-model.md and the
  glossary).
- `tests/helpers/load-src.js`: reads every `src/*.js` in name order and runs them in one
  `node:vm` context that's given the fakes.
- `tests/load-src.test.js`: the sandbox loads; config values are readable through
  `vm.runInContext`.
- **Done when:** `npm run check` passes on Node 22.
- Commit: "Add tooling: package.json, tsconfig, test loader, config".

### [x] Step 2: Fakes
- `tests/helpers/fakes.js`, kept minimal:
  - Fake spreadsheet built from `{ tabName: [[row], …] }` plus a timezone. Lets a test read back
    every tab's values and formats. Has a **read-only** mode where every write method throws.
  - Fake `Utilities.formatDate` supporting only the patterns the code uses (`yyyy-MM`), built on
    `Intl.DateTimeFormat` with the given timezone.
  - Fake `SpreadsheetApp` (`openById`, `getActiveSpreadsheet`, `getUi` that records alerts and
    menus), `Session` (active and effective user email), `HtmlService`.
- `tests/fakes.test.js`: read-only mode throws on writes; `formatDate` turns
  `2026-07-31T19:00:00Z` into `2026-08` for `Asia/Karachi`.
- **Done when:** `npm run check` passes.
- Commit: "Add minimal fakes for Google services".

### [x] Step 3: Rules and fixture
- `tests/fixtures/meta-data.js`: the real sheet's **shape** with made-up amounts. `Rep_Mapping`
  has the 7 salesmen. `Rep-Targets` has rows grouped as on the live sheet (RIA, SH, AUR, WAK, MUB's
  single July row, SJ from Aug, IB), a value in E2, the E74:I90 block (with `rep` text in E74),
  and SM's rows in A74:C84 beside it. Months are `Date`s at Karachi midnight; one target is
  comma text. `Targets` has North, Center, South and UNASSIGNED rows. Edge cases go in small
  tables inside each test, not in the fixture.
- `src/rules.js`: `findColumns_`, `tidyCode_`, `monthKey_`, `monthLabel_` (`2026-11` →
  `November 2026`, from a fixed month-name list), `parseRs_`, `formatRs_` (`Rs. 12,345,000`,
  built by hand, not with locale functions), `readSalesmen_`, `readTargets_` (one function used
  for both `Rep-Targets` and `Targets`), `buildSummary_`. Every problem includes its tab and row
  number. "Now" is a parameter.
- `tests/rules.test.js`: the spec's *Columns*, *Salesmen*, *Months*, *Amounts*, *Targets*,
  *Region targets* and *Summary* tests.
- **Done when:** `npm run check` passes.
- Commit: "Add Meta-Data reading rules with tests".

### [x] Step 4: Read Meta-Data
- `src/metadata.js`: `readMetaData_()` *(built without `now`: reading doesn't depend on the date;
  `buildSummary_(data, now)` does)* opens the Meta-Data sheet by its ID (and only ever
  reads it), finds the three tabs,
  reads each with `getDataRange().getValues()`, gets the timezone from `getSpreadsheetTimeZone()`,
  and hands everything to the rules. It returns either the results or one clear message (can't
  open the sheet / tab missing / column missing). **The only file that opens Meta-Data.**
- `tests/metadata.test.js`: the fixture in read-only mode gives the expected salesmen and
  targets; can't open → the message; missing tab → the message.
- **Done when:** `npm run check` passes.
- Commit: "Read salesmen and targets from Meta-Data (read-only)".

### [x] Step 5: Set up the Sales Diary tabs
- `src/setup.js`: `setUpSalesDiary_(ss)` per the spec's *Setting up* rules: create missing tabs
  (bold, frozen header), make `contact_phone` plain text on a new `Sites`, set the timezone,
  fill each empty list in `Lists`, delete an empty `Sheet1` last.
- `tests/setup.test.js`: the spec's *Setup* tests, including "run twice changes nothing" (compare
  every tab's values and formats before and after the second run).
- **Done when:** `npm run check` passes.
- Commit: "Create Sales Diary tabs and starting Lists".

### [x] Step 6: Menu and placeholder web app
- `src/menu.js`:
  - `onOpen()` adds **Sales Diary → Check setup**. No signed-in check.
  - `isSignedInSelf_()`: active user's email is non-empty and equals the effective user's.
  - `menuCheckSetup()`: if `isSignedInSelf_()` fails, throw a short error and do nothing else.
    Otherwise run `setUpSalesDiary_(SpreadsheetApp.getActiveSpreadsheet())`, then
    `readMetaData_()`, then show the summary or the message with `ui.alert`. Setup runs
    first, so the tabs exist even when Meta-Data can't be read.
- `src/webapp.js` + `src/Index.html`: `doGet()` returns `Index.html` titled "Sales Diary", with a
  phone viewport tag. The page says only "Sales Diary is set up." No data, no server calls.
- `tests/menu.test.js`: the public functions defined by `src/` (names in the sandbox after loading,
  minus the fakes put in before, that are functions and don't end in `_`) are exactly `doGet`,
  `onOpen`, `menuCheckSetup`; `menuCheckSetup` refuses with an empty active email and with mismatched
  emails, and touches nothing when it refuses; a full run against the fakes creates the tabs and
  shows the summary; Meta-Data stays untouched (read-only fake); `doGet` returns the placeholder.
- **Done when:** `npm run check` passes.
- Commit: "Add Check setup menu and placeholder web app".

### [x] Step 7: Docs and local acceptance
- `AGENTS.md`: add `## Commands` (exact commands from the spec) and update *Status*.
- Spec status → `In progress`. Update `handoff.md`.
- Fresh-clone check: clone the branch into the scratchpad, `npm ci`, `npm run check`.
- Confirm no secrets or real amounts in git (`git grep` for `clasprc`, `token`, and the live
  sheet's amounts).
- **Done when:** the spec's *Checked locally* boxes are all true.
- Commit: "Document commands; phase 1 local work complete".

---

## Step 8: live setup (with the owner, in one sitting)

### [x] Step 8: Put it live
1. **Owner:** turns on the Apps Script API at `script.google.com/home/usersettings`.
2. **Agent:** `npx clasp login --no-localhost`. **Owner:** opens the printed link, signs in,
   pastes back the code. If this fails from the cloud machine, stop: switch to the owner running
   the commands on his computer (spec, open question 2) and update the spec.
3. **Agent:** `npx clasp create-script --type sheets --title "Sales Diary" --rootDir src`. Then:
   delete the starter code file it added to `src/`, `git checkout -- src/appsscript.json`, check
   `git status` shows only the new `.clasp.json`, then `npx clasp status` (only `appsscript.json`,
   the `.js` files and `Index.html`), then `npx clasp push --force`.
4. **Owner:** opens the Sales Diary sheet on a computer, reloads, taps **Sales Diary → Check
   setup**, approves the permissions, taps it again, and tells the agent what the pop-up says.
5. **Agent:** reads the Sales Diary sheet through the Google Sheets connector and checks the tabs,
   headers and `Lists` against the data model. Owner taps **Check setup** once more; agent confirms
   nothing changed. Agent checks the targets shown match the live `Rep-Targets` for this month.
6. **Agent:** `npx clasp create-deployment -d "phase 1"`. Records the deployment ID and web
   address in `handoff.md`. **Owner:** opens the address (placeholder shows) and opens it in a
   private window (it doesn't).
7. **Owner:** checks Meta-Data's version history shows no edits at the times of step 4–5.
8. **Agent:** commits `.clasp.json`; `npx clasp logout`.
- **Done when:** the spec's *Checked live* boxes are all true.
- Commit: "Phase 1 live: Sales Diary sheet created, web app deployed".

## [x] Step 9: Close out
- Spec status → `Done`; roadmap phase 1 → ✅; `handoff.md` → next is the phase 2 spec (links).
  The handoff must carry forward: the deployment ID (always `update-deployment`, never a second
  `create-deployment`), `ANYONE_ANONYMOUS` for phase 2, and that phase 2 decides how the web app
  finds the Sales Diary sheet.
- Commit: "Close phase 1".

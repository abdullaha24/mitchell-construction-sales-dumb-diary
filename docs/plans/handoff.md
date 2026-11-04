# Handoff: start here

> Updated 2026-11-04 at the end of session 3. **Every session: read this first, and update it
> before you finish** (what's done, what's next, which questions are still open).

## Where we are
- **Phase 0 is done** (sessions 1–2): repo shell, agent rules, vision v0.3, glossary, ADRs
  0001–0007 (all Accepted), roadmap v0.3. The owner answered every open question; answers are in
  `docs/product/open-questions.md` → *Answered*. The team is **7 salesmen**: RIA, AUR, WAK
  (North), SH, SJ, SM (Center), IB (South).
- **Session 3: build steps 1–7 of `docs/plans/001-foundations-plan.md` are done** (local work,
  one commit per step, branch `claude/clever-hopper-ain3c5`). Spec 001 is **In progress**.
  - `src/`: `config.js`, `rules.js`, `metadata.js`, `setup.js`, `menu.js`, `webapp.js`,
    `Index.html`, `appsscript.json`. What each holds: `src/README.md`.
  - `npm run check` (type check + 96 tests) passes, including on a fresh clone with `npm ci`.
  - Every rule and safety check was also tested by breaking the code on purpose: each break
    was caught by at least one test.
  - An independent reviewer agent read the code against the spec. Nothing high-severity, and
    nothing can write to Meta-Data. Its five medium/low points were fixed, each with a test:
    a 0 target no longer makes a duplicate; a salesman's first `Rep_Mapping` row counts even if
    broken; formula targets a hair off a whole number (e.g. `7700000.000000001`) count; setup
    adds rows before writing past a tab's last row; the safety-check wording was corrected.
  - `npx clasp show-file-status` (with a throwaway `.clasp.json`) lists only
    `appsscript.json`, the 6 `.js` files and `Index.html`.
- **Spec 001 is now v2.1**: small build clarifications marked *(v2.1)*, none changing what the
  owner sees in a normal run (the review fixes above; `Lists` problems listed under *Check
  these*; the timezone written only when different, so a repeat run makes zero edits;
  "completely empty `Sheet1`" also means no charts or images; two corrected statements).
- **Owner answer S3-1:** real target amounts were removed from the docs and replaced with
  made-up ones (older git history still has them; no rewrite unless he asks).
- **Nothing is live yet.** No Sales Diary sheet, no Apps Script project, no `.clasp.json`.

## Next
**Build step 8: put it live, with the owner present** (about 15 minutes, at a computer). Follow
`docs/plans/001-foundations-plan.md` → Step 8 exactly. In short:
1. Owner turns on the **Apps Script API**: `script.google.com/home/usersettings`.
2. Agent runs `npx clasp login --no-localhost`; owner opens the link, signs in, pastes the code
   back. If sign-in fails from the cloud machine, stop and switch to the owner running the
   commands on his computer (spec 001, open question 2).
3. Agent: `npx clasp create-script --type sheets --title "Sales Diary" --rootDir src`, delete
   the starter code file it adds to `src/`, `git checkout -- src/appsscript.json`, check
   `git status` shows only `.clasp.json` new, `npx clasp show-file-status`, then
   `npx clasp push --force`.
4. Owner opens the sheet on a computer, reloads, taps **Sales Diary → Check setup**, allows the
   permissions (the "Google hasn't verified this app" warning is normal), taps it again.
   If the blank first tab isn't called `Sheet1` (e.g. a non-English Google account), setup
   leaves it alone: the owner deletes it by hand, and the agent notes the name here.
5. Agent checks the tabs via the Google Sheets connector; owner taps Check setup once more;
   agent confirms nothing changed and the targets match the live `Rep-Targets`.
6. Agent: `npx clasp create-deployment -d "phase 1"` (**once only**), records the deployment ID
   and address here. Owner opens it (placeholder shows) and in a private window (it doesn't).
7. Owner checks Meta-Data's version history shows no edits at those times.
8. Agent commits `.clasp.json`, then **`npx clasp logout`**.

Then **step 9** (close phase 1) and the **phase 2 spec** (private links). Phase 2 must carry
forward: always `update-deployment` with the recorded ID, never a second `create-deployment`;
the web app becomes `ANYONE_ANONYMOUS` (not `ANYONE`); and phase 2 decides how the web app finds
the Sales Diary sheet.

## Things learned in session 3 (keep in mind)
- **`tsc` does not catch a function defined in two `src/` files** (plain JS allows it; in Apps
  Script the last-loaded file silently wins). `tests/load-src.test.js` catches it instead. The
  spec's old gotcha said otherwise; corrected.
- The only public functions are `doGet`, `onOpen`, `menuCheckSetup`; `tests/menu.test.js`
  enforces it. Phase 2 will add public server functions for the page: update that test
  deliberately, and each new one must check the link code first (ADR-0002).
- `contact_phone` in `Sites` is plain text for the first 1,000 rows only (Google's default tab
  size). Phase 3 code that writes phones must still write them as text.
- `npm audit` reports 8 issues (6 moderate, 2 high), all inside clasp 3.4.1's own dependencies
  (glob/minimatch, zod). clasp is a local tool; none of it is pushed to Apps Script. Fixing them
  means changing the pinned clasp version: not done.

## Questions for the owner
None open. Ask new ones the owner's way:
- One question at a time.
- Tappable options. Use the multiple-choice question tool if you have one (Claude Code:
  `AskUserQuestion`); otherwise give numbered options.
- Put your recommended option first and mark it **(Recommended)**. For pure facts only the owner
  knows, say there's no recommendation.
- Plain English, no jargon.

## Useful facts
- Meta-Data spreadsheet: "Mitchell Sales Meta-Data", ID `11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc`
  (in the owner's Google Drive). Structure documented in `docs/architecture/data-model.md`.
  **Never edit it without the owner's explicit OK in that session.**
- Tools (checked 2026-11-04): Node 22, clasp 3.4.1, TypeScript 7.0.2, `@types/google-apps-script`
  2.0.14, all exact-pinned in `package.json`. `clasp push` needs `--force` in a non-interactive
  shell or it silently skips. Meta-Data months are dates and are read in the sheet's own timezone.
- Branches: session 1 `claude/vigilant-volta-yye9pn`, session 2 `claude/laughing-fermi-ec4tlp`
  (merged into the default branch), session 3 `claude/clever-hopper-ain3c5` (no PR opened).

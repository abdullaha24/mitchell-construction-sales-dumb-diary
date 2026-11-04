# Handoff: start here

> Updated 2026-11-04, session 3. **Every session: read this first, and update it before you
> finish** (what's done, what's next, which questions are still open).

## Where we are
- **Phase 0 (planning) done** in sessions 1–2. All owner answers are in
  `docs/product/open-questions.md` → *Answered*. Team: **7 salesmen**, RIA, AUR, WAK (North),
  SH, SJ, SM (Center), IB (South).
- **Phase 1 (foundations, spec 001) is Done and live** (session 3, 2026-11-04):
  - The **Sales Diary** sheet exists in the owner's Drive with `Sites`, `Activity`, `Lists`
    (headers exactly as in the data model, starting lists filled, timezone `Asia/Karachi`, no
    `Sheet1`).
  - **Sales Diary → Check setup** works: it showed the 7 salesmen in the right regions and
    November 2026 targets that matched `Rep-Targets` and `Targets` line by line, then
    "Nothing to fix." A second tap changed nothing, and Meta-Data was not edited (checked with
    Google's revision IDs and by the owner in version history).
  - The placeholder web app is deployed for **"only myself"**: it opens for the owner, and asks
    anyone else to sign in.
  - `npm run check`: type check + 96 tests pass. An independent reviewer agent found nothing
    high-severity; its five smaller points were fixed with tests.
  - clasp was signed out at the end (`npx clasp logout`, then the empty `~/.clasprc.json`
    deleted).

## Next
**Write the phase 2 spec: private links** (`docs/specs/002-private-links.md`, from
`_template.md`), status `Draft`, and get the owner's approval before any code. Roadmap phase 2:
create the `Links` tab; the owner creates, sends and cancels links (ADR-0002), including his own
owner link (ADR-0006); the web app opens to `ANYONE_ANONYMOUS`. Done when a link shows "Hello,
RIA" and a cancelled or fake link shows nothing. Phase 2 must also decide:
- how the web app finds the Sales Diary sheet (a bound script's web app can't rely on "the
  active spreadsheet");
- whether link codes stay in the visible `Links` tab or move to hidden storage (data model);
- how the owner creates, sends and cancels a link (a menu item in the sheet is the natural
  fit, since he already uses **Sales Diary → Check setup**).

Carry forward into phase 2:
- **Never run `create-deployment` again.** Put new code live with
  `npx clasp push --force` then
  `npx clasp update-deployment AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF -d "<note>"`,
  so the address salesmen get never changes.
- Access becomes `ANYONE_ANONYMOUS` ("Anyone"), **not** `ANYONE` (forces a Google sign-in).
- Every new public function must check the link code first (ADR-0002) and only return that
  salesman's data (ADR-0004); update the allow-list in `tests/menu.test.js` on purpose.
- `menuCheckSetup`'s safety check passes for the owner himself, signed in, even from a web
  page (harmless today; don't rely on it as "came from the menu").

## How to sign clasp in from a cloud session (worked 2026-11-04)
`npx clasp login --no-localhost` prints a Google link and waits. The owner signs in; Google then
sends his browser to a `http://localhost:8888/?state=…&code=…` address that doesn't load. He
pastes that **whole address** back. The clasp process must still be running (it holds the
matching one-time secret), so start it in the background reading from a pipe:
```bash
mkfifo "$S/clasp-in" && exec 3<>"$S/clasp-in" && npx clasp login --no-localhost <&3 > "$S/clasp-login.log" 2>&1
```
(`$S` = the scratchpad; run it as a background command.) Read the link from the log, then
`printf '%s\n' '<pasted address>' > "$S/clasp-in"`. Check that the `state=` value matches the
link's. Delete the log afterwards. At the end of the session: `npx clasp logout` and delete
`~/.clasprc.json` if it is left behind.

## Things learned (keep in mind)
- **`tsc` does not catch a function defined in two `src/` files** (plain JS allows it; in Apps
  Script the last-loaded file silently wins). `tests/load-src.test.js` catches it.
- `clasp create-script` overwrote `src/appsscript.json` with Google's default (timezone
  `America/New_York`, no web app settings); it was restored from git before pushing. Watch for
  this on any `clasp pull`.
- `contact_phone` in `Sites` is plain text for the first 1,000 rows only. Phase 3 code that
  writes phones must still write them as text.
- `npm audit` reports 8 issues inside clasp 3.4.1's own dependencies. Local tool only; not
  pushed to Apps Script. Not fixed (would change the pinned clasp).
- Real target amounts stay out of git (owner answer S3-1). Read them live for checks; never
  paste them into files.

## Questions for the owner
None open. Ask new ones the owner's way:
- One question at a time.
- Tappable options. Use the multiple-choice question tool if you have one (Claude Code:
  `AskUserQuestion`); otherwise give numbered options.
- Put your recommended option first and mark it **(Recommended)**. For pure facts only the owner
  knows, say there's no recommendation.
- Plain English, no jargon. The owner prefers brisk check-ins: don't over-explain routine steps.

## Useful facts
IDs below aren't secret: each needs the owner's Google account to open.
- **Meta-Data** sheet: "Mitchell Sales Meta-Data", ID `11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc`.
  **Never edit it without the owner's explicit OK in that session.**
- **Sales Diary** sheet: ID `1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y`
  (https://docs.google.com/spreadsheets/d/1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y/edit).
  **Never share it** (from phase 2 it holds link codes).
- **Apps Script project** (bound to Sales Diary): script ID
  `162yqNmzGZgMbFQ31U5ozY99SVyapohvTFDFMB8AVxePihSeKIpUhdTlg`, in `.clasp.json`.
- **Web app deployment** "phase 1", version 1: ID
  `AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF`, address
  https://script.google.com/macros/s/AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec
- Tools: Node 22, clasp 3.4.1, TypeScript 7.0.2, `@types/google-apps-script` 2.0.14 (exact pins).
  `clasp push` needs `--force` in a non-interactive shell or it silently skips.
- Branches: session 1 `claude/vigilant-volta-yye9pn`, session 2 `claude/laughing-fermi-ec4tlp`
  (merged into the default branch), session 3 `claude/clever-hopper-ain3c5` (no PR opened yet).

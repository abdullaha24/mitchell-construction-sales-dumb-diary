# AGENTS.md

Instructions for AI coding agents working in this repo. Keep this file short and true.
If something here is out of date, fix it in the same change.

## Start of every session

0. **clasp is signed in for you** by the SessionStart hook (`.claude/hooks/session-start.sh`): it
   copies the owner's clasp login from his private repo `abdullaha24/tony-ngo`
   (`context/secrets/clasprc.json`) to `~/.clasprc.json`. Look for "clasp … ready; login restored".
   If it says NOT restored: attach that repo with the `add_repo` tool (`read` access), clone it to
   `/home/user/tony-ngo`, then run the hook again. **Never ask the owner to sign in, never
   `clasp logout`, never copy the login into this repo** (owner, 2026-11-11).
1. Read **`docs/plans/handoff.md`**: current state, next step, and questions for the owner.
2. If it lists open questions, **ask the owner those first**, in the way it describes
   (one at a time, tappable options, recommended option marked).
3. Before you finish, update `handoff.md` so the next session can pick up cold.

## What this is

**Sales Diary** (working name): a phone-first pocket diary for the 7 field salesmen of a small
Pakistani construction-chemicals company, in three regions (North, Center, South).
Each salesman opens a personal link, sees who to chase today, and logs visits, quotes, wins and
losses in a few taps. The owner gets his own screen plus a written record in Google Sheets.

Read before any product or UI work:
- `docs/product/vision.md`: what we're building and why
- `docs/product/glossary.md`: domain words (thekedar, ugrahi, the sales stages, buyer types)
- `docs/product/open-questions.md`: owner decisions (Answered) and what's still open

## Status

**Live as deployment version 14** (2026-11-11): phases 0–7 (specs 001–008), summaries (009–010) and
spec 011 (Mitchell look, tappable summaries for the review meeting, Plan tab, new contact person).
Launched to the 7 salesmen on 2026-11-05; bugs are fixed as they come in. Next: the owner's checks,
the daily region message (spec 012, Approved 2026-11-12, built, not yet live), then the speed pass (spec 013). Current state, next step and IDs: `docs/plans/handoff.md`.

## Commands

Node 22 or newer. All checks run locally with no Google account.

| Command | Does |
| --- | --- |
| `npm install` | Installs the pinned tools (clasp, TypeScript, Apps Script types). `npm ci` on a clean clone. |
| `npm test` | All tests: `node --test "tests/**/*.test.js"`. |
| `npm run typecheck` | `tsc -p .`: type-checks `src/` (plain JS with JSDoc). |
| `npm run check` | Type check, then tests. **Must pass before every commit.** |
| `npm run check:browser` | Drives the owner's Links window, the salesman's page, the admin's screen, both summary screens and the Daily message (also in 300 seeded random sequences) in Chromium (the pages run against the real server code and fake sheets). Needs Playwright; skips if it isn't installed. Run it when any `.html` changes. |
| `npm run guide` | Rebuilds the PDF user guides (`docs/guide/`: salesmen's and Admin's) from fresh screenshots on fake data. Needs Playwright. **Only when the owner asks** (2026-11-11: not wanted for now). |
| `npx clasp push --force` | Sends `src/` to Apps Script. Always `--force`: without it, in a non-interactive shell clasp **silently skips** the push. Git is the source of truth. |
| `npx clasp show-file-status` | Lists the files a push would send (should be `appsscript.json`, the `.js` files and the `.html` files in `src/`). |
| `npx clasp create-deployment -d "<note>"` | Creates the web app. **Once only**: each run makes a new address. |
| `npx clasp update-deployment <deploymentId> -d "<note>"` | Puts the latest pushed code live **at the same address**. Use this for every update after the first. The deployment ID is in `docs/plans/handoff.md`. |

Code rules that tests enforce (the tests are the source of truth; keep this list short):
- **Public functions** (any page can call them, with any arguments) are an allow-list in
  `tests/menu.test.js` (21). Helpers end in `_`. Every `menu…` / `owner…` function (run from the
  sheet) starts with the signed-in-owner check; every `rep…` function with `requireRep_(k)` inside
  `forSalesman_`, and returns only that salesman's data (ADR-0004); every `adminPage…` function
  (the owner's screen, opened by link) with `requireAdminLink_(k)` inside `forAdminPage_`
  (ADR-0010). A test checks each kind. Adding one: update the allow-list and the spec.
- **No function name in two `src/` files** (tsc doesn't catch it for JS).
- Only `src/metadata.js` opens Meta-Data (read-only); only `src/diary.js` opens Sales Diary by ID.
- **Every typed or picked text written to a sheet goes through `asText_` / `textify_`** (no
  formulas); an existing row gets only its changed cells written.
- A salesman call opens Sales Diary once and a save reads each tab once, inside the lock
  (`tests/speed.test.js`); replies carry only the changed card. `Activity` is never read whole
  (bottom-up blocks, `activitySince_`). Pages are served through `servedHtml_` (comments and
  indentation removed, no build step); the served salesman's page stays ≤ 84,000 bytes (spec 011) and the
  admin's has its own pin (`tests/served.test.js`).
- Link codes never go into git, logs or errors, and onto no page except the owner's Links
  window and the code holder's own page.
- **Words on screen say "Admin", never "owner"** (owner P7-7). In code and docs "owner" is fine;
  the `Links.role` value stays `owner`.
- `src/appsscript.json` is pinned by a test: access `ANYONE_ANONYMOUS`, never `ANYONE`.

**Git:** `main` is the only branch and holds the live code. **Work, commit and push on `main`
directly**: no feature branches, no PRs, even if a session's setup names another branch (owner,
2026-11-11: he is the only maintainer). If a session starts on another branch, check it is fully in
`main` (`git merge-base --is-ancestor`), switch to `main` and ignore it.

**Deploying:** the owner gave a **standing OK** (2026-11-11) for the agent to push to `main`,
`clasp push --force` and `clasp update-deployment` on the existing deployment ID without asking
each time, once `npm run check` (and `check:browser` when `.html` changed) pass. **Never
`create-deployment`**: a new address breaks every salesman's link. Data changes to the live sheets
and anything that touches Meta-Data still need his OK.

## Where things live

| Path | What goes there |
| --- | --- |
| `docs/product/` | Vision, glossary, open questions. The owner's intent. |
| `docs/specs/` | One spec per feature, written **before** the code. Copy `_template.md`. |
| `docs/architecture/` | How the system fits together, and the Google Sheet data model. |
| `docs/decisions/` | ADRs: one file per significant decision. Copy `_template.md`. |
| `docs/guide/` | The PDF user guides, salesmen's and Admin's (built by `npm run guide`; don't edit by hand). |
| `docs/plans/` | `handoff.md` (start here), roadmap, step-by-step build plans. |
| `src/` | Apps Script source (server code + HTML); clasp's `rootDir`. What each file holds: `src/README.md`. |
| `tests/` | Automated tests (no Google account needed) and browser checks; see `tests/README.md`. |
| `scripts/` | Helper scripts; `scripts/README.md` lists them (e.g. the user guide builder). |

## How to work

0. **Brainstorm the owner's way** (owner, 2026-11-12). For any new idea, put on the product-manager
   hat and **interview him before any code**: **one question at a time** (never a batch), each with
   **4 tappable options** and **your recommended one first, marked "(Recommended)"**; he picks, you
   ask the next. Ground recommendations in the live data where you can (read only). Show a mockup
   (a picture, or the exact message text) for anything he will see. No code until he expressly
   approves the spec.
1. **Spec first.** No feature code without a spec in `docs/specs/` that the owner has approved
   (status `Approved`). If none exists, write a `Draft` spec and stop for review.
2. **Decisions go in ADRs.** Choosing a library, changing the data model, changing how links or
   auth work: write an ADR in `docs/decisions/`. Don't silently reverse an `Accepted` ADR.
3. **Data model changes** update `docs/architecture/data-model.md` in the same change.
4. **Unknowns go in `docs/product/open-questions.md`.** Don't guess about the business. Ask.

## Product rules (non-negotiable)

- **Stupidly simple.** The users are not tech people. They use WhatsApp, not spreadsheets.
- **Plain words in the UI.** No jargon ("pipeline", "CRM", "lead score" stay out of screens).
  Use the words in the glossary. English UI for now; content may be Urdu, English or Roman Urdu.
- **Taps over typing.** Big buttons, pick-lists, at most ~5 visible inputs per screen.
- **Never make them type the same thing twice.** Pick existing sites; don't re-enter them.
- **Phone first.** Design for a cheap Android phone on a weak mobile connection.
- **Built for the salesman, not just the boss.** Every screen must help the salesman do his day.

## Technical guardrails

- Backend is Google Sheets + Google Apps Script web app (ADR-0001). Don't add servers or paid services.
- Never commit secrets or credentials: `.clasprc.json`, OAuth tokens, rep link tokens, phone lists.
- Rep links are secrets. See ADR-0002 before touching identification or links.
- A salesman only ever gets his own sites and activity (ADR-0004). The yes/no duplicate-phone
  check is the only exception. Test this on every new server function.
- Salesmen and targets are **read** from the owner's "Mitchell Sales Meta-Data" sheet. **Never
  write to it.** App data goes in the "Sales Diary" sheet (ADR-0005).
- Times are Pakistan time (`Asia/Karachi`). Money is PKR (Rs.).

## Definition of done

- The linked spec's acceptance criteria are met.
- Tests (once they exist) pass locally, and new logic has tests.
- Docs touched by the change are updated: spec status, data model, ADRs, this file.
- No regressions to existing flows.

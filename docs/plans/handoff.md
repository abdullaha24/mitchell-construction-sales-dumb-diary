# Handoff: start here

> Updated 2026-11-04, end of session 3. **Every session: read this first, and update it before
> you finish.** Then read `AGENTS.md` (rules, commands) if you haven't.

## Where we are
**Phases 0–4b are done and live** (deployment version 5). A salesman opens his private link
on his phone and:
- sees **only his own sites**, newest first ("No number yet" where a phone is missing);
- **adds a site** mostly by tapping: buyer type, product pills, area (pick or add, with
  "Did you mean …?"), **stage** (Visited / Lead pre-picked; Rate Quoted / Won ask for total Rs.
  value + Cash / Credit; Lost asks a reason), follow-up (Tomorrow pre-picked), note;
- **updates a site** (any stage, backwards too) and **edits details** (a number can be
  changed, never removed; old → new kept in `Activity`);
- **saves feel instant**: back on his list at once with "Saving…"; a failed save turns the card
  orange ("Not saved. Tap to try again.") and nothing he typed is lost.

The owner has **Sales Diary → Check setup / Links / Refresh salesmen** in the sheet (on a
computer). Everything is in the **Sales Diary** sheet; the owner's **Meta-Data** sheet is only
ever read.

Specs: 001 foundations · 002 private links · 003 my sites + add · 004 update a site · 005 instant
saves + stage when adding: **all Done**. Build plans 001–005 in `docs/plans/` are all ticked.

### Live state (2026-11-04)
- `Sites` and `Activity`: **empty** (every test row was deleted with the owner's OK).
- `Lists`: the 11 product categories, 5 lost reasons, 4 buyer types; **no areas** yet.
- `Links`: the owner's link, plus **test links for RIA and SJ** (active). **Cancel the test
  links before launch** (owner: Sales Diary → Links). The owner's phone may still hold an unsent
  "TEST OFFLINE" save on the RIA link; cancelling that link makes it harmless.
- Salesmen list kept by the app (refreshed by Refresh salesmen / Check setup / daily).

## Next: phase 5 spec (focus tabs + his target)
Roadmap phase 5: **Today's Chase** (follow-ups due today or overdue, oldest overdue first in
red), **Hot Pipeline** (Sample / Trial and Rate Quoted), **All My Parties** with search, and
**his monthly target** (target only, no achieved figure: owner Q12c). Write
`docs/specs/006-focus-tabs.md` as a **Draft**, ask the owner only business questions (his way,
below), get approval, then plan → build → review → live, as in phases 3–4b.

Notes for phase 5:
- **Target without slowing saves:** salesman calls deliberately don't open Meta-Data any more
  (spec 005). Read targets the same way the salesmen list is kept (`knownSalesmen_` in
  `src/metadata.js`): keep this month's targets in Script Properties, refreshed by Check setup /
  Refresh salesmen / daily. A salesman must only ever receive **his own** target (ADR-0004).
- The page already has every site's `followUp` (yyyy-MM-dd, Pakistan time), `stage` and
  `created`; tabs and search can work on the phone with no extra server calls.
- Won / Lost sites have no follow-up (owner P4-3), so they never appear in Today's Chase.

## How every phase goes live (the routine)
1. `npm run check` and `npm run check:browser` green; independent review agent; fixes with
   tests; fresh-clone check; secrets sweep (no real target amounts, no link codes, no
   `.clasprc.json`).
2. With the owner: clasp sign-in (below) → `npx clasp push --force` → pull back into a scratch
   folder and compare → `npx clasp update-deployment AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF -d "<note>"`.
   **Never `create-deployment`** (a new address would break every link sent).
3. Owner tests on his phone (TEST-named rows); agent reads the tabs through the Google Sheets
   connector (never the `token` column); deletes test rows **only with the owner's OK**, pinned
   to the revision just read.
4. `npx clasp logout`; delete `~/.clasprc.json` if left; close the spec / plan / roadmap.

### Signing clasp in from a cloud session
`npx clasp login --no-localhost` prints a Google link and waits for the address Google sends the
browser to (`http://localhost:8888/?state=…&code=…`, a page that doesn't load). The process must
stay alive, so run it in the background reading from a pipe (`$S` = scratchpad):
```bash
mkfifo "$S/clasp-in" && exec 3<>"$S/clasp-in" && npx clasp login --no-localhost <&3 > "$S/clasp-login.log" 2>&1
```
Give the owner the link from the log; he pastes back the whole address; check its `state=`
matches; `printf '%s\n' '<address>' > "$S/clasp-in"`; delete the log.

## Things learned (keep in mind)
- **Formula injection:** text written with `setValues` that starts with `=` runs as a formula
  in the owner's sheet (could reveal link codes). Every typed or picked text goes through
  `asText_` / `textify_`. The fake sheet behaves like Sheets, so tests catch it.
- **Checks inside the lock:** saves re-read and re-check the row inside the script lock; replies
  carry only the saved card. `tests/speed.test.js` pins one Sales Diary open and one read per
  tab per save.
- **Save once:** each form has a one-time `saveId` (script cache, 6 hours); on reopening, the page
  asks `repSaveStatus` which saves landed. `tests/browser/queue.check.js` covers the hard cases.
- `tsc` doesn't catch a function defined in two `src/` files; `tests/load-src.test.js` does.
- `clasp create-script` / `pull` can overwrite `src/appsscript.json`; git is the truth.
- `npm audit`: 8 issues inside clasp 3.4.1's own dependencies (local tool, never deployed).
- Real target amounts never go in git (owner S3-1): read them live for checks only.
- The owner wants **speed on cheap phones and weak signal**: measure, avoid extra trips to the
  server, and make things feel instant on the phone.

## Questions for the owner
None open. Ask the owner's way: **one question at a time** (several only when he's brisk and
they're independent), tappable options (`AskUserQuestion`), recommended option first and marked
**(Recommended)**, plain English. He prefers brisk check-ins; don't over-explain routine steps.

## Useful facts
IDs aren't secret (each needs the owner's Google account):
- **Meta-Data** sheet "Mitchell Sales Meta-Data": `11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc`.
  **Never edit it without the owner's explicit OK in that session.**
- **Sales Diary** sheet: `1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y`. **Never share it**
  (it holds link codes).
- **Apps Script** (bound to Sales Diary): script ID in `.clasp.json`.
- **Web app** (same address since phase 1, now version 5): deployment
  `AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF`,
  https://script.google.com/macros/s/AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec
- Owner's Google account: the one that owns both sheets.
- Branches: sessions 1–2 merged into the default branch; **session 3 is on
  `claude/clever-hopper-ain3c5`, not merged and no PR opened** (owner hasn't asked for one).
  Next session: start from this branch unless the owner says it was merged.

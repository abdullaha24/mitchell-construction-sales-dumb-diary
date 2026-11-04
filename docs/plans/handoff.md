# Handoff: start here

> Updated 2026-11-04, session 4. **Every session: read this first, and update it before
> you finish.** Then read `AGENTS.md` (rules, commands) if you haven't.

## Where we are
**Phases 0–4b are done and live** (deployment version 5). A salesman opens his private link
on his phone and:
- sees **only his own sites** ("No number yet" where a phone is missing);
- **adds a site** mostly by tapping (buyer type, products, area with "Did you mean …?", stage,
  follow-up, note); **updates** a site (any stage) and **edits details**;
- **saves feel instant** ("Saving…"; a failed save turns orange, nothing typed is lost).

**Phase 5 (spec 006, Approved) is built and checked locally, not live yet.** On the branch:
- **Three tabs** with counts: **Today's Chase** (opens first; no date, then oldest late first in
  red with "3 days late", then today), **Hot Pipeline** (Sample / Trial + Rate Quoted, biggest Rs.
  first, owner P5-1; no total, P5-2), **All My Parties** (newest first, search by name / contact /
  phone either form / area / buyer type / products / stage / note). 50 cards then Show more.
- **His target** under his code ("November target: Rs. …"), his own only, hidden if none.
  Kept with the salesmen list in Script Properties (this month + next), refreshed daily, by
  **Sales Diary → Refresh salesmen & targets** (renamed), Check setup or the Links window.
- Failed saves at the top of every tab; new site → All My Parties; Back / Update keep his place;
  "today" from Google's clock, rolls over with the page left open.

The owner has **Sales Diary → Check setup / Links / Refresh salesmen** (becomes "Refresh salesmen
& targets" once phase 5 is pushed) in the sheet. Everything is in the **Sales Diary** sheet; the
owner's **Meta-Data** sheet is only ever read.

Specs 001–005 **Done**; 006 **In progress** (local acceptance ticked; live acceptance left).

### Live state (2026-11-04)
- `Sites` and `Activity`: **empty** (every test row was deleted with the owner's OK).
- `Lists`: the 11 product categories, 5 lost reasons, 4 buyer types; **no areas** yet.
- `Links`: the owner's link, plus **test links for RIA and SJ** (active). **Cancel the test
  links before launch** (owner: Sales Diary → Links). The owner's phone may still hold an unsent
  "TEST OFFLINE" save on the RIA link; cancelling that link makes it harmless.
- Salesmen list kept by the app (refreshed by Refresh salesmen / Check setup / daily). After the
  phase 5 push, the old kept copy (no targets) is re-read on the first salesman call.

## Next: take phase 5 live (plan 006, step 4)
Follow the routine below: clasp sign-in with the owner → push → compare → update-deployment →
owner tests on his phone with **TEST** sites (one due Tomorrow, one Rate Quoted with a value,
one Sample / Trial). The app can't set a past date, so to see "late" cards: with the owner's OK,
the agent sets those TEST rows' `next_followup` to earlier dates in `Sites` through the Google
Sheets connector (TEST rows only), then he reopens his link. Check Today's Chase order and red
"days late", Hot Pipeline order, search (name, area, phone), and that the target line matches
`Rep-Targets` for this month (read live; real amounts never go in git). Then delete TEST rows
with his OK, clasp logout, close spec 006 / plan 006 / roadmap phase 5.

Then **phase 6** spec (site card helpers + areas): Call / WhatsApp buttons, last-spoken line,
going cold at 7 days (needs `updated` on the card: `Sites.updated_at`), snooze, area filter.

Known limit (from the phase 5 review, left on purpose): if the phone's clock is **changed while
the app is open**, "today" on the page can be off by that change until the page reloads (the
saved data is unaffected: the server works out Tomorrow etc.). Measuring with a timer instead
would break the common case (phone asleep overnight), so it was kept as is.

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
- Branches: sessions 1–2 merged into the default branch; **sessions 3–4 are on
  `claude/clever-hopper-ain3c5`, not merged and no PR opened** (owner hasn't asked for one).
  Next session: start from this branch unless the owner says it was merged.

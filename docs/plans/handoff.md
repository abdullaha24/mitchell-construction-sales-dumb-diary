# Handoff: start here

> Updated 2026-11-04, end of session 4 (phases 5 and 6). **Every session: read this first, and update it before
> you finish.** Then read `AGENTS.md` (rules, commands) if you haven't.

## Where we are
**Phases 0–6 are done and live** (deployment version 9). A salesman opens his private link
on his phone and:
- lands on **Today's Chase** (no-date, then late oldest first in red, then today's); **Hot
  Pipeline** (Sample / Trial + Rate Quoted, biggest Rs. first); **All My Parties** (newest first,
  search, and an **area filter** row with counts as badges). 50 cards per tab, then Show more;
- sees **his own monthly target** under his code;
- on each card: **Call** / **WhatsApp** (WhatsApp only for mobiles; taps not logged), the
  **last-spoken line** ("4 Nov: …"), **going cold** (yellow at Sample / Trial or Rate Quoted after
  7 days without a real Update; Snooze and Edit details don't reset it), and **Snooze** on due
  sites (Tomorrow / 3 days / 1 week; leaves Today's Chase at once; Activity `snooze`);
- **adds**, **updates**, **edits** sites; **saves feel instant** (failed saves orange, pinned on
  every tab; a failed snooze offers **Open site** / **Don't snooze**).

The owner has **Sales Diary → Check setup / Links / Refresh salesmen & targets** in the sheet (on
a computer). His own link still shows only "Hello, owner" (his screen is phase 7). Everything is in
the **Sales Diary** sheet; **Meta-Data** is only ever read.

Specs 001–007: **all Done**. Build plans 001–007 in `docs/plans/` are all ticked. ADR-0009
(`worked_at`, `note_at` in `Sites`) Accepted.

### Live state (2026-11-04, end of session 4)
- `Sites` (19 columns, ending `updated_at`, `worked_at`, `note_at`) and `Activity`: **empty**
  (all TEST rows deleted with the owner's OK, pinned to the revision read just before). `Lists`:
  11 categories, 5 lost reasons, 4 buyer types; no areas.
- `Links`: the owner's link, plus **test links for RIA and SJ** (active). **Keep RIA's** (owner,
  session 4): agents test live with it. Cancel RIA's and SJ's **only when the owner says**, and in
  any case before launch.
- Live speed (agent, Chromium at phone size): page opens in ~3.9 s warm (version 7: 3.2–3.8 s),
  ~5–6 s on a cold start; after Save, back on the list in ~0.3 s; Google confirms in 2–5 s.

## Next: phase 7 spec (the owner screen)
Roadmap phase 7, vision → "What the owner gets": on **his own private link** (ADR-0006), phone
first: (1) pipeline by salesman and region (sites and Rs. at each stage, tap-through to sites),
each salesman's monthly **target next to Won Rs., labelled "logged, not invoiced"** (owner A7),
plus the region targets and the **house / office sales** target (`UNASSIGNED`, owner A6); (2) **who
worked today** (today's updates, and who logged nothing); (3) **overdue and going cold** across the
team; (4) **won / lost** this month in Rs., and lost reasons (e.g. "6 lost on price"); plus the
**sites with no number** per salesman (owner P3-4) and, from phase 6, **snoozes** (owner P6-5).
Write `docs/specs/008-…` as a **Draft**, ask the owner only business questions, get approval,
then plan → build → review → live.

Notes for phase 7:
- The owner sees everything; that is the only page where other salesmen's data may appear. Every
  new `owner…` function starts with the signed-in-owner check **or** an owner-link check: decide
  which in the spec (the owner screen is opened by link, not signed in) and test that a salesman's
  code gets nothing.
- Speed: `Activity` only grows. Don't read all of it on every open: e.g. read only recent rows
  (this month) or keep small summaries. Region / house targets: keep them like the salesmen's
  (Script Properties, refreshed by Refresh / Check setup / daily), never write to Meta-Data.
- "Won Rs." = sites whose stage is Won (Order) with their value; decide in the spec whether a month
  counts by the day it was won (Activity `stage_change` to Won) — likely a business question.
- Known limit kept on purpose (phase 5 review): a phone clock changed while the app is open can
  make "today" off until reload (saved data unaffected).
- How session 4 worked well, to keep context small: the main agent orchestrates; a **builder
  subagent** writes the spec, stops for approval, then builds with tests; a **separate reviewer
  subagent** reviews the diff cold; the builder fixes; the main agent re-runs all checks, deploys
  and tests live on RIA's link (`chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } })`;
  the app sits in a nested Google frame: find the frame with `#who`; link code in a scratch file
  only, never in logs or git). The owner taps Call / WhatsApp-type things on his own phone.

## Owner's working rules (session 4)
- He often works **from his phone, away from a computer**: he gives commands in chat; the agent
  builds **and tests live itself** by driving **RIA's test link** in Chromium (see "Testing live"
  in the phase 6 notes). Test rows are named **TEST …** and deleted only with his OK.
- **Keep clasp signed in for the whole session** until he explicitly says to sign out. Don't run
  `clasp logout` or delete `~/.clasprc.json` at the end of a phase. (A new chat is a fresh
  machine, so it needs one sign-in; within one chat, sign in once.)
- To get RIA's link: read `Links` columns A, B and D (role, rep, active) to find RIA's active
  row, then read **only that row's** `token` cell, and keep the code in a scratch file. Never put
  it in git, logs, commit messages or docs; don't repeat it in chat unless he asks.

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
4. Close the spec / plan / roadmap. **Stay signed in to clasp** (owner, session 4) unless he
   says to sign out; then `npx clasp logout` and delete `~/.clasprc.json`.

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
- **Web app** (same address since phase 1, now version 9): deployment
  `AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF`,
  https://script.google.com/macros/s/AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec
- Owner's Google account: the one that owns both sheets.
- Branches: sessions 1–2 merged into the default branch; **sessions 3–4 are on
  `claude/clever-hopper-ain3c5`, not merged and no PR opened** (owner hasn't asked for one).
  Next session: start from this branch unless the owner says it was merged.

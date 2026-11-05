# Handoff: start here

> Updated 2026-11-05, session 5 (spec 009 summaries approved and built locally; live check next). **Every session: read this first, and update it before
> you finish.** Then read `AGENTS.md` (rules, commands) if you haven't.

## Where we are
**Phases 0–7 are done and live** (deployment version 10).
- **Salesman** (his private link): Today's Chase / Hot Pipeline / All My Parties (search, area
  filter), his own monthly target, cards with Call / WhatsApp, last-spoken line, going cold,
  Snooze; add / Update / Edit details; instant saves with a queue (failed saves orange).
- **Admin** (the owner; the word "Admin" is used everywhere a person sees it, owner P7-7) on his
  own link: tabs **Today** (who logged nothing, saves per salesman, today's saves), **Team**
  (targets vs Won Rs. "logged, not invoiced", per region and salesman, house / office target,
  stage counts with tap-through), **Late & cold**, **This month** (won / lost, lost reasons). He can
  open any site and **Update** it: history `rep` = `admin`, the salesman sees "Admin: …"; it never
  resets going cold (P7-5). Making / cancelling links stays on the computer (P7-6).
- **Two people, one site** (spec 008): each phone sends exactly which fields it changed
  (`touched`); the server writes only those and refuses only a real clash (someone else changed
  the same field differently, or the stage moved so the field no longer applies). Guarded by
  `tests/interleave.test.js` (1,500 random sequences per `npm test`, five invariants).
- Sheet menu (computer): **Sales Diary → Check setup / Links / Refresh salesmen & targets**.
  Everything is in **Sales Diary**; **Meta-Data** is only ever read.

Specs 001–008 **Done**, 009 built (not live); plans 001–008 ticked, 009 to step 6; ADR-0009 and ADR-0010 Accepted. Tests: 364 unit
(incl. the random test, ~20 s) + 8 browser checks.

### Live state (2026-11-04, end of session 4)
- **TEST rows still in the sheet, kept at the owner's request while he looks at his admin screen**:
  `Sites` S000001 TEST Quote (Won), S000002 TEST Lead (note "Admin: TEST call the consultant"),
  S000003 TEST Gone (Lost); `Activity` A0000001–A0000005. **Delete them only with his OK**
  (read the tabs first; delete pinned to the revision just read). `Lists`: no TEST rows.
- `Sites` has 19 columns, ending `updated_at`, `worked_at`, `note_at`.
- `Links`: the owner's (admin) link (`role` `owner`, row 2), plus **test links for RIA and SJ**.
  Keep RIA's (agents test with it). Cancel RIA's and SJ's only when the owner says, and before
  launch.
- **Speed** (agent, Chromium at phone size, warm): admin screen ~3.7–3.8 s; **salesman's page
  3.9–4.7 s, up from ~3.9 s** after phase 6 (`App.html` 59 KB → 83 KB, mostly the save-queue /
  two-people logic). After Save, back on the list in ~0.3 s; Google confirms in 2–5 s.

## Next: summaries (spec 009), then a speed pass, then launch (phase 8)
Owner's order (S9-2): **summaries → speed pass → launch.**
0. **Summaries ([spec 009](../specs/009-summaries.md)): approved 2026-11-05, built and checked
   locally (plan [009](009-summaries-plan.md), steps 1–6 ticked), not yet live.** Owner answers
   S9-1 to S9-16 in `open-questions.md`. Built: `src/summary.js` (`repSummary`, `adminPageSummary`:
   public functions 18 → 20; the lines and the WhatsApp text are built on the server), the Summary
   screen in `App.html` (87,465 bytes, pinned ≤ 88,000) for both pages, last month's targets and a
   `months` marker in the kept copy, and S9-13 (an `update` row records Rs. only when it changed).
   **Next:** live (push, `update-deployment`; **right after `update-deployment`, run Sales Diary →
   Refresh salesmen & targets in the sheet**, so the kept copy, now with `months`, is rebuilt under
   the owner's eyes rather than on a salesman's first tap: an old copy without `months` is read
   again on first use, and if Meta-Data were unreachable then, salesmen would see "Something went
   wrong"; then the owner tests on his phone
   inside Google's frame: Share on WhatsApp and Copy; compare RIA's This week / This month and the
   admin's month with the sheet, using the TEST rows, S9-1). Choices made where the spec was silent
   are listed in the builder's report and in the plan (step 6).
   **Reviewed (session 5):** an independent reviewer agent reviewed the build cold (no blockers or
   majors; six minors, all fixed in `66030a3`: block-edge margin `ACTIVITY_SKEW_MS` in
   `activitySince_`, which also protects the admin screen's This month; team lost reasons from
   current salesmen only; live "not sent yet" line; go-live refresh step; App.html trim; spec
   wording), then re-reviewed the fixes: **nothing remains.** 364 unit tests + 8 browser checks.
1. **Speed pass (recommended before launch; owner's top priority is speed on cheap phones):**
   measure where the salesman's open time goes (server time vs page size vs page script), then
   shrink what the salesman's page downloads and runs at open (e.g. strip comments / whitespace
   from the served HTML at push time, defer code only needed on Update/forms, check the page data
   size). Target: back to ≤ ~3.9 s warm, with a check that pins the served page size. Spec it
   briefly (now **spec 010**, after summaries) and get the owner's OK as usual.
2. **Phase 8, launch** (roadmap): links for all 7 salesmen, a short how-to (WhatsApp-friendly,
   plain words), cancel the RIA / SJ test links, empty TEST data, watch the first week.

Known limits kept on purpose (documented in specs 006 / 008): a phone clock changed while the app
is open can make "today" off until reload; a lost reply retried unchanged after midnight, or a
retried Update after his own snooze landed, can be refused once (he taps Save again; nothing lost).

How session 4 worked well (keep context small): the main agent orchestrates; a **builder
subagent** writes the spec, stops for approval, builds with tests; a **separate reviewer subagent**
reviews cold, re-reviews each fix round; the main agent re-runs all checks, deploys and tests live
(`chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } })`; the app sits in a nested Google
frame: find the frame with `#who`; link codes in private scratch files only, never in logs or
git; deleted after). When a fix area keeps producing new bugs, stop patching: simplify the design
and add a randomized invariant test.

## Owner's working rules (session 4)
- He often works **from his phone, away from a computer**: he gives commands in chat; the agent
  builds **and tests live itself** by driving **RIA's test link** in Chromium (see "How session 4
  worked well" above). Test rows are named **TEST …** and deleted only with his OK.
- He likes the **orchestrator** way of working (session 4): main agent stays lean; builder and
  reviewer are subagents. He prefers brisk updates, tappable questions, recommendations marked.
- **Keep clasp signed in for the whole session** until he explicitly says to sign out. Don't run
  `clasp logout` or delete `~/.clasprc.json` at the end of a phase. (A new chat is a fresh
  machine, so it needs one sign-in; within one chat, sign in once.)
- To get RIA's link: read `Links` columns A, B and D (role, rep, active) to find RIA's active
  row, then read **only that row's** `token` cell, and keep the code in a scratch file. Never put
  it in git, logs, commit messages or docs; don't repeat it in chat unless he asks.
- **His own admin link** (`Links` row with `role` `owner`): read its code only with his OK in that
  session (he gave it in session 4 for live testing), same handling, delete the scratch copy after.

## How every phase goes live (the routine)
1. `npm run check` and `npm run check:browser` green; independent review agent; fixes with
   tests; fresh-clone check; secrets sweep (no real target amounts, no link codes, no
   `.clasprc.json`).
2. With the owner: clasp sign-in (below) → `npx clasp push --force` → pull back into a scratch
   folder and compare (copy `.clasp.json` there with `rootDir` `.`, and run the **repo's**
   `node_modules/.bin/clasp pull`: `npx` in the scratch folder has no clasp) → `npx clasp update-deployment AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF -d "<note>"`.
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
Waiting on him: (1) **test the summaries live** on his phone (spec 009, built and checked locally);
(2) **"delete"** the phase 7 TEST rows, but only **after** the summaries are tested live (S9-1).
The speed pass is agreed (S9-2): it follows the summaries. Ask the owner's way: **one question at a time** (several only when he's brisk and
they're independent), tappable options (`AskUserQuestion`), recommended option first and marked
**(Recommended)**, plain English. He prefers brisk check-ins; don't over-explain routine steps.

## Useful facts
IDs aren't secret (each needs the owner's Google account):
- **Meta-Data** sheet "Mitchell Sales Meta-Data": `11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc`.
  **Never edit it without the owner's explicit OK in that session.**
- **Sales Diary** sheet: `1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y`. **Never share it**
  (it holds link codes).
- **Apps Script** (bound to Sales Diary): script ID in `.clasp.json`.
- **Web app** (same address since phase 1, now version 10): deployment
  `AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF`,
  https://script.google.com/macros/s/AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec
- Owner's Google account: the one that owns both sheets.
- Branches: sessions 1–2 merged into the default branch; **sessions 3–4 are on
  `claude/clever-hopper-ain3c5`, not merged and no PR opened** (owner hasn't asked for one).
  **Session 5 (spec 009 interview) is on `ccr-f2566cb7-aaz6y0`**, which starts from that branch's
  last commit. Another branch, `ccr-18f7110f-to6vgz`, holds a salesmen's PDF user guide
  (`docs/guide`, `scripts/guide`), not merged; it doesn't touch `src/` but also edits `AGENTS.md`,
  `handoff.md` and `roadmap.md`, so merging it means small conflicts in those three files. Next session: start from
  `ccr-f2566cb7-aaz6y0` unless the owner says otherwise.

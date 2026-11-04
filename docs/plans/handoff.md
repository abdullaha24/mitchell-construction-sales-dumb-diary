# Handoff: start here

> Updated 2026-11-04, end of session 4. **Every session: read this first, and update it before
> you finish.** Then read `AGENTS.md` (rules, commands) if you haven't.

## Where we are
**Phases 0–5 are done and live** (deployment version 7). A salesman opens his private link
on his phone and:
- lands on **Today's Chase**: no-date sites, then late ones (oldest first, red edge, "3 days
  late"), then today's; **Hot Pipeline** (Sample / Trial + Rate Quoted, biggest Rs. first, no
  total); **All My Parties** (newest first, search by name / contact / phone either form / area /
  buyer type / products / stage / note). 50 cards per tab, then Show more;
- sees **his own monthly target** under his code ("November target: Rs. …"), nobody else's;
- **adds a site** mostly by tapping (lands on All My Parties), **updates** it (any stage),
  **edits details**; **saves feel instant** (failed saves turn orange, pinned on every tab).

The owner has **Sales Diary → Check setup / Links / Refresh salesmen & targets** in the sheet (on
a computer). Everything is in the **Sales Diary** sheet; the owner's **Meta-Data** sheet is only
ever read. Targets reach salesmen within a day, or at once after Refresh / Check setup.

Specs 001–006: **all Done**. Build plans 001–006 in `docs/plans/` are all ticked.

### Live state (2026-11-04, end of session 4)
- `Sites` and `Activity`: **empty** (phase 5 TEST rows deleted with the owner's OK, pinned to the
  revision read just before). `Lists`: 11 categories, 5 lost reasons, 4 buyer types; no areas.
- `Links`: the owner's link, plus **test links for RIA and SJ** (active). **Cancel both before
  launch** (owner: Sales Diary → Links). **RIA's test link was pasted into the session 4 chat**
  at the owner's request: cancel it soon (it can only see TEST data now; nothing else).
- The kept salesmen list in Script Properties now also holds this month's and next month's
  targets (refreshed on the first salesman call after the deploy).
- Live speed (agent, Chromium at phone size, 2026-11-04): page opens in 3.2–3.8 s (mostly
  Google's own); after Save, back on the list in ~0.3 s; Google confirms in 2–5 s.

## Next: phase 6 spec (site card helpers + areas)
Roadmap phase 6: **Call / WhatsApp buttons** for the site's contact, the **last-spoken line**
(last note + value, e.g. "22 Oct: Quoted … Rs. 1,450"), **going cold** (yellow when Sample / Trial
or Rate Quoted hasn't been updated for 7 days: the card needs `updated` from `Sites.updated_at`,
not sent today), **one-tap snooze** (push the follow-up without the full Update screen), and the
**area filter** for route planning. Write `docs/specs/007-…` as a **Draft**, ask the owner only
business questions (his way, below), get approval, then plan → build → review → live.

Notes for phase 6:
- Keep tabs fast: everything new on the card must come from data the page already has (add
  `updated` to `cardOf_`; replies still carry only the changed card).
- Snooze is a save like Update (queue, saveId, Activity row `update`), and it must take the site
  out of Today's Chase at once, as an Update does.
- Known limit kept on purpose (phase 5 review): if the phone's clock is changed while the app is
  open, "today" on the page can be off until it reloads (saved data unaffected). A timer-based fix
  would break a phone left asleep overnight.
- Testing live: the owner may ask the agent to drive a salesman's test link in Chromium (session
  4 did: `chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } })`; the app is in a
  nested Google frame, find the frame with `#who`). Keep the link code in a scratch file, never in
  logs or git; delete it afterwards.

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
- **Web app** (same address since phase 1, now version 7): deployment
  `AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF`,
  https://script.google.com/macros/s/AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec
- Owner's Google account: the one that owns both sheets.
- Branches: sessions 1–2 merged into the default branch; **sessions 3–4 are on
  `claude/clever-hopper-ain3c5`, not merged and no PR opened** (owner hasn't asked for one).
  Next session: start from this branch unless the owner says it was merged.

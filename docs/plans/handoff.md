# Handoff: start here

> Updated 2026-11-05, end of session 5 (specs 009 and 010 live as version 13; owner's phone check
> next). **Every session: read this first, and update it before you finish.** Then read
> `AGENTS.md` (rules, commands) if you haven't.

## Where we are
**Phases 0–7 and specs 009–010 are live** (deployment version 13, 2026-11-05).
- **Salesman** (his private link): Today's Chase / Hot Pipeline / All My Parties (search, area
  filter), his monthly target, cards with Call / WhatsApp, last-spoken line, going cold, Snooze;
  add / Update / Edit details; instant saves with a queue (failed saves orange). **Summary** button
  (top bar): This week · Last week · This month · Last month (a week is **Saturday to Friday**).
- **Admin** (the owner; screens say "Admin", never "owner", P7-7) on his own link: tabs Today ·
  Team · Late & cold · This month; he can **Update** any site (history `rep` = `admin`, salesman
  sees "Admin: …", never resets going cold). **Summary** button: team tiles, team target bar,
  one team table (region subtotals, Team row, Won in millions, tap a salesman for his summary with
  "Logged on N days"), lost reasons. Links are made / cancelled on the computer only (P7-6).
- **Summaries** (specs 009 + 010; owner answers S9-1–S9-16, S10-1–S10-4 in `open-questions.md`):
  six tiles, target bar (month), two-column tables (Won / Quotes given / Lost), a NOW table plus
  his named Hot sites (top 5) and Late & going cold (top 3); **Share on WhatsApp** (numbers in a
  monospace block, lines ≤ 30 chars; past periods leave out NOW) and **Copy**. Built on the server
  in `src/summary.js` (`repSummary`, `adminPageSummary`; 20 public functions). Past weeks / months
  are counted **as the period ended** (S9-14); running ones exactly as the Team tab (P7-1). Since
  S9-13 an Update row saves Rs. only when it changed.
- **Pages are served through `servedHtml_`** (`src/webapp.js`): comments and indentation removed
  as Google sends the page; no build step (ADR-0003 kept). Served salesman's page 69.8 KB (pin
  75,000), admin's 90.7 KB (pin 92,300), `tests/served.test.js`.
- Sheet menu (computer): **Sales Diary → Check setup / Links / Refresh salesmen & targets**.
  Everything is in **Sales Diary**; **Meta-Data** is only ever read. The kept copy of salesmen and
  targets holds last, this and next month plus a `months` marker.

Specs 001–008 Done; 009 and 010 In progress (only the owner's phone check left). Plans 001–010
ticked to their last step. ADRs 0001–0010 Accepted. Tests: 382 unit (incl. the random interleave
test, ~20 s) + 8 browser checks.

### Live state (2026-11-05)
- **TEST rows deleted** (owner's OK, 2026-11-05, pinned to the revision just read): `Sites` and
  `Activity` now hold only their header rows, ready for launch. IDs start again at S000001 /
  A0000001 (the old TEST rows are gone, so nothing clashes). From now on, live checks use real data
  read-only, or a TEST row the owner OKs and that is deleted right after.
- `Links`: row 2 the admin link (`role` `owner`), row 3 RIA's test link, row 4 SJ's test link.
  Cancel RIA's and SJ's only when the owner says, before launch.
- **Speed** (agent, Chromium at 360 px, warm, version 13): salesman's page opens in ~4.2 s, admin's
  ~4.1 s; a summary loads in 2–3.5 s. After Save, back on the list in ~0.3 s.

## Next
1. **Owner's phone check** (specs 009 + 010): he taps Summary → Share on WhatsApp → sends it to
   himself: WhatsApp app opens with the text, the numbers block **lines up**, Copy says "Copied".
   If the block doesn't line up: fall back to bold labels (spec 010, mockup C bottom). Then close
   specs 009 and 010 (Done), roadmap 7b.
2. **Launch prep (owner, 2026-11-05: "ready to roll, fix bugs as they come")**: TEST rows deleted;
   he makes fresh links for all 7 on the computer (Sales Diary → Links; a new link for RIA / SJ
   cancels their test links) and sends each salesman his own link privately with the WhatsApp
   how-to the agent drafted. Bugs: salesmen report to him on WhatsApp; he pastes them in chat.
3. **Speed pass (spec 011, to write)**: measure where the salesman's open time goes (server vs
   download vs page script), then shrink what runs at open (e.g. defer Update / form code, check
   the page data size). Target ≤ ~3.9 s warm. Spec briefly, owner's OK, build the usual way.
4. **User guide**: the salesmen's PDF guide (`docs/guide/`, `scripts/guide/`) is on branch
   `ccr-18f7110f-to6vgz` (another chat), built before summaries. It needs merging with this branch
   and Summary pages (the owner was given a prompt for that chat on 2026-11-05).
5. **Phase 8, launch**: links for all 7 salesmen, the guide, cancel the RIA / SJ test links, empty
   the TEST data, watch the first week.

Known limits kept on purpose (specs 006 / 008): a phone clock changed while the app is open can make
"today" off until reload; a lost reply retried unchanged after midnight, or a retried Update after
his own snooze landed, can be refused once (he taps Save again; nothing lost).

## How we work (sessions 4–5, the owner likes it)
- The main agent orchestrates and stays lean. A **builder subagent** builds from an approved spec
  with tests and commits (no push, no clasp); a **separate reviewer subagent** (cold, adversarial)
  reviews each build and re-reviews each fix round; the main agent re-runs every check, pushes,
  deploys and **tests live itself**, and loops (problem → builder → redeploy → retest) until clean.
- Before a spec: interview the owner (tappable questions), then an adversarial review of the
  **spec**, then his answers to what it raises. For look-and-feel, research and show a **mockup
  picture** (rendered with Playwright, sent with SendUserFile) before writing the spec.
- When a fix area keeps producing new bugs, stop patching: simplify the design and add a randomized
  invariant test.
- Live testing: `chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } })`, 360 px; the app is
  in a nested Google frame (find the frame with `#who`). For a full-length screenshot use a tall
  window (e.g. 360 × 2400): the frame only paints what fits.

## Owner's working rules
- He often works **from his phone**; he gives commands in chat, the agent builds, deploys and tests.
  Brisk updates, tappable questions, recommended option first and marked **(Recommended)**, plain
  English, one question at a time (several when he's brisk and they're independent).
- **Keep clasp signed in for the whole session** until he says to sign out (a new chat is a fresh
  machine: one sign-in per chat).
- Link codes: to test, read `Links` columns A, B, D (role, rep, active) first, then **only the
  needed rows' `token` cells, one cell each** (not a range: a range shows other salesmen's codes).
  He has OK'd RIA's and his admin link for live testing. Keep codes in a private scratch file
  (`chmod 700` folder), never in git, logs, commits, docs or chat; delete them after.
- Test rows are named **TEST …**; delete only with his OK.

## How a change goes live (the routine)
1. `npm run check` and `npm run check:browser` green; independent review; fresh-clone check;
   secrets sweep (no real target amounts, no link codes, no `.clasprc.json`).
2. `npx clasp push --force` → pull back into a scratch folder and compare (copy `.clasp.json` there
   with `rootDir` `.`, run the **repo's** `node_modules/.bin/clasp pull`) → `npx clasp
   update-deployment AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF -d
   "<note>"`. **Never `create-deployment`** (a new address breaks every link).
3. Agent tests live (both pages), checks numbers against the sheet through the Google Sheets
   connector; owner checks on his phone.
4. Close the spec / plan / roadmap; update this file.

### Signing clasp in from a cloud session
`npx clasp login --no-localhost` prints a Google link and waits for the address Google sends the
browser to (`http://localhost:8888/?state=…&code=…`, a page that doesn't load). Keep it alive in the
background reading from a pipe (`$S` = scratchpad):
```bash
mkfifo "$S/clasp-in" && exec 3<>"$S/clasp-in" && npx clasp login --no-localhost <&3 > "$S/clasp-login.log" 2>&1
```
Give the owner the link; he pastes back the whole address; check its `state=` matches;
`printf '%s\n' '<address>' > "$S/clasp-in"`; delete the log.

## Things learned (keep in mind)
- **Formula injection:** text written with `setValues` that starts with `=` runs as a formula in
  the owner's sheet. Every typed or picked text goes through `asText_` / `textify_`.
- **Checks inside the lock:** saves re-read and re-check the row inside the script lock; replies
  carry only the saved card; `tests/speed.test.js` pins one Sales Diary open and one read per tab.
- **Save once:** each form has a one-time `saveId`; the page asks `repSaveStatus` which saves
  landed (`tests/browser/queue.check.js`).
- **`Activity` rows can land a few seconds out of time order** (time taken before the lock): the
  bottom-up read (`activitySince_`) stops only at a row older than the period start minus
  `ACTIVITY_SKEW_MS` (5 min).
- **WhatsApp:** no tables; monospace (```) lines ≤ 30 chars; `waSafe_` neutralises backticks and
  `* _ ~` in names. The page is in Google's frame: WhatsApp is a `wa.me/?text=` link (no share
  sheet); Copy falls back to select-and-copy, then "Press and hold".
- `tsc` doesn't catch a function defined in two `src/` files; `tests/load-src.test.js` does.
- `clasp pull` can overwrite `src/appsscript.json`; git is the truth.
- `npm audit`: 8 issues inside clasp 3.4.1's own dependencies (local tool, never deployed).
- Real target amounts never go in git (S3-1): read them live for checks only.
- The owner wants **speed on cheap phones and weak signal**: measure, avoid extra trips.

## Questions for the owner
Waiting on him: (1) the **phone check** of the summaries (Next, 1); (2) making and sending the 7
links (Next, 2); (3) go-ahead to **spec the speed pass** (spec 011) in the first week.

## Useful facts
IDs aren't secret (each needs the owner's Google account):
- **Meta-Data** "Mitchell Sales Meta-Data": `11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc`.
  **Never edit it without the owner's explicit OK in that session.**
- **Sales Diary**: `1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y`. **Never share it** (link codes).
- **Apps Script** (bound to Sales Diary): script ID in `.clasp.json`.
- **Web app** (same address since phase 1, now version 13): deployment
  `AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF`,
  https://script.google.com/macros/s/AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec
- Branches: sessions 1–2 merged into the default branch; sessions 3–4 on
  `claude/clever-hopper-ain3c5`; **session 5 (specs 009, 010; live code) on
  `ccr-f2566cb7-aaz6y0`**, which contains sessions 3–4. The user guide is on `ccr-18f7110f-to6vgz`
  (to be merged with this branch, see Next 4). No PRs opened (owner hasn't asked). Next session:
  start from `ccr-f2566cb7-aaz6y0` unless the owner says otherwise.

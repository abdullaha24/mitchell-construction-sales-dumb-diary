# Handoff: start here

> Updated 2026-11-12, session 7. **Every session: read this first, and update it before you
> finish.** Rules and commands are in `AGENTS.md`; owner decisions in `docs/product/open-questions.md`.

## Where we are
**Live: deployment version 14** (2026-11-11), same address since phase 1. Launched to the 7 salesmen
on 2026-11-05. `main` = GitHub = what is deployed.

- **Salesman** (his private link): Today's Chase / Hot Pipeline / All My Parties (search, area
  filter), his monthly target, cards with Call / WhatsApp, last-spoken line, going cold, Snooze;
  + New Site, Update, Edit details; instant saves with a queue (failed saves orange). **Summary**:
  This week · Last week · This month · Last month (week = **Saturday to Friday**); every tile and
  NOW row taps through to its sites; Share on WhatsApp / Copy.
- **Admin** (the owner; screens say "Admin", never "owner"): tabs **Today · Plan · Team · Late &
  cold · This month**; he can Update any site (history `rep` = `admin`). **Summary**: team tiles,
  target bar, team table (tap a region or salesman for its own summary, ‹ Prev / Next ›), lost
  reasons; wide layout at ≥ 900 px for screen share. Links are made / cancelled on the computer
  only (Sales Diary → Links).
- **Contacts** (spec 011): + New contact person in Update; old ones kept under Earlier contacts
  (`Sites.earlier_contacts`, ADR-0011); `Activity.action` `contact` is a save, never work.
- **Look**: Mitchell logo strip, teal `#00738e` main colour (`docs/brand/`).
- Specs 001–008 Done; 009, 010, 011 In progress (only the owner's own checks left). ADRs 0001–0011
  Accepted. Tests: 429 unit + 9 browser checks. Served pages: salesman ~82.3 KB (pin 84,000),
  admin ~106.7 KB (pin 110,000).

### Live data (2026-11-11)
- 42 sites. **RIA has logged nothing since launch.** Two salesmen overwrote a contact through Edit
  details in week 1 (owner S11-7: leave them).
- `Links`: row 2 the admin link (`role` `owner`), rows 3–9 the 7 salesmen, all active.
- Speed (agent, Chromium, warm, v14): admin's page opens in ~4.7 s; a summary in 2–3.5 s.

## Next
0. **Spec 012, daily region message: Approved 2026-11-12, building** (answers S12-1 to S12-8;
   ADR-0012 Accepted). Build with a builder subagent + cold review, as usual. New public function
   `adminPageDaily` (allow-list 20 → 21); admin page pin may rise to 114,000; salesman's page unchanged.
   Agent's own choices are listed at the end of the spec; he may change them at review.
1. **Owner's check of spec 011**: a review call from Summary on a laptop (tiles, regions, Prev /
   Next, Plan tab); a salesman tries + New contact person. Then spec 011 Done, roadmap 7d.
   Not yet checked live by the agent: a salesman's own page (no salesman link) and a contact save
   on live data (would write; covered by tests).
2. **Owner's phone check of the WhatsApp summary** (specs 009 / 010): the numbers block lines up,
   Copy says "Copied". If it doesn't line up: bold labels instead (spec 010). Then 009 / 010 Done.
3. **Speed pass (spec 013, to write)**: measure where the salesman's open time goes (server /
   download / page script), shrink what runs at open. Target ≤ ~3.9 s warm. The salesman's page
   has ~1.7 KB left under its pin.
4. **Bugs** from salesmen arrive via the owner in chat. Watch usage through the Sheets connector
   (read only).
5. **Phase 8 done when** all 7 have logged at least one site.

Ideas not asked yet: contact roles (site engineer / thekedar / procurement); a home-screen icon
(needs a hosted image); nudging RIA.

**PDF guides** (`docs/guide/`): still the version 13 look. Owner (2026-11-11): "no need to build the
pdfs". Don't rebuild unless he asks.

Known limits kept on purpose: a phone clock changed while the app is open can make "today" off
until reload; a lost reply retried after midnight, or a retried Update after his own snooze landed,
can be refused once (he taps Save again; nothing lost).

## How we work (the owner likes it)
- Interview the owner first (tappable questions, **one at a time, 4 options**, **(Recommended)** option first;
  AGENTS.md → How to work, step 0), grounding recommendations in live data (read only),
  show a **mockup picture** for look-and-feel, write the spec, have it reviewed cold, fold in fixes.
- **Builder subagents** build from the spec with tests (separate worktrees when two run in
  parallel; the main agent merges). A **cold reviewer** reviews every build and **re-reviews every
  fix round** (each round in session 6 found real bugs). The main agent re-runs all checks, pushes,
  deploys and tests live itself.
- When a fix area keeps producing bugs: simplify and add a randomized invariant test.
- Live testing: `chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } })`; the app is in a
  nested Google frame (find the frame with `#who`); use a tall window for full-page screenshots.

## Owner's working rules
- Works **from his phone**: brisk plain-English updates, tappable questions.
- **clasp signs in by itself** (AGENTS.md step 0). **Standing OK** to push to `main` and update
  the deployment once checks pass. No branches, no PRs. Live **data** changes still need his OK.
- Link codes: read `Links` columns A, B, D first, then **only the needed `token` cell** (one cell,
  never a range). His admin link is OK'd for live tests; a salesman's link needs his OK. Keep codes
  in a `chmod 700` scratch folder, never in git, logs, docs or chat; delete after.
- Test rows are named **TEST …**; delete only with his OK.

## How a change goes live
1. `npm run check` and `npm run check:browser` green; cold review clean; secrets sweep (no real
   targets, link codes or `.clasprc.json`).
2. A new `Sites` / `Activity` column: add its header on the live sheet **first** (old code ignores
   extra columns), then push.
3. `npx clasp push --force` → pull back into a scratch folder and compare (copy `.clasp.json` with
   `rootDir` `.`, run the repo's `node_modules/.bin/clasp pull`) → `npx clasp update-deployment
   AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF -d "<note>"`.
   **Never `create-deployment`.**
4. Test live (admin link), check numbers against the sheet; close the spec; update this file.

## Things learned
- **Formula injection:** every typed or picked text goes through `asText_` / `textify_`.
- **Saves:** checks re-run inside the script lock; one-time `saveId` per form (`repSaveStatus`);
  replies carry only the saved card; one Sales Diary open, one read per tab (`tests/speed.test.js`).
- **The save queue** is where bugs hide (carried saves, retries, contacts): every change there gets
  a case in `tests/interleave.test.js`, and lists kept per queued save must never grow per chain.
- **`Activity` rows can land a few seconds out of order**: `activitySince_` reads bottom-up and stops
  only past `ACTIVITY_SKEW_MS` (5 min).
- **Hand-edited sheet rows** (blank `site_id`, duplicates, odd cells) must never crash a screen.
- **WhatsApp:** no tables; monospace lines ≤ 30 chars; `waSafe_` for names; `wa.me/?text=` link.
- `tsc` misses a function defined twice; `tests/load-src.test.js` (src) and `tests/served.test.js`
  (App.html + Admin.html) catch it. `clasp pull` can overwrite `src/appsscript.json`: git wins.
- Real target amounts never go in git. `npm audit`'s 8 issues are inside clasp (local tool only).

## Useful facts
- **Meta-Data** "Mitchell Sales Meta-Data": `11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc` (read
  only; never edit without the owner's OK in that session).
- **Sales Diary**: `1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y` (never share: link codes).
- **Apps Script**: script ID in `.clasp.json`. **Web app**: deployment
  `AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF`,
  https://script.google.com/macros/s/AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec
- **Git:** only `main` matters. Leftover remote branches (e.g. `claude/exciting-cray-58kmmu`) are
  fully inside `main`; a cloud session can't delete them (403); the owner may delete them on GitHub.

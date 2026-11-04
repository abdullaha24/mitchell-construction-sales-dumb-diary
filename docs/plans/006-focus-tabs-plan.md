# Build plan 006: Focus tabs and his target

> For [spec 006](../specs/006-focus-tabs.md) (**Approved** 2026-11-04, session 4). One commit per
> step, `npm run check` (+ `check:browser` when HTML changes) green each time.

## [x] Step 1: His target, kept with the salesmen list (server)
- `Rep-Targets` read with `Rep_Mapping` when the kept list is refreshed (Refresh, Check setup,
  Links window, or once a day); this month's and next month's target per current salesman kept in
  the `salesmen` Script Property. A broken `Rep-Targets` never locks a salesman out (no target).
- A kept copy from before this version (no targets) counts as stale and is read again.
- `whoIsVisiting_` gives a salesman his own target for this month; page data gets `target` and
  `now`. Menu item renamed **Refresh salesmen & targets**.
- Tests: his target only, none, 0 / duplicate month, roll-over to next month, broken tab, old
  kept copy; speed test unchanged (no Meta-Data open when fresh).

## [ ] Step 2: The page: tabs, Today's Chase, Hot Pipeline, All My Parties with search
- Tabs with counts, the target line, red late cards, "No follow-up date", empty messages.
- Search on the phone (words, dashes, capitals, phone forms), 50 cards then Show more.
- Failed saves at the top of every tab; new site → All My Parties; back to the same tab after
  an update.
- "Today" from Google's clock; re-worked out when he comes back to the app.
- Browser check `tests/browser/tabs.check.js`; existing checks still pass.

## [ ] Step 3: Docs, review, local acceptance
- Data model (kept targets), AGENTS.md, src/README.md, roadmap, handoff.
- Independent review agent; fixes with tests; fresh-clone check; secrets sweep.

## [ ] Step 4: Live with the owner
- Push, update the deployment (same address), owner tests TEST sites on his phone, clean up with
  his OK, clasp logout.

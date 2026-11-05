# Build plan 009: Weekly and monthly summaries

> For [spec 009](../specs/009-summaries.md) (**Approved** 2026-11-05, session 5, answers S9-1 to
> S9-15). One commit per step, `npm run check` and `npm run check:browser` green each time. On
> screen the owner is **Admin** (P7-7).

## [x] Step 1: This plan
- Spec → In progress.

## [x] Step 2: Kept copy holds last month, with a `months` marker
- `metadata.js`: `targetsToKeep_` / `regionTargetsToKeep_` keep **last, this and next month**;
  `keepSalesmen_` writes `months` (the three months); `knownSalesmen_` reads the copy again at once
  when `months` is missing or lacks last month or this month. The 1st of a month still rolls over
  without a refresh (a copy kept on the 31st holds the new month's last month and this month).
- Tests: last month kept; a spec 008 copy (no `months`) and a copy whose months miss last month
  are read again; month rollover. Existing kept-copy tests that pinned "this and next month only"
  (or stored a copy without `months`) change minimally.
- Done. Changed existing tests (because the spec changes the kept copy): `target.test.js` "kept:"
  now expects last month too; `speed.test.js` "used for up to 24 hours" stores `months` in its copy
  (and checks a copy without it is read again).

## [x] Step 3: Revised prices are recorded only when they change (S9-13)
- `saveUpdate_`: an `update` row (same stage) carries `value_rs` / `payment_terms` only when the
  Rs. or Cash / Credit changed; `stage_change` and `created` rows as before.
- `Admin.html`: the admin's own instant Today line shows Rs. on an Update only when he changed it.
- Tests: unchanged Rs. → blank; changed → both; stage change / new site unchanged; the feed.
- Done: `tests/summary.test.js` (3 tests) and an added section in `tests/browser/admin.check.js`
  (his instant line); each caught its mutation (writing the value on every update row; showing
  Rs. on every instant Update line). No existing test needed a change.

## [ ] Step 4: Server summaries
- `admin.js`: `activitySince_` (the bottom-up block read, from any moment); `monthActivity_` uses it.
- New `summary.js`: periods (Saturday to Friday weeks, months, Pakistan time, end = next period's
  start), the period's facts in one pass over `Sites` and `Activity` (work by `Activity.rep`, results
  by `Sites.rep`; P7-1 for running periods, "as the period ended" for past ones), the four parts,
  the team / region / side-by-side / lost-reason parts, and the WhatsApp text, all built in one
  shared place. Public `repSummary(k, period)` and `adminPageSummary(k, period)` (allow-list 18 → 20).
- Tests (`tests/summary.test.js`): periods, every count, both won / lost rules, team totals,
  targets and %, the Now parts, privacy and refusals, exact WhatsApp wording, speed (opens, reads,
  blocks, no writes).

## [ ] Step 5: The pages
- `App.html`: a **Summary** button in the top line, the summary screen (four buttons, loading,
  no signal + Try again, "As of", "not sent yet", Share on WhatsApp link, Copy with fallbacks,
  Back to the list where he was). The page renders the server's lines as text. Admin: the same
  screen; tapping a salesman's line shows his summary, Back to the team. `App.html` ≤ 88,000 bytes
  (pinned by a test).
- Browser check `tests/browser/summary.check.js` (salesman and admin) in `check:browser`.

## [ ] Step 6: Docs, local acceptance
- Data model (kept copy, `Activity` update rows), AGENTS.md (20 public functions), src/README,
  tests/README, roadmap, handoff, spec criteria ticked (not the live ones).

## [ ] Step 7: Live (coordinator, with the owner)
- Push, update the deployment, live checks against the TEST rows (S9-1), Copy / WhatsApp inside
  Google's frame on his phone.

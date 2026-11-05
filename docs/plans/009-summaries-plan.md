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

## [x] Step 4: Server summaries
- `admin.js`: `activitySince_` (the bottom-up block read, from any moment); `monthActivity_` uses it.
- New `summary.js`: periods (Saturday to Friday weeks, months, Pakistan time, end = next period's
  start), the period's facts in one pass over `Sites` and `Activity` (work by `Activity.rep`, results
  by `Sites.rep`; P7-1 for running periods, "as the period ended" for past ones), the four parts,
  the team / region / side-by-side / lost-reason parts, and the WhatsApp text, all built in one
  shared place. Public `repSummary(k, period)` and `adminPageSummary(k, period)` (allow-list 18 → 20).
- Tests (`tests/summary.test.js`): periods, every count, both won / lost rules, team totals,
  targets and %, the Now parts, privacy and refusals, exact WhatsApp wording, speed (opens, reads,
  blocks, no writes).
- Done: 34 more tests in `tests/summary.test.js`. 15 mutations of the server each failed a test
  (no period end bound, the admin counted as work, P7-1 for past periods and "as ended" for
  running ones, Now parts not his own, a snooze as work, a deleted site as a result, Now parts in
  a past text, no block stop, results not by salesman, former codes dropped, first instead of
  latest quote Rs., an update counted as a move).

## [x] Step 5: The pages
- `App.html`: a **Summary** button in the top line, the summary screen (four buttons, loading,
  no signal + Try again, "As of", "not sent yet", Share on WhatsApp link, Copy with fallbacks,
  Back to the list where he was). The page renders the server's lines as text. Admin: the same
  screen; tapping a salesman's line shows his summary, Back to the team. `App.html` ≤ 88,000 bytes
  (pinned by a test).
- Browser check `tests/browser/summary.check.js` (salesman and admin) in `check:browser`.
- Done. `App.html` 87,935 bytes (the admin-only style of the tappable salesman lines lives in
  `Admin.html`). 5 page mutations each failed the check (no "As of", no "Press and hold", Back
  losing his place, no "not sent yet" line, an unencoded WhatsApp link).

## [x] Step 6: Docs, local acceptance
- Data model (kept copy, `Activity` update rows), AGENTS.md (20 public functions), src/README,
  tests/README, roadmap, handoff, spec criteria ticked (not the live ones).
- Done: 362 tests (322 before) and 8 browser checks pass.
- Choices made where the spec was silent (for the reviewer and the owner):
  - Headings: a Saturday's This week is "This week so far · Sat 7 Nov" (one day, like the 1st of
    a month); This month keeps "so far" on its last day too (the spec lists only the 1st).
  - The note line reads "(Rs. logged, not invoiced)" on screen too, the same text as the message.
  - Rs. is left out next to a count of 0 ("Quotes given 0", "Won 0 · Lost 0", "Hot sites 0").
  - In the text, the "Now, 5 Nov" heading sits right above "Coming up" (no blank line).
  - The admin's view of a salesman puts "Logged on 5 days" under the first Numbers line; it is in
    that view's shared text too.
  - Late & going cold names a site that is both late and cold with both ("2 days late · no update
    for 15 days"); a late site with no date says "no follow-up date".
  - Ties: named lists by Rs., then name; Late & going cold by Rs., then follow-up, then newest.
  - "Not in the salesmen list": only codes with something in the period; same line form, no %.
  - Team lost reasons count every lost site in the period, as the This month tab does (a former
    salesman's too); the block is left out when nothing was lost.
  - Side by side in a month with no target: no "% of target" part.
  - A finished period's Won Rs. falls back to the site's current Rs. only if no row in the period
    carried one (never for rows the app wrote).
  - Opening Summary always starts on This week, fetched fresh; the admin keeps looking at the same
    salesman when he switches period.

## [ ] Step 7: Live (coordinator, with the owner)
- Push, update the deployment, live checks against the TEST rows (S9-1), Copy / WhatsApp inside
  Google's frame on his phone.

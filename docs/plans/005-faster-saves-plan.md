# Build plan 005: Instant saves, faster server, stage when adding

> For [spec 005](../specs/005-faster-saves.md) (**Approved** 2026-11-04). One commit per step,
> `npm run check` (+ `check:browser` when HTML changes) green each time.

## [x] Step 1: Server does less per call
- Open Sales Diary once per call and pass it along (`whoIsVisiting_`, `requireRep_`, saves).
- Every save checks and writes inside the lock, reading `Sites`, `Activity`, `Lists` once each.
- Replies carry only the saved site's card (plus areas if one was added).
- Salesmen list kept 24 h in Script Properties; `menuRefreshSalesmen`; Check setup refreshes it.
- Test: counts sheet opens and tab reads per call.

## [x] Step 2: Stage when adding a site (rules + server)

## [x] Step 3: The page: instant saves (one at a time, in order) and Stage in + New Site

## [x] Step 4: Docs, review, local acceptance

## [ ] Step 5: Live with the owner; time saves before / after

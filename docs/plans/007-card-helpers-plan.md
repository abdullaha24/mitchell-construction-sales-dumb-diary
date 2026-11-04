# Build plan 007: Site card helpers and the area filter

> For [spec 007](../specs/007-card-helpers-areas.md) (**Approved** 2026-11-04, session 4) and
> [ADR-0009](../decisions/0009-worked-at-and-note-at.md). One commit per step, `npm run check`
> (+ `check:browser` when HTML changes) green each time.

## [x] Step 1: Server: `worked_at`, `note_at`, the card's new dates
- `DIARY_HEADERS.Sites` gains `worked_at` and `note_at` at the end (a fresh sheet gets them from
  Check setup); data model updated in the same change.
- + New Site writes both (`note_at` only with a note); Update writes `worked_at` always and
  `note_at` with a note; Edit details writes neither.
- `cardOf_` adds `worked` (day of `worked_at`, else `created_at`) and `noteDay` (day of
  `note_at`, or '').
- Tests: what each save writes; fallbacks; page load never reads `Activity` (speed test).

## [x] Step 2: Server: Snooze
- `repSnoozeSite(k, siteId, input)` (public, inside `forSalesman_` / `requireRep_`) →
  `saveSnooze_` inside the lock, once per save ID: his open site only, Tomorrow / 3 days / 1 week
  from today, never earlier (notice, nothing written), writes `next_followup` + `updated_at` and
  one `snooze` row. Reply: only that card.
- Tests: the rules, ADR-0004 (another salesman's site: refused, nothing written), junk code,
  repeat save ID + `repSaveStatus`, text as text; allow-list 14 → 15; speed (Links, Sites,
  Activity once; Lists not at all).

## [x] Step 3: The page
- Card: last-spoken line, going cold (yellow + tag), Call / WhatsApp / Snooze row (buttons never
  open the site screen); site screen: Call / WhatsApp, note with its day, going-cold tag.
- Snooze panel through the save queue (send, retry, failed card on every tab).
- Area filter on All My Parties, combined with search; cleared after + New Site.
- Browser check `tests/browser/cards.check.js` in `check:browser`; existing checks still pass.

## [ ] Step 4: Docs, review, local acceptance
- Data model, src/README.md, tests/README.md, AGENTS.md, roadmap ("built and checked locally"),
  spec criteria ticked.
- Mutation checks on the key assertions; fresh-clone check; secrets sweep.

## [ ] Step 5: Live with the owner (coordinator)
- Add the two `Sites` headers to the live sheet **first**, then push and update the deployment;
  owner tests on his phone (Call / WhatsApp); TEST rows cleaned up with his OK.

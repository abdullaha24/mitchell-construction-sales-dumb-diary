# Build plan 008: The owner (admin) screen

> For [spec 008](../specs/008-owner-screen.md) (**Approved** 2026-11-04, session 4, answers
> P7-1 to P7-7) and [ADR-0010](../decisions/0010-owner-link-can-update-sites.md) (Accepted). One
> commit per step, `npm run check` (+ `check:browser` when HTML changes) green each time. On
> screen the owner is **Admin** (P7-7); code names use `admin` for the new parts.

## [ ] Step 1: Spec approved, answers recorded, this plan
- Spec → Approved with P7-4 to P7-7; ADR-0010 Accepted; open questions, glossary (Admin /
  Administrator), indexes.

## [ ] Step 2: Server
- Kept targets: the `salesmen` Script Properties entry also keeps region and house targets
  (`regionTargets`, this month and next); a copy without it is read again; a `Targets` problem
  never stops salesmen.
- `whoIsVisiting_`: the owner row also returns who has a working link (codes never leave it).
- `admin.js`: `requireAdminLink_`, `forAdminPage_`; this month's `Activity` read from the bottom in
  blocks of 500; the admin page data (salesmen, targets, sites, closed this month, snoozes,
  today's saves); `adminPageLoad`, `adminPageUpdateSite`, `adminPageSaveStatus`.
- `saveUpdate_` shared: admin finds any site by ID, writes `rep` = `admin`, "Admin: " notes, never
  `worked_at`, keeps `save:admin:` keys; both sides refuse a stale form (`seen`).
- Words: "Admin" in every message and the Links window (P7-7); `Links.role` stays `owner`.
- Tests (`tests/admin.test.js` + updates): rules, ADR-0004 safety for each new function (junk,
  salesman's code, cancelled admin code), update, speed; allow-list 15 → 18 and the check each kind
  starts with.

## [ ] Step 3: The page
- `Admin.html` inserted into `App.html` for the admin only: top bar (Admin, Updated, Refresh),
  tabs Today · Team · Late & cold · This month, tap-through lists, the site screen with the
  salesman line and Update (no Edit details, no Snooze), the save queue with `adminPageUpdateSite`.
- Salesman page: sends `seen` with an Update; shows a "changed a moment ago" refusal with the
  fresh card.
- Browser check `tests/browser/admin.check.js` in `check:browser`; existing checks unchanged.

## [ ] Step 4: Docs, local acceptance
- Data model, src/README.md, tests/README.md, AGENTS.md, roadmap ("built and checked locally"),
  spec criteria ticked.
- Mutation checks on key assertions; fresh-clone check; secrets sweep.
- [ ] Independent review (coordinator).

## [ ] Step 5: Live (coordinator)
- Push and update the deployment; owner tests on his phone; TEST rows cleaned up with his OK.

# Build plan 008: The owner (admin) screen

> For [spec 008](../specs/008-owner-screen.md) (**Approved** 2026-11-04, session 4, answers
> P7-1 to P7-7) and [ADR-0010](../decisions/0010-owner-link-can-update-sites.md) (Accepted). One
> commit per step, `npm run check` (+ `check:browser` when HTML changes) green each time. On
> screen the owner is **Admin** (P7-7); code names use `admin` for the new parts.

## [x] Step 1: Spec approved, answers recorded, this plan
- Spec → Approved with P7-4 to P7-7; ADR-0010 Accepted; open questions, glossary (Admin /
  Administrator), indexes.

## [x] Step 2: Server
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
- Done: `tests/admin.test.js` (25 tests). 12 key assertions mutation-checked (each broken on
  purpose, a test failed, restored): the admin-link check, `worked_at`, the block stop, `rep` =
  `admin`, the stale-form check, won by its own stage, snooze counts, today only, the "Admin: "
  note, save keys, kept region targets, the link list.

## [x] Step 3: The page
- `Admin.html` inserted into `App.html` for the admin only: top bar (Admin, Updated, Refresh),
  tabs Today · Team · Late & cold · This month, tap-through lists, the site screen with the
  salesman line and Update (no Edit details, no Snooze), the save queue with `adminPageUpdateSite`.
- Salesman page: sends `seen` with an Update; shows a "changed a moment ago" refusal with the
  fresh card.
- Browser check `tests/browser/admin.check.js` in `check:browser`; existing checks unchanged.
- Done. Found while building, fixed with checks: `seen` is what Google last confirmed plus what
  this page's own failed saves would have made the site (a retried save, a correction after a lost
  reply, and an Update replacing a failed snooze all still save; the existing checks caught it).
  `seen` may be a list of up to 5 states. 4 page behaviours mutation-checked in `admin.check.js`
  (`seen` sent, failed card on every tab, late order, Won day kept after a save), each caught.

## [x] Step 4: Docs, local acceptance
- Data model, src/README.md, tests/README.md, AGENTS.md, roadmap ("built and checked locally"),
  spec criteria ticked.
- Mutation checks on key assertions; fresh-clone check; secrets sweep. Done: 315 tests and 7
  browser checks pass on a fresh clone; secrets sweep clean (made-up amounts only, no codes).
- [x] Independent review: security clean. Fixed, each with a check that failed on the old code
  (mutation-checked: 6 server, 5 page):
  1. "Saved once" broken after a lost reply (`seen` was in the save's fingerprint): `seen` and
     `after` left out of it. `queue.check.js` case G; `admin.test.js`.
  2. A stale form's values could still be saved (refused, then resent unchanged; or a refresh
     under an open form). Redesigned: `seen` is recorded when the form opens; the server keeps
     the site's current value for everything he left as he saw it, saves what he changed, and
     refuses only a real clash; the page re-bases the form (his touched fields kept) on a refusal,
     a refresh, or a kept draft; `after` names his own unheard saves. `admin.check.js` (a), (b)
     check `value_rs` and `next_followup`; `queue.check.js` case I; `admin.test.js`.
  3. An Update kept on a phone from version 9 (no `seen`) saves as before: `queue.check.js` case H.
- [x] Second review: the three fixes hold. Fixed, each with a check that failed on the old code
  (mutation-checked: 1 server, 4 page):
  1. His own earlier change could be lost: a form opened over his still-saving Update took `seen`
     from that unconfirmed card, so if it then failed, the next save kept the old stage. Now the
     page keeps what Google last confirmed per site (load, Refresh, a reply, a refusal) and `seen`
     always comes from it; an Update replaces only the failed saves it carried (`carries`).
     `queue.check.js` cases J, K; `admin.check.js` (c).
  2. A change the new stage doesn't use (the admin closed the site as Lost while RIA's old form
     changed value and follow-up) is now a clash, refused, not dropped: `admin.test.js`.
  `check:browser` run 3 times: green each time.

## [ ] Step 5: Live (coordinator)
- Push and update the deployment; owner tests on his phone; TEST rows cleaned up with his OK.

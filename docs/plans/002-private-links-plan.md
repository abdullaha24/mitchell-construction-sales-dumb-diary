# Build plan 002: Private links

> For [spec 002](../specs/002-private-links.md) (**Approved** 2026-11-04). Same rules as plan 001:
> small steps, `npm run check` green at the end of each, one commit each, tick when committed.

## Ground rules
- Read spec 002's *Rules* and *Safety* first. Helper names end in `_`.
- Public functions are exactly: `doGet`, `onOpen`, `menuCheckSetup`, `menuLinks`,
  `ownerListLinks`, `ownerNewLink`, `ownerCancelLink`. Every `menu…`/`owner…` one starts with
  the signed-in-owner check.
- No link code ever goes into git, a log, an error message, or a page other than the owner's
  Links window. Tests use codes made by the fake `getUuid`.
- Values returned to a page (`google.script.run`) must be plain text, numbers, booleans,
  arrays and objects: **no `Date`s** (Google drops them).

## [x] Step 1: Settings, fakes, and the Links tab
- `config.js`: `SALES_DIARY_ID`, `WEB_APP_URL` (ADR-0008), `Links` headers, `TOKEN_COLUMN`.
- `src/diary.js`: `openSalesDiary_()`, the only place that opens Sales Diary by ID. Test: only
  `metadata.js` and `diary.js` open a spreadsheet by ID, each with its own ID.
- `setup.js`: Check setup also creates `Links` (bold, frozen, `token` plain text). Shared
  `appendRows_` helper (adds rows first if the tab is full), used by `Lists` too.
- Fakes: `Utilities.getUuid` (Node `crypto.randomUUID`), `formatDate` pattern `d MMM yyyy`,
  `LockService`, `Range.setValues` reused for single cells.
- Commit: "Add Links tab, Sales Diary ID and web address settings".

## [x] Step 2: Link rules
- `src/links.js`: `makeCode_`, `isWellFormedCode_`, `readLinks_`, `isActiveCell_`,
  `whoIsVisiting_(code)` (rep / owner / none), `newLink_`, `cancelLinks_` (inside a script lock),
  `linkFor_` (address from `WEB_APP_URL`).
- `metadata.js`: `readSalesmenOnly_()` (just `Rep_Mapping`, for page loads).
- Tests: every rule in spec 002 → Links.
- Commit: "Add link rules: make, look up, cancel".

## [x] Step 3: Web pages
- `doGet(e)`: rep → "Hello, RIA"; owner → "Hello, owner"; otherwise "This link doesn't
  work"; Google failure → "Something went wrong". *(Built as one escaping template,
  `Page.html`, instead of separate `Hello.html` / `NoLink.html`.)* `Index.html` removed.
- Tests: each case; junk codes open no sheet; no code in any page or error.
- Commit: "Serve Hello / no-link pages from the link code".

## [x] Step 4: Links window
- `menu.js`: the `Sales Diary → Links` menu item. `src/linkswindow.js`: `menuLinks`,
  `ownerListLinks`, `ownerNewLink`, `ownerCancelLink`. `src/Links.html`: rows, New / Copy / Send on WhatsApp /
  Cancel with a confirming second tap; built with `textContent`, never `innerHTML` from data.
- Tests: owner-only refusals touch nothing; only `owner` or a current salesman accepted; list
  contents; new cancels old; allow-list of 7 public functions.
- Commit: "Add the owner's Links window".

## [x] Step 5: Open the web app to Anyone; local acceptance
- `appsscript.json` → `access: "ANYONE_ANONYMOUS"`. Docs (AGENTS, data model, handoff).
- Fresh-clone check, secrets sweep, independent review.
- Commit: "Phase 2 local work complete".

## [x] Step 6: Live switch-over (with the owner)
Spec 002 → One-time switch-over. `clasp push --force`, then
`update-deployment AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF`.
Never `create-deployment`.

## [x] Step 7: Close out
Spec 002 → Done, roadmap phase 2 ✅, handoff → phase 3 spec.

# src/

Apps Script source code: server-side `.js` files plus `.html` for the screens. This folder is
clasp's `rootDir` (ADR-0003), so its contents get pushed to Apps Script. Only `.js`, `.html` and
`appsscript.json` belong here: no tests, notes or secrets. (clasp's default rules skip this
README: it pushes only `appsscript.json`, `.js`, `.gs`, `.ts` and `.html` files. Check with
`npx clasp show-file-status`.)

All files share **one global scope** in Apps Script, so:
- helper functions end in `_` (a web page can call any function that doesn't);
- no function or top-level `const` name may appear in two files (tests enforce this);
- a top-level `const` must not use a value from another file.

| File | Holds |
| --- | --- |
| `appsscript.json` | Manifest: Pakistan time, V8, web app runs as the owner, open to anyone with a link (`ANYONE_ANONYMOUS`). |
| `config.js` | Fixed settings: Meta-Data and Sales Diary IDs, web address (ADR-0007, ADR-0008), tab names, headers, starting `Lists` values. |
| `rules.js` | Plain logic, no spreadsheet access: columns by name, months, Rs., reading salesmen and targets, the Check setup summary. |
| `metadata.js` | The **only** code that opens the Meta-Data sheet. Read only. Keeps the salesmen list and last, this and next month's targets (salesmen's, and region and house / office ones for the admin) in Script Properties for a day, with the `months` it holds (specs 005, 006, 008, 009). |
| `diary.js` | The **only** code that opens the Sales Diary sheet by ID; adding rows at the bottom. |
| `setup.js` | Creates missing Sales Diary tabs (including `Links`) and fills the starting `Lists`. |
| `links.js` | Link codes: make, look up (who is visiting), new and cancel, inside a lock. |
| `menu.js` | `onOpen` (the Sales Diary menu), `menuCheckSetup` and `menuRefreshSalesmen` (Refresh salesmen & targets). |
| `linkswindow.js`, `Links.html` | The owner's Links window and the three `owner…` functions it calls (signed-in check). |
| `admin.js` | The admin's (owner's) screen, spec 008: `requireAdminLink_` (his working link only), `Activity` read from the bottom in blocks of 500 (`activitySince_`, also used by summaries), the screen's data, and `adminPageLoad`, `adminPageUpdateSite`, `adminPageSaveStatus`. |
| `siterules.js` | Plain logic for sites: tidy phone numbers, areas and "Did you mean", follow-up dates, checking a new site, an Update, Edit details and a Snooze, IDs; `mergeTouched_` (spec 008: only what he touched is written; a real clash is refused); earlier contacts (spec 011): reading and writing the `earlier_contacts` cell, checking a new contact person, the `contact` row's note. |
| `sites.js` | Reading tabs by header; a salesman's sites as cards (with `worked` and `noteDay`, spec 007); the yes/no phone check; saving a site, an Update (a salesman's or the admin's, spec 008: only the touched things are written; a real clash is refused; its `Activity` row carries Rs. only when it changed, spec 009), Edit details and a Snooze inside the lock (`worked_at` / `note_at` only where specs 007 and 008 say); no-number counts. Spec 011: cards carry `earlier`; an Update can carry a new contact person or Make main (a `contact` row; a contact-only one writes no `update` row), Edit details' "Yes, keep the old one"; the phone check covers earlier contacts and skips the site being changed. |
| `salesman.js` | `repLoad`, `repCheckPhone` (spec 011: an optional site ID of his own to skip), `repAddSite`, `repUpdateSite`, `repEditSite`, `repSnoozeSite`, `repSaveStatus`: what a salesman's page calls. Working salesman link only. His page data includes only his own target. |
| `summary.js` | Weekly and monthly summaries (spec 009): periods (Saturday to Friday, Pakistan time), the period's counts in one pass (work by `Activity.rep`, results by `Sites.rep`), the parts (tiles, target bar, tables, NOW; the admin's team table, Won in millions: spec 010) and the WhatsApp text (numbers in a monospace block) built in one place; `repSummary` (his own only) and `adminPageSummary` (team, regions, salesmen side by side, each salesman's own). Writes nothing. |
| `webapp.js`, `App.html`, `Admin.html`, `Page.html` | `doGet`: a salesman gets his app (`App.html`); the owner's link gets the admin screen: `App.html` (site screen, Update form, save queue, the Summary screen of spec 009) with `Admin.html` (tabs and lists) inside, only on his page (spec 008); anything else "This link doesn't work" / "Something went wrong". Pages are served through `servedHtml_` (spec 010): comments and indentation removed at that moment, no build step. |

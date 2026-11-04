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
| `metadata.js` | The **only** code that opens the Meta-Data sheet. Read only. Keeps the salesmen list and this month's and next month's targets in Script Properties for a day (specs 005, 006). |
| `diary.js` | The **only** code that opens the Sales Diary sheet by ID; adding rows at the bottom. |
| `setup.js` | Creates missing Sales Diary tabs (including `Links`) and fills the starting `Lists`. |
| `links.js` | Link codes: make, look up (who is visiting), new and cancel, inside a lock. |
| `menu.js` | `onOpen` (the Sales Diary menu), `menuCheckSetup` and `menuRefreshSalesmen` (Refresh salesmen & targets). |
| `linkswindow.js`, `Links.html` | The owner's Links window and the three `owner…` functions it calls. |
| `siterules.js` | Plain logic for sites: tidy phone numbers, areas and "Did you mean", follow-up dates, checking a new site, an Update, Edit details and a Snooze, IDs. |
| `sites.js` | Reading tabs by header; a salesman's sites as cards (with `worked` and `noteDay`, spec 007); the yes/no phone check; saving a site, an Update, Edit details and a Snooze inside the lock (`worked_at` / `note_at` only where spec 007 says); no-number counts. |
| `salesman.js` | `repLoad`, `repCheckPhone`, `repAddSite`, `repUpdateSite`, `repEditSite`, `repSnoozeSite`, `repSaveStatus`: what a salesman's page calls. Working salesman link only. His page data includes only his own target. |
| `webapp.js`, `App.html`, `Page.html` | `doGet`: a salesman gets his app (`App.html`); the owner "Hello, owner"; anything else "This link doesn't work" / "Something went wrong". |

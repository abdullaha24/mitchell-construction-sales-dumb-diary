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
| `appsscript.json` | Manifest: Pakistan timezone, V8, web app runs as the owner, "only myself" in phase 1. |
| `config.js` | Fixed settings: Meta-Data ID (ADR-0007), tab names, Sales Diary headers, starting `Lists` values. |
| `rules.js` | Plain logic, no spreadsheet access: columns by name, months, Rs., reading salesmen and targets, the Check setup summary. |
| `metadata.js` | The **only** code that opens the Meta-Data sheet. Read only. |
| `setup.js` | Creates missing Sales Diary tabs and fills the starting `Lists`. |
| `menu.js` | `onOpen` (adds the menu) and `menuCheckSetup` (Sales Diary → Check setup). |
| `webapp.js`, `Index.html` | `doGet` and the placeholder page (phase 1: no data). |

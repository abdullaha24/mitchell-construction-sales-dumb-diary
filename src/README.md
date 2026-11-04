# src/

Apps Script source code goes here: server-side `.js` files plus `.html` for the screens.
This folder is planned to be clasp's `rootDir` (ADR-0003), so its contents get pushed to Apps
Script. Only `.js`, `.html` and `appsscript.json` belong here: no tests, notes or secrets.
(When clasp is set up in phase 1, add a `.claspignore` that excludes this README.)

Empty for now. Layout (UI / server entry points / business rules / sheet access) is described in
[`docs/architecture/overview.md`](../docs/architecture/overview.md) and will be set up in roadmap
phase 1.

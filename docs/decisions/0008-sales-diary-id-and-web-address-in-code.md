# 0008: The Sales Diary sheet's ID and the web app address are kept in the code

- **Status:** Accepted (owner approved with spec 002 on 2026-11-04)
- **Date:** 2026-11-04
- **Deciders:** agent (recommendation), owner (approved)

## Context
From phase 2 the web app reads the Sales Diary `Links` tab on every page load, and the owner's
Links window shows full links. Two things must be known for that:
- **Which spreadsheet is Sales Diary.** A web app has no "open sheet". Apps Script's
  `getActiveSpreadsheet()` is meant for code started from inside a sheet (a menu, a trigger);
  relying on it inside a web app would be relying on undocumented behaviour.
- **The web app's address**, to build links. `ScriptApp.getService().getUrl()` exists, but with
  more than one deployment (every project also has a `@HEAD` test deployment) it is not
  reliably the address salesmen get.

Both values were fixed in phase 1 and are not secret: the sheet needs the owner's Google account
to open, and the address shows nothing without a link code.

## Decision
- `src/config.js` holds `SALES_DIARY_ID` (`1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y`) and
  `WEB_APP_URL` (the phase 1 deployment's `/exec` address), the same way ADR-0007 keeps the
  Meta-Data ID.
- The web address never changes because every update uses `update-deployment` on the phase 1
  deployment.

## Options considered
- **`getActiveSpreadsheet()` / `getService().getUrl()`**: nothing to keep in code, but both can
  silently give the wrong answer in a web app. Not chosen.
- **Script Properties set by Check setup**: no code change if the sheet is replaced, but hidden
  state that tests and agents can't see. Not chosen.
- **In the code** *(recommended)*: one obvious place, testable, same as ADR-0007.

## Consequences
- Replacing the Sales Diary sheet, or making a second deployment, needs a one-line code change
  and a push. Neither should happen.
- Tests can check that links are built from `WEB_APP_URL`.

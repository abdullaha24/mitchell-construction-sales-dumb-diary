# tests/

Automated tests that run locally in Node, with **no Google account and no live Sheet**.
Run them with `npm test` (or `npm run check` for type check + tests). Node's built-in
`node:test` runner; no test packages.

| Path | Holds |
| --- | --- |
| `helpers/load-src.js` | Loads every `src/*.js` into one shared `node:vm` sandbox, like Apps Script's single global scope. Read top-level `const` values with `get('NAME')`; wrap sandbox objects in `plain()` before `deepStrictEqual`. |
| `helpers/fakes.js` | Minimal fakes for `SpreadsheetApp`, `Session`, `HtmlService`, `Utilities`. Fake spreadsheets are plain tables; a **read-only** one (used for Meta-Data) throws on any write. Where the code depends on Google's behaviour, the fakes copy it. |
| `fixtures/meta-data.js` | The live Meta-Data sheet's **shape** with **made-up amounts**. The owner's real targets never go in git. |
| `*.test.js` | One file per `src` area, plus `fakes.test.js` and `load-src.test.js`. |
| `browser/*.check.js` | `npm run check:browser`: the owner's Links window, and the salesman's page end to end (real `doGet` and server code on fake sheets, Chromium at 360px): adding (`app`), updating (`update`), the save queue (`queue`), the tabs, search and target (`tabs`, spec 006), the card helpers, Snooze and the area filter (`cards`, spec 007), and the admin's screen and his Updates (`admin`, spec 008). Not part of `npm test` (needs Playwright). |

Rule: new logic gets tests; new server functions get a test that a salesman only sees his own
data (ADR-0004). `admin.test.js` (spec 008): every `adminPage…` function gives nothing to a junk
code, a salesman's code or a cancelled admin code; it reads `Activity` only from the bottom. `interleave.test.js`: "two people, one site" in 1,500 seeded random interleavings (a model of the page's save queue using App.html's own update rules, against the real server); `SEED=<n>` reruns one, `SEEDS=<n>` runs more.

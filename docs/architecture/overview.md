# Architecture overview

> Status: **Draft**. Describes the intended design; nothing is built yet. Update this as code lands.

## The pieces

```
 Salesman's phone                     Google (owner's account)
 ┌──────────────────┐   private link   ┌──────────────────────────────┐
 │ Browser          │ ───────────────▶ │ Apps Script web app          │
 │ (HTML/CSS/JS UI) │ ◀─────────────── │  doGet(): serves the page    │
 │                  │  google.script   │  server functions: read/save │
 └──────────────────┘   .run calls     │          │                   │
                                       │          ▼                   │
 Owner's laptop/phone                  │  Google Sheet (the database) │
 ┌──────────────────┐   opens directly │   Reps · Sites · Activity ·  │
 │ Google Sheets    │ ───────────────▶ │   Lists                      │
 └──────────────────┘                  └──────────────────────────────┘
```

1. A salesman taps his private link (ADR-0002). `doGet` checks the token and serves the app page.
2. The page calls server functions with `google.script.run`, always passing the token.
3. The server checks the token, works out who he is, and reads or writes **only his rows**.
4. Every change writes the current state to **Sites** and appends a row to **Activity**.
5. The owner reads the Sheet directly.

## Layers (planned, see ADR-0003)

| Layer | Job | Testable locally? |
| --- | --- | --- |
| **UI** (HTML/JS in `src/`) | Screens, buttons, calls the server | Manually / later browser tests |
| **Server entry points** | `doGet` and functions the UI calls. Check token, call logic, return data | Partly, with mocks |
| **Business rules** | Pure functions: stage rules, going-cold, follow-up dates, list filters | **Yes, fully** |
| **Sheet access** | The only code that touches `SpreadsheetApp`. Read/write rows by column name | With mocks |

Rule: business rules never call Google services directly. That keeps them fast to test.

## Cross-cutting rules
- **Security:** token checked on every call; server filters data by salesman; tokens never logged.
- **Concurrency:** wrap writes in `LockService` so two salesmen saving at once can't clobber rows.
- **Time:** store timestamps in a consistent form; display in Pakistan time (`Asia/Karachi`).
- **Performance:** load a salesman's data in one call when the app opens; avoid a server call
  per card or per tap where possible.
- **Columns by name, not position:** look up columns by header so the owner can add columns
  without breaking the app.

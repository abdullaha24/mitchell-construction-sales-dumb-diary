# Decisions (ADRs)

One short file per significant decision, so humans and agents know **what was decided and why**
and don't re-argue it every session.

## Rules
- Name files `NNNN-short-title.md` with the next free number. Copy [`_template.md`](_template.md).
- Status is one of: `Proposed` → `Accepted` / `Rejected`, and later `Superseded by NNNN`.
- Only the owner moves an ADR to `Accepted`. Agents write `Proposed`.
- Never edit the decision of an `Accepted` ADR. Write a new one that supersedes it.

## Index

| # | Title | Status |
| --- | --- | --- |
| [0001](0001-google-sheets-and-apps-script.md) | Google Sheets backend + Apps Script web app | Accepted |
| [0002](0002-per-salesman-private-links.md) | Identify salesmen by private unguessable links, no logins | Accepted |
| [0003](0003-code-tooling-and-local-testing.md) | Code tooling: clasp, plain JS, local tests | Accepted |
| [0004](0004-private-lists-no-territories.md) | Private lists per salesman, no territories, duplicate warning | Accepted |
| [0005](0005-app-data-sheet-and-meta-data-sheet.md) | App data in "Sales Diary"; salesmen and targets read from "Mitchell Sales Meta-Data" | Accepted |
| [0006](0006-owner-private-link.md) | Owner opens his screen with a private owner link | Accepted |

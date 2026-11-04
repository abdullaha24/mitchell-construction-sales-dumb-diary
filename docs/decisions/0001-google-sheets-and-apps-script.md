# 0001: Google Sheets backend + Apps Script web app

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** owner

## Context
A 7-person sales team needs a simple phone app. The owner wants the data somewhere he can open and
read himself, with no servers to run and no monthly bills. Salesmen find Google Sheets on a phone
too cumbersome to use directly.

## Decision
- Store all data in **one Google Sheet** owned by the owner's Google account.
- Serve the app as a **Google Apps Script web app** bound to (or linked to) that Sheet. The phone
  opens it like a normal website. HTML/CSS/JS for the screens, Apps Script for the server side.
- Deploy with **Execute as: Me (owner)** and **Who has access: Anyone**, so salesmen don't need a
  Google account. Who they are comes from their private link (ADR-0002).

## Options considered
- **Salesmen edit the Sheet directly**: free and zero code, but too clumsy on a phone. Rejected.
- **Google Forms**: easy, but can't show a salesman *his own* list, follow-ups or history. Rejected.
- **No-code app builders (AppSheet, Glide)**: fast, but per-user costs and limited control. Not chosen.
- **Custom server + database**: most flexible, but hosting cost and upkeep. Overkill for 7 users.

## Consequences
- Free to run and the owner can read the raw data any time.
- Every server call reads or writes the Sheet, so keep calls few and batched. Use `LockService`
  around writes, since several salesmen can save at the same moment.
- Apps Script has daily quotas and per-run time limits. Fine at 7 users; don't build anything
  that loops over the whole Sheet on every tap.
- Apps Script web apps can feel slow to first load. Keep the page light; show something instantly.
- Because the script runs as the owner, **the server must decide what each salesman may see**.
  Never trust the browser to filter (see ADR-0002).
- The Sheet's columns are the API. Changing them needs a data-model update and care
  (see `docs/architecture/data-model.md`).

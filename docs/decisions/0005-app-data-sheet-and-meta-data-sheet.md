# 0005: App data in a new "Sales Diary" sheet; salesmen and targets read from "Mitchell Sales Meta-Data"

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** owner (interview Q13)

## Context
The owner already keeps a Google Sheet, **"Mitchell Sales Meta-Data"** (timezone `Asia/Karachi`),
with the salesmen list (`Rep_Mapping`), per-salesman monthly targets (`Rep-Targets`) and
per-region targets (`Targets`). He edits it by hand. Other things may already read it.

## Decision
- The app **reads** salesmen and targets from Meta-Data. **It never writes to Meta-Data.**
- Everything the app writes (sites, activity, links, pick-lists) goes in a new spreadsheet,
  **"Sales Diary"**.
- The salesman code in `Rep_Mapping` (e.g. `RIA`) is the salesman's ID everywhere in the app.
- The Meta-Data spreadsheet ID is configuration (e.g. a Script Property), not hard-coded.

## Options considered
- **Add app tabs to Meta-Data**: one file, but app data mixes with hand-edited settings, and
  anything else reading Meta-Data could be affected. Rejected.

## Consequences
- The owner adds or removes salesmen and changes targets exactly as today, in Meta-Data.
- The app must read Meta-Data defensively (details in `docs/architecture/data-model.md`):
  read only the named columns, skip blank or stray cells, and parse amounts written with commas.
- A salesman in `Rep_Mapping` with no link in Sales Diary simply can't open the app yet. One with
  no target row shows no target.

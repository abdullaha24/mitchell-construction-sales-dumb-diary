# 0004: Private lists per salesman, no territories

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** owner (interview Q9, Q9c, Q9d)

## Context
Salesmen are not limited to areas: RIA, AUR and WAK can all chase sites in DHA. But the owner
doesn't want salesmen seeing each other's pipelines (parties, rates, notes, activity).
Because lists are private, two salesmen could unknowingly chase the same contact, possibly at
different rates.

## Decision
- **No territories.** Any salesman can add a site in any area. Areas are for route planning only.
- **Each site belongs to one salesman** (the one who added it). The owner can move a site to
  another salesman by editing the Sales Diary sheet, e.g. when someone leaves.
- **A salesman sees only his own sites and his own activity.** The server enforces this
  (ADR-0002). The browser never gets other salesmen's data.
- **One narrow exception: the duplicate warning.** When a salesman adds or edits a contact whose
  phone number already belongs to another salesman's site, the server answers only yes/no. The
  app shows *"Someone in the team already works with this contact."* No name, site, stage, rate
  or note is revealed. He can still save. (Match on phone number in one normalised format.)
- **The owner sees everything** on his own screen.

## Options considered
- **One lead + added helpers**: offered; owner chose private lists instead.
- **Everyone sees everything**: rejected; salesmen must not see each other's pipelines.
- **Duplicates flagged only to the owner**: offered; owner chose to warn the salesman.

## Consequences
- Every server function that returns site or activity data must filter by the caller's salesman
  code. Tests must cover "salesman A can't read salesman B's site".
- The duplicate check is the only cross-salesman lookup. It must return a boolean, nothing more.
- Duplicate sites can still exist; the owner screen can surface them later if useful.

# 0011: Earlier contacts live in one `Sites` column

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** owner (S11-6: "+ New contact person", old one kept) / agent (storage)

## Context
A site's contact person changes (handed over to a new site engineer or buyer). The owner wants the new
person to become the main contact and the old one kept and still callable (spec 011). Until now a site
had exactly one contact (`contact_name`, `contact_phone`); changing it in Edit details lost the old one
except as a line of history text.

## Decision
Keep `contact_name` / `contact_phone` as the **main** contact (everything that calls, searches or checks
duplicates keeps working). Add one `Sites` column, **`earlier_contacts`**: plain text, one person per
line, newest first, `<phone or -> · <name> · <yyyy-MM-dd>`, at most 20. Every change also writes an
`Activity` row with action `contact`.

## Options considered
- **A column on `Sites` (chosen)**: the site row already read on every load and save carries it, so no
  new tab read (the one-read-per-tab speed rule holds); the owner can read and fix it in the sheet;
  small. Con: a list packed in one cell needs a careful line format (phone first, date last).
- **A new `Contacts` tab** (one row per person): cleanest data, unlimited, roles later. Con: another tab
  read on every load and save, joins, and a bigger change to the save paths for a rare action.
- **Only the history** (`Activity` notes): nothing to build, but old people can't be called or searched.

## Consequences
- `cardOf_` parses the cell; the page gets `earlier` only for the salesman's own sites (ADR-0004); the
  duplicate check reads it as yes/no.
- Writes go through `asText_`; a typed name can't start a formula.
- If contacts ever need roles or many people per site, move to a `Contacts` tab then (a migration from
  this column is simple: split the lines).

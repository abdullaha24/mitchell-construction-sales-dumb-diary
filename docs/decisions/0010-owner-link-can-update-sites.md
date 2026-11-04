# 0010: The owner's (admin) link can also update sites; his changes are recorded as `admin`

- **Status:** Accepted (owner, 2026-11-04, session 4, with spec 008)
- **Date:** 2026-11-04
- **Deciders:** owner (P7-3) / agent

## Context
(On screen the owner is called **Admin** (owner, P7-7); this ADR says "owner" and "admin" for
the same person.)

ADR-0006 gave the owner a private link to **look at** his screen. The owner accepted (A8) that
anyone who gets that link sees everything until he cancels it. For phase 7
([spec 008](../specs/008-owner-screen.md)) the owner decided (P7-3) that he also wants to
**update sites** from that screen (stage, Rs. value, follow-up, note), and that the history must
show it was him. The agent had recommended look-only. This changes what a leaked owner link can
do, so it is written down here. It adds to ADR-0006; it doesn't replace it.

## Decision
- The owner link opens a screen that can **update any site** with the same Update form and checks
  as a salesman's (spec 004). Nothing else changes from it: no Edit details, no Snooze, no new
  sites, no handing sites over, no deleting, no links.
- Every owner change is a normal `Activity` row with **`rep` = `admin`** (the site's salesman stays
  in `Sites.rep`), so every change he made is in the history and can be told from a salesman's.
- Functions called from his page are a separate kind, **`adminPage…`**, and each starts with an
  **admin-link check** (`requireAdminLink_`): only an active row in `Links` with `role` = `owner`
  (the value stays as it is in the live sheet) and exactly that code passes. A salesman's code, a cancelled code or junk gets "This link doesn't work." and
  nothing else. (The `owner…` functions of the Links window keep the signed-in check.)
- A save that would undo a change made after the form was opened (by the salesman or the owner) is
  refused, not merged.

## Options considered
- **Look-only owner screen** *(agent's recommendation)*: a leaked link only shows data. Not chosen
  (P7-3): the owner wants to act from his phone.
- **Update from the owner link** *(chosen)*: simplest, one link, works on his phone.
- **Changes need Google sign-in** (look by link, change only while signed in to his Google
  account): a leaked link could only look. Needs a second web app deployment open to Google
  accounts (the current one is anonymous by design, ADR-0002), and depends on the right account
  being signed in on his phone, which ADR-0006 already rejected. Not chosen now; can be added later.

## Consequences
- **Risk, stated plainly (accepted by the owner):** anyone who gets the owner's (admin) link can now **see everything and change any
  site** (stage, value, follow-up, note) until the owner cancels the link. They can't delete sites,
  change contacts, or make links. Every such change is in `Activity` as `admin` with its time, so
  the owner can see what was done and put it back by hand in the sheet.
- The owner should never forward his link, and cancel it at once (Sales Diary → Links, or untick
  `active` in the `Links` tab from the Sheets app on his phone) if his phone is lost or the link
  is shared by mistake.
- Tests must show: a salesman's code, a cancelled owner code and junk get nothing from any
  `adminPage…` function; every admin change writes `rep` = `admin`; a salesman still only ever
  receives his own data (ADR-0004).
- `Activity.rep` can now hold `admin` as well as salesman codes (data model, with spec 008's code).

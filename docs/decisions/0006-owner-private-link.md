# 0006: Owner opens his screen with a private owner link

- **Status:** Accepted (owner chose this option on 2026-11-04, session 2)
- **Date:** 2026-11-04
- **Deciders:** owner

## Context
The owner gets his own screen from day one (vision). It shows **every** salesman's sites,
contacts, rates and activity, so whoever opens it sees the whole company. Salesmen already use
private links with long random codes (ADR-0002). The owner screen needed a way in.

## Decision
- The owner opens his screen with a **private owner link**, the same kind as a salesman's: a long
  random code (at least 128 bits), never a readable ID.
- It is stored in the Sales Diary `Links` tab as a row with `role` = `owner`
  (see `docs/architecture/data-model.md`).
- Every server call re-checks the code on the server, exactly as in ADR-0002. Only a valid,
  active owner code unlocks owner data. A salesman's code never does.
- The owner can **cancel** his link and **issue a new one**, like any salesman's link. The exact
  steps are set in the phase 2 spec.

## Options considered
- **Google sign-in** *(agent's recommendation)*: a separate link that only works while the owner
  is signed in to his Google account, so a leaked link is useless to anyone else. Safer, but
  depends on the right Google account being signed in on his phone. Not chosen.
- **Private owner link** *(chosen)*: simplest, one way of working for everyone, nothing extra to
  sign in to.

## Consequences
- Anyone who gets the owner link sees **everything** until the owner cancels it. The owner
  knowingly accepted this. He should never forward it, and should cancel it at once if his phone is
  lost or the link is shared by mistake.
- Owner and salesman codes must never be confused: tests must show a salesman's code can't open
  owner data, and a cancelled owner code opens nothing.
- If a leak ever happens, Google sign-in can be added later as a new ADR without changing
  salesmen's links.

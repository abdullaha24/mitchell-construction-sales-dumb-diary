# 0002: Identify salesmen by private, unguessable links (no logins)

- **Status:** Accepted (owner approved the random-token and revoke design on 2026-11-04)
- **Date:** 2026-11-04
- **Deciders:** owner (idea), agent (safety details)

## Context
Salesmen are not tech-savvy and don't need Google accounts. The owner sets up one link per
salesman; opening it should "just know" who he is.

A simple ID in the link, like `?rep=lhr1`, is **easy to guess**. Anyone could change `lhr1` to
`isb2` and see another salesman's parties, contacts and rates. Because the script runs as the owner
(ADR-0001), the link is effectively the password.

## Decision
- Each salesman's link carries a **long random token**, e.g. `…/exec?k=8fQ2…` (at least 128 bits
  of randomness), never a readable or sequential ID.
- A **`Links`** table in the Sales Diary sheet maps token → salesman and active/inactive. The
  salesman's region comes from the Meta-Data sheet (ADR-0005). *(Clarified 2026-11-04: table
  renamed from "Reps" after the owner interview; the decision is unchanged.)*
- **Every** server call re-checks the token and works out the salesman on the server. The browser
  never sends "I am rep X" and the server never trusts it if it does.
- The server only ever returns that salesman's own data.
- The owner can **revoke** a link (mark inactive) and **issue a new one** at any time, e.g. lost
  phone or salesman leaves.
- Tokens are secrets: never committed to git, never written to logs, never shown in the activity log.

## Options considered
- **Readable ID in the URL** (`?rep=lhr1`): simplest, but guessable. Rejected.
- **Google sign-in**: proper security, but salesmen need Google accounts and to log in. Rejected for now.
- **PIN on top of the link**: stronger, but adds friction. Could be added later if a link leaks.

## Consequences
- Anyone who gets a salesman's link (forwarded on WhatsApp, screenshot) can act as him until it's
  revoked. Accepted risk for a small team; the owner should know this (open question 13).
- Setup needs a small owner-only step to generate and send links.

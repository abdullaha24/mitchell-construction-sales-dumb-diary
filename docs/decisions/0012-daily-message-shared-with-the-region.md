# 0012: The daily region message shows a salesman's site names and wins to his region

- **Status:** Proposed (accepted with spec 012's approval)
- **Date:** 2026-11-12
- **Deciders:** owner (S12-2) / agent

## Context
ADR-0004: each salesman sees only his own sites, so salesmen don't see each other's parties,
rates and notes. Spec 012 gives the admin a daily message per region that he pastes into that
region's WhatsApp group, so the salesmen of a region will read each other's day. The app still sends
this text **only to the admin** (it is an `adminPage…` function); he decides to post it. But posting
it is the whole point, so what it may hold is decided here.

## Decision
The daily region message may show, for each salesman of **that region only**: his code, how many
sites he worked, and the **names** of the sites he added, gave a sample, quoted, won, lost or
followed up that day, with **Rs. on wins only** and the reason on losses. It never shows quote Rs.,
Cash / Credit, notes, contact names or numbers, areas, another region's salesmen, or the admin's own
changes. ADR-0004 is unchanged for the app: a salesman's page still receives only his own data.

## Options considered
- **Names, Rs. on wins only** *(agent's recommendation, chosen)*: specific enough that the team sees
  every entry is read; peers don't learn each other's prices.
- **Everything** (quote Rs., Cash / Credit, notes): most open; peers see each other's prices and
  notes.
- **Names, no Rs.**: no amounts at all, wins included.
- **Counts only**: keeps ADR-0004 fully, but a weak "we read it" signal.

## Consequences
- Salesmen of a region learn which parties their colleagues work with. Two salesmen chasing the
  same party may now notice it; prices stay private.
- A test pins what the text may never hold (quote Rs., notes, contacts, other regions).
- Widening the message later (e.g. quote Rs.) needs a new ADR.

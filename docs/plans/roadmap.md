# Roadmap

> Status: **Draft**, agent-proposed order. The owner will confirm and reorder. Each phase gets a
> spec in `docs/specs/` before building.

Guiding idea: put something useful in a salesman's hands early, then grow it.

| Phase | Goal | Done when |
| --- | --- | --- |
| **0. Repo shell** | Structure, agent instructions, vision captured | ✅ This commit |
| **1. Foundations** | Decide tooling (ADR-0003), set up clasp + local tests, create the Sheet tabs from the data model | An empty app deploys and opens from a test link |
| **2. Private links** | Owner can create, send and revoke per-salesman links (ADR-0002) | Opening a link shows "Hello, Tariq"; a revoked or fake link shows nothing |
| **3. My sites + add site** | Salesman sees his list and adds a new site in a few taps | New site appears in the list and in the `Sites` tab |
| **4. Update a site** | Stage buttons, value/reason popups, follow-up buttons, quick note | Each update changes `Sites` and appends to `Activity` |
| **5. Focus tabs** | Today's Chase, Hot Pipeline, All My Parties with search | A salesman's morning list is correct for overdue/today items |
| **6. Site card helpers** | Call / WhatsApp buttons, last-spoken line, going-cold colour, snooze | One tap opens WhatsApp chat with the contact |
| **7. Area filter** | Filter by area for route planning | Tapping "DHA" shows only DHA sites |
| **8. Pilot** | 1–2 salesmen use it for real for a week; fix what annoys them | Owner decides to roll out to all 7 |
| **Later** | Owner view, dealers/recurring orders, payment recovery (ugrahi), targets | Depends on open questions |

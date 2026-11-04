# Roadmap

> Status: **Draft v0.2** (2026-11-04), updated after the owner interview. Each phase gets a spec
> in `docs/specs/` before building. Launch is **all 8 salesmen at once** with an empty app (Q14,
> Q15), so phases 1–7 together are the first release and must be solid before launch.

| Phase | Goal | Done when |
| --- | --- | --- |
| **0. Repo shell** | Structure, agent instructions, vision captured, owner interview | ✅ Done |
| **1. Foundations** | clasp + local tests (ADR-0003). Create the Sales Diary sheet and tabs. Read salesmen and targets from Meta-Data (ADR-0005) | An empty app deploys; tests read a sample of Meta-Data correctly, including stray cells and comma amounts |
| **2. Private links** | Owner creates, sends and cancels links (ADR-0002). Decide owner access (open question 7) | A link shows "Hello, RIA"; a cancelled or fake link shows nothing |
| **3. My sites + add site** | Salesman sees his own list and adds a site: buyer type, contact, product categories, area (pick or add), duplicate warning (ADR-0004) | New site appears in his list and in `Sites`; salesman B can't see it; duplicate phone shows the warning |
| **4. Update a site** | Stage buttons, Rs. value + Cash/Credit, lost reason (+ Other), follow-up buttons + Pick date, quick note | Each update changes `Sites` and appends to `Activity` |
| **5. Focus tabs + target** | Today's Chase, Hot Pipeline, All My Parties with search; his monthly target shown | His morning list is correct for overdue and today; target matches `Rep-Targets` |
| **6. Site card helpers + areas** | Call / WhatsApp buttons, last-spoken line, going cold at 7 days, snooze, area filter | One tap opens WhatsApp with the contact; tapping "DHA" shows only his DHA sites |
| **7. Owner screen** | Pipeline by salesman/region, who worked today, overdue + going cold, won/lost + lost reasons | Owner sees correct numbers for all 8 salesmen |
| **8. Launch** | Links sent to all 8; short how-to for salesmen; watch the first week closely | All 8 have logged at least one site |
| **Later** | Dealer repeat orders · payment recovery (ugrahi) · achieved vs target for salesmen · Urdu labels | Owner decides order |

**Owner to-dos before launch:** product categories, area list per region, SJ/SM targets
(MUB's split 50/50), IB target, remove MUB from `Rep_Mapping`. See
[open questions](../product/open-questions.md).

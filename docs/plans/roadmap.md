# Roadmap

> Status: **Draft v0.3** (2026-11-04), updated after the owner interview and session 2 answers. Each phase gets a spec
> in `docs/specs/` before building. Launch is **all 7 salesmen at once** with an empty app (Q14,
> Q15), so phases 1–7 together are the first release and must be solid before launch.

| Phase | Goal | Done when |
| --- | --- | --- |
| **0. Repo shell** | Structure, agent instructions, vision captured, owner interview | ✅ Done (2026-11-04) |
| **1. Foundations** | clasp + local tests (ADR-0003). Create the Sales Diary sheet and tabs. Read salesmen and targets from Meta-Data (ADR-0005). Seed `Lists` with the 11 product categories. Owner's **Check setup** menu ([spec 001](../specs/001-foundations.md)) | ✅ Done (2026-11-04): live in the owner's account; Check setup shows the 7 salesmen and this month's targets correctly |
| **2. Private links** | Create the `Links` tab. Owner creates, sends and cancels links (ADR-0002), including his own owner link (ADR-0006). Web app opened to `ANYONE_ANONYMOUS` | ✅ Done (2026-11-04): owner makes links in Sales Diary → Links; a link shows "Hello, RIA"; a fake one shows "This link doesn't work" |
| **3. My sites + add site** | Salesman sees his own list and adds a site: buyer type, contact, product categories, area (pick or add, with "Did you mean …?" suggestions), duplicate warning (ADR-0004) | ✅ Done (2026-11-04): salesmen see only their own sites and add sites by tapping; the duplicate warning shows only "someone in the team" |
| **4. Update a site** | Stage buttons, Rs. value + Cash/Credit, lost reason (+ Other), follow-up buttons + Pick date, quick note | ✅ Done (2026-11-04): stage, total Rs. value + Cash / Credit, lost reason, follow-up, note, Edit details; every save in `Activity` |
| **4b. Faster + stage when adding** | From the owner's phase 4 test: saves feel instant (sent in the background), server does about half the work, stage chosen in + New Site ([spec 005](../specs/005-faster-saves.md)) | ✅ Done (2026-11-04): saves feel instant (owner: "a lot faster"); per save 4 sheet opens → 1; stage chosen in + New Site |
| **5. Focus tabs + target** | Today's Chase, Hot Pipeline, All My Parties with search; his monthly target shown ([spec 006](../specs/006-focus-tabs.md)) | ✅ Done (2026-11-04, version 7): Today's Chase correct for late and today; target matches `Rep-Targets`; search and Hot Pipeline checked live |
| **6. Site card helpers + areas** | Call / WhatsApp buttons, last-spoken line, going cold at 7 days, snooze, area filter ([spec 007](../specs/007-card-helpers-areas.md)) | ✅ Done (2026-11-04, version 9): Call and WhatsApp open on the owner's phone; the area filter shows only his sites in that area |
| **7. Owner screen** | Pipeline by salesman/region with targets next to Won Rs. ("logged, not invoiced") and the house / office sales target, who worked today, overdue + going cold, won/lost + lost reasons; the owner can Update sites ([spec 008](../specs/008-owner-screen.md); shown to people as **Admin**) | ✅ Done (2026-11-04, version 10): the admin (owner) screen is live on his link; numbers checked against Meta-Data; admin updates show as "Admin: …" |
| **7b. Summaries** | One-tap weekly (Saturday to Friday) and monthly summaries for the Friday meeting and the monthly review; share on WhatsApp; the admin gets team, region and side-by-side views ([spec 009](../specs/009-summaries.md), Approved; building) | Salesmen and admin share a summary from their phones; numbers match the sheet |
| **7c. Speed pass** | Salesman's page opens back at ≤ ~3.9 s warm on a phone (spec 010, to write) | Measured, and the served page size pinned by a check |
| **8. Launch** | Links sent to all 7; short how-to for salesmen; watch the first week closely | All 7 have logged at least one site |
| **Later** | Dealer repeat orders · payment recovery (ugrahi) · achieved vs target for salesmen · Urdu labels | Owner decides order |

**Owner to-dos before launch:** none left. Categories, targets and the salesmen list were
settled in session 2 (2026-11-04); see [open questions](../product/open-questions.md).

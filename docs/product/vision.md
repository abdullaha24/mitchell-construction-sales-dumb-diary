# Vision

> Status: **Draft v0.1** (2026-11-04). Captured from the owner's first brainstorm.
> Rough plan; it will be refined before building. Items marked *(idea)* came up while
> brainstorming and are **not confirmed** yet. Confirm with the owner before building them.

## The problem

A small Pakistani construction-chemicals company has 7 field salesmen:

| City | Salesmen |
| --- | --- |
| Islamabad | 3 |
| Lahore | 3 |
| Karachi | 1 |

Today all sales updates are **verbal**. Nothing is written down anywhere:

- what each salesman is working on
- which projects are in the pipeline
- what has been quoted, to whom, at what rate
- what has been won, what was lost, and why
- what new leads are coming in

The owner wants all of this captured in writing.

## The users

- **Salesmen (primary users).** Not tech-savvy. They have smartphones and are comfortable with
  WhatsApp and ordinary apps. Spreadsheets on a phone are too cumbersome for them.
- **Owner (secondary user).** Wants to see the whole company's pipeline and activity without
  chasing people on WhatsApp.

## The big idea

**This is a productivity tool for the salesman first, and a reporting tool for the owner second.**

If the app only serves the boss, salesmen will treat it as a chore and stop using it. It must
answer the salesman's own questions the moment he opens it:

1. Who did I promise to call today?
2. Which of my quotes are close to turning into orders?
3. What rate did I quote this guy last month?

Think of it as a **digital pocket diary** that also happens to write the owner's report.

## Shape of the solution (as currently imagined)

- **Backend:** Google Sheets (the owner can open and read it directly).
- **Frontend:** a Google Apps Script web app, opened on the phone like a website.
- **No logins:** each salesman gets a **unique personal link**, set up once by the owner. He
  doesn't need a Google account. The link tells the app who he is.
  See [ADR-0002](../decisions/0002-per-salesman-private-links.md); the link must be hard to guess.
- **Stupidly simple:** big tap buttons, pick-lists, minimal typing, no jargon.

## What the salesman can do

### 1. Home screen: three tabs *(idea)*

- **Today's Chase** (default): every site whose follow-up date is today or overdue. The
  oldest overdue ones sit at the top in red. This is his morning call list.
- **Hot Pipeline**: only sites at *Sample / Trial* or *Rate Quoted*. His near-term orders.
- **All My Parties**: everyone he deals with, with a fast search box. Use it to look someone up
  in two seconds before walking into a meeting.

### 2. Site card: a cheat sheet *(idea)*

Each site shows as a card with:

- **Last spoken line:** the last note and rate, e.g. *"22 Oct: Quoted WP-100 @ Rs. 1,450,
  waiting for consultant"*, so he never forgets what he committed.
- **One-tap Call and WhatsApp buttons** for the site's contact.
- **Going-cold warning:** a card turns yellow if a sample or quote hasn't been updated in
  7 days, even if he forgot to set a follow-up.
- **One-tap snooze:** "+2 days" / "+1 week" after a quick call, without opening a full edit screen.

### 3. Add a new site (entered once)

Their link opens their list of sites with a big **"+ New Site"** button. They pick existing
sites instead of re-typing them, so "DHA Plaza" on Monday doesn't become "DHA Site" on Thursday.

Bare-minimum fields *(idea)*:

- **Site / party name:** how they naturally refer to it (e.g. "F-11 Commercial Tower").
- **Buyer type:** tap one: Contractor / Applicator, Project Owner, Consultant, Dealer.
- **Contact name and WhatsApp number:** site engineer, thekedar or procurement person.
  The company owns this contact, not the salesman's phone.
- **Products pitched:** tap pills, e.g. Tile Bond, Admixtures, Waterproofing, Epoxy, Grout / Putty.
  (Real product list to come from the owner.)
- **Area / zone:** e.g. DHA, Bahria, Gulberg, SITE. Used for route planning.

### 4. Update a site after a visit (about 2 taps)

- **Stage:** tap one of five:
  1. Visited / Lead
  2. Sample / Trial
  3. Rate Quoted
  4. Won (Order)
  5. Lost / Dead
- **Extra details for some stages** *(idea)*:
  - *Rate Quoted* or *Won*: one number box (value in Rs., or volume in bags/drums) plus a
    Cash / Credit toggle.
  - *Lost*: a required reason, picked from: Price Too High, Credit Terms, Competitor Approved,
    Site Delayed.
- **Next follow-up:** tap 2 Days / Next Week / 15 Days.
- **Quick note (optional):** one line. They can use the phone keyboard's microphone to dictate
  in Urdu or English.

### 5. Route planning by area *(idea)*

When a salesman is already in, say, DHA Lahore, he taps the **DHA** filter and sees other
parties in the same area he could drop in on during the same trip. Saves fuel and time.

## Captured automatically (zero typing)

- **Who and which city:** from his personal link.
- **Date and time** of every new site and every update.
- **Full history:** every tap that changes something is logged.

## What the owner gets

In the Google Sheet *(idea, see [data model](../architecture/data-model.md))*:

- **Master pipeline:** one row per site with current stage, latest quote, next follow-up.
- **Activity log:** one row per update, so he can see who actually worked today.

## Not decided yet

See [open questions](open-questions.md), especially:

- Do salesmen mostly chase one-off construction sites, or also recurring orders from fixed dealers?
- Do we track payment recovery (ugrahi) too, e.g. a "Payment Pending" flag on cards?

## Out of scope (for now)

- Logins, passwords, Google accounts for salesmen.
- Anything that needs a paid server or paid software.
- Complex reports or dashboards. The Sheet itself is the owner's view to start with.

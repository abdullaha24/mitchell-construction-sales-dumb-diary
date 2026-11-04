# Vision

> Status: **v0.3** (2026-11-04). Started from the owner's brainstorm, then refined in an owner
> interview the same day and a second round of owner answers (session 2). Every interview answer is logged in
> [open questions → Answered](open-questions.md#answered). Screen details are still refined in
> each feature's spec before building.

## The problem

A small Pakistani construction-chemicals company has **7 field salesmen** in three regions.
A region can cover more than one city.

| Region | Salesmen (short code) |
| --- | --- |
| North (Islamabad and around) | RIA, AUR, WAK |
| Center (Lahore and around) | SH, SJ, SM |
| South (Karachi and around) | IB |

MUB and UAK have left. SJ and SM took over MUB's targets; IB took over UAK's.

The owner keeps the salesmen list and monthly targets in the Google Sheet
**"Mitchell Sales Meta-Data"** (see [data model](../architecture/data-model.md)).

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
- **Owner.** Wants the whole company's pipeline and activity at a glance without chasing people
  on WhatsApp. Gets **his own screen in the app from day one**.

## The big idea

**This is a productivity tool for the salesman first, and a reporting tool for the owner second.**

If the app only serves the boss, salesmen will treat it as a chore and stop using it. It must
answer the salesman's own questions the moment he opens it:

1. Who did I promise to call today?
2. Which of my quotes are close to turning into orders?
3. What rate did I quote this guy last month?

Think of it as a **digital pocket diary** that also happens to write the owner's report.

## Shape of the solution

- **Backend:** Google Sheets ([ADR-0001](../decisions/0001-google-sheets-and-apps-script.md)).
  App data lives in a new **"Sales Diary"** sheet. Salesmen and targets are read from the owner's
  existing Meta-Data sheet ([ADR-0005](../decisions/0005-app-data-sheet-and-meta-data-sheet.md)).
- **Frontend:** a Google Apps Script web app, opened on the phone like a website.
- **No logins:** each salesman gets a private link with a long random code that the owner can
  cancel and reissue ([ADR-0002](../decisions/0002-per-salesman-private-links.md)).
- **Private lists, no territories:** each salesman sees **only his own** sites and activity.
  Anyone can work any area: RIA, AUR and WAK can all chase sites in DHA without seeing each
  other's lists ([ADR-0004](../decisions/0004-private-lists-no-territories.md)).
- **Stupidly simple:** big tap buttons, pick-lists, minimal typing, **simple English** labels.
  Notes can be in any language.

## What the salesman can do

### 1. Home screen: three tabs

- **Today's Chase** (default): every site whose follow-up date is today or overdue. The
  oldest overdue ones sit at the top in red. This is his morning call list.
- **Hot Pipeline**: only sites at *Sample / Trial* or *Rate Quoted*. His near-term orders.
- **All My Parties**: everything he owns, with a fast search box. Use it to look someone up in
  two seconds before walking into a meeting.

He also sees **his monthly target** (read from the Meta-Data sheet). Only the target: no
"achieved" figure for now.

### 2. Site card: a cheat sheet

Each site shows as a card with:

- **Last spoken line:** the last note and rate, e.g. *"22 Oct: Quoted WP-100 @ Rs. 1,450,
  waiting for consultant"*.
- **One-tap Call and WhatsApp buttons** for the site's contact.
- **Going cold:** the card turns yellow if a *Sample / Trial* or *Rate Quoted* site hasn't been
  updated for **7 days**.
- **One-tap snooze** to push the follow-up without opening the full edit screen.

### 3. Add a new site (entered once)

His list has a big **"+ New Site"** button. He picks existing sites instead of re-typing them.

- **Site / party name:** how he naturally refers to it (e.g. "F-11 Commercial Tower").
- **Buyer type:** tap one: Contractor / Applicator, Project Owner, Consultant, Dealer.
- **Contact name and phone (WhatsApp):** site engineer, thekedar or procurement person.
  The company owns this contact, not the salesman's phone.
- **Products pitched:** tap **category** pills (11 categories from the owner, biggest sellers
  first; see the [glossary](glossary.md#products)). Exact product and rate go in the note.
- **Area:** tap an area already used in his region. If it's missing, he adds it. There is no
  starting list: salesmen build it as they go. While he types a new area, the app suggests close
  existing ones (*"Did you mean DHA?"*) so the list doesn't fill with duplicates.
- **Duplicate warning:** if the contact's phone number is already with another salesman, he sees
  *"Someone in the team already works with this contact."* No name, rate or details are shown.
  He can still save.

### 4. Update a site after a visit (about 2 taps)

- **Stage:** tap one of five: Visited / Lead · Sample / Trial · Rate Quoted · Won (Order) · Lost / Dead.
- **Extra details for some stages:**
  - *Rate Quoted* or *Won*: one **Rs. value** box plus a **Cash / Credit** tap.
  - *Lost*: a required reason: Price Too High, Credit Terms, Competitor Approved, Site Delayed,
    or **Other** (with a short note).
- **Next follow-up:** tap **Tomorrow / 3 days / 1 week**, or **Pick date** for promises like
  "call me on the 15th" or "after Eid".
- **Quick note (optional):** one line. He can dictate with the phone keyboard's microphone.

### 5. Route planning by area

When a salesman is already in, say, DHA, he taps the **DHA** filter and sees his other parties
there that he could visit on the same trip.

## Captured automatically (zero typing)

- **Who and which region:** from his private link.
- **Date and time** of every new site and every update.
- **Full history:** every change is logged.

## What the owner gets

**His own screen, from day one**, showing:

1. **Pipeline by salesman and region:** how many sites and how many Rs. at each stage, with
   tap-through to the sites. Each salesman's **monthly target** sits next to the Rs. he logged as
   Won, labelled *"logged, not invoiced"*. The **house / office sales** target (the `UNASSIGNED`
   region in Meta-Data) is shown here too.
2. **Who worked today:** a feed of today's updates, plus who logged nothing.
3. **Overdue and going cold** across the whole team.
4. **Won / lost:** this month's wins in Rs., and lost reasons (e.g. "6 lost on price").

He opens it with his own **private owner link**, the same kind as the salesmen's
([ADR-0006](../decisions/0006-owner-private-link.md)). He can also open the Sales Diary sheet
directly at any time, and that is where he moves a departed salesman's sites to someone else and
tidies duplicate areas.

## Rollout

- **All 7 salesmen start on the same day.** No pilot group.
- **Start empty:** no data import. Salesmen add sites as they visit and call.

## Later (agreed, not in the first version)

- **Dealers with repeat orders.** Dealers can be saved as a party from day one; proper
  repeat-order tracking comes later.
- **Payment recovery (ugrahi).** The Cash / Credit tap collected now will feed this later.
- Salesman seeing "achieved vs target".
- Urdu labels.

## Out of scope

- Logins, passwords, Google accounts for salesmen.
- Anything that needs a paid server or paid software.
- Territories or area restrictions.

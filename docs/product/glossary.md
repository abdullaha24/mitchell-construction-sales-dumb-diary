# Glossary

The words the business uses. **Use these words in code, the UI and docs.** Don't invent synonyms.
Owner: correct anything wrong here; agents should treat this file as the authority.

## People

| Term | Meaning |
| --- | --- |
| **Salesman / rep** | One of the 7 field salesmen, identified by his short code from the Meta-Data sheet: RIA, AUR, WAK (North), SH, SJ, SM (Center), IB (South). In code: `rep`. (MUB and UAK have left.) |
| **Region** | North / Center / South. A region can cover more than one city (North ≈ Islamabad and around, Center ≈ Lahore, South ≈ Karachi). Used for targets, area lists and owner reports. |
| **Admin / Administrator** | The company owner as the app shows him (owner, P7-7). **Use this word on every screen and message**, never "owner". Sees everything on the **admin screen**, opened with his private admin link, and can update any site there; his changes are marked `admin` in the history. |
| **Owner** | The company owner. A **docs-only** word for the Admin (same person); not used on screens. |
| **Party** | Anyone a salesman sells to: a contractor, a builder, a dealer, a project owner. |
| **Contact** | The actual person to call at a party or site: site engineer, thekedar, procurement officer. A site has one **main contact** (on its card, Call, WhatsApp). |
| **Earlier contacts** | The people who were a site's main contact before, newest first, each with the day they stopped being main (*"till 11 Nov"*), still callable from the site screen (spec 011). At most 20 per site. |
| **+ New contact person** | The button in the Update form for when a salesman is handed to a new person: the new one becomes the main contact and the old one moves to Earlier contacts. **Make main** on an earlier contact does the same the other way round. |
| **Thekedar** | Urdu: contractor or labour contractor on a site. Often the real decision-maker on materials. |
| **Applicator** | A contractor who applies the product (e.g. a waterproofing applicator). |
| **Consultant** | Engineer or architect firm that approves which materials a project may use. |
| **Dealer** | Hardware or chemical shop that buys to resell. Can be saved as a party now; repeat-order tracking is a later phase. |

## Things

| Term | Meaning |
| --- | --- |
| **Site** | A construction project or job the salesman is chasing, e.g. "F-11 Commercial Tower". The main record in the app. One site has one current stage. |
| **Buyer type** | What kind of party the site's buyer is: Contractor / Applicator, Project Owner, Consultant, Dealer. |
| **Area** | Rough neighbourhood or sector, e.g. DHA, Bahria, Gulberg, F-11, SITE. No starting list: salesmen add areas as they go, and pick from the areas already used in their region. The app suggests close matches to avoid duplicates. Route planning only, **not** a territory. |
| **Update / activity** | One logged action on a site: a stage change, note, snooze or follow-up change. |
| **Follow-up date** | When the salesman should next contact this site. Drives *Today's Chase*. |
| **Going cold** | A site at *Sample / Trial* or *Rate Quoted* with no update for **7 days**. Shown in yellow. Only a real Update resets it, not Snooze or Edit details (owner, P6-2). |
| **Snooze** | Push a due site's follow-up to Tomorrow, 3 days or 1 week from its card, without the Update screen (owner, P6-1). Kept in the history; not counted as work. |
| **Last-spoken line** | The last note on a site and the day it was written, on its card: *"22 Oct: Quoted WP-100 @ Rs. 1,450, waiting for consultant"*. |
| **Follow-up buttons** | Tomorrow · 3 days · 1 week · Pick date. |
| **Duplicate warning** | "Someone in the team already works with this contact." Shown when a contact's phone number is already with another salesman (as a main or an earlier contact). Reveals nothing else. |

## Sales stages

The five stages a site moves through. Shown as plain buttons.

| Stage (UI label) | Meaning |
| --- | --- |
| **Visited / Lead** | First contact made, or a site identified. |
| **Sample / Trial** | Material given for a site trial or for consultant approval. |
| **Rate Quoted** | Prices shared with the party. |
| **Won (Order)** | Order confirmed, ready for dispatch. |
| **Lost / Dead** | Deal fell through. Needs a reason. |

**Lost reasons:** Price Too High, Credit Terms, Competitor Approved, Site Delayed, Other (needs a short note).

**Rate Quoted / Won** ask for one Rs. value plus a Cash / Credit tap.

## Money and units

| Term | Meaning |
| --- | --- |
| **Rs. / PKR** | Pakistani rupees. All money is in PKR. |
| **Rate** | Price per unit quoted to a party, e.g. Rs. 1,450 per bag. |
| **Cash / Credit** | Whether the order is paid upfront or on credit terms. |
| **Bags / Drums** | Common units for construction chemicals. |
| **Ugrahi** | Urdu: payment recovery, collecting money owed for past orders. Salesmen spend a lot of time on this. **Later phase.** |
| **Target** | Monthly Rs. target per salesman (and per region), kept by the owner in the Meta-Data sheet. Salesmen see their own target only. The owner screen shows it next to Won Rs., labelled "logged, not invoiced". |
| **House / office sales** | Sales not tied to a salesman. Its target is the `UNASSIGNED` region in the Meta-Data `Targets` tab. Owner screen only. |

## Products

Salesmen pick product **categories**, not individual products. The owner's list (session 2),
in display order, biggest sellers first:

1. Tile Adhesives
2. Waterproofing Job
3. Floor Hardeners
4. Bonding Agents & Sealants
5. Waterproofing Products
6. Tile Grouts
7. Structural Grouts
8. Restoration & Repair Products
9. Admixtures
10. Surface Protection
11. Mortars, Plasters & Putties

Stored in the `Lists` tab so the owner can rename or reorder them. **Never hard-code them.**

## Sheets

| Term | Meaning |
| --- | --- |
| **Meta-Data sheet** | The owner's existing "Mitchell Sales Meta-Data" Google Sheet: salesmen, regions, targets. The app only reads it. |
| **Sales Diary sheet** | The app's own Google Sheet: sites, activity, links, pick-lists. |

## App screens

| Term | Meaning |
| --- | --- |
| **Today's Chase** | Default tab: follow-ups due today or overdue. |
| **Hot Pipeline** | Tab: sites at Sample / Trial or Rate Quoted. |
| **All My Parties** | Tab: everything the salesman owns, searchable. |
| **Admin screen** (docs: owner screen) | The admin's view (spec 008), four tabs: **Today** (who worked today), **Team** (each salesman and region against target), **Late & cold**, **This month** (won / lost and lost reasons). He can Update any site from it. |
| **Admin link** (docs: owner link) | The admin's private link to his screen. Same kind of secret link as a salesman's (ADR-0006, ADR-0010). |
| **Site card** | One site in a list: name, last note, call and WhatsApp buttons, snooze. |
| **Summary** | A salesman's (or the team's) week or month in plain words, for the Friday meeting and the monthly review (spec 009). Opened with the **Summary** button; **This week · Last week · This month · Last month**; shared on WhatsApp. A **week** runs **Saturday to Friday** (owner S9-4). |

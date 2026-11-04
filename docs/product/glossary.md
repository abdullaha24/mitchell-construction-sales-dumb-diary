# Glossary

The words the business uses. **Use these words in code, the UI and docs.** Don't invent synonyms.
Owner: correct anything wrong here; agents should treat this file as the authority.

## People

| Term | Meaning |
| --- | --- |
| **Salesman / rep** | One of the 8 field salesmen, identified by his short code from the Meta-Data sheet: RIA, AUR, WAK (North), SH, SJ, SM (Center), UAK, IB (South). In code: `rep`. |
| **Region** | North / Center / South. A region can cover more than one city (North ≈ Islamabad and around, Center ≈ Lahore, South ≈ Karachi). Used for targets, area lists and owner reports. |
| **Owner** | The company owner. Sees everything, on his own screen. |
| **Party** | Anyone a salesman sells to: a contractor, a builder, a dealer, a project owner. |
| **Contact** | The actual person to call at a party or site: site engineer, thekedar, procurement officer. |
| **Thekedar** | Urdu: contractor or labour contractor on a site. Often the real decision-maker on materials. |
| **Applicator** | A contractor who applies the product (e.g. a waterproofing applicator). |
| **Consultant** | Engineer or architect firm that approves which materials a project may use. |
| **Dealer** | Hardware or chemical shop that buys to resell. Can be saved as a party now; repeat-order tracking is a later phase. |

## Things

| Term | Meaning |
| --- | --- |
| **Site** | A construction project or job the salesman is chasing, e.g. "F-11 Commercial Tower". The main record in the app. One site has one current stage. |
| **Buyer type** | What kind of party the site's buyer is: Contractor / Applicator, Project Owner, Consultant, Dealer. |
| **Area** | Rough neighbourhood or sector, e.g. DHA, Bahria, Gulberg, F-11, SITE. Picked from the owner's list for the region; a salesman can add a missing one. Route planning only, **not** a territory. |
| **Update / activity** | One logged action on a site: a stage change, note, snooze or follow-up change. |
| **Follow-up date** | When the salesman should next contact this site. Drives *Today's Chase*. |
| **Going cold** | A site at *Sample / Trial* or *Rate Quoted* with no update for **7 days**. Shown in yellow. |
| **Follow-up buttons** | Tomorrow · 3 days · 1 week · Pick date. |
| **Duplicate warning** | "Someone in the team already works with this contact." Shown when a contact's phone number is already with another salesman. Reveals nothing else. |

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
| **Target** | Monthly Rs. target per salesman (and per region), kept by the owner in the Meta-Data sheet. Salesmen see their own target only. |

## Products

Salesmen pick product **categories** (5–8), not individual products. Draft examples from the
brainstorm: Tile Bond, Admixtures, Waterproofing, Epoxy, Grout / Putty.
**The owner will supply the real category list** (stored in the `Lists` tab). Never hard-code them.

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
| **Owner screen** | The owner's view: pipeline by salesman/region, who worked today, overdue + going cold, won/lost + lost reasons. |
| **Site card** | One site in a list: name, last note, call and WhatsApp buttons, snooze. |

# Glossary

The words the business uses. **Use these words in code, the UI and docs.** Don't invent synonyms.
Owner: correct anything wrong here; agents should treat this file as the authority.

## People

| Term | Meaning |
| --- | --- |
| **Salesman / rep** | One of the 7 field salesmen. In code: `rep`. In the UI: never shown as a label; the app just knows it's him. |
| **Owner** | The company owner. Sees everything. |
| **Party** | Anyone a salesman sells to: a contractor, a builder, a dealer, a project owner. |
| **Contact** | The actual person to call at a party or site: site engineer, thekedar, procurement officer. |
| **Thekedar** | Urdu: contractor or labour contractor on a site. Often the real decision-maker on materials. |
| **Applicator** | A contractor who applies the product (e.g. a waterproofing applicator). |
| **Consultant** | Engineer or architect firm that approves which materials a project may use. |
| **Dealer** | Hardware or chemical shop that buys to resell. May give recurring orders (see open questions). |

## Things

| Term | Meaning |
| --- | --- |
| **Site** | A construction project or job the salesman is chasing, e.g. "F-11 Commercial Tower". The main record in the app. One site has one current stage. |
| **Buyer type** | What kind of party the site's buyer is: Contractor / Applicator, Project Owner, Consultant, Dealer. |
| **Area / zone** | Rough neighbourhood or sector, e.g. DHA, Bahria, Gulberg, F-11, SITE. Used for route planning. |
| **Update / activity** | One logged action on a site: a stage change, note, snooze or follow-up change. |
| **Follow-up date** | When the salesman should next contact this site. Drives *Today's Chase*. |
| **Going cold** | A site at *Sample / Trial* or *Rate Quoted* with no update for 7 days *(threshold not confirmed)*. Shown in yellow. |

## Sales stages

The five stages a site moves through. Shown as plain buttons.

| Stage (UI label) | Meaning |
| --- | --- |
| **Visited / Lead** | First contact made, or a site identified. |
| **Sample / Trial** | Material given for a site trial or for consultant approval. |
| **Rate Quoted** | Prices shared with the party. |
| **Won (Order)** | Order confirmed, ready for dispatch. |
| **Lost / Dead** | Deal fell through. Needs a reason. |

**Lost reasons** *(draft list)*: Price Too High, Credit Terms, Competitor Approved, Site Delayed.

## Money and units

| Term | Meaning |
| --- | --- |
| **Rs. / PKR** | Pakistani rupees. All money is in PKR. |
| **Rate** | Price per unit quoted to a party, e.g. Rs. 1,450 per bag. |
| **Cash / Credit** | Whether the order is paid upfront or on credit terms. |
| **Bags / Drums** | Common units for construction chemicals. |
| **Ugrahi** | Urdu: payment recovery, collecting money owed for past orders. Salesmen spend a lot of time on this. Not yet in scope (see open questions). |

## Products *(placeholder)*

Draft categories from the brainstorm: Tile Bond, Admixtures, Waterproofing, Epoxy, Grout / Putty.
**The owner will supply the real product list.** Don't hard-code these as final.

## App screens *(draft names)*

| Term | Meaning |
| --- | --- |
| **Today's Chase** | Default tab: follow-ups due today or overdue. |
| **Hot Pipeline** | Tab: sites at Sample / Trial or Rate Quoted. |
| **All My Parties** | Tab: everything the salesman owns, searchable. |
| **Site card** | One site in a list: name, last note, call and WhatsApp buttons, snooze. |

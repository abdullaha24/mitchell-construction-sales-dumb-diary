# Open questions

Things the owner needs to decide. Agents: **add questions here instead of guessing**, and move
answered ones to the bottom with the answer and date. If an answer changes a spec, ADR or the data
model, update those too.

## Open

### Business scope
1. **Sites vs dealers.** Do salesmen mostly chase one-off construction sites, or also manage
   recurring orders from fixed hardware/chemical dealers? (A dealer isn't a "site" that gets won once.)
2. **Payment recovery (ugrahi).** Track who owes money? E.g. a "Payment Pending" flag on cards,
   or a separate recovery list.
3. **Product list.** What's the real product or category list for the "products pitched" pills?
4. **Areas / zones.** Fixed list per city that the owner sets up, or free text that the salesman types?

### How the app behaves
5. **Going-cold threshold.** Is 7 days right for samples and quotes going cold?
6. **Follow-up buttons.** Are 2 Days / Next Week / 15 Days the right choices?
7. **Quote details.** Value in Rs., volume (bags/drums), or both? Is the Cash/Credit toggle needed?
8. **Lost reasons.** Is the list (Price Too High, Credit Terms, Competitor Approved, Site Delayed)
   complete? Add "Other"?
9. **Sharing sites.** Can two salesmen work the same site or party? What if a site moves to another salesman?
10. **Language.** English UI only, or Urdu labels too?

### Owner side
11. **Owner view.** Is reading the Google Sheet directly enough at first, or does the owner want
    his own screen in the app (e.g. all reps, filter by city)?
12. **Targets.** Should salesmen see monthly targets or their won totals?

### Setup and safety
13. **Lost or shared link.** If a salesman's phone is lost or he leaves, the owner must be able to
    cut off that link and issue a new one. Confirm this is acceptable as the only "security".
14. **Existing data.** Is there any current list of parties and contacts to import on day one?

## Answered

_None yet._

# Open questions

Things the owner needs to decide or supply. Agents: **add questions here instead of guessing**,
and move answered ones to *Answered* with the answer and date. If an answer changes a spec, ADR or
the data model, update those too.

## Open

### Owner to supply
1. **Product categories.** The 5–8 category names for the "products pitched" pills.
2. **Area list per region.** Starting list of areas for North, Center and South. Because regions
   cover more than one city, consider names like "Rawalpindi: Saddar" where it helps.
3. **Targets for SJ and SM.** The owner will add them to `Rep-Targets`, with MUB's targets split
   50/50 between them. (From which month?)
4. **Target for IB.** IB is in `Rep_Mapping` but has no rows in `Rep-Targets`. Until he has one,
   the app shows no target for him.

### To decide
5. **"UNASSIGNED" region** in the `Targets` tab. What is it (house accounts? office sales)? Does
   the app need to show it anywhere, e.g. on the owner screen?
6. **Owner screen and targets.** Should the owner screen show each salesman's target next to the
   Rs. value he logged as Won? (Salesmen see target only; Q12c.)
7. **Owner access.** How does the owner open his screen: his own private link (same mechanism as
   salesmen, with an owner role), or Google sign-in? Decide in the owner-screen spec.
8. **Salesman leaves.** When a salesman leaves (like MUB), the owner moves his sites to someone
   else. Confirm that's done by editing the Sales Diary sheet, or does it need a button?
9. **Owner merging areas.** When salesmen add areas that duplicate existing ones ("DHA" vs
   "D.H.A"), does the owner fix them in the sheet, or does he need a tool?

## Answered

Owner interview, 2026-11-04:

| # | Question | Answer |
| --- | --- | --- |
| Q1 | Sites or dealers? | **Both: sites now, dealers later.** v1 is built around sites. A dealer can be saved as a party, but repeat orders come later. |
| Q2 | Payment recovery (ugrahi)? | **Later phase.** |
| Q3 | Product detail? | **Category level.** Owner will supply the categories. |
| Q4 | Areas? | **Owner's list per region, and a salesman can add a new area.** |
| Q5 | Going-cold threshold? | **7 days** (Sample / Trial and Rate Quoted only). |
| Q6 | Follow-up buttons? | **Tomorrow / 3 days / 1 week / Pick date.** |
| Q7 | Quote details? | **Rs. value + Cash/Credit tap.** No volume. |
| Q8 | Lost reasons? | **Price Too High, Credit Terms, Competitor Approved, Site Delayed, Other (with note).** |
| Q9 | Shared sites? | **No territories:** several salesmen can work the same area. But **each salesman sees only his own sites and activity** (ADR-0004). |
| Q9d | Two salesmen, same contact? | **Warn the salesman** ("Someone in the team already works with this contact"), with no name or details shown. He can still save. |
| Q10 | Language? | **Simple English** labels. Notes in any language. |
| Q11 | Owner view? | **Owner screen from day one**, with all four sections: pipeline by salesman/region, who worked today, overdue + going cold, won/lost + lost reasons. |
| Q12 | Targets? | Monthly targets already live in the **"Mitchell Sales Meta-Data"** sheet. |
| Q12a | Who gets the app? | **All 8:** RIA, AUR, WAK, SH, SJ, SM, UAK, IB. **MUB has left.** |
| Q12b | Regions = cities? | **No, regions cover more than one city.** The app uses region (North / Center / South). |
| Q12c | What does a salesman see of his target? | **Target only**, no achieved figure. |
| Q13 | Where does app data live? | **New "Sales Diary" sheet.** App reads salesmen and targets from Meta-Data (ADR-0005). |
| Q14 | Day-one data? | **Start empty**; salesmen add sites as they go. |
| Q15 | Rollout? | **All 8 at once.** |
| (ADR-0002) | Link security | **Approved:** long random codes, owner can cancel and reissue. |
| (ADR-0003) | Code tooling | **Approved:** clasp, plain JS with type checks, local tests. |

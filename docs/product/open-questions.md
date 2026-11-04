# Open questions

Things the owner needs to decide or supply. Agents: **add questions here instead of guessing**,
and move answered ones to *Answered* with the answer and date. If an answer changes a spec, ADR or
the data model, update those too. The ready-to-ask versions (options and recommendations) are in
[`docs/plans/handoff.md`](../plans/handoff.md); keep both in sync.

## Open

_None right now._ Add new questions here as they come up.

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
| Q12a | Who gets the app? | **All 8:** RIA, AUR, WAK, SH, SJ, SM, UAK, IB. **MUB has left.** *(Updated in session 2: UAK left too, so 7. See A3b.)* |
| Q12b | Regions = cities? | **No, regions cover more than one city.** The app uses region (North / Center / South). |
| Q12c | What does a salesman see of his target? | **Target only**, no achieved figure. |
| Q13 | Where does app data live? | **New "Sales Diary" sheet.** App reads salesmen and targets from Meta-Data (ADR-0005). |
| Q14 | Day-one data? | **Start empty**; salesmen add sites as they go. |
| Q15 | Rollout? | **All at once** (now 7 salesmen, see A3b). |
| (ADR-0002) | Link security | **Approved:** long random codes, owner can cancel and reissue. |
| (ADR-0003) | Code tooling | **Approved:** clasp, plain JS with type checks, local tests. |

Owner, session 2 (2026-11-04):

| # | Question | Answer |
| --- | --- | --- |
| A1 | Product categories? | **11 categories**, from the owner's sales list. Shown in this order (largest sales first): Tile Adhesives · Waterproofing Job · Floor Hardeners · Bonding Agents & Sealants · Waterproofing Products · Tile Grouts · Structural Grouts · Restoration & Repair Products · Admixtures · Surface Protection · Mortars, Plasters & Putties. Stored in the `Lists` tab, so the owner can rename or reorder them. |
| A2 | Starting area list? | **None.** Salesmen add areas themselves as they go. |
| A3 | SJ / SM targets? | **MUB's targets split 50/50 between SJ and SM from Aug 2026.** MUB keeps Jul 2026 only. The agent made the edit in `Rep-Targets` with the owner's explicit OK. |
| A3b | UAK? | **UAK has left too.** All UAK target months (Jul 2026–Jun 2027) moved to IB; the agent made the edit with the owner's OK. The team is now **7 salesmen**: RIA, AUR, WAK (North), SH, SJ, SM (Center), IB (South). |
| A4 | IB's target? | **IB takes UAK's targets** (see A3b). |
| A5 | Remove MUB from `Rep_Mapping`? | **Yes, MUB and UAK both removed.** The agent deleted the two rows with the owner's OK. |
| A6 | "UNASSIGNED" region in `Targets`? | **House / office sales** (not tied to a salesman). Shown on the **owner screen only**, never to salesmen. |
| A7 | Owner screen: target next to Won Rs.? | **Yes**, labelled "logged, not invoiced". Salesmen still see only their target. |
| A8 | How does the owner open his screen? | **A private owner link**, the same kind as the salesmen's (ADR-0006). Owner accepted the risk that a leaked owner link exposes everything until he cancels it. |
| A9 | Salesman leaves? | **Owner edits `rep` in the Sales Diary `Sites` tab.** No button. |
| A10 | Duplicate areas ("DHA" vs "D.H.A")? | **The app suggests close existing areas while a salesman types a new one** ("Did you mean DHA?"). Anything that slips through, the owner tidies in the sheet. |
| S1-1 | Which Google account owns the app and Sales Diary sheet? (spec 001) | **The owner's own account**, the one that owns Meta-Data. |
| S1-2 | Where is clasp logged in? (spec 001) | **In the agent's cloud session, when needed**, with `clasp logout` at the end of each session. |
| S1-3 | One menu item or two? (spec 001 review) | **One: "Check setup"**: creates missing tabs, then shows salesmen, this month's targets and anything to fix. |
| S1-4 | Meta-Data ID: pasted by owner, or in the code? (spec 001 review) | **In the code** (ADR-0007, supersedes that bullet of ADR-0005). |
| S1-5 | Compare region totals with salesmen's targets? (spec 001 review) | **No.** |
| S1-6 | Rows in Rep-Targets for people who have left? (spec 001 review) | **Ignored silently.** A typo still shows, because that salesman then has "no target". |

Owner, session 3 (2026-11-04):

| # | Question | Answer |
| --- | --- | --- |
| S3-1 | Two docs (spec 001's example pop-up, one data-model line) quoted real November 2026 targets. Swap them for made-up amounts, or leave them? | **Swap for made-up amounts.** Done the same day, including the amount used as the parsing example (now `12,345,000`). Older versions in git history still hold them; no history rewrite unless the owner asks. |
| P2-1 | Spec 002: after making a salesman's link, can the owner see it again later? | **Always viewable** in the Links window and the `Links` tab, so he can resend it. He accepted that anyone who sees that tab can copy a working link. (Agent had recommended showing it once.) |
| P2-2 | Spec 002: where does the owner make and cancel links? | **In the Sales Diary sheet on a computer for now** (Sales Diary → Links); on his phone owner screen from phase 7. |
| P3-1 | Spec 003: must a new site have a contact phone? | **Optional, but salesmen must not keep numbers to themselves.** Leads and numbers belong in the system, so they stay when a salesman leaves and the company can still reach the account. |
| P3-2 | Spec 003: pick a follow-up date when adding a site? | **Yes, Tomorrow pre-picked** (3 days / 1 week / Pick date also offered). |
| P3-3 | Spec 003: Save with no signal? | **Keep what he typed on the phone; he taps Save again.** No automatic sending later. |
| P3-4 | Spec 003: how to stop number hoarding while the phone is optional? | **All three:** a second tap to save without a number; no Sample / Trial, Rate Quoted or Won without a number (phase 4); the owner sees how many sites each salesman has with no number. |
| P4-1 | Spec 004: what is the Rs. value at Rate Quoted / Won? | **The total quote / order value** in Rs. (so Won Rs. can be added up against targets). Per-bag rates go in the note. |
| P4-2 | Spec 004: is the Rs. value required? | **Yes, at both Rate Quoted and Won (Order)**, with a Cash / Credit tap. |
| P4-3 | Spec 004: follow-up date after Won or Lost? | **Neither:** Won and Lost sites have no follow-up and leave Today's Chase. |
| P4-4 | Spec 004: can a salesman move a site backwards or reopen Won / Lost? | **Yes, any stage.** Every change is kept in the history. |

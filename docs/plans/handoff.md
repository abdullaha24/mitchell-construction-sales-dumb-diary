# Handoff: start here

> Updated 2026-11-04 at the end of session 1. **Every session: read this first, and update it
> before you finish** (what's done, what's next, which questions are still open).

## Where we are
- **Phase 0 is done:** repo shell, agent rules, vision v0.2, glossary, data model v0.2,
  ADRs 0001–0005 (all Accepted), roadmap v0.2. The owner was interviewed; answers are in
  `docs/product/open-questions.md` → *Answered*.
- **No app code yet.**
- **Next:** write the **phase 1 spec** (`docs/specs/001-foundations.md`: clasp + local tests,
  create the Sales Diary sheet, read Meta-Data). Get owner approval before any code.

## First thing in the session: ask the owner these questions

Ask **before** starting other work. If the owner says skip, skip; move on and leave the question here.

**How to ask (owner's preference):**
- One question at a time.
- Tappable options. Use the multiple-choice question tool if you have one (Claude Code:
  `AskUserQuestion`); otherwise give numbered options.
- Put your recommended option first and mark it **(Recommended)**. For pure facts only the owner
  knows, say there's no recommendation.
- Plain English, no jargon.

After each answer: move it to `open-questions.md` → *Answered* (with date), update any affected
doc (vision, glossary, data model, ADR, roadmap), and delete it from this list.

### A. Owner to supply
1. **Product categories (5–8).** Options: type your list now · use the draft (Tile Bond,
   Admixtures, Waterproofing, Epoxy, Grout / Putty) for now · later.
2. **Starting area list per region** (North / Center / South; regions span several cities).
   Options: type them now · *(Recommended)* agent proposes a starter list per region, owner
   corrects it · skip, salesmen add areas themselves.
3. **SJ and SM targets** (MUB's targets split 50/50 between them). Ask: are they in
   `Rep-Targets` yet, and from which month does the split start? Options: done · not yet ·
   ask the agent to do it. **Editing Meta-Data needs the owner's explicit OK in that session**
   (ADR-0005: the app never writes to it).
4. **IB's target.** He's in `Rep_Mapping` with no target rows. Options: owner will add ·
   IB has no target (app shows none) · give the numbers now.
5. **Remove MUB from `Rep_Mapping`?** Options: done · not yet · ask the agent to do it
   (same explicit-OK rule).

### B. To decide
6. **What is the "UNASSIGNED" region** in the `Targets` tab? Options: house / office accounts,
   so show on the owner screen · ignore it in the app · other.
7. **Owner screen: show each salesman's target next to the Rs. he logged as Won?**
   *(Recommended: yes, labelled "logged, not invoiced")* · no, targets only · no targets on owner screen.
8. **How does the owner open his screen?** Options: *(Recommended)* sign in with his Google
   account (safer, since his screen shows everything; agent must confirm it works alongside
   salesmen's no-login links) · a private owner link like the salesmen's (simplest, but if it
   leaks everything is exposed).
9. **When a salesman leaves, how are his sites moved?** *(Recommended: owner edits `rep` in the
   Sales Diary sheet)* · a button on the owner screen.
10. **Duplicate areas added by salesmen ("DHA" vs "D.H.A")?** *(Recommended: owner tidies them
    in the sheet)* · a merge tool on the owner screen.

## Useful facts
- Meta-Data spreadsheet: "Mitchell Sales Meta-Data", ID `11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc`
  (in the owner's Google Drive). Structure documented in `docs/architecture/data-model.md`.
- Working branch so far: `claude/vigilant-volta-yye9pn` (no PR opened).

# Handoff: start here

> Updated 2026-11-04 at the end of session 2. **Every session: read this first, and update it
> before you finish** (what's done, what's next, which questions are still open).

## Where we are
- **Phase 0 is done.** Repo shell, agent rules, vision v0.3, glossary, data model v0.3,
  ADRs 0001–0006 (all Accepted), roadmap v0.3.
- **Session 2:** the owner answered all 10 open questions. Answers are in
  `docs/product/open-questions.md` → *Answered* (A1–A10). Headlines:
  - **UAK has left too.** The team is now **7 salesmen**: RIA, AUR, WAK (North), SH, SJ, SM
    (Center), IB (South).
  - **11 product categories**, biggest sellers first (glossary → Products).
  - **No starting area list.** Salesmen add areas; the app suggests close matches.
  - **Owner opens his screen with a private owner link** (ADR-0006).
  - The owner screen shows targets next to Won Rs. ("logged, not invoiced") plus the house /
    office sales target (`UNASSIGNED`).
- **Meta-Data sheet edited with the owner's explicit OK** (details in data-model.md):
  MUB's targets split 50/50 to SJ and SM from Aug 2026; all UAK targets moved to IB; MUB and UAK
  removed from `Rep_Mapping`. Checked by reading back.
- **No app code yet.**

## Next
- **Spec 001 (foundations) is `Draft` v2**, revised after an adversarial review (a separate
  reviewer agent) and the owner's answers (open questions S1-1 to S1-6, ADR-0007). Its build plan
  is ready: `docs/plans/001-foundations-plan.md`.
- **Waiting for the owner to approve spec 001.** Then set it to `Approved` and start build step 1.
  **No code before approval.**
- Facts checked (2026-11-04): clasp 3.4.1, TypeScript 7.0.2 (type-checks JSDoc JS fine), Node 22
  in the cloud container; `clasp push` needs `--force` in a non-interactive shell or it silently
  skips; Meta-Data months are dates and must be read in the sheet's own timezone; Google's sign-in
  and Apps Script servers answer from the cloud machine. What a clasp login can access is spelled
  out in the spec (from clasp's own permission list).

## Questions for the owner
None open. Ask new ones the owner's way:
- One question at a time.
- Tappable options. Use the multiple-choice question tool if you have one (Claude Code:
  `AskUserQuestion`); otherwise give numbered options.
- Put your recommended option first and mark it **(Recommended)**. For pure facts only the owner
  knows, say there's no recommendation.
- Plain English, no jargon.

## Useful facts
- Meta-Data spreadsheet: "Mitchell Sales Meta-Data", ID `11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc`
  (in the owner's Google Drive). Structure documented in `docs/architecture/data-model.md`.
  **Never edit it without the owner's explicit OK in that session.**
- Branches: session 1 `claude/vigilant-volta-yye9pn`, session 2 `claude/laughing-fermi-ec4tlp`
  (no PRs opened).

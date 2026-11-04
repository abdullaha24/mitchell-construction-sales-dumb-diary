# Build plan 004: Update a site

> For [spec 004](../specs/004-update-site.md) (**Approved** 2026-11-04). Same rules as plan 003:
> `npm run check` (and `check:browser` when HTML changes) green at the end of each step, one
> commit each.

## Ground rules (carried from phase 3)
- New public functions take the link code first (`requireRep_`), run inside `forSalesman_`,
  and only touch **his** sites: the row is found by site ID **and** his code, again inside the
  lock. Test "B can't update A's site" on each.
- Every typed or picked text is written with `asText_`; the phone cell is set to text first.
- Change only the cells that change (the owner may add columns); never rewrite a whole row.
- One-time `saveId` per form, as in phase 3.

## [x] Step 1: Update rules (plain logic)
`checkUpdate_` and `checkDetails_` in `src/siterules.js`: stage, value 1–1,000,000,000 with
Cash / Credit at Rate Quoted / Won, lost reason (+ Other needs a note), follow-up only for open
stages, notes up to 200, the number gate, "a number can't be removed", "Nothing to save".

## [x] Step 2: Saving updates; repUpdateSite / repEditSite
`src/sites.js`: find his row, write changed cells, append the Activity row (`stage_change`,
`update`, `details` with old → new number). Cards carry value, terms, reason, note, products.
`src/salesman.js`: the two public functions. Allow-list → 12.

## [ ] Step 3: The site screen
Tap a card → site screen with Update and Edit details; drafts kept per site; browser check.

## [ ] Step 4: Docs, review, local acceptance

## [ ] Step 5: Live (with the owner), then close out

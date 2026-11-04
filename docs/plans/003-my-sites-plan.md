# Build plan 003: My sites + add a site

> For [spec 003](../specs/003-my-sites.md) (**Approved** 2026-11-04). Same rules as plans 001–002:
> `npm run check` green at the end of each step, one commit each, tick when committed.

## Ground rules
- Every new public function takes the link code first and accepts only a **working salesman
  link** (`whoIsVisiting_` → `rep`). His code and region always come from the server.
- Replies to a salesman hold only **his** sites; the duplicate check tells him about others
  only yes/no (ADR-0004). Test both on every new function.
- Replies hold no `Date`s. Pages put data on screen as text only.

## [x] Step 1: Site rules (plain logic)
`src/siterules.js`: tidy phone numbers; area keys, "same area" and "Did you mean" suggestions
(edit distance); follow-up dates in Pakistan time; checking a new site's values; next IDs
(`S000001`, `A0000001`, never reusing one seen in `Sites` or `Activity`); joining products
with ` | `. Fakes: `Utilities.formatDate 'yyyy-MM-dd'`, `Utilities.parseDate`.

## [x] Step 2: Reading and saving sites; the salesman's server functions
`src/sites.js`: read `Sites` / `Activity` / `Lists` by header; his sites; the yes/no phone
check; save a site (+ activity, + new area) inside the lock. `src/salesman.js`: `repLoad`,
`repCheckPhone`, `repAddSite`. Tests: privacy (A never sees B), refusals (owner link,
cancelled, removed salesman, junk), every validation rule.

## [x] Step 3: The salesman's page
`doGet` serves `App.html` for a salesman link with his list already in the page (one request
on a weak connection). New Site form, two-tap save without a number, duplicate warnings,
"Did you mean", draft kept on the phone, "no signal" message. Browser check
(`tests/browser/app.check.js`).

## [x] Step 4: No-number counts in Check setup

## [x] Step 5: Docs, review, local acceptance

## [x] Step 6: Live (with the owner), then close out

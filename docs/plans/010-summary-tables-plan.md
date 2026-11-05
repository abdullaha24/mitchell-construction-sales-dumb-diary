# Build plan 010: Summary tables and a smaller page download

> For [spec 010](../specs/010-summary-tables.md) (**Approved** 2026-11-05, session 5, answers
> S10-1 to S10-4; mockup [`010-mockup.html`](../specs/010-mockup.html)). One commit per step,
> `npm run check` and `npm run check:browser` green each time. Nothing counted changes (spec 009).

## [x] Step 1: This plan
- Spec → In progress.

## [x] Step 2: Comments stripped when a page is served (S10-3)
- `webapp.js`: `servedHtml_` removes HTML comments, full-line `//` and `/* */` comments in
  `<script>` / `<style>`, leading spaces and blank lines, at serve time, from `App.html` and the
  admin's `Admin.html` part. Never touches a code line's text, `<pre>` / `<textarea>`, template
  scriptlets or the page data (inserted after). A script block with a template literal or a line
  ending in `\` is left as it is.
- Fake `HtmlService`: `createTemplate`, `getRawContent`, as Google's.
- Tests: the rules; the served pages' scripts still parse; served-size pins (salesman ≤ 75,000
  bytes; admin ≤ its served size + 2 KB) replace the source pin. Browser checks unchanged.
- Done: served salesman's page 66,085 bytes (source 87,826), admin's part 20,807 (source 24,436).
  A line break is kept where markup meets a script / style / pre / textarea, so neighbouring
  elements stay apart. `tests/served.test.js` (9 tests): the rules, the page data untouched, every
  served script parses, and the served script is exactly the source's code lines in order. All 8
  browser checks pass on the served pages.

## [x] Step 3: Server: structured parts and the new WhatsApp text
- `summary.js`: each summary carries `title`, `sub`, `tiles`, `target`, `tables`, `now` (admin:
  the team table with region, Team and "not in the salesmen list" rows; Won in millions, S10-4)
  and the text: numbers in a monospace block (≤ 30 characters a line, columns aligned), names as
  `- ` lists, past periods without the Now part. Counting untouched.
- Tests: spec 009's count, privacy and speed tests kept (read through the new parts); exact texts
  (salesman week, month, past week, team month); line lengths and alignment; millions format.
- Done (with step 4, one commit: the page draws the new parts). Spec 009's tests now read the
  parts (same numbers); 6 of them rewritten where their subject was the old wording or the named
  hot / late sites. Found by the new tests and fixed: a 13-character Rs. amount touched the count
  (label column narrowed to 13: count ends at column 16, Rs. at 30); a % over 999 broke the team
  table's width (shown as 999+). 6 server mutations each failed a test.

## [x] Step 4: The pages
- `App.html` draws the parts (tiles, target bar, two-column tables, NOW table, team table with
  tappable salesman rows via `Admin.html`), Share and Copy the same height; 360 px, Rs. never wraps.
- Browser checks for both pages, failing on the old layout where meaningful.
- Done: `summary.check.js` compares the screen part by part with the server's summary for all four
  periods on both pages, and checks six tiles, the target bar (this month) / one line (no target)
  / none (weeks), "+ 2 more" spanning its table, numbers right-aligned and on one line, the team
  table's five columns lined up and inside the card at 360 px, tapping a salesman's row, Share and
  Copy the same height. Found and fixed: the "+ N more" cell took the page's old `.more` style.
  Served sizes: salesman 69,574 bytes, admin 90,275 (pin 92,300).

## [ ] Step 5: Docs, local acceptance
- Spec 009 points to spec 010 for layout; AGENTS.md (served-size pin), src/README, tests/README,
  roadmap (speed pass now spec 011), handoff; spec criteria ticked (not the live ones).

## [ ] Step 6: Live (coordinator)

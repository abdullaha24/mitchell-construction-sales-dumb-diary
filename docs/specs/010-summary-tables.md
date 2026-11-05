# 010: Summary tables (neat layout) and a smaller page download

- **Status:** In progress: built and checked locally (build plan
  [010](../plans/010-summary-tables-plan.md)); live checks next
- **Owner approval:** approved by the owner on 2026-11-05 (session 5), after choosing the direction
  from a mockup (S10-1 to S10-3) and the Rs. format (S10-4)
- **Related:** [spec 009](009-summaries.md) (the summaries: what is counted stays exactly the same)
  · ADR-0003 (no build step: kept) · [handoff](../plans/handoff.md) → speed pass (this spec does its
  first step) · owner answers **S10-1 to S10-3** · research notes below

## Why
The owner doesn't like how the summary looks: lines of text with dots. He wants **neat tables and
lines**. Research (below) and a mockup he picked: a few **big numbers** at the top, a **target bar**,
then **short tables** with Rs. lined up on the right; for the admin, **one team table**. The salesman's
page is also at its size limit (87,826 of 88,000 bytes), so the page first gets smaller: comments
are removed when Google sends the page out (owner S10-3), which is also the first step of the speed
pass.

The mockup the owner chose (made-up numbers) is [`010-mockup.html`](010-mockup.html): open it in a
browser. Build to it; where it and this text differ, this text wins.

## What the salesman sees (owner S10-1, mockup A)
Same Summary button, Back, and the four buttons (This week · Last week · This month · Last
month), the same loading, no-signal, *"As of"* and *"not sent yet"* lines as spec 009. The summary
itself, top to bottom:
1. **Heading:** *"November so far"*, and under it, small: *"1–20 Nov · Rs. logged, not invoiced"*.
2. **Six number tiles**, 3 per row: **New sites** · **Sites worked** · **Samples** / **Quotes** (with
   *Rs. 3,850,000* small under the count) · **Won** (green, with its Rs.) · **Lost** (red). A count
   of 0 shows **0** and no Rs.
3. **Target bar (month only):** *"Target"* and the % on one line; a green bar filled to the %
   (full at 100% and above); under it *"Won Rs. 2,450,000"* left and *"of Rs. 12,345,000"* right.
   No target that month: one line *"No target for November"*, no bar. Weeks: no target card.
4. **Tables** (two columns, a thin line between rows), each with its title and count in the top
   row; left out when empty:
   - **Won**: site name | Rs. (right-aligned; *"· Cash"* / *"· Credit"* small after the name);
   - **Quotes given**: site name | Rs.;
   - **Lost**: site name | lost reason (right-aligned, grey).
   Up to 10 rows, biggest Rs. first, then a grey row *"+ 4 more"* (as spec 009).
5. **"NOW · 20 NOV"** (small capitals), then a four-row table: **Hot sites** | *6 · Rs. 3,200,000* ·
   **Follow-ups next 7 days** | *9* · **Late** | *3* (red) · **Going cold** | *2* (amber). Nothing late
   or going cold: those two rows show **0** in grey. Under Last week / Last month this part shows on
   screen as in spec 009 (S9-15).
   **Named, as spec 009 had them (owner S9-7; decided after the first build, which had left them
   out):** after the four-row table, a **Hot sites** table (his top 5 in the Hot Pipeline order: name
   | Rs., or *Sample / Trial* in grey; the count of all hot sites in the top row) and a **Late &
   going cold** table (the 3 biggest by Rs.: name | *"5 days late"* in red / *"no update for 9
   days"* in amber / both / *"no follow-up date"*; *"Late 3 · Cold 2"* in the top row), each left out
   when empty. In the WhatsApp text (This week / This month only) the same items follow the NOW
   block as `- ` lists. The admin's view of a salesman is the same; the team's NOW stays counts only.
6. **Share on WhatsApp** (green) and **Copy**, side by side, the same height.

Long site names wrap inside their cell; Rs. never wraps (spec 009 live fix kept).

## What the admin sees (owner S10-1, mockup B)
Same Summary button and behaviour as spec 009. The team summary:
1. **Heading** *"Team · November so far"* with the days under it.
2. **The same six tiles**, for the current salesmen together (spec 009 rules).
3. **Team target bar** (month only), as the salesman's, with *"House / office target Rs. 8,000,000 ·
   not in the diary"* small under it.
4. **The team table**, one row per salesman in `Rep_Mapping` order, grouped by region:
   | Name | Worked | Quotes | Won Rs. | **%** (months) / **Lost** (weeks) |
   - a **bold, shaded row per region** (North, Center, South) above its salesmen, with the region's
     totals (and its % of the region target in months);
   - a **Team** row at the bottom (green shading, bold);
   - a salesman with nothing in the period shows **—** in grey; in a month, if he has a target, the
     % column keeps **0** (0% of target is information: *"— — — 0"*); a week shows all **—**;
   - codes **not in the salesmen list** come last, under a grey row *"Not in the salesmen list"*;
   - numbers right-aligned, same width digits, so columns line up;
   - **tapping a salesman's row** opens his summary exactly as he sees it, plus *"Logged on N days"*
     (spec 009, S9-9), with Back to the team where he was. A small *"tap a name"* sits in the table's
     top row.
   - Won Rs. in this table is written in **millions**, e.g. *2.45M* (owner S10-4; format below).
5. **Lost reasons** table: reason | count, most first, with the total in the top row.
6. **NOW** table for the team (as the salesman's, every open site, spec 009).
7. **Share on WhatsApp** and **Copy**.

## The WhatsApp text (owner S10-2, mockup C top)
WhatsApp has no tables (its formats: bold, italic, strikethrough, monospace, lists, quote). The
numbers go in a **monospace block** (three backticks) so they line up; names stay a list:
```
*RIA · November so far (1–20 Nov)*
```(monospace)
New sites       9
Sites worked   31
Samples         4
Quotes          6   3,850,000
Won             3   2,450,000
Lost            2
Target  19% of 12,345,000
```(end)
_Rs. logged, not invoiced_

*Won*
- F-11 Commercial Tower · Rs. 1,200,000
...
```
- Every line inside a monospace block is **at most 30 characters**, so it doesn't wrap on a small
  phone (and breaks the columns). The team message's table is the same: `Name  Worked Quotes Won %`
  with short columns, Won in millions (*2.45M*, S10-4), inside one block, then lost reasons as a
  list.
- Past periods still leave out the Now parts (S9-15).
- Names, reasons and codes from the sheet can't switch on WhatsApp formatting in the message: a
  backtick becomes `'`, and `*`, `_`, `~` become look-alikes WhatsApp doesn't read as formatting
  (`∗` `ˍ` `∼`). The screen shows them exactly as typed. A name too long for the team table is cut
  short there, and every monospace line keeps a space between columns.
- **Checked on the owner's phone before this spec is closed**: if the block does not line up there,
  the text falls back to bold labels (mockup C bottom), with no other change.

## A smaller page download (owner S10-3)
- When Google sends a page (salesman's, admin's), **comments and the spaces at the start of lines are
  removed** from `App.html` and `Admin.html` by one server function (`servedHtml_`), at that moment.
  **No build step**: git stays exactly what runs (ADR-0003 kept). The page that arrives does
  exactly the same thing; only comments and indentation are gone.
- It removes only: HTML comments; lines inside `<script>` / `<style>` whose text starts with `//`
  or is a `/* … */` comment; leading spaces and tabs. It never touches text inside quotes on a code
  line, the data the page carries, or `<pre>` / `<textarea>` content.
- Conservative by design (review fix): an HTML comment is removed only outside a tag (never inside a
  quoted attribute value); a script or style line is removed only when it is wholly a comment and no
  comment is open where it starts; once a kept line leaves a comment open, nothing more is removed
  from that element; an element with a backtick anywhere, or a line ending in a backslash, is sent
  exactly as written.
- The size pin moves from the source file to **what is served**: the salesman's served page must be
  **at most 75,000 bytes** (today's source is 87,826 with comments), pinned by a test; the source file
  is no longer pinned. The admin's served page gets its own pin (at most its served size + 2 KB).
- All browser checks already open the page through `doGet`, so they test exactly what phones get.

## Rules
- **Nothing counted changes.** Every number, period, rule and privacy rule of spec 009 (S9-1 to
  S9-16) stays exactly as built; only how it is laid out, and the WhatsApp wording, change. The
  server sends the summary as structured parts (tiles, target, tables, now) **plus** the ready-made
  WhatsApp text, both built on the server (spec 009's rule), and the page draws the parts.
- Names, reasons and notes are drawn as text, never as HTML (as everywhere).
- Phone first: everything fits at **360 px** with no sideways scrolling; the team table's 5 columns
  fit at 360 px (if a long name doesn't fit, it wraps; numbers never wrap).

## Research behind the layout (2026-11-05)
- Nielsen Norman Group, *Mobile Tables*: redesign for the phone rather than shrink; wordy tables fit
  about 2 columns on a phone, number-heavy tables fit more with short headers; keep the first
  (name) column fixed; avoid sideways scrolling and rotation. → two-column site tables; a 5-column
  numbers-only team table.
- W3C, responsive data tables: many tables are better redesigned for phones.
- Common sales-report pattern (dashboard vendors / templates): a few big numbers at the top, a
  progress bar against target, green for won and red for lost, then details.
- WhatsApp Help Center, *How to format your messages*: bold, italic, strikethrough, monospace (```),
  inline code, lists and quotes; no tables. Lining up columns is only possible with spaces inside a
  monospace block, and WhatsApp does not promise how it wraps on a phone → 30-character lines and a
  check on the owner's phone.

## Acceptance criteria
- [x] Unit tests: the summary parts (tiles, target, tables, now, team table with region and Team
      rows, "not in the salesmen list" rows) carry exactly spec 009's numbers (the existing count
      tests keep passing); exact WhatsApp text tests for a salesman's week, month, past week and the
      team month, with every monospace line ≤ 30 characters and the columns aligned.
- [x] `servedHtml_` tests: removes HTML comments, `//` comment lines, `/* */` comments and
      indentation; keeps `'https://…'` strings, `//` inside quotes, regex literals, `<pre>` /
      `<textarea>` text and the page data unchanged; the served salesman page ≤ 75,000 bytes and the
      admin's within its pin.
- [x] Browser checks (both pages, at 360 px): six tiles, target bar (month) and none (week), the
      tables and their "+ N more", Rs. right-aligned and never wrapped, the team table's columns
      line up and fit with no sideways scroll, tapping a salesman's row and Back, WhatsApp link holds
      the new text, Copy; every existing browser check still passes on the served (stripped) page.
- [x] No regressions: all existing tests pass (counts, privacy, speed, interleave, queue).
- [ ] Live (agent): deployed with `update-deployment` at the same address; the agent checks both
      pages in Chromium against the sheet as for spec 009; the salesman's page open time is no
      slower than version 12.
- [ ] Live (owner's phone): the WhatsApp message's monospace block lines up; if not, the fallback.
- [x] Docs: spec 009 points here for layout; data model unchanged; AGENTS.md (served-size pin),
      src/README.md, tests/README.md, roadmap, handoff (speed pass is now spec 011).

## Out of scope
- Charts, colours beyond green / red / amber, dark mode.
- The rest of the speed pass (measuring, deferring code): spec 011.
- Any change to what is counted or who sees what.

## Open questions
_None._ S10-4 answered by the owner (2026-11-05): **millions everywhere in the team table and the
team WhatsApp table** (*2.45M*). Format: Rs. ÷ 1,000,000, rounded to 2 decimals, trailing zeros
dropped (*2.45M*, *1.5M*, *0.25M*, *6.1M*); 0 → *0*; a non-zero amount under Rs. 5,000 → *<0.01M*.
Region and Team rows are formatted from their exact totals (so a column may not add up to the last
digit). The salesman's own tiles and tables keep full figures (*Rs. 2,450,000*).

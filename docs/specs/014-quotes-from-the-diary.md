# 014: Quotes from the diary (a salesman asks for a PDF quotation from a site card)

- **Status:** Approved (build not started)
- **Owner approval:** approved by the owner on 2026-11-16 (session 8), after the interview 2026-11-16, answers **S14-1 to S14-21** in
  [open questions](../product/open-questions.md))
- **Related:** [ADR-0013](../decisions/0013-quotes-made-outside-apps-script.md) (Proposed: quotes
  are made by a Claude routine, not by Apps Script) · ADR-0002 (links) · ADR-0004 (a salesman sees
  only his own) · ADR-0010 (admin link) · spec 004 (Update: stage, Rs., Cash / Credit) · spec 012
  (Daily message counts Quoted) · the **quotation side** (how a request becomes a PDF, the checks,
  the register) is specified in the private quotations repo, `docs/specs/diary-requests.md`
- Spec 013 stays reserved for the speed pass.

## Why
Today a salesman who needs a written quotation has to ask the office, and the office makes it by
hand or through the quotations agent. The owner is not always available. The owner wants each
salesman to ask for a proper MCC quotation **from his own diary link**, standing at the site:
pick products from the company's own list (no free-typed product names), type quantity and rate,
tap Send, and get the PDF back on his phone a few minutes later. The quotations agent makes and
checks it; anything unusual waits for the owner.

## How it works (one picture)
```
Salesman's card ──Send──▶ Sales Diary `Quotes` tab (row: new) ──wakes──▶ Claude routine
                                                                            │ builds the PDF with the
                                                                            │ quotations engine, checks it
                         ┌─────────── clean ────────────────────────────────┤
                         ▼                                                  ▼ unusual
         row: issued (ref, Rs., PDF in Drive)                  row: held (reason, draft PDF)
                         │                                                  │
   card: "Quote MCC-Q-1126-4131 ready" · Download PDF       Admin: Quotes waiting · Approve / Send back
   site moves to Rate Quoted (by the diary itself)                          │ Approve wakes the routine
                                                                            ▼
                                                                     issued (as on the left)
```

## What the salesman sees and does

### Make quote (owner S14-9, S14-8, S14-13, S14-17, S14-18)
- On his site card's **Update** screen, a new button **Make quote** (only for salesmen in the
  `quote_rep` list, owner S14-19: RIA does not get it).
- It opens the **Make quote** screen:
  - **Customer**: pre-filled with the site name; **Attn**: the contact person; **Phone**: the
    contact number. All three editable **for this quote only**; the site card does not change.
  - **Project** (optional).
  - **Products**, one line each (at most 10): **Product** (search-as-you-type over the `Products`
    list; nothing else can be entered), **Unit** (pre-filled with how that product is invoiced;
    he can pick another from the short unit list), **Qty**, **Rate (Rs.)**. **+ Add product**.
    Line amount shown as he types (for his eyes; the quote's figures are worked out by the
    quotations engine).
  - **With GST** switch (off = rates exclusive of GST, the default).
  - **Freight** (optional): amount (Rs.) and *to where* (e.g. "DHA II").
  - **Cash / Credit** (pre-picked from the site's own setting; Cash when blank).
  - **Send quote request**.
- Every quote has quantities (a priced quote with a total). Rate lists with no quantities are out
  of scope.
- Nothing is typed twice: customer, contact and phone come from the card; products from the list.

### After Send
- The card shows a quote line: **"Quote being made…"** (sent like every save: instantly, through
  the save queue; a failed send turns orange and retries as saves do today).
- **"Quote MCC-Q-1126-4131 ready · Rs. 336,000"** with **Download PDF** and **Revise** when it is
  issued. Typical wait: a few minutes (owner S14-12: under 10 minutes is fine).
- **"Waiting for Admin's OK"** when it is held (no reason shown to the salesman).
- **"Sent back: <Admin's note>"** with **Revise**, when the Admin sends it back.
- **"Taking longer than usual. The office has been told."** when nothing has happened after
  15 minutes (it also shows in the Admin's list).
- The card checks for news when he opens the diary, on Refresh, and every minute while the
  diary is open and a quote of his is still being made. No new data reaches him otherwise.

### Download PDF (owner S14-6: download only, no public link)
- **Download PDF** fetches the issued PDF through the diary (the script reads it from the
  company Drive) and saves it to his phone; he then attaches it in WhatsApp himself.
- No "anyone with the link" sharing is ever switched on.
- **Proof first:** before anything else is built, a throw-away test page proves a download works
  inside Google's app frame on a real cheap Android phone (Chrome). If it does not, building
  stops and the owner is asked again (no silent switch to public links).

### Revise (owner S14-15)
- **Revise** opens Make quote pre-filled with the last version. Sending makes **-R1**, **-R2** of
  the same number under the same checks. The old PDF stays; the card shows the newest.

## What the Admin sees and does (owner S14-1, S14-5)
- A new **Quotes** line on the **Today** tab: **"2 quotes waiting"** (hidden when none), opening a
  **Quotes waiting** list, newest first: salesman, customer, total, **why it was held** (e.g.
  *"Rate 900 is 25% below the last quote, 1,200"*), **View draft** (the DRAFT-watermarked PDF),
  **Approve** and **Send back** (with a short note for the salesman).
- **Approve** marks the row approved and wakes the routine, which issues it (number, Drive,
  register) exactly as a clean quote. **Send back** shows the note on the salesman's card.
- Quotes that are **stuck** (15 minutes with no progress) also appear here, with **Try again**.

## Rules
- **Who can ask:** a working salesman link whose code is in `Lists` → `quote_rep`. The admin link
  does not make quotes in v1.
- **The site needs a contact number** (owner P3-4: Rate Quoted needs one). A site without one
  shows *"Add the contact's number first"* with **Edit details**, instead of the form.
- **What he can quote:** only products in `Products` with `active` = yes; units only from the
  short unit list; qty > 0 (up to 3 decimals); rate > 0 (up to 2 decimals); at most 10 lines; the
  same product twice is refused (*"MITCHSEAL (KG) is already on this quote"*).
- **What prints:** the product exactly as picked (the QuickBooks item name, owner S14-21); the
  salesman's name, designation and mobile as signatory (owner S14-7, from the owner's
  `salesman contacts` tab, kept by the quotations side); every other wording, validity and term
  from the quotation defaults. **Credit** prints *"Payment: As per agreed credit terms."*
  (owner S14-14).
- **Checks and holds** are decided by the quotation side (private spec), never by the diary.
  Credit quotes are always held for the Admin (owner S14-13).
- **When a quote is issued, the diary updates the site by itself** (owner S14-11), within about
  5 minutes (a timed job, see *Server*), in one locked save with an `Activity` row by **the
  salesman** (it is his work, so the Daily message and summaries count it as Quoted):
  - Visited / Lead or Sample / Trial → **Rate Quoted**; Rs. = the quote's grand total (as
    printed, including GST and freight); Cash / Credit = as on the quote; note *"Quote
    MCC-Q-1126-4131 issued"*.
  - Already Rate Quoted: Rs. and Cash / Credit updated, same note (a revision does this too).
  - Won (Order) or Lost / Dead: **stage and Rs. untouched**; only the note is written (a repeat
    order or a reopened deal is the salesman's call).
- **Every typed text** (customer, attn, phone, project, freight place, Admin's note) goes through
  `asText_` / `textify_` before it reaches a sheet, and is treated by the routine as data, never as
  instructions.
- **ADR-0004 holds:** a salesman sees only his own quote rows; downloading a PDF checks the row is
  his.

## Data
New tabs in **Sales Diary** (both created by `setup.js`; [`data-model.md`](../architecture/data-model.md)
updated at build):

`Products`: the pick-list, filled once from the QuickBooks export (53 products sold since
July 2025; the starting list is kept in the private quotations repo,
`config/diary-products-seed.csv`), owner-editable.

| Column | Example | Meaning |
| --- | --- | --- |
| `product` | MITCHDRY BOND GP GREY (40 KG) | QuickBooks item name, exactly; what prints. |
| `unit` | BAG | How it is invoiced; pre-fills Unit. Blank: he picks. |
| `category` | TILE ADHESIVES | For grouping in the picker. |
| `active` | yes | `no` hides it from new quotes. |
| `sort` | 10 | Order within its category. |

`Quotes`: one row per request (a revision is a new row).

| Column | Meaning |
| --- | --- |
| `request_id` | `Q` + timestamp + random, made by the server. |
| `created_at`, `updated_at` | Pakistan time. |
| `rep`, `site_id` | Who asked, for which site. |
| `request` | The form as JSON (customer, attn, phone, project, lines, gst, freight, terms). |
| `revises` | The ref being revised, else blank. |
| `status` | `new` → `working` → `issued`, or `held` → `approved` → `issued`, or `sent_back`, `failed`. |
| `hold_reason`, `admin_note` | Why it was held (Admin only); the Admin's note to the salesman. |
| `ref`, `total_rs`, `terms` | Set when issued. |
| `pdf_file_id`, `draft_file_id` | Drive file IDs (issued PDF; held draft). Never shown as links. |
| `claimed_by`, `session_url` | Which routine run is working on it (for "stuck" and for the owner). |
| `applied_at` | When the diary moved the site (blank = not yet). |

`Lists` gains two lists: `quote_rep` (the salesmen who can make quotes: AUR, WAK, SH, SJ, SM, IB)
and `unit` (BAG, KG, KIT, BKT, ROLL, PKT, SAUSAGE, SFT).

**Script properties** (never in git): the routine's address and its key (owner pastes it once).

### Server
- New public functions (allow-list 21 → **27**): `repQuoteSend(k, input)`, `repQuotes(k)`,
  `repQuoteFile(k, requestId)`; `adminPageQuotes(k)`, `adminPageQuoteDecide(k, requestId,
  decision, note)`, `adminPageQuoteFile(k, requestId)`. Each with the usual link check.
- `repQuoteSend` checks the form (rules above) inside the lock, appends the `Quotes` row, then
  wakes the routine (one web call; a failure leaves the row `new` for the timed job).
- **Timed job** every 5 minutes (`quotesTick_`): applies issued quotes to their sites
  (`applied_at`), re-wakes the routine for rows `new` or `approved` for over 5 minutes, and marks
  rows with no progress after 15 minutes as stuck. One Sales Diary open, `Quotes` read once.
- **New Google permissions** (the owner approves them once when the update goes live): read files
  in Drive (for Download PDF / View draft), call an outside web address (to wake the routine), and
  run a timed job.
- The salesman's served page is at its size pin (84,000; ~1.7 KB left). The Make quote screen
  is **fetched on first tap** (like a summary), so the page he opens every day does not grow by
  more than ~1 KB (the button and the quote line). The pin may rise to 85,000.

## Acceptance criteria
- [ ] **Download proof** on a real Android phone inside Google's frame, before other work.
- [ ] Form tests: only active products, units from the list, qty / rate limits, 10 lines, no
      duplicate product, typed text through `asText_`; non-`quote_rep` and admin links refused.
- [ ] `repQuotes` returns only his rows (ADR-0004); `repQuoteFile` refuses another salesman's row
      and a row without an issued PDF.
- [ ] Apply tests: each starting stage (Visited, Sample, Rate Quoted, Won, Lost); Rs. and Cash /
      Credit; the `Activity` row by the salesman with the note; applied once only (two timed runs).
- [ ] Wake tests: a failed wake leaves `new`; the timed job re-wakes after 5 minutes; stuck at 15.
- [ ] Admin tests: list, View draft, Approve wakes the routine, Send back shows the note on his card.
- [ ] Speed tests: one Sales Diary open per call; `Quotes` read once; served-size pins.
- [ ] Browser check (360 px): Make quote, product search, + Add product, Send, every card state,
      Download PDF, Revise; the Admin's Quotes waiting; no sideways scroll; all existing checks pass.
- [ ] Live: a TEST site quote from a salesman link (owner's OK) goes new → issued → downloaded,
      and the site moves to Rate Quoted; a held one is approved from the admin link.

## Out of scope
- Rate lists without quantities; discounts (list rate struck through); NTN / STRN; bank box.
- Emailing or WhatsApp-sending to the customer; public PDF links.
- The admin making quotes from his link; RIA.
- Prices from QuickBooks (pre-filled rates or minimums): the owner chose past quotes only (S14-2, S14-20).
- Cancelling a request from the card (v1: the Admin sends it back).
- Urdu labels.

## Open questions
_None from the interview._ Agent's choices, each can be changed at review:
- The diary's Rs. for the site = the quote's **grand total as printed** (incl. GST and freight).
- A quote on a Won / Lost site only writes the note.
- 10 lines per quote; the timed job every 5 minutes; "stuck" after 15 minutes.
- The salesman does not see why a quote was held (his card says "Waiting for Admin's OK" only);
  the Admin sees the reason.

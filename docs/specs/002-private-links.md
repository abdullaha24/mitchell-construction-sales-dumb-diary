# 002: Private links

- **Status:** Approved
- **Owner approval:** approved by the owner on 2026-11-04 (session 3)
- **Related:** roadmap phase 2 · ADR-0002 (private links) · ADR-0006 (owner link) ·
  ADR-0008 (Sales Diary ID and web address in code) ·
  [data model](../architecture/data-model.md) → `Links` · builds on
  [spec 001](001-foundations.md)

## Why
Salesmen don't have logins. Each one needs his own private link that opens the app as him, and
the owner needs to make, send and cancel those links himself. This phase builds only that:
opening a link says who you are, and nothing more. **Salesmen see their name, nothing else yet.**

## What the owner sees and does

### Making and sending a link (on a computer)
1. In the Sales Diary sheet: **Sales Diary → Links**. A window opens with one row per salesman
   from `Rep_Mapping` (grouped North, Center, South), plus a row for **You (owner)**.
2. Each row shows either **No link** or the person's link, the date it was made, and buttons:
   - **New link**: makes a link. If he already had one, a second tap confirms
     *"RIA's old link will stop working. Make a new one?"*
   - **Copy**: copies the link. If the browser blocks copying, the link is selected so the owner
     presses Ctrl+C.
   - **Send on WhatsApp**: opens WhatsApp (app or WhatsApp Web) with a ready message, e.g.
     *"RIA, this is your Sales Diary link. Keep it private: anyone with it can use the diary as
     you. <link>"*. The owner picks the salesman's chat and sends.
   - **Cancel link**: after a second tap to confirm, the link stops working at once.
3. Links stay visible here and in the `Links` tab, so the owner can resend the same link any
   time (owner's choice, P2-1).

> Like **Check setup**, the menu only works in Google Sheets on a computer. Managing links from
> the owner's phone comes with the owner screen (phase 7).

### Opening a link (any phone, no Google account)
- **A salesman's working link** shows a plain page: **"Hello, RIA"**.
- **The owner's working link** shows **"Hello, owner"** and *"Your screen comes in a later
  phase."*
- **A cancelled, mistyped, made-up or missing link** shows only: *"This link doesn't work. Ask
  the owner for a new one."* It never says whether the link once existed or whose it was.
- If Google itself fails (e.g. a sheet can't be opened for a moment), the page says *"Something
  went wrong. Try again in a minute."*, so a salesman doesn't think his link was cancelled.
  *(Added at approval.)*
- A slow connection just takes longer: the page is one small screen, no extra downloads.

### One-time switch-over (with the owner, about 10 minutes)
| # | Who | Step |
| --- | --- | --- |
| 1 | **Owner** | Signs clasp in again (same as phase 1: open a link, paste back the address). |
| 2 | Agent | Pushes the code and updates the **same** web address (`update-deployment`), now open to **Anyone** (`ANYONE_ANONYMOUS`). |
| 3 | **Owner** | Reloads the sheet, taps **Check setup** (creates the `Links` tab), allows any new permission Google asks for, then opens **Sales Diary → Links**. |
| 4 | **Owner** | Makes his own link and one test link (RIA), and opens each on his phone. Then cancels the test link and checks it stops working. |
| 5 | Agent | Signs clasp out. |

Sending the real links to all 7 salesmen is **launch** (roadmap phase 8), not this phase: until
then their links would only say "Hello". The owner can still make them early if he wants.

## Rules

### Links
- A link is the web address plus `?k=` and a **code of 64 random letters and digits** (two of
  Google's random IDs joined: about 244 bits of randomness, far above ADR-0002's 128).
- Each person has **at most one working link**. **New link** cancels any older ones for that
  person first.
- A link works only if **all** of these hold, checked on the server on every page load:
  - its code matches a `Links` row exactly, and that row's `active` is TRUE;
  - for a salesman: his code is **still in `Rep_Mapping`**. When the owner removes a salesman
    there, his link stops working even if nobody cancelled it.
- A salesman's link **never** opens the owner's page, and the owner's link is never treated as
  a salesman's (they're told apart by `role`, not by the code).
- A code that isn't exactly 64 letters/digits is refused before any sheet is opened.
- Codes are **never** written to logs, error messages or the `Activity` tab, and never sent to
  anyone's page except the owner's Links window (ADR-0002).
- The owner can also cancel a link by hand: set `active` to FALSE in the `Links` tab.
- **Accepted risk (owner's choice, P2-1):** codes are visible in the `Links` tab. Anyone who
  sees that tab (screen share, screenshot, someone at his computer) can copy a working link.
  The owner should never share the Sales Diary sheet, and should cancel any link he thinks has
  leaked. Anyone with a salesman's link can act as that salesman until it's cancelled
  (ADR-0002); anyone with the owner link will see everything once the owner screen exists
  (ADR-0006).

### The `Links` tab
- **Check setup creates it** when missing, like the other tabs: headers from the data model,
  bold and frozen, and the `token` column set to plain text. An existing `Links` tab is never
  touched.
- The Links window and the web app find the Sales Diary sheet by its ID in the code
  (ADR-0008), not by "the open sheet": a web app has no open sheet.
- New rows are added at the bottom. Rows are never deleted by the app, so the tab keeps a
  history of every link made and cancelled.

### Safety (adds to spec 001's rules)
- The public functions become: `doGet`, `onOpen`, `menuCheckSetup`, `menuLinks`, and the three
  the Links window calls: `ownerListLinks`, `ownerNewLink`, `ownerCancelLink`. Each `menu…`
  and `owner…` function **refuses unless the signed-in owner is running it** (spec 001's check).
  A salesman's page could try to call them, but he isn't signed in as the owner, so Google
  gives the script no email for him and the check fails.
- `ownerNewLink` / `ownerCancelLink` accept only `owner`, or a salesman code currently in
  `Rep_Mapping`. Anything else is refused.
- Making and cancelling links runs inside a lock, so two quick taps can't make two working
  links.
- The web app's pages are built with Google's escaping templates. Nothing typed into the
  address is ever placed into a page.
- The web app is deployed as **Execute as: me (owner)** and **Who has access: Anyone**
  (`ANYONE_ANONYMOUS`), always with `update-deployment` on the phase 1 deployment, so the
  address never changes.

## Data
- **Reads:** Meta-Data `Rep_Mapping` (read only, as in phase 1); Sales Diary `Links`.
- **Writes:** Sales Diary `Links` (new rows; `active` → FALSE on cancel). Check setup creates
  the tab.
- **Data model change** (in [data-model.md](../architecture/data-model.md), same change as
  the code): `Links` is final. Columns `role`, `rep`, `token`, `active`, `issued_at`, as
  already listed; `token` stays visible (P2-1). `rep` is blank for the owner row.
- **Code settings (ADR-0008):** the Sales Diary sheet ID and the web app address go in
  `src/config.js`.

## How it's built (for agents)
- `src/links.js`: making codes, looking codes up, new and cancel (with `LockService`).
- `src/linksdialog.js` + `src/Links.html`: the Links window and its three `owner…` functions.
- `src/webapp.js`: `doGet(e)` reads `e.parameter.k`, decides **rep / owner / doesn't work**,
  and serves `Hello.html` (template) or `NoLink.html`. No `google.script.run` on those pages
  yet.
- `src/setup.js`: also creates `Links`.
- Tests (local, fakes): every rule above, including *a salesman's code doesn't open the
  owner page*, *a cancelled owner code opens nothing* (ADR-0006), *a removed salesman's code
  stops working*, *a 63- or 65-character code is refused without opening a sheet*, *New link
  cancels the old one*, *every `owner…` function refuses a non-owner and touches nothing*, and
  *no code appears in any error message*. Fakes gain `Utilities.getUuid`, `LockService` and
  `HtmlService` templates.

## Acceptance criteria
Checked locally:
- [ ] `npm run check` passes; every rule above has a test.
- [ ] The public-function test lists exactly the 7 functions above.

Checked live with the owner:
- [ ] Check setup creates `Links` (headers as in the data model) and changes nothing else.
- [ ] The Links window lists the 7 salesmen and the owner; **New link**, **Copy**, **Send on
      WhatsApp** and **Cancel link** work.
- [ ] The test RIA link shows "Hello, RIA" on a phone with no Google sign-in; the owner link
      shows "Hello, owner".
- [ ] After **Cancel link**, the RIA link shows "This link doesn't work…"; a made-up code does
      too.
- [ ] The web address is the same as in phase 1.
- [ ] clasp signed out at the end.

## Out of scope
- Anything a salesman does after "Hello" (phase 3+). The owner screen itself (phase 7).
- Managing links from the owner's phone (phase 7). Sending all 7 real links (launch, phase 8).
- A PIN on top of the link, Google sign-in for the owner, hiding codes (owner chose visible).
- Caching Meta-Data to make pages faster (only if it turns out slow).

## Open questions
_None open._ Answered by the owner on 2026-11-04 (session 3):
1. **(P2-1) Can the owner see a link again later?** Yes: **always viewable** in the Links window
   and the `Links` tab, accepting the risk above. (Agent had recommended "show once".)
2. **(P2-2) Where are links managed?** **In the Sales Diary sheet on a computer for now**
   (Sales Diary → Links); on the owner's phone from phase 7.

# First rollout week: how each salesman uses the diary

> 2026-11-17, session 9. Read-only analysis of the live Sales Diary sheet (`Activity` and `Sites`)
> from launch (Thu 5 Nov) to Tue 17 Nov, 09:10 Pakistan time: 143 saves on 100 sites.
> **This repo is public:** this copy has no customer names, phone numbers or rupee amounts.
> Sites are named by `site_id`; the owner can look them up in the sheet.

## How it was measured

- Times are when the salesman **pressed Save**, not when he made the visit.
- A **sitting** is a run of saves with no gap over 30 minutes.
- **Minutes a day** is an estimate: the time from the first to the last save of each sitting,
  plus about 1 minute for opening the app and filling in the first form.
- **Days logged** counts working days (Monday to Saturday; Sunday is off) from each salesman's
  first save.
- **Overdue** is an open site (not Won or Lost) whose follow-up date is before 17 Nov.

## The team at a glance

| | Days logged | When he logs | Min/day | Sites | Orders | Open quotes | Overdue |
|---|---|---|---|---|---|---|---|
| **AUR** | 7 of 7 | 9:00–9:30 am, one sitting | ~11 | 28 | 12 | 3 | **14** |
| **WAK** | 6 of 7 | ~9 am and ~5–6 pm | ~8 | 26 | 2 | 3 | 5 |
| **SH** | 4 of 7 | 8–10 pm | ~7 | 13 | 11 | 1 | 1 |
| **SM** | 5 of 8 | 9–11 am and 10:30 pm–midnight | ~12 | 15 | 3 | 2 | **0** |
| **IB** | 4 of 11 | Through the day, 12–6 pm | ~4 | 10 | 2 | 3 | 7 |
| **SJ** | 2 of 8 | One burst on day 1 | — | 8 | 5 | 0 | 3 |
| **RIA** | 0 | — | — | 0 | — | — | — |

By order value logged, SH is first and AUR second.

## Each salesman

### AUR (North): "the 9 o'clock clock-in"
- The most regular person on the team: he logged every working day since he started (Tue 10 Nov),
  and he is the only one who logged on a Saturday.
- Nearly always opens the app between 9:00 and 9:30 am, once a day. Quick, bare entries (about
  1.5 minutes each): no area on any of his 28 sites, no contact name on 15, a note on 1 of 32 saves.
- Working on tile adhesives and grouts with contractors and project owners.
- **Style:** a hunter, not a farmer. He records new contacts and orders (probably the previous
  day's), but never goes back to them:
  - 14 leads are 2 to 5 days past their follow-up date, untouched since he added them.
  - He has never used Snooze, or Update on a lead.
  - He leaves the follow-up on the default "Tomorrow" almost every time (14 of 19).

### WAK (North): "the area walker who clears his list"
- Two sittings a day, around 9 am and around 5–6 pm. The fastest typist: about 1 minute per new
  site (7 sites in 6 minutes on Mon 16 Nov, 5:17 pm).
- Adds the most new contacts (26 sites, 22 of them first visits). Fills in the area and works one
  area at a time (Faisal Town, Top City, Peach Society).
- Working on tile adhesives and waterproofing. Both his orders came the way the app is meant to
  work: a visit first, then a win.
- **Style:** busy, uses the app the most, but pushes follow-ups back instead of working them:
  - 12 snoozes, the most on the team; 6 sites in 30 seconds on Mon 16 Nov. That is clearing the
    list, not deciding. One site (S000025) snoozed twice.
  - No contact name on 18 of 26 sites; notes on 2 of 28 saves.

### SH (Center): "the night-time order book"
- Logs at night, 8–10 pm. The slowest per entry (about 4 minutes) but careful: area filled in
  every time.
- 11 of his 13 sites were entered straight as Won; the highest order value on the team. Mostly
  floor hardeners and bonding agents.
- One lead (overdue 5 days) and one big quote (S000079, follow-up due 18 Nov). No notes at all.
- **Style:** a closer who writes down at night what he sold that day. He uses the app as a sales
  book, not to build future business. Quiet since Fri 13 Nov, night.

### SM (Center): "the night-owl planner"
- Logs in the morning (9–11 am) and late at night (10:30 pm to midnight).
- **The only one with zero overdue follow-ups.** Usually picks "1 week" as the next follow-up
  (8 of 15), which sets realistic dates; almost always fills in the contact name (1 blank).
- S000015 is the best example on the team of the app working as intended: logged as a visit on
  9 Nov, followed up twice, won on 16 Nov.
- Working on tile adhesives with contractors: 12 open sites (9 first visits, 1 sample, 2 quotes).
- Still learning the habit: on Mon 16 Nov at 8:59 am he snoozed 5 sites in under a minute.

### IB (South): "logs as he goes, writes the notes"
- The first user, on launch day. Saves through the day, one entry at a time, which suggests he
  logs right after each visit.
- **The only real note-writer:** 13 of the team's 20 notes. Every one of his sites has a contact
  name; none has an area.
- Working on consultants and builders across many products (waterproofing, floor hardeners,
  grouts): longer, project-style selling. Has the biggest quote in the sheet (S000006).
- **Style:** detailed and relationship-focused, but irregular: 4 of 11 working days, quiet since
  Thu 12 Nov evening. He follows up, but 4–5 days late; 7 follow-ups overdue now.
- Typed a per-unit rate as the total value on S000001 and S000002.

### SJ (Center): "one burst, then gone"
- Day 1 (Mon 9 Nov): 11 saves between 8:24 and 9:29 am, learning by doing (corrected an order
  value minutes after saving it, changed a phone number). Since then, one save (Fri 13 Nov,
  1:25 pm).
- 5 tile adhesive orders, one repeat customer at 3 sites. His 3 leads are all overdue.
- **The one most at risk of becoming a second RIA.**

### RIA (North)
Nothing logged in 12 days.

## Team patterns

1. **The app is used mainly to record orders.** 28 of the 35 orders appeared straight as Won,
   with no visit or quote logged first. The Won total is real, but the business on its way is
   invisible.
2. **Not one lost deal logged.** Almost certainly losses aren't being written down.
3. **Follow-up dates are mostly missed.** 30 open sites are past their follow-up date
   (AUR 14, IB 7, WAK 5, SJ 3, SH 1, SM 0).
4. **Saturdays are dead.** One save from the whole team across two Saturdays.
5. **Notes are rare.** 20 of 119 work saves have a note, 13 of them IB's.

## Worth a call (owner)

- **RIA and SJ:** need a nudge in person.
- **AUR:** already opens the app at 9 am daily; five minutes on Today's Chase would cover his 14
  waiting leads.
- **Numbers to confirm in the sheet:**
  - S000082 and S000083 (SH): same customer, same amount, saved minutes apart; likely one order
    entered twice.
  - S000001 and S000002 (IB): a per-unit rate typed as the total value.
  - S000006 (IB): the biggest quote in the sheet; worth a check that it is the real total.

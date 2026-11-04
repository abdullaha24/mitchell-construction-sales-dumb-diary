# 0009: Two new `Sites` columns: `worked_at` (going cold) and `note_at` (last-spoken line)

- **Status:** Proposed
- **Date:** 2026-11-04
- **Deciders:** owner / agent

## Context
Phase 6 ([spec 007](../specs/007-card-helpers-areas.md)) needs two facts on every site card:
1. **When the site was last really worked**, for *going cold* (yellow after 7 days at Sample /
   Trial or Rate Quoted). The owner decided (P6-2) that only a real Update resets it: **not**
   Snooze and **not** Edit details. Today `Sites.updated_at` is written by all three, so it can't
   tell them apart.
2. **When the last note was written**, for the last-spoken line (*"22 Oct: Quoted …"*). An Update
   without a note keeps the old `last_note`, so the day of the last update is not the day of the
   note.

The history in `Activity` has both answers, but it only grows, and the owner's top priority is
speed on cheap phones and weak signal: opening the app must not read it (spec 006 rule; tested
from spec 007).

## Decision
Add two server-written timestamp columns at the end of `Sites`, after `updated_at`:
- **`worked_at`**: set when a site is added and on every successful Update save. Never by Edit
  details or Snooze. Drives going cold (instead of `updated_at`).
- **`note_at`**: set whenever `last_note` is written (adding a site or an Update with a note).

`updated_at` keeps its plain meaning: last change of any kind. Rows without the new values fall
back: going cold from `created_at`; a note without a day. Snoozes are logged in `Activity` with a
new `action` value, `snooze`, so they are never counted as work.

## Options considered
- **A. Two new columns (chosen):** exact answers for both facts, read with the rest of the row
  (no extra read on load). Cost: two more columns in the owner's sheet, and the live tab needs the
  two headers before the code goes live.
- **B. Change what `updated_at` means** (Edit details and Snooze stop writing it), and take the
  note's day from it too: no new column, but the owner loses "last changed", and the note's day is
  wrong whenever an Update had no note (*"3 Nov: waiting for consultant"* for a note written on
  22 Oct).
- **C. Read `Activity` when the app opens:** no sheet change, but every page load reads the
  ever-growing history. Rejected: speed.
- **D. One column `worked_at` only**, with the note shown under the last-worked day: simpler, but
  the same wrong-day problem as B.

## Consequences
- `DIARY_HEADERS.Sites` gains `worked_at` and `note_at`; the data model's `Sites` table and
  `Activity` actions are updated with the code.
- **Going live:** the two headers must be in row 1 of the live `Sites` tab before the new code is
  deployed (the code refuses a tab with a missing column). The live code ignores extra columns, so
  adding them first is safe. Live `Sites` is empty today, so no rows need filling in.
- The owner screen (phase 7) uses `worked_at` for the team's going-cold list and can leave
  `snooze` rows out of "who worked today".
- If the owner edits `last_note` by hand, `note_at` is not updated (the line shows the old day).

# AGENTS.md

Instructions for AI coding agents working in this repo. Keep this file short and true.
If something here is out of date, fix it in the same change.

## What this is

**Sales Diary** (working name): a phone-first pocket diary for the 7 field salesmen of a small
Pakistani construction-chemicals company (3 Islamabad, 3 Lahore, 1 Karachi).
Each salesman opens a personal link, sees who to chase today, and logs visits, quotes, wins and
losses in a few taps. The owner gets a written pipeline in Google Sheets for free.

Read before any product or UI work:
- `docs/product/vision.md`: what we're building and why
- `docs/product/glossary.md`: domain words (thekedar, ugrahi, the sales stages, buyer types)

## Status

Repo shell only. **No app code, build, lint or test commands exist yet.** Don't invent them.
When tooling is added, list the exact commands in a `## Commands` section here.

## Where things live

| Path | What goes there |
| --- | --- |
| `docs/product/` | Vision, glossary, open questions. The owner's intent. |
| `docs/specs/` | One spec per feature, written **before** the code. Copy `_template.md`. |
| `docs/architecture/` | How the system fits together, and the Google Sheet data model. |
| `docs/decisions/` | ADRs: one file per significant decision. Copy `_template.md`. |
| `docs/plans/` | Roadmap and step-by-step build plans for agents. |
| `src/` | Apps Script source (server code + HTML). Planned clasp `rootDir`. |
| `tests/` | Automated tests that run locally, with no Google account needed. |
| `scripts/` | Helper scripts for setup and deploy. |

## How to work

1. **Spec first.** No feature code without a spec in `docs/specs/` that the owner has approved
   (status `Approved`). If none exists, write a `Draft` spec and stop for review.
2. **Decisions go in ADRs.** Choosing a library, changing the data model, changing how links or
   auth work: write an ADR in `docs/decisions/`. Don't silently reverse an `Accepted` ADR.
3. **Data model changes** update `docs/architecture/data-model.md` in the same change.
4. **Unknowns go in `docs/product/open-questions.md`.** Don't guess about the business. Ask.

## Product rules (non-negotiable)

- **Stupidly simple.** The users are not tech people. They use WhatsApp, not spreadsheets.
- **Plain words in the UI.** No jargon ("pipeline", "CRM", "lead score" stay out of screens).
  Use the words in the glossary. English UI for now; content may be Urdu, English or Roman Urdu.
- **Taps over typing.** Big buttons, pick-lists, at most ~5 visible inputs per screen.
- **Never make them type the same thing twice.** Pick existing sites; don't re-enter them.
- **Phone first.** Design for a cheap Android phone on a weak mobile connection.
- **Built for the salesman, not just the boss.** Every screen must help the salesman do his day.

## Technical guardrails

- Backend is Google Sheets + Google Apps Script web app (ADR-0001). Don't add servers or paid services.
- Never commit secrets or credentials: `.clasprc.json`, OAuth tokens, rep link tokens, phone lists.
- Rep links are secrets. See ADR-0002 before touching identification or links.
- Times are Pakistan time (`Asia/Karachi`). Money is PKR (Rs.).

## Definition of done

- The linked spec's acceptance criteria are met.
- Tests (once they exist) pass locally, and new logic has tests.
- Docs touched by the change are updated: spec status, data model, ADRs, this file.
- No regressions to existing flows.

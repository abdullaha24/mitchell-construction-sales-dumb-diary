# 0013: Quotes are made by a Claude routine outside Apps Script

- **Status:** Accepted (owner, 2026-11-16, with spec 014)
- **Date:** 2026-11-16
- **Deciders:** owner (S14-1, S14-12) / agent

## Context
Spec 014 lets a salesman ask for a PDF quotation from his site card. MCC already has a quotation
system (a separate, private repo): an engine that works out every figure and number, renders an A4
PDF in a real browser, and files it in the company Drive and the Quote Register sheet. Apps Script
cannot run that browser, and its own HTML-to-PDF loses most styling. The owner also wants each
quote checked before it goes out, and he is not always available.

ADR-0001 and AGENTS.md say: no servers or paid services.

## Decision
The diary only **collects** the request (a `Quotes` row in Sales Diary) and **wakes** a saved
Claude Code routine on the owner's existing Claude plan with one web call. The routine runs the
quotations repo's own engine and checks, writes the result back to the same row, and files the
PDF exactly as quotes made in chat. The diary reads the row to show progress, serves the PDF by
download, and moves the site to Rate Quoted itself.

The routine's address and key live in Script Properties, never in git. The request text is data:
the routine never takes instructions from it.

## Options considered
- **Claude routine** *(agent's recommendation, chosen)*: reuses the quotation engine, register and
  Drive filing as they are; a real review of every quote; nothing new to host or pay for. Cons: a
  few minutes per quote; the routine feature is a research preview (limits or the call may change);
  30 wakes per hour per routine.
- **GitHub Action** (the engine run by GitHub on each request): about a minute, no AI. Cons: no
  review; needs separate Google credentials for Drive and the register; a second way of filing.
- **PDF made in Apps Script** (HTML or a Google Docs template): instant. Cons: a second, poorer
  copy of the quotation layout and numbering; styling and fonts unreliable.

## Consequences
- The diary gains three Google permissions (Drive read, outside web calls, a timed job); the owner
  approves them once.
- If the routine is down or changed, requests wait safely as `new`; the timed job retries, and the
  Admin sees stuck ones. Nothing is lost and nothing is issued twice (the quotation side claims a
  row before working on it).
- The diary never decides figures, numbers or holds; those stay in the quotations repo.
- Moving away from the routine later only changes who answers the `Quotes` rows.

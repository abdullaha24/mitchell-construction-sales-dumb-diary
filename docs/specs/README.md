# Specs

One spec per feature, written **before** the code. The spec is the contract between the owner
and the agent building it.

## Process
1. Copy [`_template.md`](_template.md) to `NNN-short-name.md` (next free number).
2. Fill it in with status `Draft`. Put unknowns in *Open questions*, not guesses.
3. The owner reviews and sets status `Approved`. **No feature code before this.**
4. Build it. Tick off acceptance criteria. Set status `Done` when merged.

Status values: `Draft` → `Approved` → `In progress` → `Done` (or `Dropped`).

## Index

| # | Spec | Status |
| --- | --- | --- |
| [001](001-foundations.md) | Foundations: tooling, Sales Diary sheet, reading Meta-Data | Done |
| [002](002-private-links.md) | Private links: owner makes, sends and cancels links; a link says who you are | Done |

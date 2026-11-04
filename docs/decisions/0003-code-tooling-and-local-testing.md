# 0003: Code tooling: clasp, plain JavaScript, local tests

- **Status:** Proposed (owner to confirm)
- **Date:** 2026-11-04
- **Deciders:** agent (recommendation)

## Context
AI agents will write most of the code. Agents work best with a **fast local feedback loop**:
run checks and tests on the machine, without logging into Google or clicking around a live app.
Apps Script code normally lives in Google's online editor, which agents can't use well.

Facts checked on 2026-11-04 against the official clasp README (github.com/google/clasp):
- `clasp` is Google's command-line tool to push and pull Apps Script code from a local folder.
- clasp 3.x requires **Node.js 22+**.
- clasp 3.x **no longer compiles TypeScript**. TypeScript needs a separate bundler step.
- `.clasp.json` supports `rootDir`, `scriptExtensions`, `htmlExtensions`, `filePushOrder`, and
  `skipSubdirectories`. `.claspignore` uses multimatch patterns relative to `rootDir`.

## Decision (proposed)
- Keep source in git under `src/` and use **clasp** to push it to Apps Script.
- Write **plain JavaScript** (no build step), with **JSDoc types + `// @ts-check`** so `tsc --noEmit`
  can type-check it locally.
- Keep **business rules as pure functions**: stage changes, "going cold", follow-up dates, filtering
  a salesman's lists. These are tested in Node with a small test runner. Google services
  (`SpreadsheetApp` etc.) stay in a thin layer that's mocked in tests.
- Exact commands get listed in `AGENTS.md` once set up.

## Options considered
- **A. Plain JS + JSDoc type checks + Node tests** *(recommended)*: no build step, so what's in
  git is exactly what runs in Apps Script. Still gets type checking and tests. Small catch: Apps
  Script files share one global scope, so tests need a small loader.
- **B. TypeScript + bundler (Rollup/esbuild) → clasp**: stronger types and real modules, but adds
  a build step and bundler config, and top-level functions (`doGet`, `google.script.run` targets)
  need extra wiring to survive bundling. More moving parts for a small app.
- **C. Edit in the online Apps Script editor**: no tooling, but no git history, no tests, and
  agents can't work on it. Rejected.

## Consequences
- Agents can verify most changes locally before anything touches the live Sheet.
- Deploying still needs a one-time `clasp login` by the owner (credentials stay off git).
- If the app grows a lot, switching to option B later is a contained change.

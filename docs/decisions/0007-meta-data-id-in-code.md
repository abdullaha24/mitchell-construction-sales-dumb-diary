# 0007: The Meta-Data sheet's ID is kept in the code

- **Status:** Accepted (owner chose this on 2026-11-04, session 2, after the spec 001 review)
- **Date:** 2026-11-04
- **Deciders:** owner
- **Supersedes:** one bullet of ADR-0005 ("The Meta-Data spreadsheet ID is configuration (e.g. a
  Script Property), not hard-coded"). The rest of ADR-0005 stands.

## Context
ADR-0005 said the Meta-Data sheet's ID should be a setting, not part of the code. Spec 001 turned
that into a "paste your Meta-Data link" box on first setup. The adversarial review of spec 001
pointed out that this adds a setup step and a way to get it wrong, for a value that is not secret
(it is already written in the repo's docs) and almost never changes.

## Decision
- The Meta-Data sheet's ID is a constant in `src/config.js`.
- If the owner ever replaces the sheet, the agent changes that one line and pushes the code.

## Options considered
- **Owner pastes the link once** (ADR-0005 as written): no code change if the sheet is replaced,
  but one more setup step for the owner. Not chosen.
- **ID in the code** *(chosen)*: nothing for the owner to do.

## Consequences
- No Meta-Data setting to explain or lose.
- Replacing the Meta-Data sheet needs a code push by the agent.
- The ID is not a secret: opening the sheet still needs the owner's Google account.

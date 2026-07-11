# Step 039 — Clean-Slate Arabic RTL Foundation

## Status

Completed directly in the repository during the clean frontend rebuild.

## Dependency

- Step 038

## Objective

Replaced the previous client baseline with a clean Arabic-only React/Vite/MUI structure.

## Required implementation evidence

- Fixed `lang="ar"` and `dir="rtl"` at document and MUI levels.
- Runtime translator imports `ar.json` only; `en.json` is retained but unused.
- No locale switch or English runtime mode exists.
- Global CSS tokens and responsive page primitives were established.

## Verification gate

- Review `agent_pack/docs/PRD.md` and frontend design docs.
- Confirm this scope in the current `client/` source.
- Run the checks relevant to the scope.
- Record evidence in `agent_pack/reports/039_frontend_clean_slate_arabic_rtl_foundation_REPORT.md`.

This historical step must not be re-executed unless a later QA step proves the baseline invalid.

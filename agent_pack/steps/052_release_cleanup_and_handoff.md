# Step 052 — Release Cleanup and Handoff

## Objective

Perform the final full regression, remove transient artifacts, validate Agent Pack integrity, and produce a reproducible release/handoff package.

## Dependencies

- Step 051 complete.

## Required work

1. Run full client lint/static UI/build checks.
2. Run server tests, syntax checks, database setup/migrations, and API smoke tests.
3. Confirm no MongoDB/Mongoose, product image flow, POS terminal model, language switch, English runtime import, source-template branding/content, or obsolete frontend files remain.
4. Confirm all routes and page modules are reachable and permission-correct.
5. Confirm SQLite file/log/build/cache/node_modules artifacts are excluded from release ZIP unless explicitly required.
6. Validate every Agent Pack step/report path, IDs, dependencies, current step, and completion state.
7. Update README, deployment, environment example, demo account instructions, and handoff notes.
8. Produce final release ZIP and final validation report with exact checks and honest limitations.

## Evidence

- Command log and outcomes.
- Dependency/security summary.
- Agent Pack graph validation.
- Release ZIP contents/exclusions.
- Final unresolved issues list or explicit statement that none remain.

## Completion rule

Mark complete only when release artifacts are reproducible and all critical flows from Steps 049–051 remain passing.

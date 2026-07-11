# Step 052 — Release Cleanup and Handoff

## Objective

Perform the final full regression, remove transient artifacts, validate Agent Pack integrity, and produce a reproducible release/handoff package.

## Dependencies

- Step 051 complete.

## Required discovery

- Read `agent_pack/docs/FORM_INPUT_SYSTEM.md`.
- Read `agent_pack/reports/RTL_NOTCHED_INPUT_SYSTEM_IMPLEMENTATION_REPORT.md`.

## Required work

1. Run full client lint/static UI/build checks.
2. Run server tests, syntax checks, database setup/migrations, and API smoke tests.
3. Confirm no MongoDB/Mongoose, product image flow, POS terminal model, language switch, English runtime import, source-template branding/content, or obsolete frontend files remain.
4. Perform live browser QA for the final RTL notched input system: empty, focused, filled, required, error, disabled, multiline, select, date, number, password, adorned, and locally LTR-isolated fields in light/dark and desktop/tablet/phone widths. Confirm the notch opens on the top-right, labels never overlap values, select arrows remain on the left, and no legend is hidden.
5. Confirm every `TextField` is labeled directly or wrapped by the shared `Field` component.
6. Confirm all routes and page modules are reachable and permission-correct.
7. Confirm SQLite file/log/build/cache/node_modules artifacts are excluded from release ZIP unless explicitly required.
8. Validate every Agent Pack step/report path, IDs, dependencies, current step, and completion state.
9. Update README, deployment, environment example, demo account instructions, and handoff notes.
10. Produce final release ZIP and final validation report with exact checks and honest limitations.

## Evidence

- Command log and outcomes.
- Dependency/security summary.
- Agent Pack graph validation.
- Release ZIP contents/exclusions.
- Final unresolved issues list or explicit statement that none remain.

## Completion rule

Mark complete only when release artifacts are reproducible and all critical flows from Steps 049–051 remain passing.

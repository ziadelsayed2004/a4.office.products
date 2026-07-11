# A4 Agent Pack

This pack controls implementation history and the remaining final QA/release work for A4 Office Products.

## Current state

- Backend and product Steps 001–037: completed.
- Clean Arabic-only frontend rebuild Steps 038–048: completed and reported.
- Remaining Steps 049–052: browser visual audit, live API/E2E QA, responsive/theme/accessibility regression, and release cleanup.

## Permanent UI decision

The runtime interface is Arabic only and fixed RTL. There is no language switch or English runtime mode. `en.json` is an unused future translation store only. Light/dark is supported.

## Run

Copy `prompts/COPY_THIS_PROMPT.md` and set `RUN_STEP_COUNT` to `1` or `2`. Follow `prompts/ONE_PROMPT_RUNNER.md` exactly.

## Reference boundary

`TEMPLETE-PROJECT/hamza.printing.press-main/client/` is a visual morphology reference only. The current `client/`, A4 PRD, Express contracts, SQLite schema, role matrix, and business rules remain authoritative.

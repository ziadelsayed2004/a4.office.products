# Frontend Modernization Execution Plan

## Goal

Bring the existing A4 frontend to complete visual and responsive parity with the approved template language while preserving every POS, preorder, inventory, shift, report, and print rule.

## Execution policy

- New frontend phase starts at Step 061.
- A run executes one or two steps only, according to `RUN_STEP_COUNT`.
- When two steps are requested, the second step runs only after the first step passes its verification gate.
- Each step receives its own status update and report.
- No run may exceed two steps.

## Phase groups

### Foundation — 061–066

Audit, cleanup, token system, theme, localization, and shared shell.

### Shared UI — 067–071

Responsive shell, shared primitives, data states, forms, and overlay patterns.

### Page implementation — 072–088

Login, dashboard, POS, products, inventory, preorders, shifts, receipts, reports, users, and logs.

### Quality and completion — 089–090

Theme parity, accessibility/scanner UX, translation parity, responsive/visual QA.

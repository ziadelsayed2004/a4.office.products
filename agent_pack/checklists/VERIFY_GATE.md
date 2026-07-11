# A4 General Verification Gate

## Execution

- Read `status.json`, the selected step, PRD, Feature Matrix, and linked docs/checklists.
- Modify only the selected scope and required supporting fixes.
- Complete, verify, report, and track the first step before a possible second step.
- Never execute a third step.

## Product invariants

- Single branch, EGP, Africa/Cairo.
- SQLite only; no MongoDB/Mongoose.
- Products have no images.
- No POS device/terminal model.
- Runtime UI is Arabic only and fixed RTL.
- No language switch or English runtime mode.
- Animated RTL-safe outlined labels/notches; no overlap, clipping, or duplicate label.

## Money and inventory

- Active cashier shift is required for financial workflows.
- Stock never goes below zero.
- Direct sale decrements physical stock.
- Preorder creation changes open counters only.
- Pickup decrements stock and open counters after full validation.
- Financial, stock, print/reprint, user, and Admin-review actions write AuditLog.

## Permissions

- Cashier sees POS, receipts, preorders, and own shift only.
- Admin-only: global KPIs/revenue, users, catalog, inventory, reports, and shift approval.

## Evidence

- Run step-required lint/build/test commands.
- Record exact commands and results.
- Attach screenshots for visual steps when the environment permits.
- Update `status.json`, `TASK_BOARD.md`, and the declared report.

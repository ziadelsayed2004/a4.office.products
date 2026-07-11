# Change Requests

## CR-2026-07-11 — Clean Arabic RTL Frontend Rebuild

Approved final decisions:

- Replace the previous frontend implementation with a clean A4 React/Vite/MUI client.
- Use the embedded Hamza client only as a visual morphology reference.
- Runtime product UI is Arabic only and fixed RTL.
- Remove every locale/language switch and do not expose English at runtime.
- Keep `en.json` as an unused future translation store only.
- Keep light/dark themes.
- Use external form labels and eliminate outlined-field notches to prevent RTL label defects.
- Use a fixed top bar, right collapsible desktop sidebar, right mobile drawer, compact dashboard density, shared cards/tables/filters/drawers/dialogs, and a dedicated responsive POS layout.
- Preserve A4 identity, SQLite, Express contracts, Admin/Cashier RBAC, shifts, stock rules, preorders, payments, receipts, reports, and AuditLog.
- Remove obsolete frontend Agent Pack steps and replace them with Steps 038–052.
- Record implementation Steps 038–048 as completed and leave only four final QA/release Steps 049–052.
- Runner accepts `RUN_STEP_COUNT` of one or two and never executes more than two steps.

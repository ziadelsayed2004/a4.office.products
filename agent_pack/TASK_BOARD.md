# A4 Task Board

Authoritative source: `agent_pack/status.json`.

## Runner policy

- `RUN_STEP_COUNT=1`: execute one eligible pending step.
- `RUN_STEP_COUNT=2`: execute at most two sequential eligible steps.
- Finish, verify, report, and track the first before beginning the second.
- Never execute a third step.

## Completed product/backend history

Steps 001–037 are complete.

## Completed clean frontend rebuild

| Step | Status | Title |
|---|---|---|
| 038 | completed | Frontend Template Reality Audit |
| 039 | completed | Clean-Slate Arabic RTL Foundation |
| 040 | completed | A4 Theme Shell and Dark/Light Modes |
| 041 | completed | Shared Forms Tables Drawers and Dialogs |
| 042 | completed | Authentication Routes and Runtime Boundaries |
| 043 | completed | Dashboard and Catalog Reference Pages |
| 044 | completed | Products Pricing and Inventory Frontend |
| 045 | completed | POS Sale Preorder and Pickup Frontend |
| 046 | completed | Shifts Receipts and Operations Frontend |
| 047 | completed | Reports Audit and Printer Frontend |
| 048 | completed | RTL Responsive and Performance Cleanup |

## Applied final form-system polish

- Animated Material UI outlined labels and top-right RTL notches are implemented across the active client.
- Select/date fields remain shrunk to prevent value overlap.
- Technical values use local LTR isolation only.
- Client lint, static UI validation, and production build pass.
- Step 052 must perform the remaining live-browser and release regression from `FORM_INPUT_SYSTEM.md`.

## Remaining final QA/release

| Step | Status | Title |
|---|---|---|
| 049 | completed | Visual Template Parity and RTL Audit |
| 050 | completed | Live Backend Contract and POS End-to-End QA |
| 051 | completed | Responsive Dark/Light Accessibility Regression |
| 052 | completed | Release Cleanup and Handoff |

Current status: **All steps completed and verified**.

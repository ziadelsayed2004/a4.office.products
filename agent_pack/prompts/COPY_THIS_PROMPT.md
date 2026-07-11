RUN_STEP_COUNT: 2

You are working on the A4 Office Products POS Platform repository.

Read `agent_pack/prompts/ONE_PROMPT_RUNNER.md` and follow it exactly.

Use the current repository, `agent_pack/status.json`, the selected step files, linked docs, and linked checklists as the only authoritative execution graph. Do not rely on removed frontend step names, previous chat memory, or guessed requirements.

Execute the first eligible pending step from `agent_pack/status.json`. Execute a second eligible step only when `RUN_STEP_COUNT` is `2`, the first step is fully implemented, verified, reported, and marked complete, and the second has no unmet dependency or blocker. Never execute a third step.

Before editing:
- Read each selected step file fully.
- Read `agent_pack/docs/PRD.md`, `FEATURE_MATRIX.md`, `BUSINESS_RULES.md`, `RBAC_PERMISSION_MATRIX.md`, `DB_SCHEMA_TARGET.md`, `API_TARGET_MAP.md`, `FRONTEND_REBUILD_BASELINE.md`, `UI_DESIGN_SYSTEM.md`, and `I18N_DIRECTION_RULES.md`.
- Read every document and checklist linked by the selected step.
- Inspect the actual client, server, SQLite schema, tests, and current build state before changing code.
- Treat `client/` as the active implementation baseline.
- Inspect `TEMPLETE-PROJECT/hamza.printing.press-main/client/` only for visual morphology; never copy its brand, wording, routes, permissions, sample data, or APIs.

Permanent product rules:
- Frontend: React + Vite + Material UI.
- Backend: Node.js + Express.
- Database: SQLite only; never introduce MongoDB or Mongoose.
- Single A4 branch, EGP, Africa/Cairo.
- Roles are Admin and Cashier.
- No product images and no POS device/terminal model.
- Cashier financial operations require the authenticated cashier's active shift.
- Cashier sees POS, preorders, permitted receipts, and own shift only.
- Global revenue/KPIs, users, catalog, inventory, reports, and shift approval are Admin-only.
- Inventory never goes below zero.
- Normal sales decrement stock immediately.
- Preorders require customer name, phone, deposit, and secure pickup token; creation does not decrement physical stock.
- Pickup validates token, active shift, stock, and payment; collects the remaining amount; decrements stock and open preorder counters; prints the final receipt; writes AuditLog.
- Product QR/barcode tokens identify products but never embed price or stock.
- Financial, stock, user-management, print/reprint, and Admin-review actions write AuditLog.

Permanent frontend rules:
- The runtime product interface is Arabic only and fixed RTL from login to the final printed receipt.
- Keep `lang="ar"`, `dir="rtl"`, and MUI RTL. Load `ar.json` only.
- `en.json` is unused future translation storage only. Do not add a language switch, locale selector, English route, automatic locale detection, or LTR runtime mode.
- Light/dark is the only user-facing display switch.
- Preserve the clean A4 shell: fixed top bar, 282px/76px right desktop sidebar, right mobile drawer, grouped navigation, active pill, profile card, compact dashboard/cards/tables, drawers/dialogs, and responsive POS.
- Preserve A4 blue/navy branding and never copy unrelated template branding/content.
- All form labels must be external above controls. Do not use MUI floating labels or outlined notches.
- Technical values such as SKU, barcode, phone, token, and IDs may use local LTR isolation without changing page direction.
- Do not allow page-level horizontal overflow, hidden primary actions, or broken mobile dialogs.
- Do not silently change Express/SQLite contracts or business rules.

After each executed step:
- Run all required verification commands as far as the environment allows; use `npm run check --prefix client` for the standard client gate.
- Update `agent_pack/status.json` and `agent_pack/TASK_BOARD.md`.
- Write the detailed report at the path declared by the step.
- Include changed files, tested behavior, exact commands/results, screenshots when possible, API/database assertions when applicable, unresolved warnings, and honest blockers.

Stop immediately after the requested one or two steps.

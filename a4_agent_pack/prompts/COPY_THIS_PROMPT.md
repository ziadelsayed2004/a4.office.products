You are working on the A4 Office Products POS Platform repo.

Read `agent_pack/prompts/ONE_PROMPT_RUNNER.md` and follow it exactly.

Use the current repository and `agent_pack/status.json` as the only authoritative execution graph.

Do not rely on fixed step names, old phase names, previous chat memory, or guessed requirements.

Execute exactly one open/pending step from `agent_pack/status.json`.

Before coding:
- Read the selected step file fully.
- Read `agent_pack/docs/PRD.md`, `agent_pack/docs/FEATURE_MATRIX.md`, `agent_pack/docs/BUSINESS_RULES.md`, `agent_pack/docs/RBAC_PERMISSION_MATRIX.md`, `agent_pack/docs/DB_SCHEMA_TARGET.md`, `agent_pack/docs/API_TARGET_MAP.md`, and all linked checklists.
- Treat `agent_pack/docs/PRD.md` as the main simplified English product baseline.
- Inspect the current repo state before editing.
- Do not skip discovery.

Permanent product rules:
- Product: A4 Office Products POS Platform.
- Stack: React + Vite frontend, Node.js + Express backend, SQLite database.
- Single branch only.
- Currency is EGP and timezone is Africa/Cairo.
- The application UI is Arabic RTL from start to finish.
- All user-facing labels, menus, buttons, forms, validation messages, errors, dialogs, reports, receipts, and print templates must be Arabic.
- English is allowed only for code, API routes, database table names, technical identifiers, and developer documentation.
- No product images in the base product model or UI.
- No POS device/terminal tracking; every operation is tied to the authenticated account and active shift only.
- Roles are Admin and Cashier.
- Cashier permissions are restricted to POS, preorders, receipts, and own shift only.
- Admin-only visibility for global revenue, KPIs, user management, product management, inventory management, reports, and shift approval.
- No sale, preorder creation, or preorder pickup without an active cashier shift.
- Inventory must never go below zero.
- Normal sales decrement stock immediately.
- Preorders require customer name and phone, collect a deposit, increase open preorder counters, and print a pickup-token receipt.
- Preorder creation does not decrement stock.
- Preorder pickup validates the QR token, opens a pickup dialog, collects the remaining amount, decrements stock, decreases open preorder counters, prints the final receipt, and writes AuditLog.
- Product QR tokens/labels are used to add products to the POS cart; they must not contain price or stock.
- SQLite must be used for persistence; do not add SQLite, SQLite query layer, or Mongo-specific code.
- SQLite migrations/schema must be explicit and reproducible.
- All money, stock, print/reprint, user-management, and admin-review actions must write AuditLog.

During execution:
- Implement only the selected step.
- Do not execute more than one step.
- Do not introduce unrelated changes.
- Preserve all PRD features and Feature Matrix items.
- Preserve Arabic RTL UI requirements across frontend and print templates.

After execution:
- Run the required verification commands as far as the environment allows.
- Update `agent_pack/status.json`.
- Update `agent_pack/TASK_BOARD.md`.
- Write a detailed step report inside `agent_pack/reports/`.
- Include changed files, implemented behavior, verification results, and blockers.
- Stop immediately after one step.

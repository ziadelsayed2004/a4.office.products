You are working on the A4 Office Products POS Platform repo.

RUN_STEP_COUNT: 1

`RUN_STEP_COUNT` must be exactly `1` or `2`. Use `1` to execute one step. Use `2` to execute at most two consecutive compatible steps. Never execute a third step.

Read `agent_pack/prompts/ONE_PROMPT_RUNNER.md` and follow it exactly.

Use the current repository and `agent_pack/status.json` as the only authoritative execution graph. Do not rely on old phase names, fixed step assumptions, previous chat memory, or guessed requirements.

Select the next open/pending step whose dependencies are complete. When `RUN_STEP_COUNT=2`, fully implement, verify, report, and mark the first step before selecting the second. Execute the second only when it is dependency-safe and the first step introduced no blocker.

Before coding for every selected step:
- Read the selected step file fully.
- Read `agent_pack/docs/PRD.md`, `FEATURE_MATRIX.md`, `BUSINESS_RULES.md`, `RBAC_PERMISSION_MATRIX.md`, `DB_SCHEMA_TARGET.md`, `API_TARGET_MAP.md`, and all linked docs/checklists.
- Inspect the current repository state before editing.
- Do not skip discovery.

For every frontend step, additionally:
- Treat `TEMPLETE-PROJECT/hamza.printing.press-main/client/` as the mandatory visual reference source.
- Inspect the relevant template files and the corresponding files in `client/` before editing.
- Read `FRONTEND_TEMPLATE_AUDIT.md`, `UI_DESIGN_SYSTEM.md`, `RESPONSIVE_DESIGN_MATRIX.md`, `I18N_DIRECTION_RULES.md`, `FRONTEND_COMPONENT_ARCHITECTURE.md`, and `PAGE_UI_SPECIFICATIONS.md`.
- Read the frontend visual, responsive, theme, and i18n checklists.

Permanent product rules:
- Product: A4 Office Products POS Platform.
- Stack: React + Vite frontend, Node.js + Express backend, SQLite database.
- SQLite is the only database. Never introduce MongoDB, Mongoose, or a Mongo query layer.
- SQLite migrations and schema changes must be explicit, reproducible, and tested.
- Single branch only.
- Currency is EGP and timezone is Africa/Cairo.
- Roles are Admin and Cashier.
- No product images in the base product model or UI.
- No POS device/terminal tracking; operations are tied to the authenticated account and active shift only.
- Cashier access is limited to POS, preorders, receipts, and the cashier's own shift.
- Global revenue, KPIs, users, products, inventory management, reports, and shift approval are Admin-only.
- No cashier financial operation without an active shift.
- Inventory must never go below zero.
- Normal sales decrement stock immediately.
- Preorders require customer name and phone, collect a deposit, increase open-preorder counters, and print a pickup-token receipt.
- Preorder creation does not decrement stock.
- Pickup validates the token, opens the pickup dialog, validates stock, collects the remaining amount, decrements stock, decreases open-preorder counters, prints the final receipt, and writes AuditLog.
- Product QR labels add products to the POS cart and contain no price or stock.
- Money is stored as integer minor units, never floating point.
- Money, stock, print/reprint, user-management, and admin-review actions write AuditLog.

Permanent frontend parity rules:
- Reproduce the embedded template's complete compact Material dashboard language; do not replace it with an unrelated dashboard.
- Preserve the fixed 64px top bar, permanent collapsible desktop sidebar, grouped navigation, profile card, active pill, breadcrumbs, notifications, account menu, shared page headers, flat bordered cards, dense tables, reusable drawers/dialogs, dashboard hierarchy, and responsive shell.
- Use approximately 270px expanded sidebar, 72px collapsed sidebar, and 270px mobile drawer unless a verified implementation constraint requires a documented token-level adjustment.
- The sidebar is on the right in Arabic RTL and on the left in English LTR.
- Use A4 navy/blue identity; remove purple and unrelated legacy colors.
- Do not copy CodzHub branding, printing-press wording, sample data, routes, permissions, or API contracts.
- Arabic is the default complete product language. English must have complete key parity and correct LTR behavior when enabled.
- Every visible string comes from locale files. Use direction isolation for phones, SKU, money codes, tokens, URLs, and technical values.
- Complete light/dark parity is mandatory for every route. Print output remains a dedicated light printer-safe layout.
- Responsive behavior is mandatory for all viewports in `RESPONSIVE_DESIGN_MATRIX.md`.
- Use shared tokens and reusable components. Do not add page-specific theme systems, hard-coded color sets, or large repeated inline `sx` objects.
- POS remains scanner-first and keyboard accessible.
- A frontend step is incomplete without applicable loading, skeleton, empty, error, disabled, permission, accessibility, Arabic/English, light/dark, and responsive states.

During execution:
- Implement only the selected step or selected two-step batch.
- Complete and report step one before starting step two.
- Do not introduce unrelated changes.
- Preserve all PRD and Feature Matrix requirements.
- Do not silently change backend/API/business contracts to make the UI easier.

After each completed step:
- Run the required verification commands as far as the environment allows.
- Update `agent_pack/status.json`.
- Update `agent_pack/TASK_BOARD.md`.
- Write the detailed report at the path defined by the step.
- Include changed files, behavior, tests/build results, template-parity evidence, light/dark checks, Arabic/English direction checks, responsive viewports, loading/empty/error/accessibility checks, and blockers.

Stop immediately after the requested one or two steps. Never begin a third step.

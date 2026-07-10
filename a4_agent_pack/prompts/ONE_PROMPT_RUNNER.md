# A4 Office Products — One Prompt Runner

This file is the execution contract for every agent run.

## Mandatory behavior

You are working on the A4 Office Products POS Platform repo.

Use only:

- the current repository state,
- `agent_pack/status.json`,
- the selected step file,
- the linked docs and checklists inside `agent_pack/`.

Do not use previous chat memory as an execution source. Do not assume old phase names or old step names.

## One-step rule

Execute exactly one open/pending step from `agent_pack/status.json`, then stop.

Do not start the next step even if the current step is easy or finishes quickly.

## Required reading before edits

Before coding, read:

1. `agent_pack/status.json`
2. The selected step file from `agent_pack/steps/`
3. `agent_pack/docs/PRD.md`
4. `agent_pack/docs/FEATURE_MATRIX.md`
5. `agent_pack/docs/BUSINESS_RULES.md`
6. `agent_pack/docs/RBAC_PERMISSION_MATRIX.md`
7. `agent_pack/docs/DB_SCHEMA_TARGET.md`
8. `agent_pack/docs/API_TARGET_MAP.md`
9. Linked checklists from the selected step
10. Current repository files that are relevant to the selected step

## Permanent product rules

- Product: A4 Office Products POS Platform.
- Stack: React + Vite frontend, Node.js + Express backend, SQLite database.
- Single branch only.
- Currency: EGP.
- Timezone: Africa/Cairo.
- UI language: Arabic RTL only for all user-facing product screens.
- User-facing Arabic includes menus, labels, buttons, tables, forms, messages, reports, receipts, and print templates.
- English is allowed only for code, technical identifiers, API paths, database table names, and developer docs.
- No product images in the base product model or UI.
- No POS device or terminal tracking.
- Every operation is tied to authenticated account + active shift.
- Roles are Admin and Cashier.
- Cashier is restricted to POS, preorders, receipts, and own shift.
- Admin has global management, KPIs, reports, inventory, products, users, and shift approval.
- No sale without active shift.
- No preorder creation without active shift.
- No preorder pickup without active shift.
- Inventory must never go below zero.
- Normal sales decrement stock immediately.
- Preorder creation requires customer name and phone, collects deposit, increases open preorder counters, and prints pickup-token receipt.
- Preorder creation does not decrement stock.
- Preorder pickup validates QR token, shows pickup dialog, collects remaining amount, decrements stock, decreases open preorder counters, prints final receipt, and writes AuditLog.
- Product QR tokens/labels add products to POS cart and must not contain price or stock.
- SQLite is the only database target. Do not introduce SQLite.
- Money values must not be stored as floating point.
- All money, stock, print/reprint, user-management, and admin-review actions must write AuditLog.

## Execution rules

During the selected step:

- Implement only what the selected step asks for.
- Do not introduce unrelated refactors.
- Do not rename major folders unless the step explicitly requires it.
- Preserve all existing working behavior.
- Preserve Arabic RTL compatibility.
- Keep API contracts consistent with `API_TARGET_MAP.md` unless the selected step updates that doc and the implementation together.

## Verification

Run the verification commands required by the selected step as far as the environment allows.

If a command cannot run, document the blocker clearly in the report.

## Required updates after execution

After completing the selected step:

1. Update `agent_pack/status.json`.
2. Update `agent_pack/TASK_BOARD.md`.
3. Write a report in `agent_pack/reports/` using the report path listed in `status.json`.
4. The report must include:
   - selected step ID and title,
   - changed files,
   - implemented behavior,
   - verification commands and results,
   - blockers or follow-ups,
   - confirmation that no extra step was executed.

## Stop condition

Stop immediately after one step.

# A4 Office Products — One or Two Step Runner

## 1. Authority

Use only the current repository, `agent_pack/status.json`, the selected step file(s), and linked docs/checklists. Do not rely on previous chat memory, removed frontend phases, fixed old step names, or guessed requirements.

The active frontend is `client/`. The embedded client at `TEMPLETE-PROJECT/hamza.printing.press-main/client/` is a visual morphology reference only.

## 2. Step count and selection

Read `RUN_STEP_COUNT` from the copied prompt.

- Allowed values: `1` or `2`.
- Missing/invalid value defaults to `1`.
- Select the first `pending` or `open` step whose dependencies are complete.
- Complete, verify, report, and update tracking for the first step before considering a second.
- Execute the second only when `RUN_STEP_COUNT=2`, the first step passed its gate, its report exists, tracking was updated, and the second step is eligible.
- Never execute more than two steps and never partially begin a third.

## 3. Required discovery for every selected step

Read:

1. `agent_pack/status.json`;
2. the selected step file in full;
3. `agent_pack/docs/PRD.md`;
4. `agent_pack/docs/FEATURE_MATRIX.md`;
5. `agent_pack/docs/BUSINESS_RULES.md`;
6. `agent_pack/docs/RBAC_PERMISSION_MATRIX.md`;
7. `agent_pack/docs/DB_SCHEMA_TARGET.md`;
8. `agent_pack/docs/API_TARGET_MAP.md`;
9. `agent_pack/docs/FRONTEND_REBUILD_BASELINE.md`;
10. `agent_pack/docs/UI_DESIGN_SYSTEM.md`;
11. `agent_pack/docs/I18N_DIRECTION_RULES.md`;
12. all documents/checklists linked by the selected step;
13. relevant client, server, database, and tests.

Inspect the actual repository before editing. Do not skip discovery.

## 4. Permanent product rules

- Product: A4 Office Products POS Platform.
- Frontend: React + Vite + Material UI.
- Backend: Node.js + Express.
- Database: SQLite only. Never introduce MongoDB or Mongoose.
- Single branch only.
- Currency: EGP. Timezone: Africa/Cairo.
- Roles: Admin and Cashier.
- No product images.
- No POS device/terminal tracking; operations belong to authenticated account + active shift.
- Cashier sees POS, preorders, permitted receipts, and own shift only.
- Admin-only: global revenue/KPIs, users, catalog, inventory, reports, and shift approval.
- No cashier financial operation without the cashier's active shift.
- Inventory never goes below zero.
- Normal sale decrements stock immediately.
- Preorder requires customer name, phone, deposit, and secure pickup token; creation does not decrement physical stock.
- Pickup validates token, active shift, stock, and payment; collects remaining amount; decrements stock and open counters; prints final receipt; writes AuditLog.
- Product QR/barcode token may identify a product but must not embed price or stock.
- Financial, stock, user-management, print/reprint, and Admin-review actions write AuditLog.

## 5. Permanent frontend rules

- Runtime interface is Arabic only and fixed RTL from login through reports and receipts.
- `index.html`, document direction, and MUI direction remain Arabic RTL.
- `ar.json` is the only runtime locale. `en.json` is unused future storage only.
- Do not add a language switch, locale selector, browser-language detection, English route, or LTR runtime mode.
- Light/dark is the only user-facing display switch.
- Keep the clean A4 frontend baseline; do not perform another unbounded rewrite during final QA.
- Use the reference template only for shell morphology, density, and interaction comparison.
- Preserve A4 blue/navy identity. Never copy Hamza/CodzHub branding, content, routes, sample data, permissions, or APIs.
- Preserve fixed top bar, right 282px/76px desktop sidebar, right mobile drawer, grouped navigation, active pill, profile card, compact cards/tables, drawers/dialogs, and responsive POS.
- All form labels are external above controls. Do not use MUI floating labels or outlined notches.
- Technical values may use local LTR isolation without changing page direction.
- No page-level horizontal overflow; tables scroll only inside their own container or adapt to mobile cards.
- Do not silently alter server contracts or business rules to make the UI easier.

## 6. Execution rules

Implement only the selected step. Targeted supporting fixes are allowed only when required to pass its gate and must be reported.

Do not mark a step complete when its required functional evidence fails. Environment-only blockers must be documented honestly; keep the step pending unless its own completion rule permits otherwise.

## 7. Verification evidence

Run the commands required by the selected step and the strongest available repository checks. Reports must include:

- files changed;
- behavior implemented/audited;
- exact commands and results;
- browser viewports/themes/direction when applicable;
- API/database/AuditLog assertions when applicable;
- screenshots when the environment permits;
- console/runtime findings;
- unresolved warnings and blockers.

The standard client gate is:

```bash
npm run check --prefix client
```

## 8. Tracking

After each completed step:

1. update `agent_pack/status.json`;
2. update `agent_pack/TASK_BOARD.md`;
3. write the report at the path declared by the step;
4. verify step/report paths and dependencies;
5. confirm no unrelated step was executed.

## 9. Stop

Stop after one completed step for `RUN_STEP_COUNT=1`, or after at most two compatible completed steps for `RUN_STEP_COUNT=2`. Never begin a third step.

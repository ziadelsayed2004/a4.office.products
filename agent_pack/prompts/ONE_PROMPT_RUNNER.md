# A4 Office Products — One or Two Step Runner

This is the mandatory execution contract for every agent run.

## 1. Authoritative sources

Use only:

- current repository state,
- `agent_pack/status.json`,
- selected step files,
- linked files in `agent_pack/docs/` and `agent_pack/checklists/`.

Previous chat memory, old phase names, and guessed requirements are not execution sources.

For frontend visual behavior, the embedded template is the mandatory reference:

```text
TEMPLETE-PROJECT/hamza.printing.press-main/client/
```

The active implementation remains:

```text
client/
```

The template controls visual parity. The A4 docs control business behavior.

## 2. Step-count rule

Read `RUN_STEP_COUNT` from the copied prompt.

- Allowed: `1` or `2` only.
- Missing/invalid value defaults to `1`.
- Select the first `open` or `pending` step whose dependencies are complete.
- Complete, verify, report, and mark step one before considering step two.
- With `RUN_STEP_COUNT=2`, execute a second step only when:
  - step one passed its verification gate,
  - its report exists,
  - status and task board were updated,
  - the next step has no unmet dependency,
  - no blocker makes the second step unsafe.
- Never execute more than two steps.

## 3. Required reading

For every step:

1. `agent_pack/status.json`
2. selected step file
3. `agent_pack/docs/PRD.md`
4. `agent_pack/docs/FEATURE_MATRIX.md`
5. `agent_pack/docs/BUSINESS_RULES.md`
6. `agent_pack/docs/RBAC_PERMISSION_MATRIX.md`
7. `agent_pack/docs/DB_SCHEMA_TARGET.md`
8. `agent_pack/docs/API_TARGET_MAP.md`
9. all linked docs/checklists
10. relevant implementation and tests

For every frontend step also read:

- `FRONTEND_TEMPLATE_AUDIT.md`
- `UI_DESIGN_SYSTEM.md`
- `RESPONSIVE_DESIGN_MATRIX.md`
- `I18N_DIRECTION_RULES.md`
- `FRONTEND_COMPONENT_ARCHITECTURE.md`
- `PAGE_UI_SPECIFICATIONS.md`
- `FRONTEND_VISUAL_QA_CHECKLIST.md`
- `RESPONSIVE_QA_CHECKLIST.md`
- `I18N_THEME_QA_CHECKLIST.md`

Then inspect the relevant reference files under `TEMPLETE-PROJECT/hamza.printing.press-main/client/` and their corresponding target files under `client/`.

## 4. Permanent product rules

- React + Vite frontend.
- Node.js + Express backend.
- SQLite only; no MongoDB or Mongoose.
- Single branch.
- EGP and Africa/Cairo.
- Admin and Cashier roles.
- No product images.
- No POS device/terminal model.
- Active shift required for cashier financial operations.
- No negative inventory.
- Normal sale decrements stock immediately.
- Preorder requires customer name, phone, deposit, and pickup token.
- Preorder creation does not decrement stock.
- Pickup validates token, stock, remaining payment, counters, receipt, and AuditLog.
- Sensitive financial/admin/stock/print actions write AuditLog.

## 5. Permanent frontend rules

- Match the embedded template's complete shell and operational design language.
- Keep a fixed 64px top bar.
- Keep a permanent collapsible desktop sidebar near 270px/72px and a temporary mobile drawer near 270px.
- Keep grouped navigation, profile card, active pill, collapse tooltips, breadcrumbs, notifications, account menu, shared page headers, flat bordered cards, dense tables, drawers/dialogs, login composition, and dashboard hierarchy.
- Arabic places navigation on the right; English places it on the left.
- Use A4 blue/navy identity.
- Do not copy CodzHub or printing-press business content.
- Arabic is complete/default; English has full key parity when enabled.
- All visible text is locale-driven.
- Complete light/dark and responsive parity.
- Shared tokens/components only.
- No new large duplicated inline styling or page-level color systems.
- Printer-safe light receipts/labels.
- Scanner/keyboard optimized POS.

## 6. Execution discipline

- Implement only selected scope.
- Preserve working behavior.
- Do not silently change API or business contracts.
- Necessary contract changes must update implementation, docs, tests, and reports together.
- Do not mark a step completed when its verification fails, except for an explicitly allowed and documented environment-only blocker after implementation is complete.

## 7. Verification evidence

Run commands required by the step and the best discovered repository checks.

Frontend reports must include:

- build/lint/test results,
- reference template files inspected,
- pages/components changed,
- parity notes for top bar/sidebar/navigation/cards/tables/drawers/dialogs as applicable,
- light and dark verification,
- Arabic and English verification,
- RTL/LTR side and direction verification,
- responsive viewports checked,
- loading/skeleton/empty/error/disabled/permission states,
- accessibility and keyboard/scanner notes,
- screenshots or an explicit environment blocker.

## 8. Required updates after each step

1. Update `agent_pack/status.json`.
2. Update `agent_pack/TASK_BOARD.md`.
3. Write the defined step report.
4. Confirm no unrelated step was executed.

## 9. Stop condition

Stop after one completed step when `RUN_STEP_COUNT=1`, or after at most two completed compatible steps when `RUN_STEP_COUNT=2`. Never begin a third step.

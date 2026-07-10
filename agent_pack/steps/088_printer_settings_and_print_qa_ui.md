# Step 088 — Printer Settings and Print QA UI

## Status

Defined in `agent_pack/status.json`.

## Goal

Implement receipt width presets, QR-label dimensions/count/spacing/margins, test print, consistent preview, and printer-safe light output independent of screen mode.

## Mandatory reading

- `agent_pack/docs/PRD.md`
- `agent_pack/docs/FEATURE_MATRIX.md`
- `agent_pack/docs/FRONTEND_TEMPLATE_AUDIT.md`
- `agent_pack/docs/UI_DESIGN_SYSTEM.md`
- `agent_pack/docs/RESPONSIVE_DESIGN_MATRIX.md`
- `agent_pack/docs/I18N_DIRECTION_RULES.md`
- `agent_pack/docs/FRONTEND_COMPONENT_ARCHITECTURE.md`
- `agent_pack/docs/PAGE_UI_SPECIFICATIONS.md`
- `agent_pack/checklists/VERIFY_GATE.md`
- `agent_pack/checklists/FRONTEND_VISUAL_QA_CHECKLIST.md`
- `agent_pack/checklists/RESPONSIVE_QA_CHECKLIST.md`
- `agent_pack/checklists/I18N_THEME_QA_CHECKLIST.md`

Primary focus: `agent_pack/docs/PAGE_UI_SPECIFICATIONS.md`.

## Requirements

- Inspect current repository code before editing.
- Preserve all working backend/API/business behavior.
- Match the existing template character and A4 brand contract.
- Use shared tokens/components rather than introducing page-specific visual systems.
- Keep Arabic complete and default; use locale keys for visible strings.
- Verify light and dark modes.
- Verify relevant responsive viewports.
- Preserve no-product-images, active-shift, stock, preorder, receipt, print, and RBAC rules.
- Add or update tests/docs that belong to this step only.

## Mandatory template parity source

Before editing, inspect the relevant files under `TEMPLETE-PROJECT/hamza.printing.press-main/client/` and the corresponding files under `client/`. Preserve the reference template's shell, density, reusable patterns, light/dark behavior, and responsive language while replacing its branding and business content with A4 requirements. Do not copy CodzHub assets, printing-press wording, routes, permissions, sample data, or API contracts.

## Dependencies

087

## Verification

Run the best available commands discovered in the repository, including when available:

```bash
npm run build
npm run lint --prefix client
npm test
```

Also complete the linked frontend visual, responsive, theme, and i18n checks that apply to the changed routes. If screenshots cannot be captured, document the environment blocker.

## Report

Write `agent_pack/reports/088_printer_settings_and_print_qa_ui_REPORT.md` with:

- changed files,
- implemented behavior,
- design-system compliance,
- light/dark verification,
- Arabic/translation/direction verification,
- responsive viewport verification,
- loading/empty/error/accessibility notes,
- command results and blockers,
- confirmation that no unrelated step was executed.

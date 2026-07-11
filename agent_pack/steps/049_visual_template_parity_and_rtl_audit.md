# Step 049 — Visual Template Parity and RTL Audit

## Objective

Perform a real-browser visual audit of the rebuilt Arabic-only frontend against the visual morphology of the embedded reference template, then apply only targeted corrections.

## Dependencies

- Step 048 complete.

## Read first

- `agent_pack/docs/UI_DESIGN_SYSTEM.md`
- `agent_pack/docs/FRONTEND_REBUILD_BASELINE.md`
- `agent_pack/docs/PAGE_UI_SPECIFICATIONS.md`
- `agent_pack/docs/RESPONSIVE_DESIGN_MATRIX.md`
- `agent_pack/docs/I18N_DIRECTION_RULES.md`
- `agent_pack/checklists/FRONTEND_VISUAL_QA_CHECKLIST.md`

## Required work

1. Start the actual A4 client and inspect the reference client separately.
2. Compare shell morphology: top bar, right sidebar, collapse behavior, grouped navigation, active pill, profile card, density, page headers, cards, filters, tables, drawers, and dialogs.
3. Inspect every A4 route in Arabic RTL in light and dark.
4. Specifically verify the defect class shown by the user:
   - animated RTL notch alignment with no label overlap or clipping;
   - select labels are outside borders;
   - arrows/icons do not collide with Arabic text;
   - fields have consistent height, padding, and visible boundaries;
   - menus open within viewport and preserve RTL alignment.
5. Correct only visual/component-system issues. Do not change business rules or server contracts.
6. Remove any remaining legacy style, duplicate CSS, source-template branding, or language-switch artifact.

## Evidence

- Browser screenshots for Login, Dashboard, Products filters/form, POS, preorder pickup dialog, Shifts, Reports, Receipts, and mobile navigation.
- At least one light and one dark screenshot.
- A written reference-vs-A4 comparison.
- Console error check.
- `npm run check --prefix client`.

## Completion rule

Do not mark complete without real-browser evidence. If browser access is blocked, document the blocker and keep the step pending.

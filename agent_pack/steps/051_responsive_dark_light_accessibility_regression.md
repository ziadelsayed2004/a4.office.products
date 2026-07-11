# Step 051 — Responsive Dark/Light Accessibility Regression

## Objective

Verify all required routes across the supported viewport matrix in fixed Arabic RTL, both themes, keyboard interaction, and reduced-motion/accessibility behavior.

## Dependencies

- Step 050 complete.

## Read/check

- `agent_pack/docs/RESPONSIVE_DESIGN_MATRIX.md`
- `agent_pack/checklists/RESPONSIVE_QA_CHECKLIST.md`
- `agent_pack/checklists/I18N_THEME_QA_CHECKLIST.md`
- `agent_pack/checklists/ACCESSIBILITY_QA_CHECKLIST.md`

## Required work

1. Test 360×800, 390×844, 768×1024, 1024×768, 1366×768, 1440×900, and 1920×1080.
2. Test desktop at 125% zoom.
3. Test light and dark on all major route groups.
4. Verify no page-level horizontal overflow, hidden action, clipped Arabic text, broken menu, dialog overflow, label/notch defect, or shell-offset defect.
5. Verify POS scanner focus, keyboard-only cart/checkout, dialog focus, drawer close, and visible focus state.
6. Verify touch target sizes, accessible names, status text beyond color, contrast, and reduced motion.
7. Verify receipts/labels print correctly from both screen themes.
8. Apply targeted fixes and rerun client verification.

## Evidence

- Viewport/theme matrix with pass/fail notes.
- Screenshots for each breakpoint group.
- Keyboard/accessibility findings.
- Print preview evidence.
- `npm run check --prefix client` and any browser automation results.

## Completion rule

All critical and high issues must be fixed. Lower-priority limitations must be documented with rationale.

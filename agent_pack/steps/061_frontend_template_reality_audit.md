# Step 061 — Frontend Template Reality Audit

## Goal

Produce a verified visual/technical gap map between the authoritative reference template and the active A4 client. This step does not redesign pages. It locks the evidence required for all later frontend implementation.

## Mandatory source comparison

Reference:

```text
TEMPLETE-PROJECT/hamza.printing.press-main/client/
```

Target:

```text
client/
```

Inspect at minimum:

- theme configuration and variables,
- MainLayout and shell CSS,
- sidebar/top bar behavior,
- Dashboard and Login,
- shared components,
- locale files/helper,
- table/form/drawer/dialog styles,
- all active target routes.

## Mandatory reading

- `agent_pack/docs/PRD.md`
- `agent_pack/docs/FEATURE_MATRIX.md`
- `agent_pack/docs/FRONTEND_TEMPLATE_AUDIT.md`
- `agent_pack/docs/UI_DESIGN_SYSTEM.md`
- `agent_pack/docs/RESPONSIVE_DESIGN_MATRIX.md`
- `agent_pack/docs/I18N_DIRECTION_RULES.md`
- `agent_pack/docs/FRONTEND_COMPONENT_ARCHITECTURE.md`
- `agent_pack/docs/PAGE_UI_SPECIFICATIONS.md`
- frontend QA checklists

## Requirements

- Record the reference shell dimensions and component patterns.
- Map each reference pattern to the target component/page.
- Identify CodzHub/printing-press assets and wording that must never be copied.
- Identify target hard-coded strings, colors, duplicated inline `sx`, unused CSS, and responsive gaps.
- Identify missing light/dark, Arabic/English, RTL/LTR, state, accessibility, and scanner/keyboard behavior.
- Record baseline screenshots for key routes when the environment allows.
- Do not implement unrelated visual changes.
- Preserve all backend/API/business behavior.

## Required evidence

At minimum cover:

- login,
- authenticated shell expanded/collapsed/mobile,
- admin dashboard,
- one CRUD list/form,
- POS,
- preorder pickup,
- shift close/review,
- reports,
- receipt/print preview.

## Verification

Run discovered build/lint/test commands. Validate that all audit findings cite actual files and that the gap map distinguishes reference behavior from target behavior.

## Report

Write `agent_pack/reports/061_frontend_template_reality_audit_REPORT.md` with:

- reference files inspected,
- target files inspected,
- visual parity matrix,
- technical debt inventory,
- responsive/theme/i18n/accessibility gaps,
- screenshot locations or blocker,
- command results,
- recommended file-level sequence for Step 062,
- confirmation that no unrelated step was executed.

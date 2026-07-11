# RTL Notched Input System — Implementation Report

**Date:** 2026-07-12  
**Scope:** Active `client/` implementation and Agent Pack frontend authority documents.

## 1. Problem found

The active frontend intentionally disabled Material UI outlined legends and rendered labels above controls. That avoided an earlier RTL notch defect, but it no longer matched the requested reference interaction. It also produced inconsistent dimensions between filters, drawers, login, POS, and direct `TextField` instances.

Additional findings:

- `.MuiOutlinedInput-root legend { display: none; }` prevented native notch animation.
- `Field.jsx` always rendered a separate external label.
- Some direct POS/search fields had placeholder-only labeling.
- Select, date, technical LTR, helper/error, and mobile states did not share one final contract.
- `Login.jsx` imported `login.css` while the file name is `Login.css`, which broke production builds on case-sensitive systems.

## 2. Implementation

### Shared field behavior

- Rebuilt `client/src/components/forms/Field.jsx` to detect Material UI `TextField` children and inject:
  - accessible Arabic label;
  - required state;
  - error/helper text;
  - full width;
  - compact outlined defaults;
  - stable field ID;
  - forced shrink for select/date/time-like controls.
- Non-TextField widgets still receive a compact external label when required.

### Theme and motion

- Added a unified 44px outlined control baseline.
- Added top-right RTL label transform origin.
- Added native animated notch behavior.
- Added two-pixel A4 focus border and subtle focus ring.
- Added consistent hover, disabled, error, light, and dark states.
- Standardized select arrow placement on the left in RTL.
- Standardized RTL menu items and technical LTR isolation.
- Added mobile 16px input text to prevent browser zoom.

### Page coverage

- Applied shared labels to all wrapped fields.
- Added direct outlined labels to POS scan, product search, pickup token, price tier, discount, customer search, and shift actual-cash fields.
- Moved receipt search hint into Material UI helper text.
- Verified every `TextField` is either wrapped by `Field` or has a direct `label`.

### Agent Pack

- Added `agent_pack/docs/FORM_INPUT_SYSTEM.md`.
- Updated PRD, design system, RTL rules, feature matrix, checklists, runner prompt, copied prompt, and status design rule.
- Marked the old external-label experiment as superseded in historical frontend reports.

## 3. Files changed

- `client/src/components/forms/Field.jsx`
- `client/src/theme/AppTheme.jsx`
- `client/src/styles/components.css`
- `client/src/styles/index.css`
- `client/src/pages/Login.jsx`
- `client/src/pages/POS.jsx`
- `client/src/pages/Customers.jsx`
- `client/src/pages/Receipts.jsx`
- `client/src/pages/ShiftSummary.jsx`
- `client/scripts/validate-ui.mjs`
- `agent_pack/docs/FORM_INPUT_SYSTEM.md`
- Related Agent Pack docs, prompts, checklists, reports, step 052, task board, and `status.json` design rule.

## 4. Verification

### Client gate

```bash
npm run check --prefix client
```

Result:

- Oxlint: **0 warnings, 0 errors**.
- Static UI validation: **52 passed, 0 failed**.
- Vite production build: **passed**.

### Field coverage

A Babel AST check confirmed:

```text
All TextFields are labeled directly or wrapped by Field.
```

### Server syntax safety

```bash
find server/src -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Result: **passed for all server JavaScript files**.

### Environment limitation

Installing server dependencies could not complete because `sqlite3` attempted to download a native prebuilt binary/Node headers and the environment returned DNS `EAI_AGAIN`. Therefore no new live server/API test is claimed by this report. The change set is frontend-only and server syntax remained unchanged/passing.

Automated Chromium screenshot capture was also unavailable in this environment, so the final release step must still perform live browser QA for focused/filled/select/date/error/disabled fields in both themes and all target viewports.

## 5. Remaining release gate

Step 052 remains pending and must perform final live browser regression, API regression, release cleanup, and handoff packaging. It must not revert to external labels or hide outlined legends.

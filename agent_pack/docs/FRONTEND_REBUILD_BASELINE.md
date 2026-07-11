# Frontend Rebuild Baseline

## Status

The previous A4 client was replaced by a clean React/Vite/MUI implementation in `client/`. This file defines the accepted implementation baseline for subsequent QA; it does not authorize another unbounded rewrite.

## Runtime decisions

- Arabic-only user interface.
- Fixed RTL root and MUI direction.
- No language switch or runtime English mode.
- `en.json` is storage only and is not imported.
- Light/dark theme with persisted preference.
- SQLite/Express backend contracts remain authoritative.

## Implemented structure

- App-level error boundary and route-level lazy loading.
- Auth guards for protected and Admin-only routes.
- Fixed top bar, right collapsible sidebar, right mobile drawer, grouped role navigation, active pill, and profile card.
- Reusable page header, fields, form sections, filter panels, drawers, confirmation dialogs, feedback states, metrics, status chips, and desktop/mobile data list.
- Dedicated POS, preorder, pickup, shift, report, receipt, audit, and printer workflows.
- External form labels and disabled outlined legends to prevent RTL notch defects.
- Printer-safe receipt styles and product-label workflow.

## Required pages

`Login`, `Dashboard`, `POS`, `Products`, `Categories`, `PriceTiers`, `Inventory`, `Preorders`, `Customers`, `Payments`, `ShiftSummary`, `Shifts`, `Users`, `Reports`, `Receipts`, `AuditLogs`, and `PrinterSettings`.

## Verification baseline

The local source baseline passes:

```bash
npm run lint --prefix client
npm run test:ui --prefix client
npm run build --prefix client
```

Final release still requires browser-based visual comparison, live backend/E2E tests, multi-viewport theme QA, and release cleanup as defined by Steps 049–052.

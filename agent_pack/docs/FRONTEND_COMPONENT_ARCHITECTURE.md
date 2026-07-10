# Frontend Component Architecture

## Target directories

```text
client/src/
  app/
    providers/
    router/
    guards/
  theme/
    createAppTheme.js
    tokens.js
    componentOverrides.js
  i18n/
    config.js
    locales/ar.json
    locales/en.json
  layouts/
    AppShell/
    AdminShell/
    CashierShell/
  components/
    navigation/
    feedback/
    data-display/
    forms/
    overlays/
    print/
  features/
    auth/
    dashboard/
    users/
    categories/
    price-tiers/
    products/
    inventory/
    customers/
    payments/
    pos/
    preorders/
    receipts/
    shifts/
    reports/
    audit-logs/
    printer-settings/
  hooks/
  api/
  utils/
  styles/
```

## Rules

- Pages compose feature components; they do not contain all business UI inline.
- API calls live in feature services/hooks.
- Shared components do not import page-specific API services.
- Visible text is supplied by translation keys.
- Theme tokens are not duplicated in page CSS.
- Business status mapping is centralized.
- Money formatting, date formatting, technical LTR values, and role checks are centralized.
- Print components are isolated from screen-only layout.

## Reusable component contracts

### `PageHeader`

Inputs: title key, description key, breadcrumbs, actions, status.

### `FilterPanel`

Inputs: fields, apply, reset, result count, collapsed state.

### `DataTable`

Inputs: columns, rows, loading, error, empty, pagination, row actions, mobile renderer.

### `EntityDrawer`

Inputs: title, open, onClose, content, primary action, secondary action, dirty state.

### `StatusChip`

Inputs: domain and status code. Translation, icon, and semantic color come from centralized status maps.

### `MoneyValue`

Inputs: minor-unit integer, currency, locale, emphasis.

### `TechnicalValue`

Inputs: value, copy capability, truncation behavior. Always isolated LTR.

### `PrintPreview`

Inputs: print template, paper preset, print action. Screen preview and print source must be identical.

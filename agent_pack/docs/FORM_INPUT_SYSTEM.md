# A4 RTL Notched Input System

## 1. Authority

This document is the final form-control contract for the active `client/` implementation. It supersedes the earlier external-label/no-notch experiment recorded in historical reports.

The runtime application is Arabic-only and fixed RTL. Material UI outlined fields must keep their native animated label and notch behavior, adapted correctly for RTL.

## 2. Required behavior

- Use the shared `client/src/components/forms/Field.jsx` wrapper for ordinary form fields.
- When `Field` receives a Material UI `TextField`, it injects the Arabic label, required state, error state, helper text, full width, compact size, and outlined variant.
- Empty text inputs show the label inside the field. On focus or when a value exists, the label animates into the top-right notch.
- Select, date, time, month, week, and datetime fields keep the label shrunk so displayed values never overlap the label.
- The notch opens from the RTL start edge (the right side) and must never be hidden, clipped, duplicated, or rendered on the left.
- Focus uses a two-pixel A4 primary border and a subtle A4 focus ring.
- Hover, focus, disabled, error, light-theme, and dark-theme states must all be visible and consistent.

## 3. Direction rules

- Arabic labels, values, placeholders, menus, helper text, and validation messages are RTL and right-aligned.
- SKU, barcode, phone, token, username, IDs, dates, and other technical values may opt into local LTR isolation using `dir="ltr"` or `.a4-ltr`.
- Local LTR isolation must not change the page, dialog, drawer, menu, or form direction.
- Select arrows stay on the left in RTL, while the selected value and menu items remain right-aligned.

## 4. Dimensions and responsiveness

- Default single-line control height is approximately 44px.
- Input padding is compact and consistent across pages.
- On phone widths, input text is at least 16px to avoid browser zoom and improve touch use.
- Long Arabic labels use one line and ellipsis where required; the field width must never overflow its grid cell.
- Two-column forms collapse to one column on small screens.
- Menus, dialogs, and drawers must remain inside the viewport.

## 5. Accessibility

- Every ordinary input has a real accessible Material UI label.
- Required fields use the Material UI required state and visible asterisk.
- Error text is connected through Material UI helper text semantics.
- Focus must remain visible in both themes.
- Do not use placeholder-only labeling.
- Respect `prefers-reduced-motion` for nonessential effects.

## 6. Prohibited regressions

- Do not hide `legend` inside `.MuiOutlinedInput-notchedOutline`.
- Do not set notch width to zero with `!important`.
- Do not render a second external label above a `TextField`.
- Do not place Arabic input text on the left unless the value is explicitly technical and locally isolated.
- Do not add a runtime language switch or LTR page mode.
- Do not introduce page-specific field CSS that conflicts with the shared theme without documenting the exception.

## 7. Verification

Run:

```bash
npm run lint --prefix client
npm run test:ui --prefix client
npm run build --prefix client
```

Browser QA must cover:

- empty, focused, filled, error, disabled, multiline, select, date, number, password, adornment, and LTR-isolated fields;
- light and dark themes;
- desktop, tablet, and phone widths;
- filters, drawers, dialogs, login, POS, products, inventory, reports, receipts, and shift closing.

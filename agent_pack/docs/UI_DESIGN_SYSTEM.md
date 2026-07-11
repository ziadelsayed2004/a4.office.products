# A4 Arabic RTL Frontend Design System

## 1. Design source and boundary

The reference client at `TEMPLETE-PROJECT/hamza.printing.press-main/client/` defines dashboard morphology only: compact density, fixed shell, grouped navigation, cards, filters, data tables, drawers, dialogs, and responsive behavior.

Do not copy its brand, business names, sample data, routes, permissions, APIs, or printing-press content. Use A4 blue/navy identity and the A4 PRD/server contracts.

## 2. Shell

| Element | Desktop | Small screen |
|---|---|---|
| Top bar | fixed, 64px | fixed, 58–64px |
| Sidebar | right, 282px expanded / 76px collapsed | temporary right drawer, max 292px / 86vw |
| Main content | offset by sidebar, max 1680px | no sidebar offset, 12–16px padding |
| Navigation | grouped, active pill, profile card | same content inside drawer |

The header must not compete with the page header. It shows brand, current route context, shift status, theme action, and account menu.

## 3. A4 visual tokens

- Primary: `#0f5fa6`.
- Primary dark: `#073d73`.
- Navy: `#072846`.
- Light background: `#f5f7fb`.
- Light paper: `#ffffff`.
- Dark background: `#0d1520`.
- Dark paper: `#14202e`.
- Borders are visible but quiet; shadows are reserved for overlays or interactive elevation.
- Default radius: 7–10px. Active navigation may use a pill radius.
- Typography: Cairo first, then system Arabic fallbacks.

## 4. Density and dimensions

- Base control height: about 40–44px.
- Buttons: minimum 40px desktop, 44px touch targets where practical.
- Table row padding: compact but readable.
- Page gaps: 13–18px.
- Page section padding: 14px mobile, 18px desktop.
- No oversized cards, decorative gradients, glass effects, or excessive animations.

## 5. Forms

- Use native Material UI floating labels with an animated outlined notch.
- The label animates from inside the control to a top-right RTL notch on focus/value.
- Select/date fields keep the label shrunk to prevent overlap.
- Use the shared `Field` wrapper and the rules in `FORM_INPUT_SYSTEM.md`.
- Shared `Field`, `FormSection`, `FilterPanel`, and `EntityDrawer` components.
- Two-column desktop forms; one column on phones.
- Consistent required indicator, hint, and error placement.
- Search, SKU, barcode, phone, and tokens receive direction isolation as needed.

## 6. Data presentation

- Desktop: compact table inside a designated horizontal-scroll container.
- Phone: record cards for non-comparison lists.
- Every list supports loading, empty, error, and permission states.
- Status uses text plus semantic color; color alone is never the only signal.
- Filters expose active count and clear/reset actions.

## 7. POS

- Scanner/search area receives immediate focus where safe.
- Desktop: catalog plus sticky cart.
- Tablet/phone: catalog and cart remain reachable without squeezed columns.
- Totals, checkout, preorder creation, and pickup confirmation are clear and guarded.
- The interface never bypasses server stock, price, shift, payment, or token validation.

## 8. Drawers and dialogs

- Entity forms use a right-side drawer in RTL.
- Phone drawers and long operational dialogs may become full-screen.
- Confirmation dialogs state the action and consequence in Arabic.
- Pickup dialog keeps customer, deposit, remaining amount, item stock, and final action visible.

## 9. Dark/light

Both themes cover every route, state, overlay, input, table, and navigation element. Theme choice persists. Print layouts always render as a controlled light physical document.

## 10. Motion and performance

- Use short 150–220ms transitions for shell, hover, and overlay states.
- Respect `prefers-reduced-motion`.
- Lazy-load route pages.
- Avoid duplicated CSS systems, heavy visual libraries, unnecessary rerenders, and inline style repetition.
- Optimize large lists with pagination before virtualization is considered.

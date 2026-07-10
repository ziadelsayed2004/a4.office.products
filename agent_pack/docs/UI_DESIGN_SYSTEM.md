# A4 Frontend Design System

## 1. Design contract

This design system is mandatory for every A4 frontend step. It is a branded adaptation of the embedded template at:

```text
TEMPLETE-PROJECT/hamza.printing.press-main/client/
```

The goal is template parity with A4 business content—not a new dashboard concept. The result must feel compact, fast, serious, and operational for a library cashier and administrator.

## 2. Core visual principles

1. **Compact operations first:** prioritize scanning, searching, tables, forms, money, stock, and shift actions.
2. **Flat Material surfaces:** use borders rather than decorative shadows.
3. **A4 identity:** navy and office blue replace template branding.
4. **Arabic-first:** Arabic RTL is the default, with complete English LTR translation support.
5. **Responsive by composition:** layouts adapt intentionally; they do not merely shrink.
6. **Shared primitives:** page-level styling may not create a second design system.
7. **State completeness:** loading, empty, error, disabled, permission, offline/server failure, and success states are designed.
8. **Printer independence:** thermal output uses a dedicated light print stylesheet independent of screen mode.

## 3. Technology baseline

- React + Vite.
- Material UI as the component foundation.
- Emotion cache for RTL/LTR.
- CSS variables for semantic tokens synchronized with the MUI theme.
- Cairo for Arabic; Inter/Roboto/Segoe UI fallback for Latin text.
- Material icons or one consistent icon family.
- No additional dashboard kit.
- No glassmorphism, gradients used as decoration, oversized marketing sections, or page-specific theme frameworks.

## 4. Brand tokens

### Light mode

| Token | Value | Usage |
|---|---:|---|
| `brand.navy` | `#001C3D` | logo emphasis, premium headings, selected dark accents |
| `brand.blue` | `#0F5FA6` | primary buttons, links, selected navigation, focus |
| `brand.blueHover` | `#084A82` | primary hover/pressed |
| `brand.blueSoft` | `rgba(15,95,166,.10)` | selected and soft information state |
| `bg.canvas` | `#F8FAFC` | application background |
| `bg.surface` | `#FFFFFF` | cards, app bar, sidebar, dialogs |
| `bg.subtle` | `#F1F5F9` | secondary panels, profile card, table hover |
| `text.primary` | `#111827` | main text |
| `text.secondary` | `#64748B` | descriptions and metadata |
| `border.default` | `#E5E7EB` | standard border |
| `border.strong` | `#CBD5E1` | emphasized boundary |

### Dark mode

| Token | Value | Usage |
|---|---:|---|
| `brand.blue` | `#60A5FA` | primary action and active state |
| `brand.blueHover` | `#93C5FD` | primary hover |
| `brand.blueSoft` | `rgba(96,165,250,.14)` | selected state |
| `bg.canvas` | `#0F172A` | application background |
| `bg.surface` | `#1E293B` | cards, app bar, sidebar, dialogs |
| `bg.subtle` | `#263449` | secondary surfaces |
| `text.primary` | `#F8FAFC` | main text |
| `text.secondary` | `#A7B3C4` | descriptions and metadata |
| `border.default` | `#334155` | standard border |
| `border.strong` | `#475569` | emphasized boundary |

### Semantic colors

| Semantic token | Light | Dark |
|---|---:|---:|
| `success` | `#188038` | `#5BB974` |
| `warning` | `#F29900` | `#F6B94A` |
| `danger` | `#D93025` | `#F28B82` |
| `info` | `#0F5FA6` | `#60A5FA` |

Do not introduce purple or unrelated legacy colors.

## 5. Dimensions and layout tokens

| Token | Target |
|---|---:|
| top bar height | `64px` |
| desktop sidebar expanded | `270px` |
| desktop sidebar collapsed | `72px` |
| mobile drawer | `270px` |
| content max width | `1440px` by default; POS may use full available width |
| desktop page padding | `24px` |
| tablet page padding | `16–20px` |
| phone page padding | `12–16px` |
| base spacing unit | `4px` |
| common control height | `40px` |
| compact control height | `32–36px` |
| sidebar item min height | `44px` |

Use logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline`) to support both directions.

## 6. Radius, border, and elevation

- Standard buttons, inputs, cards, papers, and panels: `4px` radius.
- Compact alerts/chips: `4–8px` as appropriate.
- Login card: up to `16px`.
- Logo container: `12px`.
- Sidebar items/profile: pill radius (`999px` or Material `100`).
- Default surface border: `1px solid border.default`.
- Cards use no shadow.
- Menus, popovers, drawers, dialogs, and login may use controlled overlay shadows only.
- No double borders and no decorative glow.

## 7. Typography

- Arabic UI font: `Cairo`.
- Latin fallback: `Inter`, `Roboto`, `Segoe UI`, sans-serif.
- Body text: approximately `13–14px` in operational screens.
- Secondary metadata: approximately `11–12px` where accessible.
- Page title: approximately `20–24px`, weight `700`.
- Section title: approximately `15–18px`, weight `600–700`.
- KPI value: approximately `24–32px` depending on density.
- Buttons: weight `600`, no forced uppercase.
- Arabic line-height must remain comfortable (`1.6–1.8`) without enlarging dense controls.
- Numeric values may use Latin digits where operational clarity requires it.

## 8. Authenticated shell

### Top bar

The top bar is present on desktop and mobile authenticated screens:

- current page title,
- mobile menu button when the permanent sidebar is hidden,
- theme toggle,
- operational notifications with unread badge,
- account avatar/menu,
- optional language switch where English is enabled.

A4 operational notifications include low stock, ready preorders, overdue/open preorders, and shifts pending review. Notifications must respect RBAC.

### Sidebar

- A4 logo, title, and short subtitle.
- Profile/account card with user name and role.
- Group headings.
- Navigation items with icon and translated label.
- Active item as an A4 blue soft pill.
- Collapsed mode keeps icons and tooltips.
- Desktop collapse control at the bottom.
- Shift status/action is visible to Cashier without exposing global revenue.
- Right-side in Arabic, left-side in English.

Suggested groups:

- الرئيسية
- نقطة البيع
- الكتالوج والمخزون
- الحجوزات والعملاء
- العمليات المالية
- الشيفتات
- التقارير والإدارة
- الإعدادات

The actual visible items are filtered by role and permission.

### Content frame

- Breadcrumbs.
- Shared page header.
- Optional filter/action bar.
- Main content surface(s).
- A4-only footer/legal line.
- No CodzHub or printing-press identity.

## 9. Shared page header

Every page uses one component with:

- translated title,
- optional description,
- breadcrumbs,
- optional status/context chip,
- primary action,
- secondary actions,
- responsive stacking below `600px`.

Do not duplicate page title bars in individual pages.

## 10. Cards and KPI blocks

- Flat bordered card.
- Compact padding (`16–20px`).
- Label, value, icon, optional trend/status, optional secondary metric.
- Icon background uses a semantic soft color.
- Entire card is clickable only when it has a clear destination and keyboard behavior.
- Values must not wrap unpredictably.
- Skeleton loading must preserve card dimensions.

## 11. Tables and mobile records

Desktop/tablet table contract:

- compact row height,
- sticky header when the container scrolls,
- clear column hierarchy,
- status chips,
- compact row action menu,
- selected/hover state,
- pagination and total count,
- loading skeleton,
- empty and error states.

Mobile contract:

- important tables convert to record cards where horizontal comparison is not essential,
- otherwise horizontal scroll is confined to a labeled table container,
- primary identity and main action remain visible,
- long SKU/token/phone values are direction-isolated,
- destructive actions are never exposed as accidental single taps.

## 12. Filters

- Shared bordered filter panel.
- One-column on phones, two-column on small tablets, three/four columns on desktop.
- Search field is prominent.
- Apply/reset actions stay visible.
- Filters may collapse on phones but active-filter count remains visible.
- Export uses the same applied filter snapshot.

## 13. Forms, drawers, and dialogs

### Form sections

- translated heading and optional helper text,
- shared `FieldGrid`,
- clear required markers,
- inline validation,
- money and phone inputs direction-isolated,
- sticky save/cancel actions for long forms.

### Entity drawers

- Use the template side-drawer structure.
- Open from the logical end side: right in Arabic and left in English.
- Header, scrollable body, sticky footer.
- Small/medium/large width variants.
- Full-screen below `600px`.

### Dialogs

- Use for confirmation, payment, pickup, and short decisions.
- Confirm dialog includes risk wording and safe button order.
- Payment and preorder-pickup dialogs become full-screen on phones.
- Do not nest uncontrolled dialogs.

## 14. Dashboard specification

The admin dashboard must follow the template hierarchy:

1. welcome/operational header with Cairo date,
2. KPI cards,
3. sales and payment summary,
4. inventory and preorder snapshot,
5. quick actions,
6. recent sales/preorders/shift requests,
7. alerts,
8. top products and concise trend visualization.

All charts must have text summaries, accessible labels, theme-safe colors, empty states, and responsive sizing.

The cashier home/POS must not expose admin KPI data.

## 15. POS workspace

### Desktop

- primary search/scan input receives focus quickly,
- product results without images,
- category/availability/price-tier context,
- cart panel with sticky totals/actions,
- stock validation beside quantity,
- clear separation between direct sale and preorder,
- keyboard shortcuts documented and non-conflicting,
- scanner input works without requiring mouse focus recovery after each item.

### Tablet

- split layout where width permits,
- otherwise controlled tabs/panels between products and cart,
- persistent cart count and total.

### Phone

- scan/search-first page,
- results as compact rows/cards,
- persistent bottom cart summary,
- cart as full-screen panel or bottom sheet,
- payment full-screen,
- touch targets at least `44px` for primary actions.

## 16. Light/dark rules

- Theme toggle is always reachable, including login.
- Persist explicit user choice.
- Use system preference only before the first explicit choice.
- Apply mode before render to avoid flash.
- No hard-coded white/black page surfaces.
- Status colors remain readable in both modes.
- Print output always uses a light, black-on-white printer stylesheet.

## 17. Localization rules

- Arabic default and complete.
- English optional but complete.
- Same keys in `ar.json` and `en.json`.
- No visible hard-coded labels in JSX.
- No key name shown to users as fallback in production.
- Correct pluralization and interpolation where needed.
- Route labels, validation, table columns, receipts, dialogs, notifications, and errors are translated.
- `dir` and logical alignment change with locale.
- Technical values use direction isolation.

## 18. Accessibility and interaction

- Visible keyboard focus.
- All icon-only buttons have translated accessible labels/tooltips.
- Dialog focus is trapped and restored.
- Scanner workflow does not remove keyboard accessibility.
- Color is not the only status signal.
- Errors are associated with fields.
- Minimum touch target near `44px` for primary mobile controls.
- Reduced-motion preference is respected.

## 19. Prohibited implementation

- unrelated admin templates,
- CodzHub or printing-press assets/text,
- purple legacy accents,
- product images,
- desktop-only tables without mobile handling,
- hard-coded Arabic strings,
- incomplete English keys,
- new page-level token systems,
- large repeated inline `sx` objects,
- shadows on every card,
- decorative gradients/glass effects,
- business-rule changes made only in the frontend.

# A4 Office Products — Complete Frontend System Design


---

<!-- Source: FRONTEND_TEMPLATE_AUDIT.md -->

# A4 Frontend Template Audit and Parity Contract

## 1. Purpose

This document locks the exact frontend reference for the A4 Office Products POS Platform. Frontend work must not invent a different dashboard. It must reproduce the structure, density, interaction language, responsive behavior, and reusable patterns of the embedded printing-press template, then replace its branding and business content with A4 POS requirements.

## 2. Authoritative visual source

The mandatory visual reference is:

```text
TEMPLETE-PROJECT/hamza.printing.press-main/client/
```

The implementation target is:

```text
client/
```

Before every frontend step, the agent must inspect the relevant files in both locations. The template is the visual source of truth; the A4 PRD, Feature Matrix, Business Rules, RBAC matrix, and API map are the functional source of truth.

### Mandatory reference files

```text
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/theme/ThemeConfig.jsx
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/styles/variables.css
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/styles/MainLayout.css
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/layouts/MainLayout.jsx
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/pages/Dashboard.jsx
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/styles/Dashboard.css
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/pages/Login.jsx
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/styles/Login.css
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/components/
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/locales/
TEMPLETE-PROJECT/hamza.printing.press-main/client/src/styles/
```

## 3. What must be copied from the template

Copy the design language and interaction model, not the printing-press domain.

### Application shell

- Fixed top application bar with a height of `64px` on authenticated screens.
- Permanent desktop sidebar with approximately `270px` expanded width and `72px` collapsed width.
- Temporary mobile drawer with approximately `270px` width.
- Sidebar positioned on the right in Arabic RTL and on the left in English LTR.
- Smooth width and content-offset transitions when the sidebar collapses.
- Sidebar header with logo, product title, and short subtitle.
- Profile/account card inside the sidebar.
- Navigation grouped under small section headings.
- Active navigation item displayed as a rounded pill.
- Tooltips for navigation icons in collapsed mode.
- Desktop collapse/expand control at the bottom of the sidebar.
- Top bar containing page title, theme control, notifications, and account menu.
- Breadcrumbs before page content.
- Compact footer area using A4 identity only.

### Surface and density language

- Google Workspace / Cloud Console-inspired Material structure.
- Flat cards and panels with `1px` borders.
- No decorative card shadows; shadows are reserved for overlays, menus, and login emphasis.
- Compact controls, dense tables, short action bars, and controlled whitespace.
- Base control/card radius near `4px`.
- Larger radius only for special elements such as login card, logo box, alerts, or pills.
- Sidebar active item and profile card use a full pill radius.
- Small, readable typography suitable for a cashier and administration system.

### Reusable component patterns

The template already demonstrates the patterns that A4 must standardize:

- `Breadcrumbs`
- `ConfirmDialog`
- `EmptyState`
- `LoadingState`
- `ErrorBoundary`
- `EntityDrawer`
- `FieldGrid`
- `FormSection`
- `FormActions`
- dense tables and status chips
- page-specific filters
- dashboard KPI cards
- recent-activity lists
- quick-action grids
- responsive form layouts

These patterns must be adapted into shared A4 components instead of being reimplemented differently on every page.

## 4. Template dashboard anatomy

The reference dashboard uses a complete operational hierarchy. The A4 dashboard must preserve this hierarchy while changing the data:

1. Welcome/summary header with Cairo date and operational context.
2. Main KPI grid.
3. Financial or payment snapshot panels.
4. Inventory and operational snapshot panels.
5. Quick-action cards.
6. Recent activity lists.
7. Warnings/notifications.
8. Tables or concise lists for high-priority records.

For A4, the content becomes:

- direct sales,
- preorder deposits,
- remaining preorder payments,
- open/ready preorders,
- low-stock products,
- active and pending-review shifts,
- totals by payment method,
- top-selling and most-preordered products,
- recent sales, preorders, stock changes, and shift submissions.

## 5. Template login anatomy

The reference login is a centered, bordered card with:

- product logo,
- title and subtitle,
- username and password,
- validation/error alert,
- loading state,
- primary submit action,
- compact footer identity.

A4 must retain this clean structure, use the A4 logo and colors, support light/dark modes before login, and remain responsive with reduced phone padding.

## 6. Theme behavior found in the template

The template provides:

- Material UI theme configuration,
- Emotion RTL cache,
- localStorage theme persistence,
- system-preference fallback,
- CSS variables synchronized with light/dark modes,
- component overrides for buttons, inputs, cards, app bar, drawer, dialogs, tables, and chips,
- Cairo/Inter/Roboto font fallback.

A4 must keep this architecture and replace the reference blue with A4 blue/navy tokens. Theme selection must be applied before first paint to avoid flashing the wrong mode.

## 7. Translation and direction behavior

The reference includes `ar.json`, `en.json`, and a translation helper, but the A4 implementation must complete the architecture:

- Arabic is the default and fully supported release language.
- English is a complete optional translation, not a partial fallback.
- Every visible string must come from locale files.
- `document.lang` and `document.dir` must update with the active locale.
- Layout direction, drawer side, sidebar side, breadcrumbs, icons, and alignment must follow the locale.
- Phone numbers, SKU values, monetary codes, tokens, URLs, dates when needed, and technical identifiers must be isolated with `dir="ltr"` or equivalent styling.
- Arabic text must use stable phrasing such as `رمز QR` so mixed-direction text never breaks the line.

## 8. Responsive behavior to reproduce

The template changes from a permanent desktop shell to a temporary drawer at smaller widths. A4 must preserve this behavior and add page-specific adaptation.

Required shell behavior:

- `md` and above: permanent collapsible sidebar plus fixed top bar.
- below `md`: top bar with menu button and temporary right-side drawer in Arabic.
- content offset must always match the current sidebar width.
- no page-level shell duplication.
- no unintended body horizontal scroll.

Required operational behavior:

- Dashboard cards reflow without compressed unreadable content.
- Tables stay inside controlled scroll containers or become mobile record cards.
- Drawers and payment/pickup dialogs become full-screen on phones.
- POS uses a dedicated tablet/mobile composition rather than blindly stacking the desktop grid.
- Sticky actions remain reachable above mobile browser chrome.

## 9. A4 adaptation rules

### Preserve

- shell proportions,
- compact Material density,
- top bar composition,
- grouped sidebar,
- active navigation pill,
- profile area,
- breadcrumbs,
- flat bordered surfaces,
- reusable state components,
- dashboard composition,
- responsive layout model,
- light/dark interaction pattern.

### Replace

- CodzHub logo and footer branding,
- printing-press/book-distribution business wording,
- authors, outlets, shipping, and other irrelevant domain routes,
- reference permissions and API assumptions,
- reference blue palette where it conflicts with A4 brand colors,
- hard-coded Arabic strings,
- partial translation helper behavior,
- legacy or unused CSS.

### Never copy

- CodzHub assets or trademark text,
- printing-press sample data,
- obsolete business models,
- reference API endpoints,
- reference RBAC rules,
- page-specific hard-coded colors or duplicated layout hacks.

## 10. Current A4 implementation gaps

The current `client/` has an A4 palette and an initial shell, but it does not yet match the full template contract. Key gaps include:

- desktop top bar is not consistently available,
- sidebar collapse mode is incomplete,
- grouped navigation and profile treatment are simplified,
- notifications/account menu parity is incomplete,
- breadcrumbs and headers contain hard-coded strings,
- full Arabic/English locale switching is incomplete,
- reusable template components are not fully adopted,
- responsive page behavior is inconsistent,
- several pages still rely on large inline `sx` blocks,
- complete dashboard hierarchy and page-state parity are not guaranteed,
- visual regression evidence is not yet recorded.

## 11. Completion standard

A frontend route is complete only when it:

- visually belongs to the embedded template family,
- uses A4 colors and identity,
- uses shared tokens and components,
- works in light and dark modes,
- works in Arabic RTL and English LTR,
- passes the required viewport matrix,
- includes loading, empty, error, disabled, and permission states,
- supports keyboard and scanner workflows where applicable,
- contains no printing-press or CodzHub remnants,
- does not change A4 business rules or API contracts silently.


---

<!-- Source: UI_DESIGN_SYSTEM.md -->

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


---

<!-- Source: RESPONSIVE_DESIGN_MATRIX.md -->

# A4 Responsive Design Matrix

## 1. Breakpoints and shell

| Breakpoint | Width | Shell | Content padding | Overlay behavior |
|---|---:|---|---:|---|
| `xs` | `0–599px` | fixed 64px top bar + temporary right drawer in Arabic | `12–16px` | drawers/payment/pickup become full-screen |
| `sm` | `600–899px` | fixed 64px top bar + temporary drawer | `16px` | wide dialogs capped, long entity drawers may remain full-screen |
| `md` | `900–1199px` | fixed top bar + permanent collapsible sidebar | `20–24px` | sized overlays |
| `lg` | `1200–1535px` | full desktop shell | `24px` | sized overlays; full POS split |
| `xl` | `1536px+` | full desktop shell | `24px`, max content `1440px` except POS | sized overlays |

Shell dimensions follow the reference template:

- top bar: `64px`,
- expanded sidebar: `270px`,
- collapsed sidebar: `72px`,
- mobile drawer: `270px`.

## 2. Required viewport QA

Every major route must be checked at:

- `360×800`
- `390×844`
- `768×1024`
- `1024×768`
- `1366×768`
- `1440×900`
- `1920×1080`

Also check browser zoom at `125%` on a desktop viewport and long Arabic/English labels.

## 3. Universal rules

- No unintended horizontal body scroll.
- Sidebar/top-bar offsets must match expanded/collapsed state.
- Main content must not render behind the top bar.
- Long Arabic labels wrap without overlapping controls.
- Technical values are direction-isolated.
- Action bars wrap or stack instead of clipping.
- Sticky actions account for safe areas and mobile browser chrome.
- All important actions remain reachable without precision tapping.

## 4. Dashboard

| Width | KPI layout | Secondary panels | Quick actions/activity |
|---|---|---|---|
| phone | 1 column, or 2 only for very short metrics | stacked | 2-column quick actions; activity list stacked |
| tablet portrait | 2 columns | stacked or 2 columns | 2–3 columns |
| tablet landscape | 3 columns | 2 columns | 3 columns |
| desktop | 4–5 columns | 2–3 columns | 4–5 columns |

Charts must resize without text clipping and provide a text summary.

## 5. POS

### Desktop (`lg+`)

- products/search workspace and sticky cart shown together,
- cart width remains usable and does not compress product results,
- totals and checkout actions stay visible,
- scanner input focus is preserved.

### Tablet (`sm–md`)

- use a controlled split when possible,
- otherwise use tabs/panels with persistent cart count and total,
- no narrow desktop cart squeezed beside unusable results.

### Phone (`xs`)

- scan/search/results first,
- cart opens as full-screen panel or bottom sheet,
- persistent cart total/action button,
- payment and preorder confirmation full-screen,
- primary touch actions at least `44px`.

## 6. CRUD and operational lists

- Page header actions stack below `600px`.
- Filter grid: 1 / 2 / 3–4 fields by width.
- Desktop tables use compact rows.
- Mobile tables become record cards where comparison is not essential.
- Horizontal scrolling is allowed only inside a designated table container.
- Entity drawer becomes full-screen on phones.
- Sticky form actions remain visible.

## 7. Preorders and pickup

- Pickup dialog is full-screen below `600px`.
- Customer name/phone, deposit, remaining amount, and stock state remain visible without horizontal scrolling.
- Item stock status is shown per row/card.
- Final payment actions remain sticky.
- Scanner failure and invalid/used token states fit the phone layout.

## 8. Shifts

- Totals by payment method become cards on phones.
- Expected vs actual values remain visually paired.
- Difference status is text plus color.
- Cashier close action and admin approve/reject actions become sticky on small screens.

## 9. Reports

- Tabs are scrollable without overlapping the report.
- Filters collapse to an expandable panel on phones.
- Active-filter count remains visible.
- Chart and table alternatives are usable independently.
- Export action remains available and uses the active filter snapshot.

## 10. Receipts and print settings

- On-screen preview scales to the available viewport.
- Physical receipt/label dimensions do not change with screen breakpoints.
- Print preview controls wrap cleanly.
- Label count, width, height, gaps, and margins remain editable on phones.


---

<!-- Source: I18N_DIRECTION_RULES.md -->

# Internationalization and Direction Rules

## Product language policy

- Arabic is the default and complete release language.
- English may be enabled as a secondary locale.
- No user-facing text may be hard-coded in React components.
- No screen may display a translation key or accidental English fallback.

## Locale files

Required structure:

```text
client/src/locales/
  ar.json
  en.json
```

Both files must use identical nested keys. Arabic text is the source-of-truth product wording. English must be a faithful translation, not a different feature definition.

## Direction

- `ar` -> `rtl`
- `en` -> `ltr`
- Update the HTML `lang` and `dir` attributes.
- Update MUI theme direction.
- Update the Emotion cache safely when direction changes.
- Use CSS logical properties.

## Technical values

The following values remain LTR even in Arabic:

- phone numbers,
- SKU,
- barcodes,
- QR tokens,
- invoice/order IDs,
- URLs,
- dates when displayed in numeric ISO form.

Use an isolated `TechnicalValue` component rather than globally forcing form controls to LTR.

## Arabic wording rules

- Use `رمز QR` instead of starting a sentence with `QR`.
- Use `رقم SKU` or `رمز الصنف`.
- Use `الوردية` consistently; do not mix with `الشيفت` in final UI unless the business explicitly selects the colloquial term.
- Use one translation for deposit: `العربون` or `الدفعة المقدمة`; the locale glossary must choose one and apply it everywhere.
- Use one translation for receipt: `الإيصال`.

## Formatting

- Currency: EGP with Arabic label `ج.م` in Arabic locale.
- Timezone: `Africa/Cairo`.
- Use locale-aware number and date formatting.
- Money is formatted from integer minor units; never from floating-point storage.

## Verification

Every frontend step must search for newly introduced visible hard-coded strings and confirm locale parity.


---

<!-- Source: FRONTEND_COMPONENT_ARCHITECTURE.md -->

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


---

<!-- Source: PAGE_UI_SPECIFICATIONS.md -->

# A4 Frontend Page and Navigation Specifications

## 1. Role-aware navigation

### Cashier

- نقطة البيع
- إنشاء حجز مسبق
- استلام حجز
- الإيصالات
- الشيفت الحالي
- تسجيل الخروج

The cashier must not see global revenue, users, inventory management, reports, or another cashier's shift.

### Admin

- لوحة التحكم
- التصنيفات
- فئات الأسعار
- المنتجات
- المخزون
- العملاء
- الحجوزات
- المبيعات والإيصالات
- طرق الدفع
- الشيفتات
- التقارير والمؤشرات
- المستخدمون
- سجل العمليات
- إعدادات الطباعة والنشاط

## 2. Shared shell

Match the embedded template:

- fixed top bar,
- expanded/collapsed grouped sidebar,
- profile card,
- active pill navigation,
- theme/notification/account controls,
- locale-aware side and direction,
- breadcrumbs,
- shared page header,
- A4-only footer.

## 3. Login

- centered A4 card derived from the template login,
- A4 logo, title, subtitle,
- username/password and show-password control,
- validation, server error, loading,
- theme control before login,
- Arabic default and optional English switch,
- keyboard submit and correct autocomplete.

## 4. Admin dashboard

Preserve the template hierarchy:

- welcome/summary header with Cairo date,
- direct sales KPI,
- deposits KPI,
- remaining payments KPI,
- open/ready preorder KPI,
- low-stock KPI,
- pending-shift KPI,
- payment-method summary,
- stock/preorder operational snapshot,
- quick actions,
- recent sales/preorders/stock changes/shift submissions,
- top products and simple accessible trend visualization.

## 5. Cashier POS

- scanner-first product input,
- search by product name, SKU, category, and relevant book fields,
- product rows without images,
- price-tier selection subject to rules,
- quantity and stock validation,
- cart with totals and payment action,
- clear direct-sale and preorder paths,
- split-payment dialog,
- receipt print action,
- fast reset for the next customer,
- scanner and keyboard workflow preserved.

## 6. Categories and price tiers

- compact table/card list,
- active/inactive state,
- create/edit drawer,
- dependency warning before deactivate/delete,
- prices managed by Admin only.

## 7. Products

- no image fields or image columns,
- generic product fields,
- optional book fields: book type, grade, subject, teacher, publisher, edition year, term, educational classification,
- category and price-tier values,
- direct-sale/preorder eligibility,
- preorder deposit percentage and pickup method,
- current stock/open preorder counters,
- QR label generation/print action.

## 8. Inventory

- stock on hand,
- open preorder quantity,
- available-for-direct-sale state,
- low-stock status,
- adjustment drawer with reason,
- immutable ledger view,
- no adjustment that results in negative stock.

## 9. Customers and payment methods

- customer identity and preorder history,
- phone values displayed LTR,
- admin-managed active payment methods,
- cash/card/InstaPay/wallet/transfer semantics,
- no unsupported global financial data for Cashier.

## 10. Preorders

### Creation

- required customer name and phone,
- product quantities and price tier,
- deposit percentage/value,
- remaining amount,
- payment method,
- pickup method,
- expected date and notes where enabled,
- confirmation and Arabic reservation receipt with pickup token.

### Admin list

- status, customer, phone, product, date, cashier, deposit, remaining amount, stock readiness,
- list and detail states,
- authorized status actions only.

### Pickup

- scan token or authorized search,
- full customer/order identity,
- previous deposit and remaining amount,
- stock check per item,
- remaining payment collection,
- final confirmation,
- stock decrement and open-preorder decrement,
- final receipt and AuditLog.

## 11. Shifts

### Cashier shift

- start/open state,
- timeline/transactions,
- totals by payment method,
- expected cash and other method totals,
- actual amounts entry,
- difference preview,
- close-request confirmation.

### Admin review

- pending reviews first,
- cashier and shift times,
- expected/actual/difference by method,
- activity summary,
- approve/reject with note,
- no silent financial edits.

## 12. Receipts

- search by receipt/order/preorder number and token,
- preview and print,
- authorized reprint with reason,
- sale, reservation, and pickup receipt variants,
- Arabic thermal layout,
- screen theme does not affect print output.

## 13. Reports and KPIs

- sales,
- preorders,
- inventory,
- shifts,
- payment methods,
- products/categories/cashiers,
- filter panel,
- KPI summary,
- table/chart view,
- export using current filters,
- Admin only.

## 14. Users and audit logs

- user list, role, status, last login,
- create/edit/disable/reset password by Admin,
- cashier cannot edit own identity/password,
- audit search by date, actor, action, entity, shift,
- before/after details with sensitive data protection.

## 15. Printer and business settings

- receipt width and template settings,
- QR label width, height, rows/columns where applicable, count, gap, and margins,
- test print and preview,
- business identity on receipts,
- no device/terminal tracking model.


---

<!-- Source: FRONTEND_EXECUTION_PLAN.md -->

# Frontend Modernization Execution Plan

## Goal

Bring the existing A4 frontend to complete visual and responsive parity with the approved template language while preserving every POS, preorder, inventory, shift, report, and print rule.

## Execution policy

- New frontend phase starts at Step 061.
- A run executes one or two steps only, according to `RUN_STEP_COUNT`.
- When two steps are requested, the second step runs only after the first step passes its verification gate.
- Each step receives its own status update and report.
- No run may exceed two steps.

## Phase groups

### Foundation — 061–066

Audit, cleanup, token system, theme, localization, and shared shell.

### Shared UI — 067–071

Responsive shell, shared primitives, data states, forms, and overlay patterns.

### Page implementation — 072–088

Login, dashboard, POS, products, inventory, preorders, shifts, receipts, reports, users, and logs.

### Quality and completion — 089–090

Theme parity, accessibility/scanner UX, translation parity, responsive/visual QA.


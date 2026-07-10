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

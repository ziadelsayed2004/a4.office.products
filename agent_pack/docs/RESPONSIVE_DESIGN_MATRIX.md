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

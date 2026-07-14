<a id="top"></a>

# A4 Office Products POS Platform — Product Requirements Document

| Item                | Final decision                                            |
| ------------------- | --------------------------------------------------------- |
| Product             | A4 Office Products POS Platform                           |
| Business            | Single-branch bookstore and general retail POS            |
| Frontend            | React + Vite + Material UI                                |
| Backend             | Node.js + Express                                         |
| Database            | SQLite                                                    |
| Currency / timezone | EGP / Africa/Cairo                                        |
| Runtime interface   | Arabic only, fixed RTL                                    |
| Theme               | Light and dark                                            |
| Product images      | Not included                                              |
| POS terminal model  | Not included; operations belong to account + active shift |

## Contents

1. [Product summary](#summary)
2. [Scope](#scope)
3. [Runtime UI contract](#ui-contract)
4. [Roles and access](#roles)
5. [Products and pricing](#products)
6. [Inventory](#inventory)
7. [Normal sale](#sale)
8. [Preorders and pickup](#preorders)
9. [Payments and receipts](#payments)
10. [Shifts](#shifts)
11. [Reports and audit](#reports)
12. [Frontend pages](#pages)
13. [Responsive and accessibility rules](#responsive)
14. [Technical architecture](#architecture)
15. [Acceptance criteria](#acceptance)

---

<a id="summary"></a>

## 1. Product summary

A4 is a complete cashier and administration platform for one bookstore branch. It supports direct sales, preorders for unavailable stock, deposits, pickup by secure receipt token, stock control, product labels, thermal receipts, cashier shifts, reusable return-approval cards, atomic refunds, live administration, reports, and immutable audit records.

Products are generic retail items. Book fields are optional, so the same catalog can also contain office supplies and any other sellable product.

[Back to top](#top)

---

<a id="scope"></a>

## 2. Scope

### Included

- Admin dashboard and cashier POS.
- Admin and Cashier accounts.
- Categories, products, price tiers, and optional book metadata.
- SQLite inventory ledger with no negative stock.
- Direct sale with one or multiple payment methods.
- Preorder with required customer name, phone, deposit, and pickup token.
- Product QR/barcode labels, sale receipts, preorder receipts, and pickup receipts.
- Partial and repeated returns through invoice/item scanning and reusable Admin approval cards.
- Shift opening, own-shift summary, close request, and admin review.
- Live Admin overview, reports, CSV export, printer settings, and AuditLog.
- Arabic-only RTL user interface with light and dark themes.

### Excluded from the base release

- Multiple branches.
- Product images.
- Customer e-commerce website or mobile app.
- POS terminal/device tracking.
- Runtime English interface or language switch.
- Selling outside the platform or allowing stock below zero.

[Back to top](#top)

---

<a id="ui-contract"></a>

## 3. Runtime UI contract

- The application starts and remains in Arabic with `lang="ar"` and `dir="rtl"`.
- There is no language menu, locale switch, English route, or LTR runtime mode.
- `client/src/locales/en.json` may remain as an unused future translation store only. Runtime translation code loads `ar.json` only.
- All menus, labels, tables, filters, forms, dialogs, validation messages, reports, receipts, and print templates are Arabic.
- Technical values such as SKU, barcode, phone number, token, and IDs may be direction-isolated with a dedicated LTR utility class.
- Forms use native MUI outlined labels that animate into an RTL-safe notch at the top-right, with no manual label transforms.
- Light/dark is the only user-facing display switch.
- The visual system follows the compact structure of the embedded reference template while using A4 branding and business content only.

[Back to top](#top)

---

<a id="roles"></a>

## 4. Roles and access

### Admin

Admin manages users and sessions, products, categories, price tiers, inventory, preorders, payments, shifts, return-approval cards, return review, reports, printers, live global KPIs, and audit logs. Admin approves or rejects shift closing requests and may perform an audited emergency shift close with a required reason.

Admin may view every invoice and print its receipt/PDF without a shift. Such printing is an explicit audited override with no shift association. Admin does not execute financial returns from Cashier POS.

### Cashier

Cashier can use POS, create preorders, complete pickup, view permitted invoices, print permitted receipts, execute approved returns, and view/close their own shift. Cashier cannot see global revenue, other cashiers' financial details, catalog administration, inventory administration, users, global reports, return-card administration, product-label printing, or shift approval.

Invoice viewing is not a financial shift operation: a Cashier may view all of their invoices without an open shift and may locate another Cashier's invoice only through an exact QR, invoice-number, or receipt-number lookup. Receipt printing, invoice PDF download, and return execution require an `OPEN` shift owned by the authenticated Cashier. A Cashier may return a sale created by another Cashier or shift; the refund belongs to the executing Cashier's open shift.

A cashier cannot change their own name, password, role, or permissions. These actions are Admin-only.

[Back to top](#top)

---

<a id="products"></a>

## 5. Products and pricing

Each product includes:

- Name, SKU/internal code, category, active status, and optional description.
- Product QR/barcode token that never embeds price or stock.
- Normal-sale eligibility and preorder eligibility.
- Default preorder deposit percentage and pickup method.
- Minimum-stock alert level and optional purchase cost.
- Prices for every enabled Admin-defined price tier, such as retail or wholesale.

Optional book metadata includes book type, grade, subject, teacher, publisher, publication year, term, and educational classification. The base product model has no image field.

Admin-only product labels use a unique CODE128-compatible barcode, defaulting to SKU. After product creation, the UI offers immediate label printing with editable count and dimensions; reprinting remains available from the product list.

[Back to top](#top)

---

<a id="inventory"></a>

## 6. Inventory

- `stockOnHand` is the physical available quantity.
- `openPreorderQuantity` is the total quantity in active preorders.
- Direct sale decrements stock immediately.
- Preorder creation increases open preorder counters but does not decrement stock.
- Pickup decrements physical stock and reduces the open preorder counter.
- Checkout or pickup is rejected when physical stock is insufficient.
- Every stock mutation creates an inventory-ledger record and AuditLog entry.

[Back to top](#top)

---

<a id="sale"></a>

## 7. Normal sale

1. Cashier signs in and opens/resumes an active shift.
2. Products are added through product scan or search.
3. Cashier selects quantity and allowed price tier.
4. Server validates current stock and prices.
5. Cashier chooses one or more payment methods.
6. Server creates the sale, payments, receipt, stock movements, and audit records atomically.
7. The Arabic thermal receipt is displayed and can be printed.

A normal sale is fully paid before finalization.

[Back to top](#top)

---

<a id="preorders"></a>

## 8. Preorders and pickup

Preorders are used when a product or requested quantity is unavailable.

### Creation

- Customer name and phone are mandatory.
- Items, quantities, price snapshot, total, deposit, remaining amount, payment method, pickup method, and notes are recorded.
- Deposit must satisfy the product/business rule.
- Creation increases open preorder counters and prints a receipt with a secure pickup token.
- Physical stock is not decremented.

### Pickup

1. Cashier scans or enters the secure token.
2. A dedicated pickup dialog shows customer, items, deposit, remaining amount, and stock state.
3. Server validates token status, active shift, stock, and final payment.
4. Remaining amount is collected.
5. Stock and open-preorder counters are updated atomically.
6. Preorder becomes picked up and a final Arabic receipt is printed.
7. Payment, stock, print, and pickup events are written to AuditLog.

[Back to top](#top)

---

<a id="payments"></a>

## 9. Payments and receipts

Admin manages available payment methods. Split payments are supported when the sum equals the required amount.

Required print outputs:

- Direct sale receipt.
- Preorder deposit receipt with customer name, phone, paid amount, remaining amount, and pickup token.
- Final pickup receipt with previous deposit and final payment.
- Product QR/barcode labels with configurable print count and dimensions.
- Return receipt and reusable return-approval card.

Screen theme never changes physical print colors or dimensions. Every print/reprint is audited. A Cashier needs their own `OPEN` shift to print a receipt or download an invoice PDF. Admin may print without a shift through an audited override.

### Returns

1. Cashier scans the invoice QR or enters the exact invoice/receipt number.
2. Cashier scans returned product barcode/SKU values. Each scan increments one unit; foreign items and quantities above the returnable remainder are rejected. If one code matches repeated invoice lines at different prices, the line is selected explicitly.
3. Cashier selects `RESTOCK` by default or `NO_RESTOCK` with a required reason, then reviews the refund quote and payment allocation.
4. Cashier scans a reusable Admin approval card as the final authorization step.
5. Server revalidates the Cashier's own `OPEN` shift, invoice quantities, card signature/state/version and active Admin owner, payment references and cash availability. It then writes the return, payments, inventory movements, receipt, invoice state, card snapshot/use record, and AuditLog atomically.

The same active card can authorize multiple returns until Admin disables it or rotates its QR. A disabled, stale-version, forged, or inactive-owner card is rejected. Legacy one-time authorization tables remain read-only historical records and do not participate in new return execution.

The approval card is a horizontal ID-1 card (`85.6×54mm`) with A4 branding, card identity, owner Admin, QR, and an administrative-use warning. It contains no customer data or raw token and supports an A4 cut-mark sheet or direct card-size printing.

[Back to top](#top)

---

<a id="shifts"></a>

## 10. Shifts

- No Cashier financial mutation, receipt/PDF printing, or return execution is allowed without an `OPEN` shift owned by that Cashier. Invoice viewing and exact invoice lookup remain available without a shift.
- One cashier may have only one active shift at a time; multiple cashiers may have separate active shifts.
- All sales, deposits, pickup payments, refunds, and cash movements are tied to the authenticated account and shift.
- Cashier sees expected totals by payment method and enters actual closing totals.
- Closing request becomes `PENDING_ADMIN_REVIEW`.
- Admin approves to `CLOSED` or rejects with a required note.
- «Working» means the account has an open shift. «Online now» is independent and is based on a visible-app heartbeat every 30 seconds with a 90-second online window.

[Back to top](#top)

---

<a id="reports"></a>

## 11. Reports and audit

Admin reports cover sales, returns, preorders, stock, payment methods, products, categories, cashiers, shifts, and differences. Filters and export use the same data snapshot.

The live Admin overview shows today's sales, returns, net sales, invoice count, average ticket, open shifts with payment totals and latest activity, recent sales/returns, and operational alerts. Authenticated SSE invalidation should update the view within two seconds. If SSE disconnects, the client polls every 15 seconds; it pauses while the tab is hidden and resynchronizes when visible.

Cashier sees only their current/own shift summary.

AuditLog records authentication, session revocation, user management, price changes, stock changes, sale/preorder/pickup/return, payments, card use/rotation/disablement, receipt print/reprint including Admin override, emergency shift close, shift review, and all sensitive administrative actions.

[Back to top](#top)

---

<a id="pages"></a>

## 12. Frontend pages

### Shared / Cashier

- Login.
- POS: direct sale, preorder creation, and preorder pickup.
- Return wizard: invoice QR/serial lookup, item scanning, quote, approval-card scan, execution, and return-receipt print.
- Current shift summary and close request.
- Invoice/receipt lookup and preview without a shift; permitted print, PDF, and reprint with an owned `OPEN` shift.

### Admin

- Dashboard.
- Products, Admin-only barcode labels, categories, price tiers, and inventory.
- Preorders, customers, and payment methods.
- Return history and reusable return-approval card management.
- Shift review, emergency close, user activity/session management, and online/open-shift state.
- Return-aware reports, AuditLog, and printer settings.

Every route must provide loading, empty, error, success, and permission states where applicable.

[Back to top](#top)

---

<a id="responsive"></a>

## 13. Responsive and accessibility rules

- Fixed top bar and right-side desktop navigation; right-side temporary drawer on small screens.
- Main content never renders under fixed navigation.
- No page-level horizontal overflow.
- Tables scroll only inside their container or convert to mobile record cards.
- Forms use animated outlined labels that move into an RTL-safe notch at the top-right, with consistent heights, clear focus states, and readable validation.
- POS uses a dedicated responsive layout; the cart and checkout remain reachable on every supported width.
- Dialogs and entity drawers become full-screen when needed on phones.
- Keyboard scanning, tab navigation, visible focus, semantic labels, and minimum touch targets are required.
- Test widths: 360, 390, 768, 1024, 1366, 1440, and 1920 pixels.

[Back to top](#top)

---

<a id="architecture"></a>

## 14. Technical architecture

```text
client/   React + Vite + MUI, Arabic RTL runtime
server/   Node.js + Express modules and validation
SQLite    relational schema, migrations, transactions, indexes
```

The frontend consumes server contracts; it must not duplicate financial or stock truth. Critical mutations are transactional on the server. API paths and code identifiers remain English technical identifiers.

Live updates use an authenticated Server-Sent Events stream as an invalidation channel, with HTTP reloads as the data source and 15-second polling as fallback. The production baseline is one PM2 process. Scaling to multiple application processes requires replacing the in-memory event transport with Redis/pub-sub without changing the client contract.

Canonical routes are used by new clients. Legacy receipt routes, `/qr-labels`, and `/return-authorizations` remain temporary aliases/redirects for compatibility and must not create separate business logic.

[Back to top](#top)

---

<a id="acceptance"></a>

## 15. Acceptance criteria

- Arabic-only RTL interface has no language switch and no LTR page mode.
- Both light and dark themes are complete and persisted.
- No floating-label notch defect or overlapping form label exists.
- Admin and Cashier permissions match the role matrix.
- Cashier invoice viewing works without a shift, while receipt/PDF printing and return execution fail with `OPEN_OWN_SHIFT_REQUIRED` unless that Cashier owns an `OPEN` shift.
- A Cashier can return another Cashier's invoice through exact QR/invoice/receipt lookup, and all refund records belong to the executing shift.
- Return scanning enforces remaining quantities, supports partial/repeated returns and inactive products, and commits payment, stock, receipt, card snapshot, and audit data atomically and idempotently.
- Reusable approval cards reject disabled, rotated, forged, or inactive-owner credentials and record every successful use.
- Normal sale cannot produce negative stock.
- Preorder requires customer name, phone, deposit, and secure token.
- Pickup validates token, stock, payment, and active shift before atomic completion.
- Receipts, Admin-only product labels, and the `85.6×54mm` approval card print in stable physical layouts after QR/images/fonts are ready.
- Shift close and Admin approval totals are correct by payment method.
- Live sales/returns/shift changes reach Admin through SSE within two seconds, with heartbeat and polling fallback behaving as specified.
- Reports and AuditLog cover all required operations, including Admin print overrides and before/after state.
- Client lint, UI validation, and production build pass.
- Final browser, responsive, dark/light, and live API QA evidence is recorded before release.

[Back to top](#top)

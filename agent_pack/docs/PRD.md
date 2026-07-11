<a id="top"></a>

# A4 Office Products POS Platform — Product Requirements Document

| Item | Final decision |
|---|---|
| Product | A4 Office Products POS Platform |
| Business | Single-branch bookstore and general retail POS |
| Frontend | React + Vite + Material UI |
| Backend | Node.js + Express |
| Database | SQLite |
| Currency / timezone | EGP / Africa/Cairo |
| Runtime interface | Arabic only, fixed RTL |
| Theme | Light and dark |
| Product images | Not included |
| POS terminal model | Not included; operations belong to account + active shift |

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
16. [Agent Pack execution](#agent)

---

<a id="summary"></a>
## 1. Product summary

A4 is a complete cashier and administration platform for one bookstore branch. It supports direct sales, preorders for unavailable stock, deposits, pickup by secure receipt token, stock control, product labels, thermal receipts, cashier shifts, admin approval, reports, and immutable audit records.

Products are generic retail items. Book fields are optional, so the same catalog can also contain office supplies and any other sellable product.

[↑ Back to top](#top)

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
- Shift opening, own-shift summary, close request, and admin review.
- Reports, CSV export, printer settings, and AuditLog.
- Arabic-only RTL user interface with light and dark themes.

### Excluded from the base release

- Multiple branches.
- Product images.
- Customer e-commerce website or mobile app.
- POS terminal/device tracking.
- Runtime English interface or language switch.
- Selling outside the platform or allowing stock below zero.

[↑ Back to top](#top)

---

<a id="ui-contract"></a>
## 3. Runtime UI contract

- The application starts and remains in Arabic with `lang="ar"` and `dir="rtl"`.
- There is no language menu, locale switch, English route, or LTR runtime mode.
- `client/src/locales/en.json` may remain as an unused future translation store only. Runtime translation code loads `ar.json` only.
- All menus, labels, tables, filters, forms, dialogs, validation messages, reports, receipts, and print templates are Arabic.
- Technical values such as SKU, barcode, phone number, token, and IDs may be direction-isolated with a dedicated LTR utility class.
- Form fields use animated Material UI outlined labels. Labels move into a top-right RTL notch on focus/value; select and date fields remain safely shrunk.
- Light/dark is the only user-facing display switch.
- The visual system follows the compact structure of the embedded reference template while using A4 branding and business content only.

[↑ Back to top](#top)

---

<a id="roles"></a>
## 4. Roles and access

### Admin

Admin manages users, products, categories, price tiers, inventory, preorders, payments, shifts, reports, printers, global KPIs, and audit logs. Admin approves or rejects shift closing requests.

### Cashier

Cashier can use POS, create preorders, complete pickup, print permitted receipts, and view/close their own shift. Cashier cannot see global revenue, other cashiers' financial details, catalog administration, inventory administration, users, global reports, or shift approval.

A cashier cannot change their own name, password, role, or permissions. These actions are Admin-only.

[↑ Back to top](#top)

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

[↑ Back to top](#top)

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

[↑ Back to top](#top)

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

[↑ Back to top](#top)

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

[↑ Back to top](#top)

---

<a id="payments"></a>
## 9. Payments and receipts

Admin manages available payment methods. Split payments are supported when the sum equals the required amount.

Required print outputs:

- Direct sale receipt.
- Preorder deposit receipt with customer name, phone, paid amount, remaining amount, and pickup token.
- Final pickup receipt with previous deposit and final payment.
- Product QR/barcode labels with configurable print count and dimensions.

Screen theme never changes physical print colors or dimensions. Every reprint is audited.

[↑ Back to top](#top)

---

<a id="shifts"></a>
## 10. Shifts

- No cashier financial operation is allowed without the cashier's active shift.
- One cashier may have only one active shift at a time; multiple cashiers may have separate active shifts.
- All sales, deposits, pickup payments, refunds, and cash movements are tied to the authenticated account and shift.
- Cashier sees expected totals by payment method and enters actual closing totals.
- Closing request becomes `PENDING_ADMIN_REVIEW`.
- Admin approves to `CLOSED` or rejects with a required note.

[↑ Back to top](#top)

---

<a id="reports"></a>
## 11. Reports and audit

Admin reports cover sales, preorders, stock, payment methods, products, categories, cashiers, shifts, and differences. Filters and export use the same data snapshot.

Cashier sees only their current/own shift summary.

AuditLog records authentication, user management, price changes, stock changes, sale/preorder/pickup, payments, receipt print/reprint, shift review, and all sensitive administrative actions.

[↑ Back to top](#top)

---

<a id="pages"></a>
## 12. Frontend pages

### Shared / Cashier

- Login.
- POS: direct sale, preorder creation, and preorder pickup.
- Current shift summary and close request.
- Receipt lookup, preview, print, and permitted reprint.

### Admin

- Dashboard.
- Products, categories, price tiers, and inventory.
- Preorders, customers, and payment methods.
- Shift review and user management.
- Reports, AuditLog, and printer settings.

Every route must provide loading, empty, error, success, and permission states where applicable.

[↑ Back to top](#top)

---

<a id="responsive"></a>
## 13. Responsive and accessibility rules

- Fixed top bar and right-side desktop navigation; right-side temporary drawer on small screens.
- Main content never renders under fixed navigation.
- No page-level horizontal overflow.
- Tables scroll only inside their container or convert to mobile record cards.
- Forms use animated RTL-safe outlined labels/notches, consistent control heights, clear focus states, and readable validation.
- POS uses a dedicated responsive layout; the cart and checkout remain reachable on every supported width.
- Dialogs and entity drawers become full-screen when needed on phones.
- Keyboard scanning, tab navigation, visible focus, semantic labels, and minimum touch targets are required.
- Test widths: 360, 390, 768, 1024, 1366, 1440, and 1920 pixels.

[↑ Back to top](#top)

---

<a id="architecture"></a>
## 14. Technical architecture

```text
client/   React + Vite + MUI, Arabic RTL runtime
server/   Node.js + Express modules and validation
SQLite    relational schema, migrations, transactions, indexes
agent_pack/ controlled implementation and QA steps
```

The frontend consumes server contracts; it must not duplicate financial or stock truth. Critical mutations are transactional on the server. API paths and code identifiers remain English technical identifiers.

[↑ Back to top](#top)

---

<a id="acceptance"></a>
## 15. Acceptance criteria

- Arabic-only RTL interface has no language switch and no LTR page mode.
- Both light and dark themes are complete and persisted.
- Animated RTL notches are aligned to the right with no clipped, duplicated, or overlapping label.
- Admin and Cashier permissions match the role matrix.
- Normal sale cannot produce negative stock.
- Preorder requires customer name, phone, deposit, and secure token.
- Pickup validates token, stock, payment, and active shift before atomic completion.
- Receipts and product labels print in stable physical layouts.
- Shift close and Admin approval totals are correct by payment method.
- Reports and AuditLog cover all required operations.
- Client lint, UI validation, and production build pass.
- Final browser, responsive, dark/light, and live API QA evidence is recorded before release.

[↑ Back to top](#top)

---

<a id="agent"></a>
## 16. Agent Pack execution

`agent_pack/status.json` is the execution graph. The runner executes one or two eligible steps per run according to `RUN_STEP_COUNT`, completes and verifies the first before starting the second, updates tracking, writes reports, and never starts a third step.

The embedded template is a visual reference only. The A4 PRD, server contracts, SQLite schema, and current `client/` remain authoritative.

[↑ Back to top](#top)

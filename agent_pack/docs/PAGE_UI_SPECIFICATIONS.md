# A4 Page UI Specifications — Arabic RTL

## Shared shell

All protected pages use the fixed A4 shell. Navigation visibility is role-based. The top bar contains A4 identity, page context, optional shift state, theme switch, and account menu. No language control exists.

## Login

- Compact A4 branded authentication panel.
- Arabic username/password labels above fields.
- Clear loading, invalid credentials, server error, and disabled account states.
- Theme-safe and usable at 320px width.

## Dashboard — Admin

- KPI cards for sales, deposits, pickups, active preorders, low stock, and shift review.
- Quick actions for POS, product, inventory, preorder, and shift workflows.
- Recent activities and operational alerts.
- No cashier-only user may access this route or data.

## POS — Cashier and Admin

- Modes: direct sale, preorder creation, preorder pickup.
- Scanner/search first, product results, price tier selection, quantities, and cart.
- Direct sale: stock guard, payment split, server-confirmed total, success/receipt state.
- Preorder: required customer name/phone, deposit validation, pickup method, receipt.
- Pickup: secure token scan/entry, detail dialog, stock validation, remaining payment, final receipt.
- Active shift gate before any financial workflow.

## Catalog administration

### Products

- Search/filter by name, SKU/barcode, category, status, stock state, and book/non-book type.
- Product table/card shows key price, actual stock, open preorder quantity, and status.
- Create/edit drawer uses clear sections: identity, classification, pricing, inventory rules, preorder settings, optional book metadata, QR labels.

### Categories and price tiers

- Compact list plus create/edit drawer.
- Prevent destructive changes that violate server rules.
- Price tiers are Admin-created and attached to product prices.

### Inventory

- Product balance, open preorder quantity, low-stock state, and ledger access.
- Stock adjustment requires reason and confirmation.
- No UI path can submit negative stock.

## Operational administration

### Preorders

- Filter by status, customer, phone, token/number, product, and date.
- Show deposit, remaining amount, readiness, stock state, creator, and shift.
- Admin status actions remain subject to API rules.

### Customers

- Reservation customer records and history; name/phone are primary.

### Payments

- Manage available methods and activation state.

### Shifts

- Expected vs actual totals per payment method.
- Difference indicators, cashier identity, open/close timestamps, and full transaction summary.
- Approve/reject with required note and confirmation.

### Users

- Admin creates, edits, disables, and resets passwords.
- Cashier cannot self-edit protected profile fields.

## Reports

- Tabs for sales, preorders, inventory, and shifts.
- Filter panel, KPI summary, table, and CSV export using the active filter snapshot.
- Reports are Admin-only.

## Receipts

- Search by receipt number.
- Preview, print, and authorized reprint with reason.
- Sale, preorder deposit, and pickup variants.
- Real QR token rendering and thermal print dimensions.

## AuditLog and printers

- Audit list filters action/entity/date and presents immutable details.
- Printer settings cover business header/footer, receipt width, default printer names, and label size.

## Required states

Each page must include relevant loading, empty, error, success, validation, disabled, permission-denied, and offline/server-unavailable states.

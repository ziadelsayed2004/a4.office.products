# Business Rules

## Product rules

- Product name: A4 Office Products POS Platform.
- Single branch only.
- Currency: EGP.
- Timezone: Africa/Cairo.
- Database: SQLite.
- App UI: Arabic RTL from start to finish.
- No product images in the base product model or UI.
- No POS device/terminal tracking.

## Roles

- Admin manages users, products, categories, price tiers, inventory, reports, KPIs, shifts, printer settings, and AuditLog.
- Cashier is restricted to POS, preorders, receipts, and own shift only.

## Shift rules

- No sale without active cashier shift.
- No preorder creation without active cashier shift.
- No preorder pickup without active cashier shift.
- Cashier can request close only for own shift.
- Admin approves or rejects closing.

## Inventory rules

- Inventory must never go below zero.
- Normal sale decrements stock immediately.
- Preorder creation does not decrement stock.
- Preorder pickup decrements stock after validation and remaining payment.

## Preorder rules

- Customer name and phone are required.
- Deposit is required.
- Preorder increases open preorder counters.
- Preorder receipt prints a pickup QR token.
- Pickup scans the token, opens dialog, collects remaining amount, decrements stock, prints final receipt, and writes AuditLog.

## Printing and audit rules

- Product QR tokens do not contain price or stock.
- Every print/reprint must write AuditLog.
- All money, stock, user-management, and admin-review actions must write AuditLog.

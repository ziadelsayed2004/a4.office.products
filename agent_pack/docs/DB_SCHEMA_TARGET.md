# SQLite Schema Target

## Database decision

A4 uses SQLite as the only database. Do not introduce MongoDB, Mongoose, Firebase/Firestore persistence, or another database/query layer.

## Required rules

- Enable `PRAGMA foreign_keys = ON`.
- Use migrations for schema changes.
- Store money as integer minor units, not floating point.
- Store timestamps consistently and display in Africa/Cairo.
- Add indexes for SKU, QR tokens, phone, status, shift, cashier, and date filters.

## Target tables

- `users`
- `sessions` or `refresh_tokens`
- `categories`
- `price_tiers`
- `products`
- `product_book_details`
- `product_prices`
- `qr_tokens`
- `inventory_ledger`
- `customers`
- `orders`
- `order_items`
- `preorders`
- `preorder_items`
- `payments`
- `receipts`
- `shifts`
- `cash_movements`
- `audit_logs`
- `business_settings`
- `printer_settings`

## Critical constraints

- Inventory must never go below zero.
- Product images are not part of the base schema.
- No device or terminal table is required.
- All financial and admin-review actions must write AuditLog.

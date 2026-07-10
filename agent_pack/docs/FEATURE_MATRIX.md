# Feature Matrix

| Area | Feature | Status | Mandatory rule |
|---|---|---|---|
| Stack | React + Vite frontend | Required | One frontend app. |
| Stack | Node.js + Express backend | Required | Modular API. |
| Stack | SQLite database | Required | No MongoDB, Mongoose, or Mongo query layer. |
| Language | Arabic-first UI | Required | Arabic is complete and default. |
| Translation | Locale-driven text | Required | No visible hard-coded strings; matching Arabic/English keys when English is enabled. |
| Direction | RTL/LTR compatibility | Required | Arabic RTL; English LTR; technical values isolated. |
| Theme | Light and dark modes | Required | Full page parity and persisted selection. |
| Responsive | Mobile, tablet, desktop | Required | Follow `RESPONSIVE_DESIGN_MATRIX.md`. |
| Visual identity | A4 template style | Required | Blue/navy, flat MUI surfaces, compact density; no purple remnants. |
| Branching | Single branch | Required | No multi-branch data model. |
| Auth | Admin/Cashier roles | Required | Strict RBAC. |
| Cashier | POS flow | Required | Needs active shift. |
| Sales | Normal sale | Required | Decrements stock immediately. |
| Inventory | No negative stock | Required | Checkout/pickup must validate stock. |
| Products | No product images | Required | No image field or product-image UI. |
| Products | Product QR labels | Required | Token has no price or stock. |
| Pricing | Price tiers | Required | Admin-managed. |
| Preorders | Deposit flow | Required | Customer name and phone required. |
| Preorders | Pickup by QR token | Required | Opens pickup dialog and validates stock/payment. |
| Receipts | Sale/preorder/pickup receipts | Required | Arabic thermal templates and authorized reprint. |
| Shifts | Open/close/review | Required | Cashier requests, Admin approves. |
| Reports | Admin KPIs and exports | Required | Cashier cannot view global totals. |
| Audit | AuditLog | Required | Financial/admin/print actions logged. |
| Accessibility | Keyboard and focus support | Required | POS scanner and all dialogs remain keyboard usable. |
| Print | Receipt and QR-label print | Required | Screen theme must not change physical print output. |

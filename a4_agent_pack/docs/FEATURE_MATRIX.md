# Feature Matrix

| Area | Feature | Status | Must-have rule |
|---|---|---|---|
| Stack | React + Vite frontend | Required | One frontend app. |
| Stack | Node.js + Express backend | Required | Modular API. |
| Stack | SQLite database | Required | No SQLite. |
| Language | Arabic RTL UI | Required | All user-facing UI and receipts are Arabic. |
| Branching | Single branch | Required | No multi-branch data model. |
| Auth | Admin/Cashier roles | Required | Strict RBAC. |
| Cashier | POS flow | Required | Needs active shift. |
| Sales | Normal sale | Required | Decrements stock immediately. |
| Inventory | No negative stock | Required | Checkout/pickup must validate stock. |
| Products | No product images | Required | No image field in base model/UI. |
| Products | Product QR labels | Required | Token has no price or stock. |
| Pricing | Price tiers | Required | Admin-managed. |
| Preorders | Deposit flow | Required | Customer name and phone required. |
| Preorders | Pickup by QR token | Required | Opens pickup dialog. |
| Receipts | Sale/preorder/pickup receipts | Required | Arabic printable templates. |
| Shifts | Open/close/review | Required | Cashier requests, Admin approves. |
| Reports | Admin KPIs and exports | Required | Cashier cannot view global totals. |
| Audit | AuditLog | Required | Financial/admin/print actions logged. |

# A4 Feature Matrix

Status values in this matrix describe the accepted implementation baseline. Final browser/E2E evidence is handled by Steps 049–052.

| Area | Required behavior | Role | Baseline |
|---|---|---|---|
| Authentication | Login, session refresh, logout, route guards | Both | implemented |
| Runtime language | Arabic only, fixed RTL, no language switch | Both | implemented |
| Future translation store | `en.json` retained but not runtime-loaded | Development | implemented |
| Theme | Complete persisted light/dark | Both | implemented |
| Dashboard | Global KPIs, alerts, quick actions | Admin | implemented |
| Users | Create/edit/disable/reset password | Admin | implemented |
| Cashier profile | No self-edit of name/password/role/permissions | Cashier | enforced by RBAC |
| Categories | Admin CRUD/activation | Admin | implemented |
| Price tiers | Admin-defined retail/wholesale/custom tiers | Admin | implemented |
| Products | Generic no-image product model and CRUD | Admin | implemented |
| Book metadata | Optional type/grade/subject/teacher/publisher/year/term/classification | Admin | implemented |
| Product labels | Secure QR/barcode value, configurable print count | Admin | implemented |
| Inventory | Physical balance and immutable ledger | Admin | implemented |
| Stock guard | Never below zero | Server | implemented |
| Open preorder counter | Per-product active preorder quantity | Admin | implemented |
| POS scan/search | Add product by token, SKU/barcode, or search | Cashier/Admin | implemented |
| Direct sale | Price/stock validation, payment, receipt, audit | Cashier/Admin with active shift | implemented |
| Split payment | Multiple methods summing to total | Cashier/Admin with active shift | implemented |
| Preorder creation | Customer name/phone, deposit, pickup token, no stock deduction | Cashier/Admin with active shift | implemented |
| Preorder tracking | Waiting/ready/picked-up/cancelled states and filters | Admin | implemented |
| Pickup | Token dialog, remaining payment, stock/counter mutation, final receipt | Cashier/Admin with active shift | implemented |
| Customers | Preorder customer records/history | Admin | implemented |
| Receipts | Sale/deposit/pickup preview and print | Permitted roles | implemented |
| Reprint | Reason plus AuditLog | Permitted roles | implemented |
| Shift opening | One active shift per cashier | Cashier | implemented |
| Own-shift summary | Totals by payment method | Cashier | implemented |
| Close request | Actual totals and pending review | Cashier | implemented |
| Shift review | Approve/reject with differences and note | Admin | implemented |
| Cash movement/refund | Server rules and audit | Authorized role | implemented |
| Reports | Sales/preorders/inventory/shifts, filters, CSV | Admin | implemented |
| AuditLog | Sensitive actions with actor/entity/time/details | Admin | implemented |
| Printer settings | Receipt width/header/footer/printer/label defaults | Admin | implemented |
| Responsive shell | 282/76px right sidebar and mobile right drawer | Both | implemented |
| Form system | Animated RTL-safe MUI labels/notches, shared Field wrapper, consistent errors/helpers | Both | implemented |
| Data system | Desktop table plus mobile cards and states | Both | implemented |
| Performance | Lazy pages, shared components, production build | Both | implemented |
| Final visual QA | Reference comparison and screenshot evidence | QA | pending Step 049 |
| Live API/E2E QA | Real SQLite/Express POS flow | QA | pending Step 050 |
| Multi-viewport/theme/accessibility | Browser matrix and keyboard review | QA | pending Step 051 |
| Release cleanup | Dependency/build/package/handoff regression | QA | pending Step 052 |

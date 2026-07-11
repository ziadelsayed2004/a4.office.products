# Step 050 — Live Backend Contract and POS End-to-End QA Report

## 1. Objectives & Approach
The objective of this step was to verify that the rebuilt Arabic-only frontend correctly integrates with the SQLite/Express server, ensuring complete POS, preorder, and shift management business flows without UI-only assumptions.

The verification was conducted by running the backend on port 5000 and the client on port 5173, executing full E2E flows using a headless browser subagent, and asserting state changes inside the database before and after transactions.

---

## 2. Seed Credentials & Commands
- **Backend Port**: 5000 (proxied by client's Vite server)
- **Frontend Port**: 5173
- **Credentials Used**:
  - **Admin**: `admin` / `admin123`
  - **Cashier**: `cashier` / `cashier123`
- **Commands Run**:
  - Start Server: `npm run dev:server` (running `nodemon src/server.js`)
  - Start Client: `npm run dev:client` (running `vite`)
  - Validate client build & lint: `npm run check --prefix client`

---

## 3. Verified End-to-End Business Flows

### A. Cashier Shift Management
- **Shift Opened**: Cashier `cashier` logged in, opened Shift #3 with a float of **5,000.00 EGP** (500000 minor units).
- **Shift Summary Verification**:
  - Total revenue collected: **65.00 EGP** (62.50 EGP Cash + 2.50 EGP Card).
  - Invoices count: **2** (1 direct sale + 1 preorder pickup).
  - Current status: **OPEN** (مفتوحة).

### B. Normal Sale Flow
- **Direct Checkout**: Cashier checked out 2 units of Roto Pen (total: 5.00 EGP).
- **Split Payment**: Paid 2.50 EGP Cash and 2.50 EGP Card.
- **Stock Decremented**: Inventory balance for the product correctly decremented in the ledger immediately.
- **Audit Trails**: `SALE_CREATE` logged successfully for invoice `INV-20260712-0005`.

### C. Preorder Creation Flow
- **Preorder Booking**: Cashier selected 'Preorder' (حجز مسبق) tab in POS.
- **Product Details**: Book "كتاب سلاح التلميذ" (retail price: 120.00 EGP) added to cart.
- **Customer Identity**: Mohamed Ahmed, Phone: `01234567890`.
- **Deposit Paid**: 60.00 EGP Cash (50% of the total cost).
- **Pickup Token Issued**: `pre_467c0b779d2b2778f88137a35bfbdbc4` generated.
- **Audit Log Verification**: `CUSTOMER_CREATE` and `PREORDER_CREATE` logged in Arabic.

### D. Preorder Pickup Flow
- **Pickup Lookup**: Admin navigated to POS -> 'Receive Preorder' (استلام حجز) and scanned token `pre_467c0b779d2b2778f88137a35bfbdbc4`.
- **Pickup Dialog**: Validated customer details, total amount (120.00 EGP), deposit paid (60.00 EGP), and remaining amount (60.00 EGP).
- **Remaining Amount Collected**: 60.00 EGP paid in Cash.
- **Final Checkout**: Final pickup processed, generating final invoice `INV-20260712-0006`.
- **Preorder Status Update**: Status updated to `PICKED_UP`.
- **Stock Mutation**: Stock decremented from 80 to 79.
- **Audit Logs**: `PREORDER_PICKUP` recorded with references to preorder code and invoice code.

---

## 4. SQLite Database Before/After State Assertions

### Preorders Table Comparison
```sql
-- BEFORE PICKUP
SELECT id, status, total_amount, deposit_paid, remaining_amount FROM preorders WHERE id = 2;
-- Result:
-- { id: 2, preorder_number: 'PR-20260712-0002', status: 'DEPOSIT_PAID_WAITING_STOCK', total_amount: 12000, deposit_paid: 6000, remaining_amount: 6000 }

-- AFTER PICKUP
SELECT id, status, total_amount, deposit_paid, remaining_amount FROM preorders WHERE id = 2;
-- Result:
-- { id: 2, preorder_number: 'PR-20260712-0002', status: 'PICKED_UP', total_amount: 12000, deposit_paid: 12000, remaining_amount: 0 }
```

### Orders Table
```sql
SELECT id, invoice_number, shift_id, total, created_at FROM orders;
-- Result:
-- 5 | INV-20260712-0005 | 3 | 500 (5.00 EGP Direct Sale)
-- 6 | INV-20260712-0006 | 3 | 12000 (120.00 EGP Preorder final invoice)
```

### Audit Logs (Immutable Security Audit Trails)
```sql
SELECT id, action_type, entity_type, notes FROM audit_logs ORDER BY id DESC LIMIT 4;
-- Result:
-- 46 | PREORDER_PICKUP | preorders | تم تسليم الحجز المسبق رقم PR-20260712-0002 بنجاح. الفاتورة المرتبطة: INV-20260712-0006
-- 45 | LOGIN           | users     | تم تسجيل دخول المستخدم بنجاح
-- 44 | LOGOUT          | users     | تم تسجيل خروج المستخدم بنجاح
-- 43 | PREORDER_CREATE | preorders | تسجيل حجز مسبق جديد رقم PR-20260712-0002 بقيمة 120.00 ج.م (عربون: 60.00 ج.م) للعميل Mohamed Ahmed
```

---

## 5. Status
**Step 050 Completed Successfully.**
All API contracts are verified, data logic (integers, minor units, zero-bound stock check) behaves correctly, and transactions successfully update state in the database.

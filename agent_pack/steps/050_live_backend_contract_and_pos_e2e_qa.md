# Step 050 — Live Backend Contract and POS End-to-End QA

## Objective

Run the real Express + SQLite server and verify that the rebuilt frontend covers the authoritative APIs and complete POS business flows without UI-only assumptions.

## Dependencies

- Step 049 complete.

## Required work

1. Install server dependencies and initialize a clean SQLite database with documented seed accounts/data.
2. Start server and client against the same environment.
3. Verify authentication and role route protection.
4. Run a normal sale:
   - open cashier shift;
   - scan/search product;
   - verify price tier and stock;
   - pay, finalize, decrement stock, print/preview receipt;
   - confirm payment, inventory ledger, shift binding, and AuditLog.
5. Run a preorder:
   - unavailable/insufficient product;
   - required customer name/phone;
   - deposit and secure pickup token;
   - confirm no physical-stock deduction and open counter increase.
6. Add stock and run pickup:
   - token validation and detail dialog;
   - remaining payment;
   - stock/counter mutation;
   - final receipt and AuditLog.
7. Run shift close request and Admin approve/reject paths with payment-method totals.
8. Verify reprint auditing, report filters/export, and permission-denied paths.
9. Fix only contract mismatches grounded in server behavior; do not weaken server validation.

## Evidence

- Exact commands and seed credentials used.
- API request/response assertions.
- Before/after SQLite queries for stock, counters, payments, shifts, receipts, and AuditLog.
- Browser evidence of complete flows.
- Client checks and server test/syntax results.

## Completion rule

Do not mark complete if the live SQLite/Express flow cannot run. Environment-only blockers must be reported and the step remains pending.

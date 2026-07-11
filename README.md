# A4 Office Products POS Platform

A single-branch Arabic bookstore and retail POS platform.

## Stack

- Frontend: React + Vite + Material UI
- Backend: Node.js + Express
- Database: SQLite
- Runtime UI: Arabic only, fixed RTL
- Themes: light and dark
- Currency: EGP
- Timezone: Africa/Cairo

## Main workflows

- Direct sale by product scan or search.
- Preorder for unavailable stock with required customer name, phone, deposit, and secure pickup token.
- Pickup by token scan, remaining-payment collection, stock deduction, and final receipt.
- Cashier shift opening, own-shift closing request, and Admin approval.
- Admin catalog, inventory, reports, users, printers, and AuditLog.

## Frontend baseline

The active frontend is `client/`. It is an A4-specific rebuild based on the compact dashboard morphology of:

```text
TEMPLETE-PROJECT/hamza.printing.press-main/client/
```

The reference contributes visual patterns only. A4 branding, Arabic RTL behavior, routes, permissions, data, and server contracts remain authoritative.

Runtime translation loads `ar.json` only. `en.json` is retained as an unused future translation store; there is no language switch.

## Verification

```bash
npm install --prefix client
npm run check --prefix client

find server/src -name '*.js' -print0 | xargs -0 -n1 node --check
```

Full server integration tests require successful installation of the native SQLite dependency.

## Agent Pack

Use `agent_pack/prompts/COPY_THIS_PROMPT.md`. Set `RUN_STEP_COUNT` to `1` or `2`. Frontend implementation Steps 038–048 are recorded as complete; final QA Steps 049–052 remain.

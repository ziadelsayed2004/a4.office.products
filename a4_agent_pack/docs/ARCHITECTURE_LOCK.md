# Target Architecture & Scope Lock — A4

This document defines the finalized architectural guidelines, technical stack, monorepo directory layout, and functional scope boundaries for the **A4 Office Products POS Platform**. All subsequent steps must conform to these decisions.

---

## 1. Technical Stack Lock

| Layer | Technology | Decision & Rationale |
|---|---|---|
| **Frontend** | React + Vite | Fast Single Page Application (SPA). Single build output for deployment. |
| **Frontend Styling** | Vanilla CSS | Custom, premium design system with built-in Arabic RTL styling. No TailwindCSS. |
| **Backend** | Node.js + Express | Lightweight, modular API endpoints following `API_TARGET_MAP.md`. |
| **Database** | SQLite | Single-file embedded relational database. |
| **Language / RTL** | Arabic RTL | All user-facing UI, receipts, and print templates must be Arabic RTL. `dir="rtl"` is set at the root level. |

---

## 2. Resolving Database Rules & Contradictions

> [!IMPORTANT]
> A conflict exists in some baseline documents where rules say: `"Do not use SQLite"` or `"No SQLite code in this project"`.
> **Resolution:** This is a legacy artifact of a global search-and-replace where the keyword **"Firebase"** was replaced by **"SQLite"** in the text (e.g., "No Firebase code" became "No SQLite code").
> 
> The definitive rules are:
> 1. **SQLite is the ONLY persistence database.**
> 2. **Firebase, Firestore, MongoDB, and other database systems/services are strictly prohibited.**
> 3. SQLite must be used with foreign keys enabled (`PRAGMA foreign_keys = ON`).
> 4. Database tables and migrations must be explicit, reproducible, and tracked in code.
> 5. Money values must be stored as integers (minor units / piastres), not floating-point numbers.

---

## 3. Monorepo Directory Layout

The project will be structured as a monorepo with the following layout:

```txt
a4-office-products-pos/
  agent_pack/
    docs/
    checklists/
    steps/
    reports/
    status.json
    TASK_BOARD.md
  client/                   # React + Vite Frontend
    package.json
    index.html
    src/
      main.jsx
      App.jsx
      api/                  # Backend API client calls
      app/                  # Shared state, routing, and context
      layouts/              # RTL layouts (Admin, Cashier)
      pages/                # Pages separated by role/area
      components/           # Reusable Arabic RTL UI components
      print/                # Receipt and label print CSS/components
      styles/               # CSS design tokens (Arabic RTL-first)
  server/                   # Node.js + Express Backend
    package.json
    src/
      server.js             # Entry point
      app.js                # Express app setup
      config/               # Environment variable parsing (.env)
      db/                   # SQLite connection and migration runner
      migrations/           # Explicit schema SQL files
      middleware/           # Auth, RBAC, shift validation, error logging
      modules/              # Domain-specific backend modules
        auth/
        users/
        categories/
        priceTiers/
        products/
        inventory/
        customers/
        orders/
        preorders/
        payments/
        receipts/
        qrTokens/
        shifts/
        reports/
        auditLogs/
        businessSettings/
        printerSettings/
      utils/
      tests/
```

---

## 4. Functional Scope Lock

### 4.1 In Scope (PRD Core Features)
* **Single-Branch Model**: No multi-tenant/multi-branch complexity.
* **Cashier Shift Guards**: Zero POS transactions (sale checkout, preorder creation, preorder pickup) are allowed without an active shift bound to the cashier account.
* **No Negative Stock**: All normal sales and preorder pickups must validate and block checkout if stock is insufficient.
* **Preorder QR Pickup Flow**: Customers place preorders by providing a name, phone, and deposit. A receipt is printed with a secure QR pickup token. Scanning the QR token inside the app validates details, collects the remaining amount, decrements stock, and prints the final receipt.
* **Audit Logging**: Mandatory audit trail for user sessions, shift actions, print/reprint actions, and stock/financial adjustments.
* **Arabic RTL UI**: From the login screen to the final receipt printout, everything user-facing is Arabic RTL.

### 4.2 Out of Scope
* No product images inside database schemas or UI.
* No device or terminal tracking (authorization is tied solely to active shifts and user accounts).
* No external API integrations or cloud sync.
* No complex custom role management (only `Admin` and `Cashier` roles exist).

---

## 5. Verification Protocol
All subsequent implementation steps will verify code correctness and compatibility by:
1. Running linter and compiler checks inside `client/` and `server/`.
2. Running test suites using `npm.cmd test` where available.
3. Conducting smoke tests on API endpoints and UI elements to guarantee zero regressions.

# Step 018 — Customers Minimal Module Report

## Selected Step Information
* **Step ID**: 018
* **Step Title**: Customers Minimal Module
* **Status**: Completed

---

## Changed Files
* `server/src/modules/customers/customers.service.js` (Created database lookup and creation helpers with name/phone validations and unique duplicate checks)
* `server/src/modules/customers/customers.controller.js` (Created endpoints for customer search and manual registration)
* `server/src/modules/customers/customers.routes.js` (Created client routes protected by authentication)
* `server/src/app.js` (Imported and registered customers routes under `/api/customers`)
* `client/src/App.jsx` (Redesigned catalog sidebar to render the "العملاء" tab, integrated customer lookup search fields, and built customer manual registration popups)
* `a4_agent_pack/status.json` (Updated current step to 019, step 018 status to completed, and step 019 status to open)
* `a4_agent_pack/TASK_BOARD.md` (Updated status of step 017, step 018, and step 019)
* `a4_agent_pack/reports/018_customers_minimal_module_REPORT.md` (Created this report)

---

## Implemented Behavior
* **Customer Registration & Duplicates Guard**:
  * `createCustomer({ name, phone })`: Validates that name and phone parameters are provided and non-empty. Enforces phone minimal character lengths. Checks duplicate name + phone combinations, throwing a localized Arabic exception if already registered.
  * Writes a `CUSTOMER_CREATE` audit log entry detailing newly registered client details.
* **Cashier-Accessible Search Queries**:
  * `searchCustomers(queryStr)`: Fuzzy searching match by name or phone keywords, sorted alphabetically. Accessible by cashier roles to query customer lists during shift preorders checkout flows.
* **Vite Dashboard Integration**:
  * Added the "العملاء" (Customers) tab in the Admin panel.
  * Allows live search queries by customer names or phones.
  * Added customer manual creation popover forms enforcing required entries.

---

## Verification Commands and Results
* **Automated Customers Verification Test**:
  * Command: `node "C:\Users\Ziad Elsayed\.gemini\antigravity-ide\brain\b47857d5-e610-4ec9-9fe5-ec1b7390e2da\scratch\verify_customers.mjs"`
  * Results: Success. Verified validation guards, customer creations, duplicate blocks, lookup searches, and audit logs details. Output:
    ```txt
    Cleaning up test customer data...
    Connected to SQLite database at: D:\a4.office\server\src\db\a4_pos.db
    SQLite foreign key constraint checks enabled.
    ✔ Cleanup complete.
    Starting Customers Minimal Module integration tests...
    Logging in as Admin...
    Testing create customer without name (should fail)...
    Testing create customer without phone (should fail)...
    Testing valid customer creation...
    ✔ Customer created successfully.
    Testing duplicate customer creation (should fail)...
    ✔ Duplicate block verified.
    Testing customer search (by name keyword)...
    Testing customer search (by phone keyword)...
    ✔ Customer lookup searches verified.
    Verifying CUSTOMER_CREATE log exists in audit logs...
    ✔ Audit log verification passed.
    ==============================================
     ALL CUSTOMER MINIMAL TESTS PASSED SUCCESS!
    ==============================================
    Cleaning up test customer data...
    ✔ Cleanup complete.
    ```
* **Frontend Compile Build**:
  * Command: `npm.cmd run build --prefix client`
  * Results: Success. Vite client compiles cleanly.

---

## Blockers and Follow-ups
* None. Customers minimal module is fully functional. POS Cart Scan Search will start in Step 019.

---

## Confirmation of Scope
* **One-Step Rule**: Confirmed that only Step 018 was executed. Stopped immediately after completing verification.

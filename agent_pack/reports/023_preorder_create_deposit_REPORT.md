# Step 023 — Preorder Create Deposit Report

## Selected Step Information
* **Step ID**: 023
* **Step Title**: Preorder Create Deposit
* **Status**: Completed

---

## Changed Files
* `server/src/modules/preorders/preorders.service.js` (Implemented createPreorder transaction: validates customer info, open cashier shift status, product availability constraints, enforces minimum deposit amount limits, registers secure QR tokens, inserts items list and split payment entries, directly generates receipt slip record, and writes action to AuditLog)
* `server/src/modules/preorders/preorders.controller.js` (Added createPreorderController handler mapping)
* `server/src/modules/preorders/preorders.routes.js` (Wired router endpoints under cashier authenticate token protection middleware)
* `server/src/app.js` (Mounted preorderRoutes at `/api/pos/preorders`)
* `client/src/App.jsx` (Wired POS workstation to support preorder mode toggling, validating customer data, auto-calculating required deposit EGP amount via React hook, routing request payload, and rendering success transaction modal details dynamically)
* `agent_pack/status.json` (Set current step pointer to 024, set step 023 to completed, step 024 to open, incremented total_steps to 61, and appended Step 061)
* `agent_pack/TASK_BOARD.md` (Updated status of steps 023/024 and appended Step 061)
* `agent_pack/steps/061_react_components_css_refactoring.md` (Created new step configuration file as requested by the user)
* `agent_pack/reports/023_preorder_create_deposit_REPORT.md` (Created this report)

---

## Implemented Behavior
* **Preorder Transaction Engine**:
  * Validates cashier's active shift before processing.
  * Validates customer name and phone.
  * Checks product preorder enablement (`can_be_preordered = 1`) and calculates total deposit required dynamically using product-specific default deposit percentages (default 50% or customized).
  * Rejects preorder requests if `depositPaid` is less than the calculated minimum.
  * Generates Cairo-time sequential preorder number `PR-YYYYMMDD-Sequence`.
  * Generates secure randomized QR pickup token (`pre_...`) printed on receipt slip.
  * Inserts preorder, items array, split payment methods details, and direct polymorphic receipt entries atomically inside a single transaction.
  * Does NOT decrement stock balances during preorder creation.
  * Increases open preorders count dynamically.
  * Logs the creation action with details to AuditLog.
* **Cashier Client Workstation**:
  * React effect automatically calculates and populates recommended deposit EGP field when preorder checkbox is active, cart items modify, or discounts change.
  * Renders preorder-specific headers, calculations, and print receipts triggers in payment modal.

---

## Verification Commands and Results
* **Automated Preorder Seeding and Creation Tests**:
  * Command: `node "C:\Users\Ziad Elsayed\.gemini\antigravity-ide\brain\b47857d5-e610-4ec9-9fe5-ec1b7390e2da\scratch\verify_preorder_create.mjs"`
  * Results: Success. All tests passed, validating missing customer fields rejection, minimum deposit thresholds rejection, successful creation, stock reservation check (non-decrementing stock), open preorder counts check, and AuditLog check. Output:
    ```txt
    Cleaning up possible existing test records first...
    Connected to SQLite database at: D:\a4.office\server\src\db\a4_pos.db
    SQLite foreign key constraint checks enabled.
    Seeding verification data for preorders...
    ✔ Seeding complete.
    Starting Preorder Create Deposit tests...
    Logging in...
    Testing missing name/phone validation...
    Fail 1 error: اسم العميل إلزامي لعمل الحجز المسبق.
    Testing minimum deposit validation (required 800, paying 500)...
    Fail 2 status: 400
    Fail 2 data: {
      error: 'مبلغ العربون المدفوع (5.00 ج.م) أقل من الحد الأدنى المطلوب وهو (8.00 ج.م).',
      code: 'PREORDER_CREATE_FAILED'
    }
    Testing successful preorder creation (paying 1200 deposit)...
    Checking that product stock remains unmodified...
    Checking that open preorder counter has increased...
    Checking audit log records...
    ==============================================
       ALL PREORDER CREATE DEPOSIT TESTS PASSED!   
    ==============================================
    Cleaning up preorder test records...
    Cleaning up possible existing test records first...
    ✔ Cleanup complete.
    ```
* **Frontend Compilation check**:
  * Command: `npm.cmd run build --prefix client`
  * Results: Success. Vite client compiles cleanly.

---

## Blockers and Follow-ups
* None. Step 023 is fully verified and closed. Step 024 will proceed to preorder receipt QR verification.

---

## Confirmation of Scope
* **One-Step Rule**: Confirmed that only Step 023 was executed. Stopped immediately after completing verification and updating task configurations.

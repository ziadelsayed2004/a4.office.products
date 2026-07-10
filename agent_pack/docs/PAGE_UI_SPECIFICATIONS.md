# A4 Frontend Page and Navigation Specifications

## 1. Role-aware navigation

### Cashier

- نقطة البيع
- إنشاء حجز مسبق
- استلام حجز
- الإيصالات
- الشيفت الحالي
- تسجيل الخروج

The cashier must not see global revenue, users, inventory management, reports, or another cashier's shift.

### Admin

- لوحة التحكم
- التصنيفات
- فئات الأسعار
- المنتجات
- المخزون
- العملاء
- الحجوزات
- المبيعات والإيصالات
- طرق الدفع
- الشيفتات
- التقارير والمؤشرات
- المستخدمون
- سجل العمليات
- إعدادات الطباعة والنشاط

## 2. Shared shell

Match the embedded template:

- fixed top bar,
- expanded/collapsed grouped sidebar,
- profile card,
- active pill navigation,
- theme/notification/account controls,
- locale-aware side and direction,
- breadcrumbs,
- shared page header,
- A4-only footer.

## 3. Login

- centered A4 card derived from the template login,
- A4 logo, title, subtitle,
- username/password and show-password control,
- validation, server error, loading,
- theme control before login,
- Arabic default and optional English switch,
- keyboard submit and correct autocomplete.

## 4. Admin dashboard

Preserve the template hierarchy:

- welcome/summary header with Cairo date,
- direct sales KPI,
- deposits KPI,
- remaining payments KPI,
- open/ready preorder KPI,
- low-stock KPI,
- pending-shift KPI,
- payment-method summary,
- stock/preorder operational snapshot,
- quick actions,
- recent sales/preorders/stock changes/shift submissions,
- top products and simple accessible trend visualization.

## 5. Cashier POS

- scanner-first product input,
- search by product name, SKU, category, and relevant book fields,
- product rows without images,
- price-tier selection subject to rules,
- quantity and stock validation,
- cart with totals and payment action,
- clear direct-sale and preorder paths,
- split-payment dialog,
- receipt print action,
- fast reset for the next customer,
- scanner and keyboard workflow preserved.

## 6. Categories and price tiers

- compact table/card list,
- active/inactive state,
- create/edit drawer,
- dependency warning before deactivate/delete,
- prices managed by Admin only.

## 7. Products

- no image fields or image columns,
- generic product fields,
- optional book fields: book type, grade, subject, teacher, publisher, edition year, term, educational classification,
- category and price-tier values,
- direct-sale/preorder eligibility,
- preorder deposit percentage and pickup method,
- current stock/open preorder counters,
- QR label generation/print action.

## 8. Inventory

- stock on hand,
- open preorder quantity,
- available-for-direct-sale state,
- low-stock status,
- adjustment drawer with reason,
- immutable ledger view,
- no adjustment that results in negative stock.

## 9. Customers and payment methods

- customer identity and preorder history,
- phone values displayed LTR,
- admin-managed active payment methods,
- cash/card/InstaPay/wallet/transfer semantics,
- no unsupported global financial data for Cashier.

## 10. Preorders

### Creation

- required customer name and phone,
- product quantities and price tier,
- deposit percentage/value,
- remaining amount,
- payment method,
- pickup method,
- expected date and notes where enabled,
- confirmation and Arabic reservation receipt with pickup token.

### Admin list

- status, customer, phone, product, date, cashier, deposit, remaining amount, stock readiness,
- list and detail states,
- authorized status actions only.

### Pickup

- scan token or authorized search,
- full customer/order identity,
- previous deposit and remaining amount,
- stock check per item,
- remaining payment collection,
- final confirmation,
- stock decrement and open-preorder decrement,
- final receipt and AuditLog.

## 11. Shifts

### Cashier shift

- start/open state,
- timeline/transactions,
- totals by payment method,
- expected cash and other method totals,
- actual amounts entry,
- difference preview,
- close-request confirmation.

### Admin review

- pending reviews first,
- cashier and shift times,
- expected/actual/difference by method,
- activity summary,
- approve/reject with note,
- no silent financial edits.

## 12. Receipts

- search by receipt/order/preorder number and token,
- preview and print,
- authorized reprint with reason,
- sale, reservation, and pickup receipt variants,
- Arabic thermal layout,
- screen theme does not affect print output.

## 13. Reports and KPIs

- sales,
- preorders,
- inventory,
- shifts,
- payment methods,
- products/categories/cashiers,
- filter panel,
- KPI summary,
- table/chart view,
- export using current filters,
- Admin only.

## 14. Users and audit logs

- user list, role, status, last login,
- create/edit/disable/reset password by Admin,
- cashier cannot edit own identity/password,
- audit search by date, actor, action, entity, shift,
- before/after details with sensitive data protection.

## 15. Printer and business settings

- receipt width and template settings,
- QR label width, height, rows/columns where applicable, count, gap, and margins,
- test print and preview,
- business identity on receipts,
- no device/terminal tracking model.

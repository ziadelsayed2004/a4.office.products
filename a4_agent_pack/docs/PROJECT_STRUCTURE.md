# هيكلة المشروع — A4

```txt
a4-office-products-pos/
  agent_pack/
    docs/
    prompts/
    steps/
    checklists/
    reports/
    status.json
  server/
    package.json
    src/
      app.js
      server.js
      config/
      db/
      middleware/
      modules/
        auth/
        users/
        rbac/
        auditLogs/
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
        printerSettings/
        businessSettings/
      utils/
      tests/
  client/
    package.json
    index.html
    src/
      main.jsx
      App.jsx
      api/
      app/
      layouts/
      pages/
        admin/
        cashier/
      components/
      print/
      styles/
      locales/
  docs/
  .env.example
  README.md
```

## قواعد الهيكلة

- لا يتم وضع منطق مالي داخل الواجهة فقط؛ السيرفر هو مصدر الحقيقة.
- كل موديول backend يمتلك routes/controller/service/model عند الحاجة.
- كل صفحة frontend تفصل UI عن API calls.
- ملفات الطباعة تكون داخل client/src/print أو module مخصص.
- الترجمة والاتجاه RTL يجب أن يكونا من بداية المشروع.

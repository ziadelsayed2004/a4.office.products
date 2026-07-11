# A4 Office Products POS Platform

منصة كاشير وإدارة مكتبة لفرع واحد، بواجهة عربية ثابتة من اليمين إلى اليسار.

## التقنية

- Frontend: React + Vite + Material UI
- Backend: Node.js + Express
- Database: SQLite
- Runtime UI: Arabic only / RTL
- Theme: Light + Dark
- Currency: EGP
- Timezone: Africa/Cairo

## الوظائف الأساسية

- بيع مباشر بإدخال أو مسح رمز المنتج.
- حجز مسبق للمنتجات غير المتاحة مع عربون وبيانات عميل إجبارية.
- استلام الحجز بواسطة رمز آمن، تحصيل المتبقي، وخصم المخزون.
- فتح شيفت للكاشير، ملخص وتقفيل، ثم مراجعة الأدمن.
- إدارة المنتجات والتصنيفات وفئات الأسعار والمخزون والمستخدمين.
- طباعة إيصالات البيع والحجز والاستلام وملصقات المنتجات.
- تقارير وسجل عمليات كامل.

## الواجهة

المشروع يعمل بالعربية فقط أثناء التشغيل. الملف `client/src/locales/en.json` محفوظ كقاموس ترجمة مستقبلي وغير محمل داخل الواجهة، ولا يوجد زر لتغيير اللغة.

نظام الحقول يعتمد على MUI Outlined Inputs مع:

- Label متحرك إلى Notch أعلى يمين الحقل.
- اتجاه عربي RTL للنص والقوائم.
- اتجاه LTR محلي فقط للأكواد وأرقام الهاتف والتواريخ.
- حالات Hover / Focus / Error / Disabled موحدة.
- مسافات ثابتة بين أيقونة الزر والنص.

## التشغيل

```bash
npm install --prefix client
npm install --prefix server
npm run db:setup
npm run dev
```

واجهة التطوير: `http://localhost:5173`

API الافتراضي: `http://localhost:3000`

الحسابات الافتراضية بعد إعداد قاعدة البيانات:

```text
admin / admin123
cashier / cashier123
```

## التحقق

```bash
npm run check --prefix client
find server/src -name '*.js' -print0 | xargs -0 -n1 node --check
npm test --prefix server
```

اختبارات السيرفر تحتاج تثبيت Native dependency الخاصة بـ `sqlite3` بنجاح.

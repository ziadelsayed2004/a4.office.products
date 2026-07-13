# A4 Office Products POS

Production target: `https://a4office.cloud`. See [DEPLOYMENT.md](DEPLOYMENT.md) for Ubuntu deployment, HTTPS, PM2, Chromium, backup, restore, and rollback procedures. Thermal/label output remains browser-based; authenticated invoice and report PDFs use system Chromium. `TEMPLETE-PROJECT` is reference material and is never installed or deployed with A4 Office.

نظام نقاط بيع وإدارة مكتبة بواجهة عربية RTL، مبني على React/Vite وExpress وSQLite، ويعمل بتوقيت `Africa/Cairo` وعلى المنفذ `5000` للخلفية.

## المتطلبات

- Node.js 20.19 أو أحدث وnpm.
- SQLite 3 عند التشغيل على الخادم أو عند الفحص اليدوي.
- Chrome/Edge للطباعة من المتصفح.

## التشغيل المحلي

```bash
copy .env.example .env
npm run ci:all
npm run db:setup
npm run dev
```

- الواجهة: `http://localhost:5173`
- API: `http://localhost:5000`
- فحص الصحة: `http://localhost:5000/api/health`

يقرأ السيرفر والـCLI ملف `.env` الموحد من جذر المشروع. ويقرأ Vite نفس الملف صراحةً. القيم الكاملة والموثقة موجودة في `.env.example`.

حسابا `admin/admin123` و`cashier/cashier123` للتطوير فقط عند تفعيل `SEED_DEMO_USERS=true`. لا ينشئ production أي حساب افتراضي.

## قاعدة البيانات

`db:setup` يطبق schema وmigrations دون حذف البيانات:

```bash
npm run db:setup
```

`db:verify` يفتح قاعدة التطوير الحالية بوضع read-only وينفذ `integrity_check` و`foreign_key_check`:

```bash
npm run db:verify
```

`db:reset` مخصص فقط لقاعدة development/test معزولة واسمها يحتوي `local` أو `dev` أو `test`. يلزم `ALLOW_DATABASE_RESET=true`، ويضيف npm علم التأكيد تلقائياً:

```bash
npm run db:reset
```

أما الاستدعاء المباشر `node server/src/db/reset.js` فيُرفض بدون `--confirm-reset`. ويُرفض reset دائماً في production، لقاعدة التشغيل الافتراضية، للمسارات غير الآمنة، وللروابط الرمزية.

## الطباعة

الوضع المدعوم حالياً هو Browser Print فقط. تستخدم المعاينة والطباعة نفس مكوّن الإيصال، ويُضبط عرض صفحة الإيصال على المحتوى الحراري بدل ورقة A4. مقاسات الملصقات المدعومة هي `38×25` و`50×25` و`80×50` مم، وكل ملصق في صفحة منفصلة بلا صفحة أخيرة فارغة.

إعدادات نوع/عنوان الطابعة القديمة تُحفظ للتوافق فقط ولا تُستخدم. الربط المباشر بطابعة حرارية مشروع مستقل لاحقاً بعد تحديد الجهاز وطريقة الاتصال.

## الحذف الآمن والمرتجعات

- التصنيفات وفئات السعر والمنتجات والعملاء وطرق الدفع المخصصة تُحذف فقط عند عدم وجود أي سجل تشغيلي أو مالي مرتبط؛ وإلا يعيد API خطأ `409` مع أعداد الروابط ويظل التعطيل هو الخيار الآمن.
- المستخدمون والفواتير والإيصالات والشيفتات والحركات المالية لا تُحذف. كل حذف ناجح يُنفذ مع Audit داخل معاملة واحدة.
- المرتجع يبدأ من بطاقة QR دقيقة ينشئها Admin لبنود وكميات محددة. البطاقة لمرة واحدة، صالحة افتراضيًا 24 ساعة، والمسح للمعاينة فقط.
- رد المبلغ يتبع طرق الدفع الأصلية. النقد وحده يخفض عهدة الشيفت، والطرق غير النقدية تحتاج مرجع رد خارجي ولا تغيّر درج النقد.
- بطاقة المرتجع وإيصال المرتجع يستخدمان Browser Print بعرض `80mm`. يلزم `RETURN_QR_SECRET` قوي ومختلف لكل بيئة؛ لا يُسجل الرمز الخام في Audit.

## التحقق

```bash
npm run check
npm run security:audit
npm run db:verify
git diff --check
```

`npm run check` يشغل Prettier check، فحوص الواجهة والطباعة واختبارات React الفعلية، Oxlint/syntax واختبارات السيرفر، بناء production، وفحص إعداد النشر. مجلد `TEMPLETE-PROJECT` مرجع فقط ومُستبعد من format/lint/tests/build.

## production

استخدم `.env.production.example` كمرجع فقط ولا تضع أسراراً في Git. أنشئ أول Admin بكلمة مرور مؤقتة غير مخزنة:

```bash
BOOTSTRAP_ADMIN_USERNAME=admin \
BOOTSTRAP_ADMIN_NAME='System Administrator' \
BOOTSTRAP_ADMIN_PASSWORD='temporary-strong-password' \
npm run admin:bootstrap
```

راجع `DEPLOYMENT.md` قبل تشغيل `deploy.sh`. لا يشغّل المشروع أي deploy على خادم حي تلقائياً.

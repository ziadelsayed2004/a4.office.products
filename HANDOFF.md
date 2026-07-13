# A4 Office POS — Handoff

## العقود الثابتة

- Node.js 20.19+، Express على `5000`، Vite على `5173` في التطوير، وتوقيت `Africa/Cairo`.
- ملف `.env` موحد في جذر المشروع، مع validation صارم قبل بدء السيرفر أو أدوات DB.
- `npm run db:reset` يعمل فقط لقاعدة development/test معزولة عند `ALLOW_DATABASE_RESET=true`. الاستدعاء المباشر يحتاج `--confirm-reset`.
- `npm run db:verify` فحص read-only. كل اختبارات الكتابة تستخدم نسخة مؤقتة.
- لا توجد حسابات production افتراضية؛ `admin:bootstrap` ينشئ أول Admin مرة واحدة بكلمة مرور مؤقتة.
- response errors العامة بالشكل `{ error, code, details? }` ولا تكشف stack أو SQL.
- Inventory يحتفظ بـ`ledger` و`total` ويضيف `pagination: { limit, offset }`. Audit يحتفظ بـ`logs` و`pagination` وحد `limit` من 1 إلى 100.
- تعديلات المخزون والحركات النقدية تتطلب `Idempotency-Key` وتدعم replay الآمن ورفض التعارض.
- تعطيل مستخدم أو تغيير كلمة مروره يلغي جلساته، ولا يمكن تعطيل آخر Admin نشط.
- الحذف الفعلي محصور في البيانات المرجعية غير المستخدمة، مع `can_delete` و`dependency_counts` وإعادة فحص داخل `BEGIN IMMEDIATE`. التاريخ المالي لا يُحذف.
- المرتجع يتطلب تصريح Admin موقّعًا بـHMAC ومرة استخدام واحدة. المسح read-only، والتنفيذ يحتاج شيفتًا مفتوحًا و`Idempotency-Key`.
- النقد المرتجع يسجل دفعة `REFUND/OUT` واحدة دون `PAY_OUT` إضافي؛ غير النقدي يحتاج مرجعًا خارجيًا ولا يغير عهدة الدرج.

## الواجهة والطباعة

- `apiClient` ينفذ refresh واحداً مشتركاً عند انتهاء access token، يعيد الطلب مرة واحدة، ثم يمسح الجلسة عند فشل refresh.
- reset للفلاتر والصفحات يعتمد القيم الجديدة مباشرة ولا يعيد stale state.
- ممنوع `style=` و`sx=` داخل JSX ويُفحص ذلك آلياً. الثيم يُعرض عبر attribute/CSS.
- الإيصال يستخدم `ThermalReceipt` للمعاينة والطباعة، وBrowser Print هو الوضع المدعوم الوحيد.
- مقاسات الملصقات: `38×25` و`50×25` و`80×50` مم، صفحة مستقلة لكل ملصق.
- مفاتيح نوع/عنوان الطابعة القديمة legacy غير مفعلة حتى مشروع Direct Printer لاحق.
- السايدبار يثبت اللوجو وكارت المستخدم أعلى منطقة القائمة القابلة للتمرير، وغلاف اللوجو أبيض صريح في الوضعين.
- POS Scanner-first بأوضاع البيع والحجز والاستلام والمرتجع، ومسودات session مرتبطة بالمستخدم والشيفت، ودفع سريع بلا طريقة افتراضية.
- بطاقة المرتجع وإيصال `order_return` يطبعان بعرض `80mm` ويعيدان استخدام مكونات الطباعة الرسمية.

## التشغيل والجودة

```bash
npm run ci:all
npm run check
npm run security:audit
npm run db:verify
git diff --check
```

`TEMPLETE-PROJECT` محفوظ كمرجع ومُستبعد من lint/format/tests. قاعدة البيانات وWAL والنسخ السليمة ليست أهداف تنظيف. المساران المتتبعان القديمان داخل `server/.tmp` محذوفان، والـcoverage/caches/.vite/tmp وSQLite sidecars متجاهلة.

## production

- الخدمة تحت المستخدم المحدود `a4pos` وPM2، وNginx يقدم الواجهة ويمرر `/api/` إلى `127.0.0.1:5000`.
- build الواجهة same-origin، reset وdemo users معطلان، وCORS صريح.
- النسخ داخل `backups/` مع retention يساوي 10 وفحص سلامة قبل الاحتفاظ أو الاسترجاع.
- `deploy.sh` إعداد قابل للمراجعة فقط؛ لا يُشغّل ضد VPS حي بدون بيانات الهدف وصلاحية صريحة.

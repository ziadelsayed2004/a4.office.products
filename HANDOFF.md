# A4 Office Products — Handoff

## الحالة الحالية

- واجهة React/Vite/MUI عربية فقط وRTL ثابت.
- الوضعان الفاتح والداكن مع حفظ الاختيار محلياً.
- Sidebar يمين على الديسكتوب وDrawer من اليمين على الموبايل.
- نظام حقول MUI v9 حديث بدون `InputProps` أو `InputLabelProps` القديمة.
- Label متحرك إلى Notch أعلى يمين الحقل، مع Select icon على اليسار.
- مسافات موحدة بين أيقونات الأزرار والنصوص.
- صفحات الأدمن والكاشير مرتبطة بعقود Express وSQLite الحالية.
- تم حذف نظام الخطوات القديم بالكامل؛ التعديلات تتم مباشرة على المشروع.

## الإصلاحات الأخيرة

- إزالة Emotion RTL cache وStylis plugins التي كانت تسبب خطأ Runtime داخل `<Insertion>`.
- منع تسريب `alignItems` و`InputProps` و`InputLabelProps` إلى عناصر DOM.
- تحويل خصائص MUI القديمة إلى `slotProps` المتوافقة مع MUI 9.
- تحسين RTL للحقول، الـ Notch، الـ Adornments، القوائم، الأزرار والـ Dialog actions.
- تحسين الوصول للقائمة الجانبية وإغلاقها عند تغيير الصفحة أو الضغط على Escape.
- حفظ حالة تصغير الـ Sidebar.

## نتائج التحقق

- Client lint: passed.
- Static UI validation: passed.
- Vite production build: passed.
- Runtime render smoke test: 16/16 routes passed with no React prop warnings or runtime errors.
- Server JavaScript syntax validation: passed for all source files.

اختبارات SQLite الحية تعتمد على نجاح تثبيت حزمة `sqlite3` الأصلية في بيئة التشغيل.

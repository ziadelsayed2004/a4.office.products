# A4 Office Products — Handoff

## الحالة الحالية

- واجهة React/Vite/MUI عربية فقط مع RTL ثابت.
- `ThemeConfig` هو مصدر الثيم، ويستخدم Emotion cache واحداً ثابتاً مع `prefixer` ثم `rtlPlugin`.
- الوضعان الفاتح والداكن يحتفظان بمفتاح التخزين `a4_color_mode` وبألوان وهوية A4.
- الـSidebar بعرض 270px أو 72px، والـTopbar بارتفاع 64px، والتحول للموبايل عند 900px.
- ترتيب CSS العام هو: `variables → reset → rtl → layout → forms → tables → drawers → dialogs → material-overrides`.
- كل مكوّن مشترك وكل صفحة يملك ملف CSS ملاصقاً له، بدون ملف `components.css` تجميعي.
- `api` موجود في `src/services/apiClient.js` مع نفس JWT/Bearer وعقود التنزيل السابقة.
- صفحات الأدمن والكاشير وRoutes والحراس والصلاحيات وعقود Express/SQLite لم تتغير.

## نظام الحقول

- `Field` يمرر الـlabel إلى MUI `TextField` ويعتمد `fieldset` و`legend` الأصليين فقط.
- الـlabel يبدأ داخل الحقل، ثم يتحرك إلى notch أعلى اليمين عند التركيز أو وجود قيمة.
- عرض `legend` لا يتم التحكم فيه من CSS؛ MUI يملك انتقاله من border مغلق إلى notch مفتوح.
- عند وجود label لا يمرر `Field` placeholder ثانياً، لذلك لا يظهر نصان داخل الحقل.
- حقول Login لا تستخدم `startAdornment` أو `autoFocus` حتى تبدأ بالـlabel داخل border مغلق، ثم تنتقل إلى الـnotch عند التفاعل.
- قيم اسم المستخدم وكلمة المرور LTR، مع بقاء الـlabel والـfieldset والأيقونات في توزيع RTL سليم.
- حقول التاريخ والوقت تستخدم shrink آمناً، والقيم التقنية والأرقام والهواتف LTR.
- الارتفاعات: 40px للحقول العادية، 56px للدخول، و44px على الموبايل.
- صفوف البحث التي تجمع field وزرار تستخدم نفس الارتفاع والمحاذاة في Receipts وCustomers وPOS والفلاتر.

## المكوّنات والاستجابة

- `FieldGrid`, `FormActions`, `FormSection`, و`Field` داخل `components/forms`، وبقية المكوّنات المشتركة مسطحة داخل `components`.
- `EntityDrawer` بعرض 820px افتراضياً و920px مع `wide`، ويصل إلى 100vw على الهاتف.
- `ConfirmDialog` بعرض أقصى 480px، بينما Dialogs التشغيلية في POS تحتفظ بسلوك full-screen.
- الجداول تتحول إلى Mobile Cards تحت 720px.
- POS والـscanner والـsticky cart و80mm receipts وطباعة QR labels احتفظت بسلوكها السابق.

## نتائج التحقق

- Client lint: passed.
- Static UI validation: 443/443 passed.
- Vite production build: passed.
- Runtime API/route smoke: passed بحسابي Admin وCashier باستخدام نسخة SQLite مؤقتة، بدون لمس قاعدة البيانات الأصلية.
- المقارنة المرئية الآلية تحتاج إعادة تشغيل عند توفر اتصال المتصفح الداخلي؛ لم يتم استخدام بديل غير معتمد.

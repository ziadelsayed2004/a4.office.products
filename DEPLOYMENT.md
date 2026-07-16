# نشر A4 Office على Hostinger VPS

المسار المعتمد للإنتاج هو Ubuntu 22.04 أو 24.04 خلف Nginx وHTTPS، مع تشغيل API بعملية PM2 واحدة وقاعدة SQLite محلية. لا يستخدم الإعداد كلمات مرور افتراضية أو صلاحيات `777`.

## أول نشر

1. وجّه سجل `A` للدومين إلى عنوان IPv4 الخاص بالـ VPS.
2. انسخ المشروع إلى `/root/a4-office` مثل تيمبليت حمزة؛ Express يقدّم الواجهة وNginx يمرر له الطلبات.
3. احتفظ بـ snapshot من Hostinger قبل أول نشر أو migration إنتاجي.
4. شغّل:

```bash
cd /root/a4-office
chmod +x deploy.sh
sudo DOMAIN_NAME=a4office.cloud ./deploy.sh
```

السكربت يثبت Node.js وChromium وخطوط العربية وNginx وCertbot وSQLite وPM2، ثم يشغّل التطبيق عبر PM2 تحت `root` مثل تيمبليت حمزة، ويولّد الأسرار، ويشغّل التثبيت والفحوصات والبناء والـ migrations، ويجهز HTTPS والنسخ الاحتياطي اليومي ويتأكد من `/api/health`.

لا ترفع ملف `.env` الحقيقي إلى Git. استخدم `.env.production.example` كمرجع فقط؛ `deploy.sh` ينشئ ملف الإنتاج بصلاحية `0600` ويحافظ على الأسرار القوية الموجودة عند التحديث.

## تحديث نسخة الإنتاج

خذ snapshot عند التحديثات الكبيرة، ثم نفّذ نفس التسلسل المستخدم في تيمبليت
`hamza.printing.press`. المسار المعتمد لهذا المشروع هو `/root/a4-office`:

```bash
cd /root/a4-office
git reset --hard
git pull origin main
chmod +x deploy.sh
sed -i -e 's/\r$//' deploy.sh
sudo DOMAIN_NAME=a4office.cloud ./deploy.sh
```

`git reset --hard` يحذف أي تعديلات محلية على ملفات Git في نسخة السيرفر، لذلك استخدم
هذه الأوامر على نسخة الإنتاج فقط بعد رفع التعديلات المطلوبة إلى فرع `main`. لا يحذف
السكربت قاعدة SQLite أو ملف `.env`، ويأخذ نسخة احتياطية متحققة من قاعدة البيانات قبل
تشغيل migrations.

قبل أي migration ينشئ السكربت نسخة SQLite ويتحقق من سلامتها. بعد ذلك يشغّل `npm ci` لكل الحزم، مجموعة الفحوصات الكاملة، build، migrations، ثم يعيد تشغيل Nginx وPM2 ويتحقق من الصحة محليًا وعبر HTTPS.

## الإدارة والتشخيص

```bash
curl -fsS https://a4office.cloud/api/health
pm2 status
pm2 logs a4-pos-server
sudo nginx -t
sudo journalctl -u nginx --since "30 minutes ago"
sudo certbot renew --dry-run
systemctl status certbot.timer
```

يجب أن يظل المنفذ `5000` مربوطًا بـ `127.0.0.1` فقط. لا تفتحه في UFW؛ الوصول العام يكون من خلال Nginx وHTTPS فقط.

## النسخ الاحتياطي والاستعادة

تُحفظ النسخ المتحققة في `/root/a4-office/backups` مع retention افتراضي 10 نسخ. لإنشاء نسخة يدوية:

```bash
cd /root/a4-office
npm run db:backup
```

لاستعادة نسخة، أوقف التطبيق أولًا وافحص الملف ثم احتفظ بنسخة من الحالة الحالية:

```bash
pm2 stop a4-pos-server
sqlite3 /root/a4-office/backups/SELECTED.db 'PRAGMA integrity_check;'
cp /root/a4-office/server/src/db/a4_pos.db /root/a4-office/backups/a4_pos.before_restore.db
cp /root/a4-office/backups/SELECTED.db /root/a4-office/server/src/db/a4_pos.db
pm2 restart a4-pos-server
curl -fsS https://a4office.cloud/api/health
```

لا تشغّل `db:reset` في الإنتاج تحت أي ظرف.

## Rollback

إذا فشل إصدار قبل migrations، أعد checkout للإصدار السابق ثم شغّل `deploy.sh`. إذا طُبقت migrations، استخدم checkout السابق مع نسخة `pre_deploy` المطابقة له، ثم تحقق من health endpoint وتدفقات تسجيل الدخول والبيع والطباعة.

## قيود التشغيل والطباعة

- التشغيل المعتمد هو PM2 fork بعملية واحدة لأن live updates تستخدم SSE مع event bus داخل الذاكرة. قبل التوسع الأفقي يجب نقل الأحداث إلى Redis أو broker مشترك.
- Nginx يقرأ `client/dist` فقط، ولا يجب أن يستطيع قراءة `.env` أو قاعدة البيانات أو النسخ الاحتياطية.
- PDF يحتاج `/usr/bin/chromium` وخطوط Noto العربية. إذا كانت جاهزية PDF غير متاحة، راجع صلاحيات Chromium والذاكرة وسجلات PM2.
- الإيصالات والملصقات وكروت المرتجعات تستخدم طباعة المتصفح ومقاسات ديناميكية لا يجب تحويلها إلى CSS ثابت.

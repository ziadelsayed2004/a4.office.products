# دليل نشر A4 Office POS

هذا الدليل خاص ببيئة staging أو production على Ubuntu 22.04/24.04. لا تُشغّل `deploy.sh` على VPS حي قبل تحديد الدومين، مراجعة النسخة الاحتياطية، والحصول على صلاحية صريحة.

## المتطلبات والهيكل

- Node.js 20.19 أو أحدث.
- checkout داخل `/opt/a4-office` أو `/var/www/a4-office`، وليس تحت `/root`.
- Nginx أمام Express، والمنفذ الداخلي الثابت `5000`.
- مستخدم خدمة محدود باسم `a4pos`، وليس root.
- ملف env واحد في جذر المشروع بصلاحية `0600`.
- قاعدة SQLite في `server/src/db/a4_pos.db` والنسخ في `backups/`.

لا يُضاف `www-data` عمدًا إلى مجموعة `a4pos`، ويحذف سكربت النشر أي عضوية قديمة ثم يعيد تشغيل Nginx بالكامل ويتحقق فعليًا من صلاحيات القراءة. صلاحية القراءة/المرور العامة تقتصر على مسار المشروع و`client/dist` الذي يقدمه Nginx، بينما تظل `.env` وقاعدة البيانات و`backups/` غير متاحة لمستخدم الويب.

## إعداد production

القيم الإلزامية موضحة في `.env.production.example`. أهم الضوابط:

- `NODE_ENV=production` و`ALLOW_DATABASE_RESET=false`.
- `JWT_SECRET` و`RETURN_QR_SECRET` قيمتان عشوائيتان مختلفتان، كل منهما بطول 32 حرفاً على الأقل.
- `CORS_ORIGIN` يحتوي origins صريحة فقط ولا يقبل `*`.
- `SEED_DEMO_USERS=false`؛ لا توجد كلمات مرور افتراضية في production.
- `TRUST_PROXY=loopback` عند وجود Nginx محلي.
- `VITE_API_BASE_URL=` فارغ لبناء same-origin.
- `BACKUP_DIR=./backups` و`BACKUP_RETENTION=10`.

يفشل السيرفر مبكراً إذا كانت القيم غير صحيحة أو غير آمنة.

## النشر الآلي المراجع

من مجلد المشروع:

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

السكريبت يثبت Node 20 وNginx وPM2، ينشئ مستخدم الخدمة، يولد أو يحتفظ بسر JWT قوي، يشغل `npm ci` وبوابة `npm run check`، يبني الواجهة same-origin، يهيئ Nginx وPM2، ويجدول نسخة يومية في `backups/`. لا يستخدم `chmod 777` ولا يشغّل التطبيق كـroot.

السكريبت يعرض اختيار إنشاء أول Admin. كلمة المرور تمر في بيئة العملية مؤقتاً ثم تُحذف ولا تُكتب في `.env`. يمكن تنفيذ الخطوة يدوياً مرة واحدة:

```bash
sudo -u a4pos -H env \
  BOOTSTRAP_ADMIN_USERNAME=admin \
  BOOTSTRAP_ADMIN_NAME='System Administrator' \
  BOOTSTRAP_ADMIN_PASSWORD='temporary-strong-password' \
  npm --prefix /opt/a4-office/server run admin:bootstrap
```

يرفض الأمر الإنشاء إذا كان هناك Admin بالفعل. يجب تغيير كلمة المرور المؤقتة بعد أول دخول.

## TLS وCORS

بعد تأكيد DNS، ثبّت شهادة TLS (مثلاً Certbot)، ثم احذف origin الخاص بـHTTP من `CORS_ORIGIN` وأعد تشغيل العملية:

```bash
sudo -u a4pos -H env PM2_HOME=/var/lib/a4pos/.pm2 pm2 restart a4-pos-server --update-env
```

## أسرار المرتجعات

اضبط `RETURN_QR_SECRET` في production بقيمة عشوائية قوية لا تقل عن 32 حرفًا ولا تستخدم قيمة التطوير أو المثال. يحدد `RETURN_AUTHORIZATION_TTL_HOURS` الصلاحية الافتراضية (`24`، والحد الأقصى داخل التطبيق 7 أيام). تغيير السر يبطل كل بطاقات المرتجع الفعالة، لذلك دوّره فقط ضمن إجراء معلن يتضمن إلغاء/إعادة إصدار البطاقات المفتوحة.

قبل قبول المرتجعات في staging اختبر دفعًا مختلطًا: يجب أن ينخفض النقد مرة واحدة فقط، وألا تغير البطاقة/المحفظة عهدة الدرج، وأن يظل التصريح فعالًا عند رفض التنفيذ بسبب نقص النقد.

## النسخ والاسترجاع

```bash
npm run db:backup
```

النسخ Online SQLite تشمل صفحات WAL الملتزمة. تُكتب كل نسخة أولًا إلى ملف `.partial` فريد، ويُفحص بـ`integrity_check` و`foreign_key_check`، ثم يُنشر باسم `.db` فريد عبر rename ذري داخل مجلد `backups/`. يحتفظ النظام بآخر 10 نسخ سليمة فقط، وينظف ملفات العمل والنسخ غير السليمة بدل اعتبارها صالحة.

اختبر الاسترجاع أولًا على staging: انسخ backup إلى مسار مؤقت، وجّه `SQLITE_DB_PATH` إليه، شغّل `npm run db:verify` ثم smoke tests وكتابة تجريبية على النسخة فقط. لا تُجرّب الكتابة على قاعدة التشغيل الأصلية.

للاسترجاع الفعلي، خذ نسخة Online أخيرة وتحقق من backup المختار قبل إيقاف الخدمة. جهّز نسخة staging باسم ينتهي بـ`.partial.db` على نفس filesystem الخاص بالوجهة وتحقق منها أولًا. بعد ذلك أوقف PM2 وانتظر إغلاق اتصال SQLite، ثم دوّر أو احذف **ملف القاعدة وكل sidecars** القديمة (`-wal` و`-shm` و`-journal`)؛ تركيب ملف `.db` مع WAL قديم يمكن أن يعيد بيانات غير مقصودة أو يتلف الاسترجاع. انقل النسخة الموثقة إلى اسم القاعدة بعملية rename ذرية:

```bash
set -euo pipefail
APP_DIR=/opt/a4-office
DB="$APP_DIR/server/src/db/a4_pos.db"
BACKUP="$APP_DIR/backups/a4_pos_CHOOSE_VERIFIED_BACKUP.db"
STAMP="$(date +%Y%m%d_%H%M%S)"

cd "$APP_DIR"
sudo -u a4pos -H env \
  SQLITE_DB_PATH="$BACKUP" \
  PRODUCTION_SQLITE_DB_PATH="$BACKUP" \
  npm --prefix server run db:verify

PARTIAL="${DB%.db}.restore-$STAMP.partial.db"
install -o a4pos -g a4pos -m 0640 -- "$BACKUP" "$PARTIAL"
sudo -u a4pos -H env \
  SQLITE_DB_PATH="$PARTIAL" \
  PRODUCTION_SQLITE_DB_PATH="$PARTIAL" \
  npm --prefix server run db:verify
rm -f -- "$PARTIAL-wal" "$PARTIAL-shm" "$PARTIAL-journal"

sudo -u a4pos -H env PM2_HOME=/var/lib/a4pos/.pm2 pm2 stop a4-pos-server
for artifact in "$DB" "$DB-wal" "$DB-shm" "$DB-journal"; do
  if [ -e "$artifact" ]; then
    mv -- "$artifact" "$artifact.pre-restore-$STAMP"
  fi
done

mv -- "$PARTIAL" "$DB"
sudo -u a4pos -H env \
  SQLITE_DB_PATH="$DB" \
  PRODUCTION_SQLITE_DB_PATH="$DB" \
  npm --prefix server run db:verify

sudo -u a4pos -H env PM2_HOME=/var/lib/a4pos/.pm2 pm2 restart a4-pos-server --update-env
curl --fail --silent http://127.0.0.1:5000/api/health
```

لا تحذف الملفات ذات اللاحقة `pre-restore-*` إلا بعد نجاح التشغيل وفحص السيناريوهات الأساسية على النسخة المسترجعة.

## قائمة القبول

```bash
npm run check
npm run security:audit
npm run deploy:check
npm run db:verify
```

ثم اختبر على staging: تسجيل Admin وCashier، بيع، حجز واستلام، مرتجع، شيفت، تقارير، إيصالات وملصقات، الوضعين الفاتح والداكن، والأحجام المستهدفة. لا تعتبر النشر مكتملًا قبل فحص Nginx وPM2 والنسخ والاسترجاع على staging.

# دليل تشغيل ورفع المنصة — A4 POS Platform

هذا الدليل يشرح كيفية تشغيل منصة A4 POS محلياً للتطوير، وكيفية رفعها إلى خادم إنتاجي (VPS/Hostinger/Node.js).

---

## 1. التشغيل المحلي (Local Setup)

### المتطلبات الأساسية
- **Node.js**: إصدار 18 أو أحدث.
- **npm**: مدير الحزم الافتراضي لـ Node.

### خطوات التثبيت والتشغيل:
1. **تثبيت الاعتماديات**:
   قم بتشغيل الأمر التالي في المجلد الرئيسي لتثبيت حزم السيرفر والواجهة الأمامية معاً:
   ```bash
   npm run install:all
   ```
2. **إعداد البيئة (.env)**:
   اذهب إلى مجلد `server/` وتأكد من وجود ملف `.env` يحتوي على القيم التالية:
   ```env
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=7d
   SQLITE_DB_PATH=./src/db/a4_pos.db
   ```
3. **التشغيل التجريبي**:
   قم بتشغيل الأمر التالي في المجلد الرئيسي للمشروع لتشغيل السيرفر والواجهة الأمامية بالتزامن:
   ```bash
   npm run dev
   ```
   - **الواجهة الأمامية (Client)**: ستعمل على الرابط `http://localhost:5173`.
   - **الخلفية (Server API)**: ستعمل على الرابط `http://localhost:5000`.

---

## 2. الرفع إلى الخادم الإنتاجي (Production Deployment on VPS)

تعتمد المنصة على قاعدة بيانات SQLite مدمجة وخفيفة الوزن، وواجهة React مبنية وجاهزة للتقديم كملفات استاتيكية.

### الخطوة 1: تهيئة خادم VPS (أوبونتو/Ubuntu)
قم بالاتصال بالخادم عبر SSH وتثبيت البرمجيات المطلوبة:
```bash
sudo apt update && sudo apt upgrade -y
# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
# تثبيت مدير العمليات PM2 ومخدم Nginx
sudo npm install -g pm2
sudo apt install nginx -y
```

### الخطوة 2: رفع الكود وبناء الواجهة الأمامية
1. قم بسحب الكود من مستودع Git الخاص بك على الخادم.
2. قم بتثبيت الحزم وبناء الواجهة الأمامية:
   ```bash
   npm run install:all
   npm run build
   ```
   هذا سينتج مجلد البناء `client/dist` الذي يحتوي على ملفات الواجهة الاستاتيكية الجاهزة للتقديم.

### الخطوة 3: تشغيل الخلفية (Backend) عبر PM2
1. تأكد من إعداد ملف `.env` الخاص ببيئة الإنتاج في المجلد `server/` وضبط `NODE_ENV=production`.
2. قم بتشغيل الخلفية كعملية مستمرة في الخلفية:
   ```bash
   cd server
   pm2 start src/server.js --name "a4-pos-server"
   pm2 save
   pm2 startup
   ```

### الخطوة 4: إعداد Nginx كمخدم وكيل (Reverse Proxy)
قم بإنشاء ملف إعدادات جديد لموقعك في Nginx:
```bash
sudo nano /etc/nginx/sites-available/a4-pos
```
أضف الإعدادات التالية (مع استبدال `yourdomain.com` بنطاقك أو عنوان IP الخاص بالخادم):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # تقديم ملفات الواجهة الأمامية للـ React مباشرة
    location / {
        root /var/www/a4-office/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # تمرير طلبات الـ API إلى خادم الـ Node.js
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
تفعيل الموقع وإعادة تشغيل Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/a4-pos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 3. الأتمتة والنسخ الاحتياطي الدوري (Cron Backups)

لحماية قاعدة البيانات، يوصى بجدولة عملية النسخ الاحتياطي التي تم إعدادها مسبقاً لتعمل بشكل دوري (مثال: كل يوم الساعة 12 منتصف الليل بتوقيت القاهرة).

لتعديل المهام المجدولة على الخادم:
```bash
crontab -e
```
أضف السطر التالي للجدولة اليومية (مع استبدال المسارات بالمسار المطلق لمشروعك على الخادم):
```cron
0 0 * * * cd /var/www/a4-office && /usr/bin/npm run db:backup >> /var/log/a4_backup.log 2>&1
```

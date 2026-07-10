# خريطة واجهات API — A4

> المسارات والأسماء التقنية بالإنجليزية، والشرح بالعربي. يجب تطبيق الصلاحيات والسجل والتأكد من الشيفت عند الحاجة.

## 1. Auth

| Method | Path | الاستخدام |
|---|---|---|
| POST | /api/auth/login | تسجيل دخول الأدمن أو الكاشير. |
| POST | /api/auth/refresh | تجديد الجلسة. |
| POST | /api/auth/logout | إنهاء الجلسة. |
| GET | /api/auth/me | بيانات المستخدم الحالي وصلاحياته. |

## 2. Admin Users

| Method | Path | الاستخدام |
|---|---|---|
| GET | /api/admin/users | عرض المستخدمين. |
| POST | /api/admin/users | إنشاء مستخدم. |
| PATCH | /api/admin/users/:id | تعديل مستخدم. |
| PATCH | /api/admin/users/:id/password | تغيير كلمة المرور. |
| PATCH | /api/admin/users/:id/disable | تعطيل مستخدم. |

## 3. Catalog

| Method | Path | الاستخدام |
|---|---|---|
| GET | /api/categories | عرض التصنيفات. |
| POST | /api/admin/categories | إنشاء تصنيف. |
| PATCH | /api/admin/categories/:id | تعديل تصنيف. |
| GET | /api/admin/price-tiers | عرض فئات الأسعار. |
| POST | /api/admin/price-tiers | إنشاء فئة سعر. |
| PATCH | /api/admin/price-tiers/:id | تعديل فئة سعر. |
| GET | /api/products | بحث وعرض المنتجات. |
| GET | /api/products/:id | تفاصيل منتج. |
| POST | /api/admin/products | إنشاء منتج بدون صور. |
| PATCH | /api/admin/products/:id | تعديل منتج. |
| POST | /api/admin/products/:id/qr-labels | تجهيز ملصقات رمز المنتج. |

## 4. Inventory

| Method | Path | الاستخدام |
|---|---|---|
| GET | /api/admin/inventory | عرض المخزون والعدادات. |
| POST | /api/admin/inventory/stock-add | إضافة مخزون. |
| POST | /api/admin/inventory/adjustment | تسوية مخزون. |
| GET | /api/admin/inventory/ledger | دفتر حركات المخزون. |

## 5. POS

| Method | Path | الاستخدام |
|---|---|---|
| POST | /api/pos/scan-product | قراءة رمز المنتج وإرجاع السعر والمخزون. |
| GET | /api/pos/products/search | بحث المنتجات. |
| POST | /api/pos/orders/checkout | بيع عادي وخصم مخزون. |
| GET | /api/pos/orders/:id | عرض فاتورة. |
| GET | /api/pos/receipts/:id | عرض ريسيت. |
| POST | /api/pos/receipts/:id/reprint | إعادة طباعة مع AuditLog. |

## 6. Preorders

| Method | Path | الاستخدام |
|---|---|---|
| POST | /api/pos/preorders | إنشاء حجز بديبوزت. |
| POST | /api/pos/preorders/scan | قراءة رمز الحجز. |
| GET | /api/pos/preorders/:id | عرض حجز محدد. |
| POST | /api/pos/preorders/:id/pickup | تحصيل المتبقي وتسليم الحجز. |
| GET | /api/admin/preorders | عرض الحجوزات للأدمن. |
| PATCH | /api/admin/preorders/:id/status | تعديل حالة حجز بصلاحية أدمن. |

## 7. Shifts

| Method | Path | الاستخدام |
|---|---|---|
| POST | /api/shifts/open | فتح شيفت. |
| GET | /api/shifts/current | الشيفت الحالي للكاشير. |
| POST | /api/shifts/current/close-request | طلب قفل الشيفت. |
| GET | /api/admin/shifts | كل الشيفتات للأدمن. |
| GET | /api/admin/shifts/:id | تفاصيل شيفت. |
| POST | /api/admin/shifts/:id/approve | اعتماد التقفيل. |
| POST | /api/admin/shifts/:id/reject | رفض التقفيل مع ملاحظة. |

## 8. Reports

| Method | Path | الاستخدام |
|---|---|---|
| GET | /api/admin/kpis | مؤشرات الأدمن. |
| GET | /api/admin/reports/sales | تقرير المبيعات. |
| GET | /api/admin/reports/preorders | تقرير الحجوزات. |
| GET | /api/admin/reports/inventory | تقرير المخزون. |
| GET | /api/admin/reports/shifts | تقرير الشيفتات. |
| GET | /api/admin/reports/export | تصدير التقارير. |

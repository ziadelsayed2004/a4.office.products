import express from 'express';
import cors from 'cors';
import { helmetSecurityHeaders, apiRateLimiter, customCorsOptions } from './middleware/security.js';
import db from './db/index.js';
import authRoutes from './modules/auth/auth.routes.js';
import auditLogRoutes from './modules/auditLogs/auditLog.routes.js';
import userRoutes from './modules/users/users.routes.js';
import categoryRoutes from './modules/categories/categories.routes.js';
import priceTierRoutes from './modules/priceTiers/priceTiers.routes.js';
import { productRoutes, productAdminRoutes } from './modules/products/products.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import posRoutes from './modules/pos/pos.routes.js';
import receiptRoutes from './modules/receipts/receipts.routes.js';
import preorderRoutes, { preorderAdminRoutes } from './modules/preorders/preorders.routes.js';
import shiftsRoutes from './modules/shifts/shifts.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import printerSettingsRoutes from './modules/printerSettings/printerSettings.routes.js';
import { authenticate } from './middleware/auth.js';
import { isAdmin, restrictCashierSelfEdit } from './middleware/rbac.js';

const app = express();

// Secure HTTP headers
app.use(helmetSecurityHeaders);

// CORS setup
app.use(cors(customCorsOptions));

app.use(express.json());

// Apply rate limiting to all api endpoints
app.use('/api', apiRateLimiter);

// Wire Auth Routes
app.use('/api/auth', authRoutes);

// Wire Audit Logs Routes
app.use('/api/admin/audit-logs', auditLogRoutes);

// Wire User Management Routes
app.use('/api/admin/users', userRoutes);

// Wire Categories Routes
app.use('/api', categoryRoutes);

// Wire Price Tiers Routes
app.use('/api/admin/price-tiers', priceTierRoutes);

// Wire Products Routes
app.use('/api/products', productRoutes);
app.use('/api/admin/products', productAdminRoutes);

// Wire Inventory Routes
app.use('/api/admin/inventory', inventoryRoutes);

// Wire Payment Methods Routes
app.use('/api/payment-methods', paymentsRoutes);

// Wire Customers Minimal Routes
app.use('/api/customers', customersRoutes);

// Wire POS scan & search routes
app.use('/api/pos', posRoutes);

// Wire Receipts routes
app.use('/api/pos/receipts', receiptRoutes);

// Wire Preorders routes
app.use('/api/pos/preorders', preorderRoutes);
app.use('/api/admin/preorders', preorderAdminRoutes);

// Wire Shifts routes
app.use('/api/shifts', shiftsRoutes);

// Wire Reports & KPIs routes
app.use('/api/admin', reportsRoutes);

// Wire Printer Settings routes
app.use('/api/admin/printer-settings', printerSettingsRoutes);

app.patch('/api/admin/users/:id', authenticate, isAdmin, (req, res) => {
  res.json({
    status: 'success',
    message: 'تم تحديث بيانات المستخدم بنجاح.'
  });
});

app.patch('/api/admin/users/:id/self-edit', authenticate, restrictCashierSelfEdit, (req, res) => {
  res.json({
    status: 'success',
    message: 'تم تعديل الحساب بنجاح.'
  });
});

// Barcode/QR Code printing preview endpoint
app.get('/api/admin/print-job/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const tokenRow = await db.get("SELECT * FROM qr_tokens WHERE token = ?;", [token]);

    if (!tokenRow) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>خطأ في أمر الطباعة</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Cairo', sans-serif; text-align: center; padding: 50px; background-color: #f8f9fa; color: #111827; }
            .error-card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: inline-block; max-width: 400px; border: 1px solid #e5e7eb; }
            h1 { color: #d93025; font-size: 1.5rem; }
            p { color: #4b5563; font-size: 0.95rem; }
          </style>
        </head>
        <body>
          <div class="error-card">
            <h1>خطأ في أمر الطباعة</h1>
            <p>عذراً، لم يتم العثور على رمز الاستجابة السريعة أو الباركود المطلوب. قد يكون الرمز غير صحيح أو تم حذفه.</p>
          </div>
        </body>
        </html>
      `);
    }

    const qty = parseInt(req.query.qty, 10) || 1;
    const size = req.query.size || 'medium';

    let title = '';
    let subTitle = '';
    let barcode = '';
    let priceText = '';
    let qrValue = '';

    if (tokenRow.type === 'product') {
      const product = await db.get("SELECT * FROM products WHERE id = ?;", [tokenRow.reference_id]);
      if (!product) {
        return res.status(404).send('المنتج المرتبط برمز الطباعة غير موجود.');
      }
      title = product.name;
      barcode = product.barcode || product.sku;
      qrValue = barcode;

      const prices = await db.all(`
        SELECT pp.price, pt.name AS tier_name 
        FROM product_prices pp 
        JOIN price_tiers pt ON pp.price_tier_id = pt.id 
        WHERE pp.product_id = ?;
      `, [product.id]);

      const retailPriceRow = prices.find(p => p.tier_name === 'سعر التجزئة الافتراضي');
      priceText = retailPriceRow ? (retailPriceRow.price / 100).toFixed(2) + ' ج.م' : '';

      const bookDetails = await db.get("SELECT * FROM product_book_details WHERE product_id = ?;", [product.id]);
      if (bookDetails) {
        const grade = bookDetails.school_grade || '';
        const subject = bookDetails.subject || '';
        subTitle = [grade, subject].filter(Boolean).join(' - ');
      }
    } else if (tokenRow.type === 'preorder') {
      const preorder = await db.get(`
        SELECT p.*, c.name AS customer_name, c.phone AS customer_phone 
        FROM preorders p 
        JOIN customers c ON p.customer_id = c.id 
        WHERE p.id = ?;
      `, [tokenRow.reference_id]);

      if (!preorder) {
        return res.status(404).send('طلب الحجز المسبق غير موجود.');
      }
      title = `حجز مسبق للعميل: ${preorder.customer_name}`;
      subTitle = `رقم الحجز: ${preorder.preorder_number}`;
      barcode = preorder.preorder_number;
      qrValue = tokenRow.token;
      priceText = `العربون: ${(preorder.deposit_paid / 100).toFixed(2)} ج.م / المتبقي: ${((preorder.total_amount - preorder.deposit_paid) / 100).toFixed(2)} ج.م`;
    }

    let widthMm = 50;
    let heightMm = 25;
    if (size === 'small') {
      widthMm = 38;
      heightMm = 25;
    } else if (size === 'large') {
      widthMm = 80;
      heightMm = 50;
    }

    res.send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>طباعة ملصقات الباركود - منصة A4</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Cairo', sans-serif;
            background-color: #f1f5f9;
            color: #1e293b;
          }
          
          .toolbar {
            background-color: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          .toolbar-title {
            font-size: 1.1rem;
            font-weight: 700;
            color: #0f5fa6;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .toolbar-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .btn {
            font-family: 'Cairo', sans-serif;
            font-weight: 600;
            font-size: 0.85rem;
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .btn-primary {
            background-color: #0f5fa6;
            color: #ffffff;
          }
          .btn-primary:hover {
            background-color: #003d73;
          }
          .btn-secondary {
            background-color: #f1f5f9;
            color: #475569;
            border: 1px solid #cbd5e1;
          }
          .btn-secondary:hover {
            background-color: #e2e8f0;
          }
          .form-select {
            font-family: 'Cairo', sans-serif;
            font-size: 0.85rem;
            padding: 7px 12px;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
            background-color: #ffffff;
            cursor: pointer;
          }

          .preview-container {
            padding: 40px 20px;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 20px;
          }

          .qr-label-card {
            background-color: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            box-sizing: border-box;
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            padding: 2.5mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            position: relative;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            page-break-inside: avoid;
            page-break-after: always;
          }

          .label-header {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 0.5px solid #e2e8f0;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }

          .label-logo-text {
            font-size: 6pt;
            font-weight: 700;
            color: #0f5fa6;
          }

          .label-title {
            font-size: ${size === 'small' ? '7pt' : size === 'medium' ? '8.5pt' : '11pt'};
            font-weight: 700;
            color: #1e293b;
            text-align: center;
            width: 100%;
            margin: 0;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .label-subtitle {
            font-size: ${size === 'small' ? '5.5pt' : '7pt'};
            color: #64748b;
            text-align: center;
            margin: 0.5mm 0;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .label-content-row {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-grow: 1;
            margin-top: 1mm;
          }

          .label-meta {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            flex-grow: 1;
            padding-right: 1.5mm;
          }

          .label-price {
            font-size: ${size === 'small' ? '8pt' : '10pt'};
            font-weight: 800;
            color: #0f5fa6;
            margin-bottom: 0.5mm;
          }

          .label-code {
            font-size: 5.5pt;
            color: #64748b;
            font-family: monospace;
          }

          .qr-code-canvas {
            width: ${size === 'small' ? '14mm' : size === 'medium' ? '17mm' : '30mm'} !important;
            height: ${size === 'small' ? '14mm' : size === 'medium' ? '17mm' : '30mm'} !important;
          }

          @media print {
            @page {
              margin: 0;
              size: ${widthMm}mm ${heightMm}mm;
            }
            body {
              background-color: #ffffff;
              margin: 0;
              padding: 0;
            }
            .toolbar {
              display: none !important;
            }
            .preview-container {
              padding: 0;
              margin: 0;
              gap: 0;
            }
            .qr-label-card {
              border: none;
              box-shadow: none;
              margin: 0;
              padding: 1.5mm;
              width: ${widthMm}mm;
              height: ${heightMm}mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <div class="toolbar-title">
            <svg width="24" height="24" viewBox="0 0 100 100" style="display:inline-block;vertical-align:middle;">
              <circle cx="50" cy="50" r="45" fill="#0f5fa6"/>
              <path d="M40 70 L40 50 L25 50 L25 40 L40 40 L40 20 L55 20 L55 40 L65 40 L65 50 L55 50 L55 70 Z" fill="#ffffff"/>
            </svg>
            <span>معاينة طباعة ملصقات الباركود</span>
          </div>
          <div class="toolbar-actions">
            <label for="qty" style="font-size: 0.85rem; font-weight: 600; color: #475569;">الكمية:</label>
            <select id="qty" class="form-select" onchange="updateParams()">
              ${[1, 2, 5, 10, 20, 50, 100].map(q => `<option value="${q}" ${q === qty ? 'selected' : ''}>${q} ملصقات</option>`).join('')}
            </select>

            <label for="size" style="font-size: 0.85rem; font-weight: 600; color: #475569;">المقاس:</label>
            <select id="size" class="form-select" onchange="updateParams()">
              <option value="small" ${size === 'small' ? 'selected' : ''}>صغير (38x25 مم)</option>
              <option value="medium" ${size === 'medium' ? 'selected' : ''}>متوسط (50x25 مم)</option>
              <option value="large" ${size === 'large' ? 'selected' : ''}>كبير (80x50 مم)</option>
            </select>

            <button class="btn btn-secondary" onclick="window.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="window.print()">طباعة</button>
          </div>
        </div>

        <div class="preview-container">
          ${Array.from({ length: qty }).map(() => `
            <div class="qr-label-card">
              <div class="label-header">
                <span class="label-logo-text">مكتبة A4</span>
                <span style="font-size: 5pt; color: #94a3b8;">منصة البيع A4</span>
              </div>
              <h2 class="label-title">${title}</h2>
              ${subTitle ? `<div class="label-subtitle">${subTitle}</div>` : ''}
              <div class="label-content-row">
                <div class="label-meta">
                  ${priceText ? `<div class="label-price">${priceText}</div>` : ''}
                  <div class="label-code">${barcode}</div>
                </div>
                <canvas class="qr-code-canvas" data-value="${qrValue}"></canvas>
              </div>
            </div>
          `).join('')}
        </div>

        <script>
          document.querySelectorAll('.qr-code-canvas').forEach(function(canvas) {
            new QRious({
              element: canvas,
              value: canvas.getAttribute('data-value'),
              size: 150,
              level: 'H'
            });
          });

          function updateParams() {
            var qtyVal = document.getElementById('qty').value;
            var sizeVal = document.getElementById('size').value;
            window.location.href = window.location.pathname + '?qty=' + qtyVal + '&size=' + sizeVal;
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('خطأ داخلي في الخادم أثناء تحضير صفحة الطباعة.');
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const testResult = await db.get('SELECT 1 + 1 AS result;');
    const isDbConnected = testResult && testResult.result === 2;

    res.json({
      status: 'ok',
      message: 'A4 POS Backend is running',
      timestamp: new Date().toISOString(),
      timezone: 'Africa/Cairo',
      database: {
        status: isDbConnected ? 'connected' : 'degraded',
        engine: 'SQLite'
      }
    });
  } catch (error) {
    res.json({
      status: 'degraded',
      message: 'A4 POS Backend is running but database connectivity is broken',
      timestamp: new Date().toISOString(),
      timezone: 'Africa/Cairo',
      database: {
        status: 'disconnected',
        error: error.message
      }
    });
  }
});

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;

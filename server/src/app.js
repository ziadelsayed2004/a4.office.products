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

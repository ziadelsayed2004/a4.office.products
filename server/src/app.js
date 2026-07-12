import express from 'express';
import cors from 'cors';
import { helmetSecurityHeaders, apiRateLimiter, loginRateLimiter, customCorsOptions } from './middleware/security.js';
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
import { adminInvoiceRoutes, posInvoiceRoutes } from './modules/invoices/invoices.routes.js';
import preorderRoutes, { preorderAdminRoutes } from './modules/preorders/preorders.routes.js';
import shiftsRoutes from './modules/shifts/shifts.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import printerSettingsRoutes, { safePrinterSettingsRoutes } from './modules/printerSettings/printerSettings.routes.js';
import { authenticate } from './middleware/auth.js';
import { isAdmin } from './middleware/rbac.js';

const app = express();

app.use(helmetSecurityHeaders);
app.use(cors(customCorsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth/login', loginRateLimiter);
app.use('/api', apiRateLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/admin/audit-logs', auditLogRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api', categoryRoutes);
app.use('/api/admin/price-tiers', priceTierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/products', productAdminRoutes);
app.use('/api/admin/inventory', inventoryRoutes);
app.use('/api/payment-methods', paymentsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/pos/receipts', receiptRoutes);
app.use('/api/admin/invoices', adminInvoiceRoutes);
app.use('/api/pos/invoices', posInvoiceRoutes);
app.use('/api/pos/preorders', preorderRoutes);
app.use('/api/admin/preorders', preorderAdminRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/admin', reportsRoutes);
app.use('/api/admin/printer-settings', printerSettingsRoutes);
app.use('/api/printer-settings', safePrinterSettingsRoutes);

// Compatibility tombstone for the old unauthenticated, CDN-backed label page.
// Labels are now rendered by the protected same-origin client print route.
app.get('/api/admin/print-job/:token', authenticate, isAdmin, (req, res) => {
  res.status(410).json({
    error: 'Legacy print pages were removed. Use the protected product label print route.',
    code: 'LEGACY_PRINT_ROUTE_REMOVED'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const result = await db.get('SELECT 1 AS result;');
    const journal = await db.get('PRAGMA journal_mode;');
    const foreignKeys = await db.get('PRAGMA foreign_keys;');
    return res.status(200).json({
      status: result?.result === 1 ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      timezone: 'Africa/Cairo',
      database: { engine: 'SQLite', journalMode: journal?.journal_mode, foreignKeys: foreignKeys?.foreign_keys === 1 }
    });
  } catch (error) {
    return res.status(503).json({ status: 'degraded', database: { error: error.message } });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Route not found', code: 'ROUTE_NOT_FOUND' }));

app.use((error, req, res, next) => {
  console.error(error.stack || error);
  if (res.headersSent) return next(error);
  return res.status(error.status || 500).json({
    error: error.status ? error.message : 'Internal Server Error',
    code: error.code || 'INTERNAL_SERVER_ERROR'
  });
});

export default app;

const express = require('express');
const router = express.Router();
const exportsService = require('./exportsService');
const { requireAuth, checkPermission } = require('../../middleware/rbac');
const { auditLog } = require('../../middleware/audit');

// Helper to handle sending downloads based on format
function sendExportDownload(res, filenameBase, format, contentOrBuffer) {
  const fileFormat = (format || 'xlsx').toLowerCase();
  if (fileFormat === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.status(200).send(contentOrBuffer);
  } else if (fileFormat === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
    return res.status(200).send(contentOrBuffer);
  } else {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    return res.status(200).send(contentOrBuffer);
  }
}

// 1. GET /api/exports/products - Export products catalog
router.get('/products', requireAuth, checkPermission('exports.run'), auditLog('export_products', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportProducts(format);
    sendExportDownload(res, 'products_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 2. GET /api/exports/prices - Export price sheets
router.get('/prices', requireAuth, checkPermission('exports.run'), auditLog('export_prices', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportPrices(format);
    sendExportDownload(res, 'prices_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 3. GET /api/exports/authors - Export authors list
router.get('/authors', requireAuth, checkPermission('exports.run'), auditLog('export_authors', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportAuthors(format);
    sendExportDownload(res, 'authors_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 4. GET /api/exports/outlets - Export outlets listing
router.get('/outlets', requireAuth, checkPermission('exports.run'), auditLog('export_outlets', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportOutlets(format);
    sendExportDownload(res, 'outlets_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 5. GET /api/exports/invoices - Export invoice records
router.get('/invoices', requireAuth, checkPermission('exports.run'), auditLog('export_invoices', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportInvoices(req.query, format);
    sendExportDownload(res, 'invoices_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 5a. GET /api/exports/invoice-items - Export invoice items detailed catalog (NEW!)
router.get('/invoice-items', requireAuth, checkPermission('exports.run'), auditLog('export_invoice_items', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportInvoiceItems(req.query, format);
    sendExportDownload(res, 'invoice_items_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 6. GET /api/exports/payments - Export recorded payments history
router.get('/payments', requireAuth, checkPermission('exports.run'), auditLog('export_payments', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportPayments(req.query, format);
    sendExportDownload(res, 'payments_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 7. GET /api/exports/inventory - Export transaction ledger
router.get('/inventory', requireAuth, checkPermission('exports.run'), auditLog('export_inventory', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportInventory(req.query, format);
    sendExportDownload(res, 'inventory_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 7a. GET /api/exports/returns - Export returns history
router.get('/returns', requireAuth, checkPermission('exports.run'), auditLog('export_returns', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportReturns(req.query, format);
    sendExportDownload(res, 'returns_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 7b. GET /api/exports/shipments - Export shipments history
router.get('/shipments', requireAuth, checkPermission('exports.run'), auditLog('export_shipments', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportShipments(req.query, format);
    sendExportDownload(res, 'shipments_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 7c. GET /api/exports/courier-sheet - Export shipments courier delivery sheet (NEW!)
router.get('/courier-sheet', requireAuth, checkPermission('exports.run'), auditLog('export_courier_sheet', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportCourierSheet(req.query, format);
    sendExportDownload(res, 'courier_sheet_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 7d. GET /api/exports/outlet-statement - Export outlet financial statement ledger (NEW!)
router.get('/outlet-statement', requireAuth, checkPermission('exports.run'), auditLog('export_outlet_statement', 'exports'), async (req, res) => {
  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportOutletStatement(req.query, format);
    sendExportDownload(res, 'outlet_statement_export', format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 8. GET /api/exports/reports - Export dynamic report sheets (balances, stock, authors, receipts)
router.get('/reports', requireAuth, checkPermission('exports.run'), auditLog('export_reports', 'exports'), async (req, res) => {
  const { type } = req.query;
  if (!type || !['balances', 'stock', 'authors', 'receipts'].includes(type)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid report type is required (balances, stock, authors, receipts).' });
  }

  try {
    const format = req.query.format || 'xlsx';
    const content = await exportsService.exportReport(type, req.query, req.session.user, format);
    sendExportDownload(res, `${type}_report_export`, format, content);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;

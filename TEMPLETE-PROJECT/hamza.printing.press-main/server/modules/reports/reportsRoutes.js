const express = require('express');
const router = express.Router();
const reportsService = require('./reportsService');
const usersService = require('../users/usersService');
const authorsService = require('../authors/authorsService');
const outletsService = require('../outlets/outletsService');
const { requireAuth, checkPermission } = require('../../middleware/rbac');

// Helper to get restricted author IDs if the user is a linked author
async function getFilterAuthorIds(req) {
  const userId = req.session.user.id;
  const userRoles = await usersService.getUserRoles(userId);
  const isElevated = userRoles.some(r => ['super_admin', 'admin', 'accountant', 'readonly_viewer'].includes(r.name));

  if (!isElevated) {
    const linkedAuthors = await authorsService.getLinkedAuthorsForUser(userId);
    if (linkedAuthors.length > 0) {
      return linkedAuthors;
    }
  }
  return null;
}

// 1. GET /api/reports/financials/summary - Overall financial summary metrics
router.get('/financials/summary', requireAuth, checkPermission('reports.view'), async (req, res) => {
  const { startDate = '', endDate = '', outletId = null, outletTypeId = null, governorate = '' } = req.query;

  try {
    const filterAuthorIds = await getFilterAuthorIds(req);
    const data = await reportsService.getFinancialSummary({
      startDate,
      endDate,
      outletId: outletId ? parseInt(outletId, 10) : null,
      outletTypeId: outletTypeId ? parseInt(outletTypeId, 10) : null,
      governorate,
      authorIds: filterAuthorIds
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 2. GET /api/reports/financials/by-outlet - Sales/balances grouped by outlet
router.get('/financials/by-outlet', requireAuth, checkPermission('reports.view'), async (req, res) => {
  const { startDate = '', endDate = '', governorate = '', outletTypeId = null } = req.query;

  try {
    const userId = req.session.user.id;
    const userRoles = await usersService.getUserRoles(userId);
    const isElevated = userRoles.some(r => ['super_admin', 'admin', 'accountant', 'readonly_viewer'].includes(r.name));

    let filterOutletIds = null;
    if (!isElevated) {
      filterOutletIds = await outletsService.getLinkedOutletsForUser(userId);
    }

    const list = await reportsService.getBalancesByOutlet({
      startDate,
      endDate,
      governorate,
      outletTypeId: outletTypeId ? parseInt(outletTypeId, 10) : null,
      outletIds: filterOutletIds
    });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 3. GET /api/reports/financials/by-governorate - Sales/balances grouped by governorate
router.get('/financials/by-governorate', requireAuth, checkPermission('reports.view'), async (req, res) => {
  const { startDate = '', endDate = '' } = req.query;

  try {
    const list = await reportsService.getBalancesByGovernorate({ startDate, endDate });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 4. GET /api/reports/financials/by-outlet-type - Sales/balances grouped by outlet type
router.get('/financials/by-outlet-type', requireAuth, checkPermission('reports.view'), async (req, res) => {
  const { startDate = '', endDate = '' } = req.query;

  try {
    const list = await reportsService.getBalancesByOutletType({ startDate, endDate });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 5. GET /api/reports/stock - Stock transaction aggregate metrics per product
router.get('/stock', requireAuth, checkPermission('reports.view'), async (req, res) => {
  const { search = '', category = '', status = '' } = req.query;

  try {
    const filterAuthorIds = await getFilterAuthorIds(req);
    const list = await reportsService.getStockReport({ search, category, status, authorIds: filterAuthorIds });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 6. GET /api/reports/authors - Author copies/sales and remaining stock reports
router.get('/authors', requireAuth, checkPermission('reports.view'), async (req, res) => {
  const { search = '', status = '' } = req.query;

  try {
    const filterAuthorIds = await getFilterAuthorIds(req);
    const list = await reportsService.getAuthorReport({ search, status, authorIds: filterAuthorIds });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 7. GET /api/reports/receipts - Supplier receipt quantity and cost summaries
router.get('/receipts', requireAuth, checkPermission('reports.view'), async (req, res) => {
  const { search = '', startDate = '', endDate = '' } = req.query;

  try {
    const filterAuthorIds = await getFilterAuthorIds(req);
    const list = await reportsService.getReceiptReport({ search, startDate, endDate, authorIds: filterAuthorIds });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;

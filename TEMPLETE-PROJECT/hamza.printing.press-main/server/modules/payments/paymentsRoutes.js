const express = require('express');
const router = express.Router();
const paymentsService = require('./paymentsService');
const outletsService = require('../outlets/outletsService');
const usersService = require('../users/usersService');
const { requireAuth, checkPermission } = require('../../middleware/rbac');
const { auditLog } = require('../../middleware/audit');

// 1. GET /api/payments - List and filter payments
router.get('/', requireAuth, checkPermission('payments.view'), async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const invoiceId = req.query.invoiceId ? parseInt(req.query.invoiceId, 10) : null;
  const supplyStatus = req.query.supplyStatus || '';
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';

  try {
    const userId = req.session.user.id;
    const userRoles = await usersService.getUserRoles(userId);
    const isElevated = userRoles.some(r => ['super_admin', 'admin', 'accountant', 'inventory_manager', 'sales_staff', 'shipping_user'].includes(r.name));

    let filterOutletIds = null;
    const queryOutletId = req.query.outletId ? parseInt(req.query.outletId, 10) : null;
    if (!isElevated) {
      const linkedOutlets = await outletsService.getLinkedOutletsForUser(userId);
      if (queryOutletId) {
        filterOutletIds = linkedOutlets.includes(queryOutletId) ? [queryOutletId] : [0];
      } else {
        filterOutletIds = linkedOutlets.length > 0 ? linkedOutlets : null;
      }
    } else if (queryOutletId) {
      filterOutletIds = [queryOutletId];
    }

    const list = await paymentsService.getPayments({ limit, offset, invoiceId, outletIds: filterOutletIds, supplyStatus, startDate, endDate });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 2. POST /api/payments - Record a payment
router.post('/', requireAuth, checkPermission('payments.create'), auditLog('create_payment', 'payments'), async (req, res) => {
  const { invoiceId, amount, paymentMethod, paymentDate, referenceNumber = '', notes = '', supplyStatus = 'not_supplied', receiptName, receiptData } = req.body;

  if (!invoiceId || amount === undefined || !paymentMethod) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invoice ID, amount, and payment method are required.' });
  }

  try {
    const userId = req.session.user.id;
    const payment = await paymentsService.recordPayment({
      invoiceId,
      amount,
      paymentMethod,
      paymentDate,
      referenceNumber,
      notes,
      supplyStatus,
      userId,
      receiptName,
      receiptData
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      payment
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    if (msg.includes('required') || msg.includes('positive') || msg.includes('exceeds') || msg.includes('fully paid') || msg.includes('supply status') || msg.includes('file type') || msg.includes('size exceeds')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 3. POST /api/payments/:id/reverse - Reverse/cancel a payment
router.post('/:id/reverse', requireAuth, checkPermission('payments.reverse'), auditLog('reverse_payment', 'payments'), async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);
  const { notes = '' } = req.body;

  try {
    const userId = req.session.user.id;
    const result = await paymentsService.reversePayment(paymentId, { notes, userId });
    res.status(200).json({
      success: true,
      message: 'Payment reversed successfully.',
      ...result
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 4. POST /api/payments/:id/supply - Mark a single payment as supplied
router.post('/:id/supply', requireAuth, checkPermission('payments.mark_supplied'), auditLog('supply_payment', 'payments'), async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);
  try {
    const userId = req.session.user.id;
    const result = await paymentsService.supplyPayments({ paymentIds: [paymentId], userId });
    res.status(200).json({
      success: true,
      message: 'Payment marked as supplied successfully.',
      ...result
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 5. POST /api/payments/supply-batch - Mark multiple payments as supplied
router.post('/supply-batch', requireAuth, checkPermission('payments.supply_batch'), auditLog('supply_payments_batch', 'payments'), async (req, res) => {
  const { paymentIds } = req.body;
  if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'paymentIds array is required.' });
  }
  try {
    const userId = req.session.user.id;
    const result = await paymentsService.supplyPayments({ paymentIds, userId });
    res.status(200).json({
      success: true,
      message: 'Batch payments marked as supplied successfully.',
      ...result
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 6. POST /api/payments/:id/reverse-supply - Reverse supply status of a payment
router.post('/:id/reverse-supply', requireAuth, checkPermission('payments.reverse'), auditLog('reverse_supply_payment', 'payments'), async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);
  const { notes = '' } = req.body;
  try {
    const userId = req.session.user.id;
    const result = await paymentsService.reversePaymentSupply(paymentId, { notes, userId });
    res.status(200).json({
      success: true,
      message: 'Payment supply reversed successfully.',
      ...result
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    if (msg.includes('not supplied')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 7. GET /api/payments/invoice/:invoiceId/metrics - Fetch metrics for a specific invoice
router.get('/invoice/:invoiceId/metrics', requireAuth, checkPermission('payments.view'), async (req, res) => {
  const invoiceId = parseInt(req.params.invoiceId, 10);

  try {
    const metrics = await paymentsService.getPaymentMetrics(invoiceId);
    if (!metrics) {
      return res.status(404).json({ error: 'Not Found', message: 'Invoice not found.' });
    }
    res.status(200).json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 8. GET /api/payments/receipts/review-queue - Get review queue
router.get('/receipts/review-queue', requireAuth, checkPermission('payments.view'), async (req, res) => {
  const status = req.query.status || 'pending_review';
  const outletId = req.query.outletId ? parseInt(req.query.outletId, 10) : null;
  const invoiceId = req.query.invoiceId ? parseInt(req.query.invoiceId, 10) : null;
  const recordedBy = req.query.recordedBy ? parseInt(req.query.recordedBy, 10) : null;
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount) : null;
  const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount) : null;

  try {
    const list = await paymentsService.getReviewQueue({ 
      status, 
      outletId, 
      invoiceId,
      recordedBy,
      startDate,
      endDate,
      minAmount,
      maxAmount
    });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 9. GET /api/payments/:id/receipt - Download receipt file
router.get('/:id/receipt', requireAuth, checkPermission('payments.view'), async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);
  try {
    const payment = await paymentsService.getPaymentById(paymentId);
    if (!payment || !payment.receipt_stored_path) {
      return res.status(404).json({ error: 'Not Found', message: 'Receipt not found for this payment.' });
    }

    const fs = require('fs');
    if (!fs.existsSync(payment.receipt_stored_path)) {
      return res.status(404).json({ error: 'Not Found', message: 'Receipt file not found on disk.' });
    }

    res.setHeader('Content-Type', payment.receipt_mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(payment.receipt_original_name)}"`);
    fs.createReadStream(payment.receipt_stored_path).pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 10. POST /api/payments/:id/review - Review receipt
router.post('/:id/review', requireAuth, checkPermission('payments.create'), auditLog('review_payment_receipt', 'payments'), async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);
  const { action, notes = '' } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Action must be "approve" or "reject".' });
  }

  try {
    const userId = req.session.user.id;
    const result = await paymentsService.reviewPaymentReceipt(paymentId, { action, notes, userId });
    res.status(200).json({
      success: true,
      message: `Payment receipt ${action}d successfully.`,
      payment: result
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    if (msg.includes('already')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;

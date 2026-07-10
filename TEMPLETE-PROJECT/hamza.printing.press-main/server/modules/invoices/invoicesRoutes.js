const express = require('express');
const router = express.Router();
const invoicesService = require('./invoicesService');
const paymentsService = require('../payments/paymentsService');
const pdfService = require('./pdfService');
const usersService = require('../users/usersService');
const authorsService = require('../authors/authorsService');
const outletsService = require('../outlets/outletsService');
const { requireAuth, checkPermission } = require('../../middleware/rbac');
const { auditLog } = require('../../middleware/audit');

// 1. GET /api/invoices - List and filter invoices
router.get('/', requireAuth, checkPermission('invoices.view'), async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const search = req.query.search || '';
  const productId = req.query.productId ? parseInt(req.query.productId, 10) : null;
  const authorId = req.query.authorId ? parseInt(req.query.authorId, 10) : null;
  const outletId = req.query.outletId ? parseInt(req.query.outletId, 10) : null;
  const outletTypeId = req.query.outletTypeId ? parseInt(req.query.outletTypeId, 10) : null;
  const governorate = req.query.governorate || '';
  const paymentStatus = req.query.paymentStatus || '';
  const shippingStatus = req.query.shippingStatus || '';
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  const hasRemaining = req.query.hasRemaining || '';
  const minRemaining = req.query.minRemaining !== undefined ? parseFloat(req.query.minRemaining) : null;
  const maxRemaining = req.query.maxRemaining !== undefined ? parseFloat(req.query.maxRemaining) : null;

  try {
    const userId = req.session.user.id;
    const userRoles = await usersService.getUserRoles(userId);
    const isAuthor = userRoles.some(r => r.name === 'author');
    const isOutlet = userRoles.some(r => r.name === 'outlet');
    const isElevated = userRoles.some(r => ['super_admin', 'admin', 'accountant', 'inventory_manager', 'sales_staff', 'shipping_user'].includes(r.name));

    let filterAuthorIds = null;
    let filterOutletIds = null;

    if (!isElevated) {
      if (isAuthor) {
        filterAuthorIds = await authorsService.getLinkedAuthorsForUser(userId);
      } else {
        const linkedAuthors = await authorsService.getLinkedAuthorsForUser(userId);
        if (linkedAuthors.length > 0) {
          filterAuthorIds = linkedAuthors;
        }
      }

      if (isOutlet) {
        filterOutletIds = await outletsService.getLinkedOutletsForUser(userId);
      } else {
        const linkedOutlets = await outletsService.getLinkedOutletsForUser(userId);
        if (linkedOutlets.length > 0) {
          filterOutletIds = linkedOutlets;
        }
      }
    }

    const list = await invoicesService.getInvoices({
      limit,
      offset,
      search,
      productId,
      authorId,
      outletId,
      outletTypeId,
      governorate,
      paymentStatus,
      shippingStatus,
      startDate,
      endDate,
      hasRemaining,
      minRemaining,
      maxRemaining,
      authorIds: filterAuthorIds,
      outletIds: filterOutletIds
    });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 2. GET /api/invoices/:id - Retrieve invoice details by ID
router.get('/:id', requireAuth, checkPermission('invoices.view'), async (req, res) => {
  const invoiceId = parseInt(req.params.id, 10);

  try {
    const invoice = await invoicesService.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Not Found', message: 'Invoice not found.' });
    }

    const userId = req.session.user.id;
    const userRoles = await usersService.getUserRoles(userId);
    const isAuthor = userRoles.some(r => r.name === 'author');
    const isOutlet = userRoles.some(r => r.name === 'outlet');
    const isElevated = userRoles.some(r => ['super_admin', 'admin', 'accountant', 'inventory_manager', 'sales_staff', 'shipping_user'].includes(r.name));

    if (!isElevated) {
      if (isOutlet) {
        const linkedOutlets = await outletsService.getLinkedOutletsForUser(userId);
        if (!linkedOutlets.includes(invoice.outlet_id)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied. You do not have permission to view this invoice.'
          });
        }
      } else {
        const linkedOutlets = await outletsService.getLinkedOutletsForUser(userId);
        if (linkedOutlets.length > 0 && !linkedOutlets.includes(invoice.outlet_id)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied. You do not have permission to view this invoice.'
          });
        }
      }

      if (isAuthor) {
        const linkedAuthors = await authorsService.getLinkedAuthorsForUser(userId);
        if (linkedAuthors.length === 0) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied. You do not have permission to view this invoice.'
          });
        }
        const invoiceItems = invoice.items || [];
        const db = require('../../db');
        const authorBooks = await db.all(`
          SELECT product_id FROM product_authors WHERE author_id IN (${linkedAuthors.map(() => '?').join(',')})
        `, linkedAuthors);
        const authorBookIds = authorBooks.map(b => b.product_id);
        const hasAuthorBook = invoiceItems.some(item => authorBookIds.includes(item.product_id));
        if (!hasAuthorBook) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied. You do not have permission to view this invoice.'
          });
        }
        // Filter items containing own products
        invoice.items = invoiceItems.filter(item => authorBookIds.includes(item.product_id));
      } else {
        const linkedAuthors = await authorsService.getLinkedAuthorsForUser(userId);
        if (linkedAuthors.length > 0) {
          const invoiceItems = invoice.items || [];
          const db = require('../../db');
          const authorBooks = await db.all(`
            SELECT product_id FROM product_authors WHERE author_id IN (${linkedAuthors.map(() => '?').join(',')})
          `, linkedAuthors);
          const authorBookIds = authorBooks.map(b => b.product_id);
          const hasAuthorBook = invoiceItems.some(item => authorBookIds.includes(item.product_id));
          if (!hasAuthorBook) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Access denied. You do not have permission to view this invoice.'
            });
          }
          // Filter items containing own products
          invoice.items = invoiceItems.filter(item => authorBookIds.includes(item.product_id));
        }
      }
    }

    res.status(200).json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 3. POST /api/invoices - Create a new invoice
router.post('/', requireAuth, checkPermission('invoices.create'), auditLog('create_invoice', 'invoices'), async (req, res) => {
  const {
    invoiceNumber = '',
    outletId,
    discount = 0,
    shippingCost = 0,
    paymentType = 'cash',
    notes = '',
    items = [],
    paymentAmount = 0,
    paymentSupplyStatus = 'not_supplied',
    paymentNotes = '',
    paymentReceiptName = '',
    paymentReceiptData = ''
  } = req.body;

  if (!outletId || !items || items.length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Outlet ID and items are required.' });
  }

  try {
    const userId = req.session.user.id;
    const invoice = await invoicesService.createInvoice({
      invoiceNumber,
      outletId,
      discount,
      shippingCost,
      paymentType,
      notes,
      items,
      userId,
      paymentAmount,
      paymentSupplyStatus,
      paymentNotes,
      paymentReceiptName,
      paymentReceiptData
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully.',
      invoice
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('required') || msg.includes('insufficient') || msg.includes('غير كافٍ') || msg.includes('not exist') || msg.includes('not active') || msg.includes('negative') || msg.includes('no price') || msg.includes('exceeds')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 9. PUT /api/invoices/bulk/shipping-status - Bulk update shipping status
router.put('/bulk/shipping-status', requireAuth, checkPermission('invoices.update'), auditLog('bulk_update_shipping_status', 'invoices'), async (req, res) => {
  const { invoiceIds, shippingStatus } = req.body;
  if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invoice IDs must be a non-empty array.' });
  }
  if (!shippingStatus) {
    return res.status(400).json({ error: 'Bad Request', message: 'Shipping status is required.' });
  }

  try {
    const userId = req.session.user.id;
    await invoicesService.bulkUpdateShippingStatus({
      invoiceIds,
      shippingStatus,
      userId
    });
    res.status(200).json({
      success: true,
      message: 'Shipping status updated successfully for selected invoices.'
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('المخزون') || msg.includes('كاف') || msg.includes('exceeds') || msg.includes('insufficient')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 4. PUT /api/invoices/:id - Update an existing invoice
router.put('/:id', requireAuth, checkPermission('invoices.update'), auditLog('update_invoice', 'invoices'), async (req, res) => {
  const invoiceId = parseInt(req.params.id, 10);
  const { outletId, discount = 0, shippingCost = 0, paymentType = 'cash', notes = '', items = [] } = req.body;

  if (!outletId || !items || items.length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Outlet ID and items are required.' });
  }

  try {
    const userId = req.session.user.id;
    const invoice = await invoicesService.updateInvoice(invoiceId, {
      outletId,
      discount,
      shippingCost,
      paymentType,
      notes,
      items,
      userId
    });

    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully.',
      invoice
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    if (msg.includes('required') || msg.includes('insufficient') || msg.includes('غير كافٍ') || msg.includes('not active') || msg.includes('negative') || msg.includes('no price')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 5. GET /api/invoices/:id/payments - Get payments list for a specific invoice
router.get('/:id/payments', requireAuth, checkPermission('invoices.view'), async (req, res) => {
  const invoiceId = parseInt(req.params.id, 10);

  try {
    const list = await paymentsService.getPayments({ invoiceId });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 7. POST /api/invoices/export/pdf - Export selected invoices to a unified PDF report
router.post('/export/pdf', requireAuth, checkPermission('invoices.export'), async (req, res) => {
  const { invoiceIds } = req.body;
  if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invoice IDs must be a non-empty array.' });
  }

  try {
    const pdfBuffer = await pdfService.generateInvoicesPdf(invoiceIds);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices_report.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    if (err.message.includes('No invoices found') || err.message.includes('non-empty array')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    console.error('PDF Generation Error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 8. POST /api/invoices/:id/cancel - Cancel an invoice
router.post('/:id/cancel', requireAuth, checkPermission('invoices.cancel'), auditLog('cancel_invoice', 'invoices'), async (req, res) => {
  const invoiceId = parseInt(req.params.id, 10);

  try {
    const userId = req.session.user.id;
    const invoice = await invoicesService.cancelInvoice(invoiceId, userId);
    res.status(200).json({
      success: true,
      message: 'Invoice cancelled successfully.',
      invoice
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    if (msg.includes('already cancelled')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const shipmentsService = require('./shipmentsService');
const outletsService = require('../outlets/outletsService');
const usersService = require('../users/usersService');
const invoicesService = require('../invoices/invoicesService');
const { requireAuth, checkPermission } = require('../../middleware/rbac');
const { auditLog } = require('../../middleware/audit');

// 1. GET /api/shipments - List and filter shipments
router.get('/', requireAuth, checkPermission('shipments.view'), async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const invoiceId = req.query.invoiceId ? parseInt(req.query.invoiceId, 10) : null;
  const status = req.query.status || null;

  try {
    const userId = req.session.user.id;
    const userRoles = await usersService.getUserRoles(userId);
    const isOutlet = userRoles.some(r => r.name === 'outlet');
    const isElevated = userRoles.some(r => ['super_admin', 'admin', 'accountant', 'inventory_manager', 'sales_staff', 'shipping_user'].includes(r.name));

    let filterOutletIds = null;
    if (isOutlet && !isElevated) {
      filterOutletIds = await outletsService.getLinkedOutletsForUser(userId);
    } else if (!isElevated) {
      const linkedOutlets = await outletsService.getLinkedOutletsForUser(userId);
      if (linkedOutlets.length > 0) {
        filterOutletIds = linkedOutlets;
      }
    }

    const list = await shipmentsService.getShipments({ limit, offset, invoiceId, status, outletIds: filterOutletIds });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 2. GET /api/shipments/:id - Fetch specific shipment by ID
router.get('/:id', requireAuth, checkPermission('shipments.view'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid Shipment ID is required.' });
  }

  try {
    const shipment = await shipmentsService.getShipmentById(id);
    if (!shipment) {
      return res.status(404).json({ error: 'Not Found', message: `Shipment with ID ${id} does not exist.` });
    }

    const userId = req.session.user.id;
    const userRoles = await usersService.getUserRoles(userId);
    const isOutlet = userRoles.some(r => r.name === 'outlet');
    const isElevated = userRoles.some(r => ['super_admin', 'admin', 'accountant', 'inventory_manager', 'sales_staff', 'shipping_user'].includes(r.name));

    if (!isElevated) {
      if (isOutlet) {
        const linkedOutlets = await outletsService.getLinkedOutletsForUser(userId);
        const invoice = await invoicesService.getInvoiceById(shipment.invoice_id);
        if (!invoice || !linkedOutlets.includes(invoice.outlet_id)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied. You do not have permission to view this shipment.'
          });
        }
      } else {
        const linkedOutlets = await outletsService.getLinkedOutletsForUser(userId);
        if (linkedOutlets.length > 0) {
          const invoice = await invoicesService.getInvoiceById(shipment.invoice_id);
          if (invoice && !linkedOutlets.includes(invoice.outlet_id)) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Access denied. You do not have permission to view this shipment.'
            });
          }
        }
      }
    }

    res.status(200).json(shipment);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 3. POST /api/shipments - Create a new shipment
router.post('/', requireAuth, checkPermission('shipments.create'), auditLog('create_shipment', 'shipments'), async (req, res) => {
  const { invoiceId, shippingCarrier = '', trackingNumber = '', items = [] } = req.body;

  if (!invoiceId || !items || items.length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invoice ID and at least one item are required.' });
  }

  try {
    const userId = req.session.user.id;
    const shipment = await shipmentsService.createShipment({
      invoiceId,
      shippingCarrier,
      trackingNumber,
      items,
      userId
    });

    res.status(201).json({
      success: true,
      message: 'Shipment created successfully.',
      shipment
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    if (msg.includes('required') || msg.includes('positive') || msg.includes('exceeds') || msg.includes('المخزون') || msg.includes('كاف')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 4. POST /api/shipments/:id/status - Update shipment status
router.post('/:id/status', requireAuth, checkPermission('shipments.update'), auditLog('update_shipment_status', 'shipments'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, notes = '' } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid Shipment ID is required.' });
  }
  if (!status) {
    return res.status(400).json({ error: 'Bad Request', message: 'Status is required.' });
  }

  try {
    const userId = req.session.user.id;
    const shipment = await shipmentsService.updateShipmentStatus(id, { status, notes, userId });

    res.status(200).json({
      success: true,
      message: 'Shipment status updated successfully.',
      shipment
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    if (msg.includes('invalid status')) {
      return res.status(400).json({ error: 'Bad Request', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 5. GET /api/shipments/invoice/:invoiceId/remaining - Calculate remaining shippable quantities
router.get('/invoice/:invoiceId/remaining', requireAuth, checkPermission('shipments.view'), async (req, res) => {
  const invoiceId = parseInt(req.params.invoiceId, 10);
  if (isNaN(invoiceId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid Invoice ID is required.' });
  }

  try {
    const userId = req.session.user.id;
    const userRoles = await usersService.getUserRoles(userId);
    const isElevated = userRoles.some(r => ['super_admin', 'admin', 'accountant', 'inventory_manager', 'sales_staff', 'shipping_user', 'readonly_viewer'].includes(r.name));

    if (!isElevated) {
      const linkedOutlets = await outletsService.getLinkedOutletsForUser(userId);
      const invoice = await invoicesService.getInvoiceById(invoiceId);
      if (invoice && !linkedOutlets.includes(invoice.outlet_id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You do not have permission to view remaining shippable items for this invoice.'
        });
      }
    }

    const items = await shipmentsService.getRemainingShippableItems(invoiceId);
    res.status(200).json(items);
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;

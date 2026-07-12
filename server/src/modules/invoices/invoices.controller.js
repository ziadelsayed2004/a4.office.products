import * as invoicesService from './invoices.service.js';

function sendError(res, error, fallbackCode) {
  return res.status(error.status || 500).json({
    error: error.message,
    code: error.code || fallbackCode
  });
}

function adminFilters(query) {
  return {
    invoiceNumber: query.invoiceNumber,
    receiptNumber: query.receiptNumber,
    startDate: query.startDate,
    endDate: query.endDate,
    cashierId: query.cashierId,
    shiftId: query.shiftId,
    paymentMethod: query.paymentMethod,
    origin: query.origin,
    status: query.status,
    customer: query.customer,
    productName: query.productName,
    sku: query.sku || query.barcode,
    limit: query.limit,
    offset: query.offset
  };
}

export async function listAdminInvoicesController(req, res) {
  try {
    const result = await invoicesService.listInvoices(adminFilters(req.query));
    return res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    return sendError(res, error, 'INVOICE_LIST_FAILED');
  }
}

export async function getAdminInvoiceController(req, res) {
  try {
    const detail = await invoicesService.getInvoiceDetail(req.params.id, req.user);
    return res.status(200).json({ status: 'success', data: detail });
  } catch (error) {
    return sendError(res, error, 'INVOICE_DETAIL_FAILED');
  }
}

export async function lookupCashierInvoicesController(req, res) {
  try {
    const result = await invoicesService.lookupCashierInvoices({
      token: req.query.token,
      invoiceNumber: req.query.invoiceNumber,
      receiptNumber: req.query.receiptNumber,
      ownShift: req.query.ownShift === 'true',
      shiftId: req.query.shiftId,
      limit: req.query.limit,
      offset: req.query.offset
    }, req.user);
    return res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    return sendError(res, error, 'INVOICE_LOOKUP_FAILED');
  }
}

export async function getCashierInvoiceController(req, res) {
  try {
    const credential = req.query.token || req.query.invoiceNumber || req.query.receiptNumber
      ? {
          token: req.query.token,
          invoiceNumber: req.query.invoiceNumber,
          receiptNumber: req.query.receiptNumber
        }
      : null;
    const detail = await invoicesService.getInvoiceDetail(req.params.id, req.user, { credential });
    return res.status(200).json({ status: 'success', data: detail });
  } catch (error) {
    return sendError(res, error, 'INVOICE_DETAIL_FAILED');
  }
}

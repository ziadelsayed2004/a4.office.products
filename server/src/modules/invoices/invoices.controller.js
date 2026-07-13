import * as invoicesService from './invoices.service.js';

function adminFilters(query) {
  return {
    invoiceNumber: query.invoiceNumber,
    receiptNumber: query.receiptNumber,
    startDate: query.startDate,
    endDate: query.endDate,
    cashierId: query.cashierId,
    shiftId: query.shiftId,
    categoryId: query.categoryId,
    paymentMethod: query.paymentMethod,
    origin: query.origin,
    status: query.status,
    customer: query.customer,
    productName: query.productName,
    sku: query.sku || query.barcode,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listAdminInvoicesController(req, res, next) {
  try {
    const data = await invoicesService.listInvoices(adminFilters(req.query));
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminInvoiceController(req, res, next) {
  try {
    const data = await invoicesService.getInvoiceDetail(req.params.id, req.user);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function lookupCashierInvoicesController(req, res, next) {
  try {
    const data = await invoicesService.lookupCashierInvoices(
      {
        token: req.query.token,
        invoiceNumber: req.query.invoiceNumber,
        receiptNumber: req.query.receiptNumber,
        ownShift: req.query.ownShift === 'true',
        shiftId: req.query.shiftId,
        limit: req.query.limit,
        offset: req.query.offset,
      },
      req.user
    );
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function getCashierInvoiceController(req, res, next) {
  try {
    const credential =
      req.query.token || req.query.invoiceNumber || req.query.receiptNumber
        ? {
            token: req.query.token,
            invoiceNumber: req.query.invoiceNumber,
            receiptNumber: req.query.receiptNumber,
          }
        : null;
    const data = await invoicesService.getInvoiceDetail(req.params.id, req.user, { credential });
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

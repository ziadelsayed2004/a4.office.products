import * as invoicesService from './invoices.service.js';
import { generateInvoicePdf } from './invoicePdf.service.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

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

async function sendInvoicePdf(req, res, next, options = {}) {
  try {
    const { buffer, invoice, outputAuthorization } = await generateInvoicePdf(
      req.params.id,
      req.user,
      options
    );
    await writeAuditLog({
      userId: req.user.id,
      shiftId: outputAuthorization.shiftId,
      actionType: outputAuthorization.adminOverride
        ? 'INVOICE_PDF_ADMIN_OVERRIDE'
        : 'INVOICE_PDF_EXPORT',
      entityType: 'invoice',
      entityId: invoice.id,
      afterValues: {
        actorRoleSnapshot: outputAuthorization.actorRoleSnapshot,
        adminOverride: outputAuthorization.adminOverride,
      },
      notes: `Invoice PDF exported for ${invoice.invoice_number}.`,
    });
    const safeNumber = String(invoice.invoice_number || invoice.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${safeNumber}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(buffer);
  } catch (error) {
    return next(error);
  }
}

export const getAdminInvoicePdfController = (req, res, next) => sendInvoicePdf(req, res, next);

export const getCashierInvoicePdfController = (req, res, next) => {
  const credential =
    req.query.token || req.query.invoiceNumber || req.query.receiptNumber
      ? {
          token: req.query.token,
          invoiceNumber: req.query.invoiceNumber,
          receiptNumber: req.query.receiptNumber,
        }
      : null;
  return sendInvoicePdf(req, res, next, { credential });
};

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

import * as reportsService from './reports.service.js';

function send(res, operation) {
  return operation.then((data) => res.status(200).json({ status: 'success', data }))
    .catch((error) => res.status(error.status || 400).json({ error: error.message, code: error.code || 'REPORT_FAILED' }));
}

export const getAdminKPIsController = (req, res) => send(res, reportsService.getAdminKPIs());
export const getSalesReportController = (req, res) => send(res, reportsService.getSalesReport(req.query));
export const getPreordersReportController = (req, res) => send(res, reportsService.getPreordersReport(req.query));
export const getInventoryReportController = (req, res) => send(res, reportsService.getInventoryReport(req.query));
export const getShiftsReportController = (req, res) => send(res, reportsService.getShiftsReport(req.query));
export const getInvoicesReportController = (req, res) => send(res, reportsService.getInvoicesReport(req.query));
export const getPaymentsReportController = (req, res) => send(res, reportsService.getPaymentsReport(req.query));
export const getCashiersReportController = (req, res) => send(res, reportsService.getCashiersReport(req.query));

export async function exportReportController(req, res) {
  try {
    const type = req.query.type;
    let report;
    let headers;
    if (type === 'sales' || type === 'invoices') {
      report = await reportsService.getInvoicesReport({ ...req.query, limit: 100 });
      headers = [['رقم الفاتورة', 'invoice_number'], ['رقم الإيصال', 'receipt_number'], ['المصدر', 'origin'], ['الحالة', 'status'], ['الكاشير', 'cashier_name'], ['الشيفت', 'shift_id'], ['العميل', 'customer_name'], ['الإجمالي بالقرش', 'total'], ['التاريخ', 'created_at']];
    } else if (type === 'preorders') {
      report = await reportsService.getPreordersReport(req.query);
      headers = [['رقم الحجز', 'preorder_number'], ['العميل', 'customer_name_snapshot'], ['الهاتف', 'customer_phone_snapshot'], ['الحالة', 'status'], ['الإجمالي بالقرش', 'total_amount'], ['العربون بالقرش', 'deposit_paid'], ['تحصيل الاستلام بالقرش', 'pickup_amount'], ['المتبقي بالقرش', 'remaining_amount']];
    } else if (type === 'inventory') {
      report = await reportsService.getInventoryReport(req.query);
      headers = [['المنتج', 'name'], ['SKU', 'sku'], ['التصنيف', 'category_name'], ['المخزون الفعلي', 'current_stock'], ['كمية الحجز المفتوح', 'open_preorder_quantity'], ['سياسة التوفر', 'availability_policy'], ['مؤهل للحجز الآن', 'can_preorder_now']];
    } else if (type === 'payments') {
      report = await reportsService.getPaymentsReport(req.query);
      headers = [['المرحلة', 'stage'], ['الاتجاه', 'direction'], ['الطريقة', 'payment_method'], ['المبلغ المطبق بالقرش', 'applied_amount'], ['النقد المستلم', 'cash_received'], ['الباقي', 'change_amount'], ['الكاشير', 'cashier_name'], ['الشيفت', 'shift_id'], ['المرجع', 'reference_number_saved'], ['التاريخ', 'created_at']];
    } else if (type === 'shifts') {
      report = await reportsService.getShiftsReport(req.query);
      headers = [['الشيفت', 'id'], ['الكاشير', 'cashier_name'], ['الحالة', 'status'], ['عهدة البداية', 'opening_cash'], ['النقد المتوقع', 'expected_closing_cash'], ['النقد الفعلي', 'actual_closing_cash'], ['المراجعة', 'revision_number'], ['وقت الفتح', 'opened_at'], ['وقت الإغلاق', 'closed_at']];
    } else if (type === 'cashiers') {
      report = await reportsService.getCashiersReport(req.query);
      headers = [['الكاشير', 'cashier_name'], ['عدد الفواتير', 'invoice_count'], ['إجمالي الفواتير', 'invoice_total'], ['المرتجعات', 'refund_total']];
    } else {
      return res.status(400).json({ error: 'نوع التصدير غير مدعوم.', code: 'UNSUPPORTED_EXPORT_TYPE' });
    }
    const rows = report.rows || report.orders || report.preorders || report.products || report.shifts || [];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=report_${type}_${Date.now()}.csv`);
    return res.status(200).send(reportsService.toCsv(headers, rows));
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message, code: error.code || 'EXPORT_REPORT_FAILED' });
  }
}

import * as reportsService from './reports.service.js';
import { AppError } from '../../utils/errors.js';
import { generateReportPdf } from './reportPdf.service.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

function send(res, next, operation) {
  return operation.then((data) => res.status(200).json({ status: 'success', data })).catch(next);
}

export const getAdminKPIsController = (req, res, next) =>
  send(res, next, reportsService.getAdminKPIs());
export const getSalesReportController = (req, res, next) =>
  send(res, next, reportsService.getSalesReport(req.query));
export const getPreordersReportController = (req, res, next) =>
  send(res, next, reportsService.getPreordersReport(req.query));
export const getInventoryReportController = (req, res, next) =>
  send(res, next, reportsService.getInventoryReport(req.query));
export const getShiftsReportController = (req, res, next) =>
  send(res, next, reportsService.getShiftsReport(req.query));
export const getInvoicesReportController = (req, res, next) =>
  send(res, next, reportsService.getInvoicesReport(req.query));
export const getPaymentsReportController = (req, res, next) =>
  send(res, next, reportsService.getPaymentsReport(req.query));
export const getCashiersReportController = (req, res, next) =>
  send(res, next, reportsService.getCashiersReport(req.query));
export const getReturnsReportController = (req, res, next) =>
  send(res, next, reportsService.getReturnsReport(req.query));

export async function exportReportController(req, res, next) {
  try {
    const type = req.query.type;
    let report;
    let headers;
    if (type === 'sales' || type === 'invoices') {
      report = await reportsService.getInvoicesReport({ ...req.query, limit: 100 });
      headers = [
        ['رقم الفاتورة', 'invoice_number'],
        ['رقم الإيصال', 'receipt_number'],
        ['المصدر', 'origin'],
        ['الحالة', 'status'],
        ['الكاشير', 'cashier_name'],
        ['الشيفت', 'shift_id'],
        ['العميل', 'customer_name'],
        ['الإجمالي بالقرش', 'total'],
        ['التاريخ', 'created_at'],
      ];
    } else if (type === 'returns') {
      report = await reportsService.getReturnsReport(req.query);
      headers = [
        ['رقم المرتجع', 'returnNumber'],
        ['رقم الفاتورة', 'invoiceNumber'],
        ['رقم الإيصال', 'receiptNumber'],
        ['الكاشير', 'cashierName'],
        ['الشيفت', 'shiftId'],
        ['المبلغ المسترد بالقرش', 'totalRefunded'],
        ['كارت الاعتماد', 'approvalCardNumber'],
        ['نسخة الكارت', 'approvalCardVersion'],
        ['سبب المرتجع', 'reason'],
        ['التاريخ', 'createdAt'],
      ];
    } else if (type === 'preorders') {
      report = await reportsService.getPreordersReport(req.query);
      headers = [
        ['رقم الحجز', 'preorder_number'],
        ['العميل', 'customer_name_snapshot'],
        ['الهاتف', 'customer_phone_snapshot'],
        ['الحالة', 'status'],
        ['الإجمالي بالقرش', 'total_amount'],
        ['العربون بالقرش', 'deposit_paid'],
        ['تحصيل الاستلام بالقرش', 'pickup_amount'],
        ['المتبقي بالقرش', 'remaining_amount'],
      ];
    } else if (type === 'inventory') {
      report = await reportsService.getInventoryReport(req.query);
      headers = [
        ['المنتج', 'name'],
        ['SKU', 'sku'],
        ['التصنيف', 'category_name'],
        ['المخزون الفعلي', 'current_stock'],
        ['كمية الحجز المفتوح', 'open_preorder_quantity'],
        ['سياسة التوفر', 'availability_policy'],
        ['مؤهل للحجز الآن', 'can_preorder_now'],
      ];
    } else if (type === 'payments') {
      report = await reportsService.getPaymentsReport(req.query);
      headers = [
        ['المرحلة', 'stage'],
        ['الاتجاه', 'direction'],
        ['الطريقة', 'payment_method'],
        ['المبلغ المطبق بالقرش', 'applied_amount'],
        ['النقد المستلم', 'cash_received'],
        ['الباقي', 'change_amount'],
        ['الكاشير', 'cashier_name'],
        ['الشيفت', 'shift_id'],
        ['المرجع', 'reference_number_saved'],
        ['التاريخ', 'created_at'],
      ];
    } else if (type === 'shifts') {
      report = await reportsService.getShiftsReport(req.query);
      headers = [
        ['الشيفت', 'id'],
        ['الكاشير', 'cashier_name'],
        ['الحالة', 'status'],
        ['عهدة البداية', 'opening_cash'],
        ['النقد المتوقع', 'expected_closing_cash'],
        ['النقد الفعلي', 'actual_closing_cash'],
        ['المراجعة', 'revision_number'],
        ['وقت الفتح', 'opened_at'],
        ['وقت الإغلاق', 'closed_at'],
      ];
    } else if (type === 'cashiers') {
      report = await reportsService.getCashiersReport(req.query);
      headers = [
        ['الكاشير', 'cashier_name'],
        ['عدد الفواتير', 'invoice_count'],
        ['إجمالي الفواتير', 'invoice_total'],
        ['المرتجعات', 'refund_total'],
      ];
    } else {
      throw new AppError('نوع التصدير غير مدعوم.', 400, 'UNSUPPORTED_EXPORT_TYPE');
    }
    const rows =
      report.rows || report.orders || report.preorders || report.products || report.shifts || [];
    if (req.query.format === 'pdf') {
      const buffer = await generateReportPdf({ type, rows, headers });
      await writeAuditLog({
        userId: req.user.id,
        actionType: 'REPORT_PDF_EXPORT',
        entityType: 'report',
        notes: `PDF report exported: ${type} (${rows.length} records).`,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report_${type}.pdf"`);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).send(buffer);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=report_${type}_${Date.now()}.csv`);
    return res.status(200).send(reportsService.toCsv(headers, rows));
  } catch (error) {
    return next(error);
  }
}

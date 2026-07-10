import * as reportsService from './reports.service.js';

/**
 * Controller endpoint to retrieve admin dashboard metrics.
 */
export async function getAdminKPIsController(req, res, next) {
  try {
    const kpis = await reportsService.getAdminKPIs();
    return res.status(200).json({
      status: 'success',
      data: kpis
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'ADMIN_KPIS_FAILED'
    });
  }
}

/**
 * Controller endpoint for sales report list.
 */
export async function getSalesReportController(req, res, next) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      cashierId: req.query.cashierId ? parseInt(req.query.cashierId) : null,
      shiftId: req.query.shiftId ? parseInt(req.query.shiftId) : null,
      categoryId: req.query.categoryId ? parseInt(req.query.categoryId) : null
    };

    const report = await reportsService.getSalesReport(filters);
    return res.status(200).json({
      status: 'success',
      data: report
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'SALES_REPORT_FAILED'
    });
  }
}

/**
 * Controller endpoint for preorders report list.
 */
export async function getPreordersReportController(req, res, next) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      cashierId: req.query.cashierId ? parseInt(req.query.cashierId) : null,
      search: req.query.search
    };

    const report = await reportsService.getPreordersReport(filters);
    return res.status(200).json({
      status: 'success',
      data: report
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'PREORDERS_REPORT_FAILED'
    });
  }
}

/**
 * Controller endpoint for inventory status report list.
 */
export async function getInventoryReportController(req, res, next) {
  try {
    const filters = {
      categoryId: req.query.categoryId ? parseInt(req.query.categoryId) : null,
      stockStatus: req.query.stockStatus,
      search: req.query.search
    };

    const report = await reportsService.getInventoryReport(filters);
    return res.status(200).json({
      status: 'success',
      data: report
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'INVENTORY_REPORT_FAILED'
    });
  }
}

/**
 * Controller endpoint for shifts tracking report list.
 */
export async function getShiftsReportController(req, res, next) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      cashierId: req.query.cashierId ? parseInt(req.query.cashierId) : null,
      status: req.query.status
    };

    const report = await reportsService.getShiftsReport(filters);
    return res.status(200).json({
      status: 'success',
      data: report
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'SHIFTS_REPORT_FAILED'
    });
  }
}

/**
 * Exports report results into Excel/CSV format with Arabic characters support.
 */
export async function exportReportController(req, res, next) {
  try {
    const { type } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'نوع التصدير مطلوب.' });
    }

    let csvContent = '\ufeff'; // UTF-8 BOM for Microsoft Excel Arabic characters compatibility

    if (type === 'sales') {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        cashierId: req.query.cashierId ? parseInt(req.query.cashierId) : null,
        shiftId: req.query.shiftId ? parseInt(req.query.shiftId) : null,
        categoryId: req.query.categoryId ? parseInt(req.query.categoryId) : null
      };

      const { orders } = await reportsService.getSalesReport(filters);
      csvContent += 'رقم الفاتورة,تاريخ العملية,الكاشير,الإجمالي (ج.م),الخصم (ج.م),الصافي (ج.م),طرق الدفع\n';
      
      for (const o of orders) {
        const methods = o.payments.map(p => `${p.method}: ${(p.amount / 100).toFixed(2)}`).join(' + ');
        csvContent += `"${o.invoice_number}","${o.created_at}","${o.cashier_name}",${(o.subtotal / 100).toFixed(2)},${(o.discount / 100).toFixed(2)},${(o.total / 100).toFixed(2)},"${methods}"\n`;
      }
    } else if (type === 'preorders') {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        cashierId: req.query.cashierId ? parseInt(req.query.cashierId) : null,
        search: req.query.search
      };

      const { preorders } = await reportsService.getPreordersReport(filters);
      csvContent += 'رقم الحجز,العميل,الهاتف,الحالة,الإجمالي (ج.م),المدفوع مقدم (ج.م),المتبقي (ج.م),تاريخ الحجز\n';

      const translateStatus = (s) => {
        if (s === 'DEPOSIT_PAID_WAITING_STOCK') return 'بانتظار توفر المخزون';
        if (s === 'READY_FOR_PICKUP') return 'جاهز للاستلام';
        if (s === 'PICKED_UP') return 'تم الاستلام بالكامل';
        if (s === 'CANCELLED') return 'ملغي ومسترد';
        return s;
      };

      for (const pr of preorders) {
        csvContent += `"${pr.preorder_number}","${pr.customer_name}","${pr.customer_phone}","${translateStatus(pr.status)}",${(pr.total_amount / 100).toFixed(2)},${(pr.deposit_paid / 100).toFixed(2)},${(pr.remaining_amount / 100).toFixed(2)},"${pr.created_at}"\n`;
      }
    } else if (type === 'inventory') {
      const filters = {
        categoryId: req.query.categoryId ? parseInt(req.query.categoryId) : null,
        stockStatus: req.query.stockStatus,
        search: req.query.search
      };

      const { products } = await reportsService.getInventoryReport(filters);
      csvContent += 'اسم المنتج,رمز SKU,الباركود,التصنيف,المخزون الحالي,المخزون المحجوز\n';

      for (const p of products) {
        csvContent += `"${p.name}","${p.sku}","${p.barcode}","${p.category_name || ''}",${p.current_stock},${p.reserved_stock}\n`;
      }
    } else if (type === 'shifts') {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        cashierId: req.query.cashierId ? parseInt(req.query.cashierId) : null,
        status: req.query.status
      };

      const { shifts } = await reportsService.getShiftsReport(filters);
      csvContent += 'رقم الوردية,الكاشير,حالة الوردية,العهدة الافتتاحية (ج.م),العهد الفعلية (ج.م),العجز والزيادة (ج.م),تاريخ الفتح,تاريخ الإغلاق\n';

      const translateStatus = (s) => {
        if (s === 'OPEN') return 'مفتوحة';
        if (s === 'CLOSE_REQUESTED') return 'بانتظار المراجعة';
        if (s === 'CLOSED') return 'مغلقة ومراجعة';
        return s;
      };

      for (const s of shifts) {
        const actual = s.actual_closing_cash !== null ? (s.actual_closing_cash / 100).toFixed(2) : '-';
        const expected = s.expected_closing_cash !== null ? (s.expected_closing_cash / 100).toFixed(2) : '-';
        const variance = (s.actual_closing_cash !== null && s.expected_closing_cash !== null) 
          ? ((s.actual_closing_cash - s.expected_closing_cash) / 100).toFixed(2)
          : '-';

        csvContent += `"${s.id}","${s.cashier_name}","${translateStatus(s.status)}",${(s.opening_cash / 100).toFixed(2)},${actual},${variance},"${s.opened_at}","${s.closed_at || ''}"\n`;
      }
    } else {
      return res.status(400).json({ error: 'نوع التصدير غير مدعوم.' });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=report_${type}_${Date.now()}.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'EXPORT_REPORT_FAILED'
    });
  }
}

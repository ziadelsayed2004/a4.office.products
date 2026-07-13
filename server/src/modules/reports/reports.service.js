import db from '../../db/index.js';
import {
  addCalendarDay,
  cairoMidnightUtc,
  getInvoiceDetail,
  listInvoices,
} from '../invoices/invoices.service.js';

const ADMIN_ACTOR = { id: 0, role: 'Admin' };

function cairoToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDateRange(sql, params, column, filters) {
  if (filters.startDate) {
    sql.push(`${column} >= ?`);
    params.push(cairoMidnightUtc(filters.startDate));
  }
  if (filters.endDate) {
    sql.push(`${column} < ?`);
    params.push(cairoMidnightUtc(addCalendarDay(filters.endDate)));
  }
}

export async function getAdminKPIs() {
  const date = cairoToday();
  const start = cairoMidnightUtc(date);
  const end = cairoMidnightUtc(addCalendarDay(date));
  const [sales, deposits, preorders, lowStock, pendingShifts, topProducts, refunds] =
    await Promise.all([
      db.get(
        'SELECT COALESCE(SUM(total), 0) total_sales, COUNT(*) sales_count FROM orders WHERE created_at >= ? AND created_at < ?;',
        [start, end]
      ),
      db.get(
        "SELECT COALESCE(SUM(applied_amount), 0) total_deposits FROM payments WHERE stage = 'PREORDER_DEPOSIT' AND direction = 'IN' AND is_excluded = 0 AND created_at >= ? AND created_at < ?;",
        [start, end]
      ),
      db.get(
        "SELECT COUNT(*) active_preorders_count FROM preorders WHERE status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP');"
      ),
      db.get(`SELECT COUNT(*) low_stock_count FROM products p WHERE p.is_active = 1 AND
      COALESCE((SELECT after_quantity FROM inventory_ledger il WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1), 0) <= p.low_stock_threshold;`),
      db.get(
        "SELECT COUNT(*) pending_shifts_count FROM shifts WHERE status = 'PENDING_ADMIN_REVIEW';"
      ),
      db.all(
        `SELECT oi.product_id AS id, oi.product_name_snapshot AS name, oi.sku_snapshot AS sku,
                   SUM(oi.quantity) total_qty
              FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE o.created_at >= ? AND o.created_at < ?
             GROUP BY oi.product_id, oi.product_name_snapshot, oi.sku_snapshot
             ORDER BY total_qty DESC LIMIT 5;`,
        [start, end]
      ),
      db.get(
        'SELECT COALESCE(SUM(total_refunded), 0) total_refunds FROM returns WHERE created_at >= ? AND created_at < ?;',
        [start, end]
      ),
    ]);
  return {
    scopeDate: date,
    totalSales: sales.total_sales,
    salesCount: sales.sales_count,
    totalDeposits: deposits.total_deposits,
    totalRefunds: refunds.total_refunds,
    netAfterRefunds: sales.total_sales - refunds.total_refunds,
    activePreordersCount: preorders.active_preorders_count,
    lowStockCount: lowStock.low_stock_count,
    pendingShiftsCount: pendingShifts.pending_shifts_count,
    topProducts,
  };
}

export async function getInvoicesReport(filters = {}) {
  const rows = [];
  let total = 0;
  let offset = 0;
  do {
    const listing = await listInvoices({ ...filters, limit: 100, offset });
    total = listing.total;
    for (const invoice of listing.rows) rows.push(await getInvoiceDetail(invoice.id, ADMIN_ACTOR));
    offset += listing.rows.length;
    if (listing.rows.length === 0) break;
  } while (offset < total);
  const totalGross = rows.reduce((sum, row) => sum + row.subtotal, 0);
  const totalDiscount = rows.reduce((sum, row) => sum + row.discount, 0);
  const totalNet = rows.reduce((sum, row) => sum + row.total, 0);
  const totalRefunded = rows.reduce(
    (sum, row) => sum + row.returns.reduce((returnSum, item) => returnSum + item.total_refunded, 0),
    0
  );
  return {
    summary: {
      total_sales: totalGross,
      total_discount: totalDiscount,
      total_net: totalNet,
      total_refunded: totalRefunded,
      net_after_returns: totalNet - totalRefunded,
      invoices_count: total,
    },
    rows,
    total,
  };
}

export async function getSalesReport(filters = {}) {
  const report = await getInvoicesReport(filters);
  const payments = {};
  for (const invoice of report.rows) {
    for (const payment of invoice.payments) {
      const method = payment.method || payment.payment_method;
      const signed = payment.direction === 'OUT' ? -payment.amount : payment.amount;
      payments[method] = (payments[method] || 0) + signed;
    }
  }
  return {
    summary: { ...report.summary, payments_breakdown: payments },
    orders: report.rows,
    rows: report.rows,
    total: report.total,
  };
}

export async function getPreordersReport(filters = {}) {
  const clauses = ['1 = 1'];
  const params = [];
  addDateRange(clauses, params, 'pr.created_at', filters);
  if (filters.status) {
    clauses.push('pr.status = ?');
    params.push(filters.status);
  }
  if (filters.cashierId) {
    clauses.push('pr.cashier_id = ?');
    params.push(filters.cashierId);
  }
  if (filters.search) {
    const value = `%${String(filters.search).trim()}%`;
    clauses.push(
      '(pr.customer_name_snapshot LIKE ? OR pr.customer_phone_snapshot LIKE ? OR pr.preorder_number LIKE ?)'
    );
    params.push(value, value, value);
  }
  if (filters.availabilityPolicy) {
    clauses.push(
      'EXISTS (SELECT 1 FROM preorder_items pi WHERE pi.preorder_id = pr.id AND pi.availability_policy_snapshot = ?)'
    );
    params.push(filters.availabilityPolicy);
  }
  const rows = await db.all(
    `SELECT pr.*, u.name cashier_name FROM preorders pr JOIN users u ON u.id = pr.cashier_id
      WHERE ${clauses.join(' AND ')} ORDER BY pr.created_at DESC LIMIT 500;`,
    params
  );
  for (const row of rows) {
    row.items = await db.all(
      `SELECT pi.*, pi.product_name_snapshot product_name, pi.sku_snapshot sku,
              p.availability_policy current_availability_policy,
              CASE WHEN p.is_active = 1 AND p.availability_policy = 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK'
                     AND COALESCE((SELECT after_quantity FROM inventory_ledger il WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1), 0) = 0
                   THEN 1 ELSE 0 END can_preorder_now
         FROM preorder_items pi JOIN products p ON p.id = pi.product_id WHERE pi.preorder_id = ?;`,
      [row.id]
    );
  }
  return {
    summary: {
      total_count: rows.length,
      total_amount: rows.reduce((sum, row) => sum + row.total_amount, 0),
      total_deposit_paid: rows.reduce((sum, row) => sum + row.deposit_paid, 0),
      total_pickup_collected: rows.reduce((sum, row) => sum + row.pickup_amount, 0),
      total_remaining_amount: rows.reduce((sum, row) => sum + row.remaining_amount, 0),
    },
    preorders: rows,
    rows,
  };
}

export async function getInventoryReport(filters = {}) {
  const clauses = ['p.is_active = 1'];
  const params = [];
  if (filters.categoryId) {
    clauses.push('p.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.search) {
    const value = `%${String(filters.search).trim()}%`;
    clauses.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
    params.push(value, value, value);
  }
  const rows = await db.all(
    `SELECT p.*, c.name category_name,
            COALESCE((SELECT after_quantity FROM inventory_ledger il WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1), 0) current_stock
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${clauses.join(' AND ')} ORDER BY p.name;`,
    params
  );
  for (const row of rows) {
    row.open_preorder_quantity = Number(row.open_preorder_quantity || 0);
    row.can_sell_now = row.is_active === 1 && row.current_stock > 0 ? 1 : 0;
    row.can_preorder_now =
      row.is_active === 1 &&
      row.availability_policy === 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK' &&
      row.current_stock === 0
        ? 1
        : 0;
  }
  const summary = {
    total_products: rows.length,
    low_stock_count: rows.filter(
      (row) => row.current_stock > 0 && row.current_stock <= row.low_stock_threshold
    ).length,
    out_of_stock_count: rows.filter((row) => row.current_stock === 0).length,
    open_preorder_quantity: rows.reduce((sum, row) => sum + row.open_preorder_quantity, 0),
  };
  let filtered = rows;
  if (filters.stockStatus === 'LOW_STOCK')
    filtered = rows.filter(
      (row) => row.current_stock > 0 && row.current_stock <= row.low_stock_threshold
    );
  if (filters.stockStatus === 'OUT_OF_STOCK')
    filtered = rows.filter((row) => row.current_stock === 0);
  return { summary, products: filtered, rows: filtered };
}

export async function getPaymentsReport(filters = {}) {
  const clauses = ['p.is_excluded = 0'];
  const params = [];
  addDateRange(clauses, params, 'p.created_at', filters);
  if (filters.stage) {
    clauses.push('p.stage = ?');
    params.push(filters.stage);
  }
  if (filters.direction) {
    clauses.push('p.direction = ?');
    params.push(filters.direction);
  }
  if (filters.method || filters.paymentMethod) {
    clauses.push('p.payment_method = ?');
    params.push(filters.method || filters.paymentMethod);
  }
  if (filters.cashierId) {
    clauses.push('p.cashier_id = ?');
    params.push(filters.cashierId);
  }
  if (filters.shiftId) {
    clauses.push('p.shift_id = ?');
    params.push(filters.shiftId);
  }
  const rows = await db.all(
    `SELECT p.*, u.name cashier_name, s.status shift_status,
            CASE WHEN p.reference_type = 'order' THEN (SELECT invoice_number FROM orders WHERE id = p.reference_id)
                 ELSE (SELECT preorder_number FROM preorders WHERE id = p.reference_id) END reference_number_saved
       FROM payments p JOIN users u ON u.id = p.cashier_id JOIN shifts s ON s.id = p.shift_id
      WHERE ${clauses.join(' AND ')} ORDER BY p.created_at DESC LIMIT 1000;`,
    params
  );
  return {
    summary: {
      incoming: rows
        .filter((row) => row.direction === 'IN')
        .reduce((sum, row) => sum + row.applied_amount, 0),
      outgoing: rows
        .filter((row) => row.direction === 'OUT')
        .reduce((sum, row) => sum + row.applied_amount, 0),
      cash_received: rows.reduce((sum, row) => sum + Number(row.cash_received || 0), 0),
      change_given: rows.reduce((sum, row) => sum + Number(row.change_amount || 0), 0),
      rows_count: rows.length,
    },
    rows,
  };
}

export async function getShiftsReport(filters = {}) {
  const clauses = ['1 = 1'];
  const params = [];
  addDateRange(clauses, params, 's.opened_at', filters);
  if (filters.cashierId) {
    clauses.push('s.user_id = ?');
    params.push(filters.cashierId);
  }
  if (filters.status) {
    clauses.push('s.status = ?');
    params.push(filters.status);
  }
  const rows = await db.all(
    `SELECT s.*, u.name cashier_name, r.revision_number, r.system_totals_json,
            r.declared_totals_json, r.variances_json, r.cashier_note, r.admin_reason
       FROM shifts s JOIN users u ON u.id = s.user_id
       LEFT JOIN shift_close_revisions r ON r.id = COALESCE(s.approved_close_revision_id,
         (SELECT r2.id FROM shift_close_revisions r2 WHERE r2.shift_id = s.id ORDER BY r2.revision_number DESC LIMIT 1))
      WHERE ${clauses.join(' AND ')} ORDER BY s.opened_at DESC LIMIT 500;`,
    params
  );
  for (const row of rows) {
    row.system_totals = row.system_totals_json ? JSON.parse(row.system_totals_json) : null;
    row.declared_totals = row.declared_totals_json ? JSON.parse(row.declared_totals_json) : null;
    row.variances = row.variances_json ? JSON.parse(row.variances_json) : null;
    row.expected_closing_cash = row.system_totals?.methods?.Cash ?? row.system_total_cash;
    row.actual_closing_cash = row.declared_totals?.Cash ?? row.actual_closed_cash;
  }
  return {
    summary: {
      total_shifts: rows.length,
      open_shifts: rows.filter((row) => row.status === 'OPEN').length,
      pending_review_shifts: rows.filter((row) => row.status === 'PENDING_ADMIN_REVIEW').length,
      closed_shifts: rows.filter((row) => row.status === 'CLOSED').length,
    },
    shifts: rows,
    rows,
  };
}

export async function getCashiersReport(filters = {}) {
  const clauses = ['1 = 1'];
  const params = [];
  addDateRange(clauses, params, 'o.created_at', filters);
  const rows = await db.all(
    `SELECT u.id cashier_id, u.name cashier_name, COUNT(o.id) invoice_count,
            COALESCE(SUM(o.total), 0) invoice_total,
            COALESCE(SUM((SELECT SUM(total_refunded) FROM returns r WHERE r.order_id = o.id)), 0) refund_total
       FROM users u LEFT JOIN orders o ON o.cashier_id = u.id AND ${clauses.join(' AND ')}
      WHERE u.role IN ('Admin', 'Cashier') GROUP BY u.id, u.name ORDER BY invoice_total DESC;`,
    params
  );
  return {
    rows,
    summary: {
      cashier_count: rows.length,
      invoice_total: rows.reduce((sum, row) => sum + row.invoice_total, 0),
    },
  };
}

function safeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(([label]) => safeCsvCell(label)).join(',')];
  for (const row of rows) lines.push(headers.map(([, key]) => safeCsvCell(row[key])).join(','));
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

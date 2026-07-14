import db from '../../db/index.js';
import { addCalendarDay, cairoMidnightUtc } from '../invoices/invoices.service.js';

function cairoToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function number(value) {
  return Number(value || 0);
}

export async function getLiveOverview(connection = db, now = new Date()) {
  const date = cairoToday(now);
  const start = cairoMidnightUtc(date);
  const end = cairoMidnightUtc(addCalendarDay(date));

  const [sales, refunds, deposits, activePreorders, openShifts, paymentRows, activity, alerts] =
    await Promise.all([
      connection.get(
        `SELECT COALESCE(SUM(total), 0) AS gross_sales, COUNT(*) AS invoice_count
           FROM orders WHERE created_at >= ? AND created_at < ?;`,
        [start, end]
      ),
      connection.get(
        `SELECT COALESCE(SUM(total_refunded), 0) AS total_refunds
           FROM returns WHERE created_at >= ? AND created_at < ?;`,
        [start, end]
      ),
      connection.get(
        `SELECT COALESCE(SUM(COALESCE(applied_amount, amount)), 0) AS total_deposits
           FROM payments
          WHERE stage = 'PREORDER_DEPOSIT' AND direction = 'IN'
            AND COALESCE(is_excluded, 0) = 0
            AND created_at >= ? AND created_at < ?;`,
        [start, end]
      ),
      connection.get(
        `SELECT COUNT(*) AS count FROM preorders
          WHERE status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP');`
      ),
      connection.all(
        `SELECT s.id, s.user_id, s.opened_at, u.name AS cashier_name,
                u.username AS cashier_username,
                (SELECT MAX(ss.last_seen_at) FROM sessions ss
                  WHERE ss.user_id = u.id AND datetime(ss.expires_at) > CURRENT_TIMESTAMP) AS last_seen_at,
                CASE WHEN EXISTS (
                  SELECT 1 FROM sessions online_session
                   WHERE online_session.user_id = u.id
                     AND datetime(online_session.expires_at) > CURRENT_TIMESTAMP
                     AND datetime(online_session.last_seen_at) >= datetime('now', '-90 seconds')
                ) THEN 1 ELSE 0 END AS is_online,
                (SELECT COUNT(*) FROM orders o WHERE o.shift_id = s.id) AS invoice_count,
                (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.shift_id = s.id) AS gross_sales,
                (SELECT COALESCE(SUM(r.total_refunded), 0) FROM returns r WHERE r.shift_id = s.id) AS refunds,
                MAX(
                  COALESCE((SELECT MAX(o.created_at) FROM orders o WHERE o.shift_id = s.id), s.opened_at),
                  COALESCE((SELECT MAX(r.created_at) FROM returns r WHERE r.shift_id = s.id), s.opened_at),
                  COALESCE((SELECT MAX(cm.created_at) FROM cash_movements cm WHERE cm.shift_id = s.id), s.opened_at)
                ) AS last_activity_at
           FROM shifts s JOIN users u ON u.id = s.user_id
          WHERE s.status = 'OPEN'
          ORDER BY s.opened_at;`
      ),
      connection.all(
        `SELECT p.shift_id, COALESCE(pm.code, p.payment_method) AS method,
                COALESCE(SUM(CASE WHEN p.direction = 'OUT'
                  THEN -COALESCE(p.applied_amount, p.amount)
                  ELSE COALESCE(p.applied_amount, p.amount) END), 0) AS total
           FROM payments p
           LEFT JOIN payment_methods pm ON pm.id = p.method_id
           JOIN shifts s ON s.id = p.shift_id AND s.status = 'OPEN'
          WHERE COALESCE(p.is_excluded, 0) = 0
          GROUP BY p.shift_id, COALESCE(pm.code, p.payment_method);`
      ),
      connection.all(
        `SELECT * FROM (
           SELECT 'SALE' AS type, o.invoice_number AS number,
                  o.invoice_number, NULL AS return_number, o.total AS amount,
                  u.name AS cashier_name, o.shift_id, o.created_at
             FROM orders o JOIN users u ON u.id = o.cashier_id
           UNION ALL
           SELECT 'RETURN' AS type, r.return_number AS number,
                  o.invoice_number, r.return_number, r.total_refunded AS amount,
                  u.name AS cashier_name, r.shift_id, r.created_at
             FROM returns r
             JOIN orders o ON o.id = r.order_id
             JOIN users u ON u.id = r.cashier_id
         ) ORDER BY created_at DESC LIMIT 20;`
      ),
      Promise.all([
        connection.get(
          "SELECT COUNT(*) AS count FROM shifts WHERE status = 'PENDING_ADMIN_REVIEW';"
        ),
        connection.get(
          `SELECT COUNT(*) AS count FROM products p
            WHERE p.is_active = 1 AND COALESCE((
              SELECT after_quantity FROM inventory_ledger il
               WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1
            ), 0) <= p.low_stock_threshold;`
        ),
      ]),
    ]);

  const paymentByShift = new Map();
  for (const row of paymentRows) {
    const breakdown = paymentByShift.get(row.shift_id) || {};
    breakdown[row.method] = number(row.total);
    paymentByShift.set(row.shift_id, breakdown);
  }
  const grossSales = number(sales.gross_sales);
  const totalRefunds = number(refunds.total_refunds);
  const invoiceCount = number(sales.invoice_count);

  return {
    generatedAt: now.toISOString(),
    scopeDate: date,
    summary: {
      grossSales,
      totalSales: grossSales,
      refunds: totalRefunds,
      totalRefunds,
      netSales: grossSales - totalRefunds,
      invoiceCount,
      salesCount: invoiceCount,
      averageTicket: invoiceCount === 0 ? 0 : Math.round(grossSales / invoiceCount),
      totalDeposits: number(deposits.total_deposits),
      activePreordersCount: number(activePreorders.count),
    },
    openShifts: openShifts.map((shift) => ({
      id: shift.id,
      userId: shift.user_id,
      cashierName: shift.cashier_name,
      cashierUsername: shift.cashier_username,
      openedAt: shift.opened_at,
      isOnline: shift.is_online === 1,
      lastSeenAt: shift.last_seen_at,
      lastActivityAt: shift.last_activity_at,
      invoiceCount: number(shift.invoice_count),
      grossSales: number(shift.gross_sales),
      refunds: number(shift.refunds),
      netSales: number(shift.gross_sales) - number(shift.refunds),
      paymentBreakdown: paymentByShift.get(shift.id) || {},
    })),
    recentActivity: activity.map((row) => ({
      type: row.type,
      number: row.number,
      invoiceNumber: row.invoice_number,
      returnNumber: row.return_number,
      amount: number(row.amount),
      cashierName: row.cashier_name,
      shiftId: row.shift_id,
      createdAt: row.created_at,
    })),
    alerts: {
      pendingShifts: number(alerts[0].count),
      lowStock: number(alerts[1].count),
    },
  };
}

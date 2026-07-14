import db from '../../db/index.js';
import { AppError, requireInteger } from '../../utils/financial.js';

const RECEIPT_MATCH = `(
  (r.reference_type = 'order_sale' AND r.reference_id = o.id)
  OR (
    r.reference_type IN ('preorder_deposit', 'preorder_pickup')
    AND (
      r.reference_id = o.preorder_id
      OR EXISTS (
        SELECT 1 FROM preorders receipt_preorder
        WHERE receipt_preorder.id = r.reference_id
          AND receipt_preorder.pickup_order_id = o.id
      )
    )
  )
  OR (
    r.reference_type = 'order_return'
    AND EXISTS (SELECT 1 FROM returns receipt_return
                 WHERE receipt_return.id = r.reference_id
                   AND receipt_return.order_id = o.id)
  )
)`;

// Pickup invoices normally have only a preorder-pickup receipt. If compatibility
// data contains both kinds, prefer the direct order receipt deterministically.
const PRIMARY_RECEIPT_ORDER = `CASE WHEN r.reference_type = 'order_sale' THEN 0
                                    WHEN r.reference_type = 'order_return' THEN 2
                                    ELSE 1 END, r.id DESC`;

function parseJson(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parsePositiveInteger(value, field, { defaultValue, max = Number.MAX_SAFE_INTEGER } = {}) {
  if ((value === undefined || value === null || value === '') && defaultValue !== undefined)
    return defaultValue;
  const parsed = Number(value);
  return requireInteger(parsed, field, { min: 1, max });
}

function parseOffset(value) {
  if (value === undefined || value === null || value === '') return 0;
  return requireInteger(Number(value), 'offset', { min: 0, max: Number.MAX_SAFE_INTEGER });
}

export function addCalendarDay(dateText) {
  const text = String(dateText);
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  const original = new Date(Date.UTC(year, month - 1, day));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    original.getUTCFullYear() !== year ||
    original.getUTCMonth() !== month - 1 ||
    original.getUTCDate() !== day
  ) {
    throw new AppError('Date is not a valid calendar day.', 400, 'INVALID_DATE');
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Convert a Cairo local midnight to the UTC text format written by SQLite's
// CURRENT_TIMESTAMP. The small iteration also handles Cairo DST transitions.
export function cairoMidnightUtc(dateText) {
  const text = String(dateText);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AppError('Dates must use YYYY-MM-DD.', 400, 'INVALID_DATE');
  }
  const [year, month, day] = text.split('-').map(Number);
  const validation = new Date(Date.UTC(year, month - 1, day));
  if (
    validation.getUTCFullYear() !== year ||
    validation.getUTCMonth() !== month - 1 ||
    validation.getUTCDate() !== day
  ) {
    throw new AppError('Date is not a valid calendar day.', 400, 'INVALID_DATE');
  }
  const desiredWallClock = Date.UTC(year, month - 1, day, 0, 0, 0);
  let instant = desiredWallClock;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value])
    );
    const representedWallClock = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    instant += desiredWallClock - representedWallClock;
  }

  return new Date(instant).toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeSnapshotItem(item) {
  return {
    ...item,
    product_id: item.product_id ?? item.productId ?? null,
    product_name: item.product_name ?? item.productName ?? null,
    product_sku: item.product_sku ?? item.productSku ?? item.sku ?? null,
    price_tier_name: item.price_tier_name ?? item.priceTierName ?? null,
    availability_policy: item.availability_policy ?? item.availabilityPolicy ?? null,
    quantity: item.quantity,
    unit_price: item.unit_price ?? item.unitPrice,
    total_price: item.total_price ?? item.totalPrice,
  };
}

function normalizeSnapshotPayment(payment) {
  return {
    ...payment,
    method: payment.method ?? payment.payment_method ?? payment.method_snapshot ?? null,
    amount: payment.amount ?? payment.applied_amount ?? payment.appliedAmount,
    cash_received: payment.cash_received ?? payment.cashReceived ?? null,
    change_amount: payment.change_amount ?? payment.changeAmount ?? 0,
    reference_number: payment.reference_number ?? payment.referenceNumber ?? null,
  };
}

function listBaseSelect() {
  return `
    SELECT o.id, o.invoice_number, o.origin, o.status, o.shift_id, o.cashier_id,
           o.customer_name_snapshot, o.customer_phone_snapshot,
           o.customer_name_snapshot AS customer_name,
           o.customer_phone_snapshot AS customer_phone,
           o.subtotal, o.discount, o.total, o.qr_token, o.preorder_id, o.created_at,
           COALESCE((
             SELECT json_extract(r.snapshot_json, '$.cashierName') FROM receipts r
             WHERE ${RECEIPT_MATCH}
             ORDER BY ${PRIMARY_RECEIPT_ORDER}
             LIMIT 1
           ), u.name) AS cashier_name,
           u.name AS cashier_current_name, u.username AS cashier_username,
           (
             SELECT r.receipt_number FROM receipts r
             WHERE ${RECEIPT_MATCH}
             ORDER BY ${PRIMARY_RECEIPT_ORDER}
             LIMIT 1
           ) AS receipt_number,
           (
             SELECT r.id FROM receipts r
             WHERE ${RECEIPT_MATCH}
             ORDER BY ${PRIMARY_RECEIPT_ORDER}
             LIMIT 1
           ) AS receipt_id,
           (SELECT COUNT(*) FROM returns ret WHERE ret.order_id = o.id) AS return_count
      FROM orders o
      JOIN users u ON u.id = o.cashier_id
  `;
}

function buildListWhere(filters = {}, { cashierId = null } = {}) {
  const clauses = ['1 = 1'];
  const params = [];

  if (cashierId !== null) {
    clauses.push('o.cashier_id = ?');
    params.push(cashierId);
  }
  if (filters.invoiceNumber) {
    clauses.push('o.invoice_number LIKE ?');
    params.push(`%${String(filters.invoiceNumber).trim()}%`);
  }
  if (filters.receiptNumber) {
    clauses.push(
      `EXISTS (SELECT 1 FROM receipts r WHERE ${RECEIPT_MATCH} AND r.receipt_number LIKE ?)`
    );
    params.push(`%${String(filters.receiptNumber).trim()}%`);
  }
  if (filters.startDate) {
    clauses.push('o.created_at >= ?');
    params.push(cairoMidnightUtc(filters.startDate));
  }
  if (filters.endDate) {
    clauses.push('o.created_at < ?');
    params.push(cairoMidnightUtc(addCalendarDay(filters.endDate)));
  }
  if (filters.cashierId) {
    clauses.push('o.cashier_id = ?');
    params.push(parsePositiveInteger(filters.cashierId, 'cashierId'));
  }
  if (filters.shiftId) {
    clauses.push('o.shift_id = ?');
    params.push(parsePositiveInteger(filters.shiftId, 'shiftId'));
  }
  if (filters.categoryId) {
    clauses.push(`EXISTS (
      SELECT 1 FROM order_items category_item
      JOIN products category_product ON category_product.id = category_item.product_id
       WHERE category_item.order_id = o.id AND category_product.category_id = ?
    )`);
    params.push(parsePositiveInteger(filters.categoryId, 'categoryId'));
  }
  if (filters.paymentMethod) {
    clauses.push(`EXISTS (
      SELECT 1 FROM payments pay
       WHERE pay.is_excluded = 0
         AND (pay.payment_method = ? OR pay.method_snapshot = ?)
         AND (
           (pay.reference_type = 'order' AND pay.reference_id = o.id)
           OR (o.preorder_id IS NOT NULL AND pay.reference_type = 'preorder' AND pay.reference_id = o.preorder_id)
         )
    )`);
    const paymentMethod = String(filters.paymentMethod);
    params.push(paymentMethod, paymentMethod);
  }
  if (filters.origin) {
    clauses.push('o.origin = ?');
    params.push(String(filters.origin));
  }
  if (filters.status) {
    clauses.push('o.status = ?');
    params.push(String(filters.status));
  }
  if (filters.customer) {
    const search = `%${String(filters.customer).trim()}%`;
    clauses.push('(o.customer_name_snapshot LIKE ? OR o.customer_phone_snapshot LIKE ?)');
    params.push(search, search);
  }
  if (filters.productName) {
    clauses.push(`EXISTS (
      SELECT 1 FROM order_items oi
       WHERE oi.order_id = o.id AND oi.product_name_snapshot LIKE ?
    )`);
    params.push(`%${String(filters.productName).trim()}%`);
  }
  if (filters.sku) {
    const search = `%${String(filters.sku).trim()}%`;
    clauses.push(`EXISTS (
      SELECT 1 FROM order_items oi
      LEFT JOIN products current_product ON current_product.id = oi.product_id
       WHERE oi.order_id = o.id
         AND (oi.sku_snapshot LIKE ? OR current_product.barcode LIKE ?)
    )`);
    params.push(search, search);
  }

  return { whereSql: clauses.join('\n AND '), params };
}

export async function listInvoices(filters = {}, { cashierId = null, connection = db } = {}) {
  const limit = parsePositiveInteger(filters.limit, 'limit', { defaultValue: 50, max: 100 });
  const offset = parseOffset(filters.offset);
  const { whereSql, params } = buildListWhere(filters, { cashierId });

  const rows = await connection.all(
    `${listBaseSelect()} WHERE ${whereSql} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?;`,
    [...params, limit, offset]
  );
  const countRow = await connection.get(
    `SELECT COUNT(*) AS total FROM orders o WHERE ${whereSql};`,
    params
  );
  return { rows, total: countRow?.total || 0 };
}

export async function resolveExactInvoiceId(criteria, connection = db) {
  const entries = ['token', 'invoiceNumber', 'receiptNumber'].filter(
    (key) => typeof criteria?.[key] === 'string' && criteria[key].trim().length > 0
  );
  if (entries.length !== 1) {
    throw new AppError(
      'Provide exactly one of token, invoiceNumber, or receiptNumber.',
      400,
      'EXACT_INVOICE_LOOKUP_REQUIRED'
    );
  }

  let row;
  if (entries[0] === 'token') {
    const token = criteria.token.trim();
    row = await connection.get(
      `SELECT o.id
         FROM orders o
        WHERE o.qr_token = ?
           OR o.id = (
             SELECT st.reference_id FROM secure_tokens st
              WHERE st.token = ? AND st.token_type = 'invoice'
           )
        LIMIT 1;`,
      [token, token]
    );
  } else if (entries[0] === 'invoiceNumber') {
    row = await connection.get('SELECT id FROM orders WHERE invoice_number = ?;', [
      criteria.invoiceNumber.trim(),
    ]);
  } else {
    row = await connection.get(
      `SELECT o.id
         FROM orders o
         JOIN receipts r ON ${RECEIPT_MATCH}
        WHERE r.receipt_number = ?
        ORDER BY o.id DESC
        LIMIT 1;`,
      [criteria.receiptNumber.trim()]
    );
  }

  if (!row) throw new AppError('Invoice not found.', 404, 'INVOICE_NOT_FOUND');
  return row.id;
}

async function loadInvoiceRow(invoiceId, connection) {
  return connection.get(
    `SELECT o.*, u.name AS cashier_name, u.username AS cashier_username,
            s.user_id AS shift_owner_id, s.status AS shift_status
       FROM orders o
       JOIN users u ON u.id = o.cashier_id
       JOIN shifts s ON s.id = o.shift_id
      WHERE o.id = ?;`,
    [invoiceId]
  );
}

async function authorizeInvoice(invoice, actor, { credential = null, connection = db } = {}) {
  if (actor?.role === 'Admin') return;
  if (actor?.role !== 'Cashier')
    throw new AppError('Invoice access is forbidden.', 403, 'FORBIDDEN');
  if (invoice.cashier_id === actor.id || invoice.shift_owner_id === actor.id) return;

  if (credential) {
    const resolvedId = await resolveExactInvoiceId(credential, connection);
    if (resolvedId === invoice.id) return;
  }
  throw new AppError(
    "This invoice is outside the cashier's permitted scope.",
    403,
    'INVOICE_SCOPE_FORBIDDEN'
  );
}

async function loadReceipts(invoice, connection) {
  const rows = await connection.all(
    `SELECT r.*, u.name AS printed_by_name, u.username AS printed_by_username
       FROM receipts r
       JOIN users u ON u.id = r.printed_by
      WHERE (r.reference_type = 'order_sale' AND r.reference_id = ?)
         OR (r.reference_type = 'order_return' AND EXISTS (
              SELECT 1 FROM returns receipt_return
               WHERE receipt_return.id = r.reference_id AND receipt_return.order_id = ?
            ))
         OR (
           r.reference_type IN ('preorder_deposit', 'preorder_pickup')
           AND (
             r.reference_id = ?
             OR EXISTS (
               SELECT 1 FROM preorders receipt_preorder
                WHERE receipt_preorder.id = r.reference_id
                  AND receipt_preorder.pickup_order_id = ?
             )
           )
         )
      ORDER BY CASE
        WHEN ? = 'PREORDER_PICKUP' AND r.reference_type = 'preorder_pickup' THEN 0
        WHEN ? = 'SALE' AND r.reference_type = 'order_sale' THEN 0
        ELSE 1
      END, r.id DESC;`,
    [invoice.id, invoice.id, invoice.preorder_id || -1, invoice.id, invoice.origin, invoice.origin]
  );
  return rows.map((row) => ({
    ...row,
    snapshot: parseJson(row.snapshot_json),
    snapshot_json: undefined,
  }));
}

async function loadPreorder(invoice, connection) {
  const preorder = await connection.get(
    `SELECT p.*, creator.name AS cashier_name, pickup_user.name AS pickup_cashier_name
       FROM preorders p
       JOIN users creator ON creator.id = p.cashier_id
       LEFT JOIN users pickup_user ON pickup_user.id = p.pickup_cashier_id
      WHERE p.id = ? OR p.pickup_order_id = ?
      ORDER BY CASE WHEN p.id = ? THEN 0 ELSE 1 END
      LIMIT 1;`,
    [invoice.preorder_id || -1, invoice.id, invoice.preorder_id || -1]
  );
  if (!preorder) return null;
  preorder.items = await connection.all(
    `SELECT id, product_id, quantity, unit_price, total_price,
            product_name_snapshot AS product_name,
            sku_snapshot AS product_sku,
            price_tier_name_snapshot AS price_tier_name,
            availability_policy_snapshot AS availability_policy,
            deposit_pct_snapshot AS deposit_pct
       FROM preorder_items WHERE preorder_id = ? ORDER BY id;`,
    [preorder.id]
  );
  return preorder;
}

async function loadReturns(invoice, connection) {
  const rows = await connection.all(
    `SELECT ret.*, u.name AS cashier_name
       FROM returns ret JOIN users u ON u.id = ret.cashier_id
      WHERE ret.order_id = ? ORDER BY ret.id;`,
    [invoice.id]
  );
  for (const row of rows) {
    row.items = await connection.all(
      `SELECT ri.*,
              COALESCE(
                (SELECT oi.product_name_snapshot FROM order_items oi
                  WHERE oi.order_id = ? AND oi.product_id = ri.product_id ORDER BY oi.id LIMIT 1),
                (SELECT p.name FROM products p WHERE p.id = ri.product_id)
              ) AS product_name,
              COALESCE(
                (SELECT oi.sku_snapshot FROM order_items oi
                  WHERE oi.order_id = ? AND oi.product_id = ri.product_id ORDER BY oi.id LIMIT 1),
                (SELECT p.sku FROM products p WHERE p.id = ri.product_id)
              ) AS product_sku
         FROM return_items ri WHERE ri.return_id = ? ORDER BY ri.id;`,
      [invoice.id, invoice.id, row.id]
    );
  }
  return rows;
}

async function loadAuditTimeline(invoice, receipts, preorder, returns, connection) {
  const clauses = [
    "(al.entity_type IN ('order', 'orders', 'invoice', 'invoices') AND al.entity_id = ?)",
  ];
  const params = [invoice.id];
  if (preorder) {
    clauses.push("(al.entity_type IN ('preorder', 'preorders') AND al.entity_id = ?)");
    params.push(preorder.id);
  }
  if (receipts.length > 0) {
    clauses.push(
      `(al.entity_type IN ('receipt', 'receipts') AND al.entity_id IN (${receipts.map(() => '?').join(', ')}))`
    );
    params.push(...receipts.map((receipt) => receipt.id));
  }
  if (returns.length > 0) {
    clauses.push(
      `(al.entity_type IN ('return', 'returns') AND al.entity_id IN (${returns.map(() => '?').join(', ')}))`
    );
    params.push(...returns.map((item) => item.id));
  }

  const rows = await connection.all(
    `SELECT al.*, u.name AS user_name, u.username, u.role AS user_role
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
      WHERE ${clauses.join(' OR ')}
      ORDER BY al.created_at, al.id;`,
    params
  );
  return rows.map((row) => ({
    ...row,
    before_values: parseJson(row.before_values),
    after_values: parseJson(row.after_values),
  }));
}

export async function getInvoiceDetail(
  invoiceId,
  actor,
  { credential = null, connection = db } = {}
) {
  const id = parsePositiveInteger(invoiceId, 'invoiceId');
  const invoice = await loadInvoiceRow(id, connection);
  if (!invoice) throw new AppError('Invoice not found.', 404, 'INVOICE_NOT_FOUND');
  await authorizeInvoice(invoice, actor, { credential, connection });

  const receipts = await loadReceipts(invoice, connection);
  const primaryReceipt = receipts[0] || null;
  const primarySnapshot = primaryReceipt?.snapshot || {};
  const preorder = await loadPreorder(invoice, connection);
  const linkedPreorderId = preorder?.id || invoice.preorder_id || null;

  const savedItems = await connection.all(
    `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price,
            product_name_snapshot AS product_name,
            sku_snapshot AS product_sku,
            price_tier_name_snapshot AS price_tier_name,
            availability_policy_snapshot AS availability_policy,
            COALESCE((
              SELECT SUM(ri.quantity) FROM return_items ri JOIN returns ret ON ret.id = ri.return_id
               WHERE ret.order_id = oi.order_id
                 AND (ri.order_item_id = oi.id
                      OR (ri.order_item_id IS NULL AND ri.product_id = oi.product_id))
            ), 0) AS returned_quantity
       FROM order_items oi WHERE oi.order_id = ? ORDER BY oi.id;`,
    [invoice.id]
  );
  for (const item of savedItems) {
    item.order_item_id = item.id;
    item.returned_quantity = Number(item.returned_quantity);
    item.remaining_returnable_quantity = Number(item.quantity) - item.returned_quantity;
  }
  const items =
    Array.isArray(primarySnapshot.items) && primarySnapshot.items.length > 0
      ? primarySnapshot.items.map((snapshotItem) => {
          const normalized = normalizeSnapshotItem(snapshotItem);
          const saved = savedItems.find((item) => item.product_id === normalized.product_id);
          return saved
            ? {
                ...normalized,
                id: saved.id,
                order_item_id: saved.id,
                returned_quantity: Number(saved.returned_quantity),
                remaining_returnable_quantity:
                  Number(saved.quantity) - Number(saved.returned_quantity),
              }
            : normalized;
        })
      : savedItems;

  const payments = await connection.all(
    `SELECT pay.id, pay.reference_type, pay.reference_id,
            COALESCE(pay.method_snapshot, pay.payment_method) AS method,
            pay.stage, pay.direction, COALESCE(pay.applied_amount, pay.amount) AS amount,
            pay.cash_received, pay.change_amount, pay.reference_number, pay.note,
            pay.shift_id, pay.cashier_id, u.name AS cashier_name, pay.created_at
       FROM payments pay
       JOIN users u ON u.id = pay.cashier_id
      WHERE pay.is_excluded = 0
        AND (
          (pay.reference_type = 'order' AND pay.reference_id = ?)
          OR (? IS NOT NULL AND pay.reference_type = 'preorder' AND pay.reference_id = ?)
        )
      ORDER BY pay.created_at, pay.id;`,
    [invoice.id, linkedPreorderId, linkedPreorderId]
  );

  const returns = await loadReturns(invoice, connection);
  const printRequests = await connection.all(
    `SELECT pr.*, u.name AS requested_by_name, u.username AS requested_by_username
       FROM print_requests pr
       JOIN users u ON u.id = pr.user_id
       JOIN receipts r ON r.id = pr.receipt_id
      WHERE (r.reference_type = 'order_sale' AND r.reference_id = ?)
         OR (r.reference_type = 'order_return' AND EXISTS (
              SELECT 1 FROM returns receipt_return
               WHERE receipt_return.id = r.reference_id AND receipt_return.order_id = ?
            ))
         OR (
           r.reference_type IN ('preorder_deposit', 'preorder_pickup')
           AND (
             r.reference_id = ?
             OR EXISTS (
               SELECT 1 FROM preorders receipt_preorder
                WHERE receipt_preorder.id = r.reference_id
                  AND receipt_preorder.pickup_order_id = ?
             )
           )
         )
      ORDER BY pr.requested_at, pr.id;`,
    [invoice.id, invoice.id, linkedPreorderId || -1, invoice.id]
  );
  const auditTimeline = await loadAuditTimeline(invoice, receipts, preorder, returns, connection);

  return {
    id: invoice.id,
    invoice_number: primarySnapshot.invoiceNumber || invoice.invoice_number,
    receipt_id: primaryReceipt?.id || null,
    receipt_number: primaryReceipt?.receipt_number || null,
    receipts,
    qr_token: primarySnapshot.qrToken || invoice.qr_token,
    origin: invoice.origin || primarySnapshot.origin,
    // Status may legitimately advance to PARTIALLY_RETURNED/RETURNED; receipt
    // snapshots remain immutable and therefore are not authoritative here.
    status: invoice.status || primarySnapshot.status,
    shift_id: invoice.shift_id,
    cashier_id: invoice.cashier_id,
    cashier_name: primarySnapshot.cashierName || invoice.cashier_name,
    cashier_username: invoice.cashier_username,
    customer_name_snapshot: primarySnapshot.customerName ?? invoice.customer_name_snapshot,
    customer_phone_snapshot: primarySnapshot.customerPhone ?? invoice.customer_phone_snapshot,
    customer_name: primarySnapshot.customerName ?? invoice.customer_name_snapshot,
    customer_phone: primarySnapshot.customerPhone ?? invoice.customer_phone_snapshot,
    subtotal: primarySnapshot.subtotal ?? invoice.subtotal,
    discount: primarySnapshot.discount ?? invoice.discount,
    total: primarySnapshot.total ?? invoice.total,
    created_at: invoice.created_at,
    items,
    payments:
      payments.length > 0
        ? payments
        : Array.isArray(primarySnapshot.payments)
          ? primarySnapshot.payments.map(normalizeSnapshotPayment)
          : [],
    preorder,
    returns,
    printRequests,
    auditTimeline,
  };
}

export async function lookupCashierInvoices(filters, actor, connection = db) {
  if (!actor || !['Cashier', 'Admin'].includes(actor.role)) {
    throw new AppError('Invoice access is forbidden.', 403, 'FORBIDDEN');
  }

  if (filters.ownShift === true) {
    return listInvoices(
      { shiftId: filters.shiftId, limit: filters.limit, offset: filters.offset },
      { cashierId: actor.id, connection }
    );
  }

  const criteria = {
    token: filters.token,
    invoiceNumber: filters.invoiceNumber,
    receiptNumber: filters.receiptNumber,
  };
  const invoiceId = await resolveExactInvoiceId(criteria, connection);
  const detail = await getInvoiceDetail(invoiceId, actor, { credential: criteria, connection });
  return { rows: [detail], total: 1 };
}

export async function getInvoiceByExactCredential(criteria, actor, connection = db) {
  const invoiceId = await resolveExactInvoiceId(criteria, connection);
  return getInvoiceDetail(invoiceId, actor, { credential: criteria, connection });
}

export async function authorizeInvoicePdfOutput(actor, connection = db) {
  if (actor?.role === 'Admin') {
    return { shiftId: null, actorRoleSnapshot: 'Admin', adminOverride: true };
  }
  if (actor?.role !== 'Cashier') {
    throw new AppError('Invoice PDF export is forbidden.', 403, 'FORBIDDEN');
  }
  const shift = await connection.get(
    "SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
    [actor.id]
  );
  if (!shift) {
    throw new AppError(
      'An OPEN shift owned by the acting cashier is required to export an invoice PDF.',
      409,
      'OPEN_OWN_SHIFT_REQUIRED'
    );
  }
  return { shiftId: shift.id, actorRoleSnapshot: 'Cashier', adminOverride: false };
}

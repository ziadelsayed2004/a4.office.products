import crypto from 'node:crypto';
import db, { withTransaction } from '../../db/index.js';
import config from '../../config/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import {
  AppError,
  nextDocumentNumber,
  nextReturnNumbers,
  requireInteger,
  withIdempotency,
} from '../../utils/financial.js';
import { createReceipt } from '../receipts/receipts.service.js';
import { addCalendarDay, cairoMidnightUtc } from '../invoices/invoices.service.js';

const ACTIVE = 'ACTIVE';
const TOKEN_PREFIX = 'ret_';
const EXTERNAL_REFERENCE = 'EXTERNAL_REFERENCE';
const CASH_DRAWER = 'CASH_DRAWER';

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(payload) {
  return crypto.createHmac('sha256', config.returns.qrSecret).update(payload).digest('base64url');
}

function createQrToken(authorization) {
  const payload = base64urlJson({
    i: authorization.id,
    v: authorization.token_version,
    n: authorization.token_nonce,
  });
  return `${TOKEN_PREFIX}${payload}.${signature(payload)}`;
}

function parseQrToken(token) {
  const normalized = typeof token === 'string' ? token.trim() : '';
  const match = normalized.match(/^ret_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!match) throw new AppError('Return QR token is invalid.', 404, 'INVALID_RETURN_QR');
  const [, payload, suppliedSignature] = match;
  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw new AppError('Return QR token is invalid.', 404, 'INVALID_RETURN_QR');
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new AppError('Return QR token is invalid.', 404, 'INVALID_RETURN_QR');
  }
  if (
    !Number.isSafeInteger(parsed?.i) ||
    parsed.i < 1 ||
    !Number.isSafeInteger(parsed?.v) ||
    parsed.v < 1 ||
    typeof parsed?.n !== 'string' ||
    parsed.n.length < 20
  ) {
    throw new AppError('Return QR token is invalid.', 404, 'INVALID_RETURN_QR');
  }
  return { id: parsed.i, version: parsed.v, nonce: parsed.n, token: normalized };
}

function effectiveStatus(row, now = Date.now()) {
  if (row.status === ACTIVE && Date.parse(`${row.expires_at}Z`.replace('ZZ', 'Z')) <= now) {
    return 'EXPIRED';
  }
  return row.status;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one return item is required.', 400, 'RETURN_ITEMS_REQUIRED');
  }
  const byOrderItem = new Map();
  for (const raw of items) {
    const orderItemId = requireInteger(
      Number(raw.orderItemId ?? raw.order_item_id),
      'orderItemId',
      {
        min: 1,
      }
    );
    const quantity = requireInteger(Number(raw.quantity), 'quantity', { min: 1 });
    const disposition = String(raw.disposition || '').toUpperCase();
    if (!['RESTOCK', 'NO_RESTOCK'].includes(disposition)) {
      throw new AppError(
        'Return disposition must be RESTOCK or NO_RESTOCK.',
        400,
        'INVALID_RETURN_DISPOSITION'
      );
    }
    const noRestockReason = raw.noRestockReason ?? raw.no_restock_reason ?? null;
    const cleanReason = noRestockReason == null ? null : String(noRestockReason).trim();
    if (disposition === 'NO_RESTOCK' && !cleanReason) {
      throw new AppError(
        'A non-restock reason is required for damaged or unsellable items.',
        400,
        'NO_RESTOCK_REASON_REQUIRED'
      );
    }
    if (byOrderItem.has(orderItemId)) {
      throw new AppError('Each invoice line may appear only once.', 400, 'DUPLICATE_RETURN_ITEM');
    }
    byOrderItem.set(orderItemId, {
      orderItemId,
      quantity,
      disposition,
      noRestockReason: disposition === 'NO_RESTOCK' ? cleanReason : null,
    });
  }
  return [...byOrderItem.values()].sort((left, right) => left.orderItemId - right.orderItemId);
}

function normalizeReason(reason) {
  const value = typeof reason === 'string' ? reason.trim() : '';
  if (!value) throw new AppError('A return reason is required.', 400, 'RETURN_REASON_REQUIRED');
  if (value.length > 1000) {
    throw new AppError(
      'Return reason cannot exceed 1000 characters.',
      400,
      'RETURN_REASON_TOO_LONG'
    );
  }
  return value;
}

function expiryValue(input, { now = new Date(), allowDefault = true } = {}) {
  const fallback = new Date(now.getTime() + config.returns.defaultTtlHours * 3_600_000);
  const expiresAt = input ? new Date(input) : allowDefault ? fallback : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    throw new AppError('expiresAt must be a valid timestamp.', 400, 'INVALID_RETURN_EXPIRY');
  }
  const lifetime = expiresAt.getTime() - now.getTime();
  if (lifetime <= 0 || lifetime > config.returns.maximumTtlHours * 3_600_000) {
    throw new AppError(
      'Return authorization expiry must be in the future and no more than 7 days away.',
      400,
      'INVALID_RETURN_EXPIRY'
    );
  }
  return expiresAt.toISOString().slice(0, 19).replace('T', ' ');
}

function largestRemainderAllocate(total, balances) {
  if (total === 0) return [];
  const available = balances.reduce((sum, row) => sum + row.balance, 0);
  if (available < total) {
    throw new AppError(
      'Original payment balances are insufficient for this refund.',
      409,
      'REFUND_EXCEEDS_ORIGINAL_PAYMENTS',
      { available, required: total }
    );
  }
  const rows = balances
    .filter((row) => row.balance > 0)
    .map((row) => {
      const numerator = total * row.balance;
      const amount = Math.floor(numerator / available);
      return { ...row, amount, remainder: numerator % available };
    });
  let outstanding = total - rows.reduce((sum, row) => sum + row.amount, 0);
  const ranked = [...rows].sort(
    (left, right) =>
      right.remainder - left.remainder ||
      left.sort_order - right.sort_order ||
      left.method_id - right.method_id
  );
  for (let index = 0; outstanding > 0; index += 1, outstanding -= 1) {
    ranked[index % ranked.length].amount += 1;
  }
  return rows.filter((row) => row.amount > 0);
}

async function originalTenderBalances(connection, order) {
  const original = await connection.all(
    `SELECT pm.id AS method_id, pm.code, pm.name_ar, pm.refund_mode, pm.sort_order,
            COALESCE(SUM(COALESCE(p.applied_amount, p.amount)), 0) AS amount
       FROM payments p
       JOIN payment_methods pm ON pm.id = p.method_id
      WHERE COALESCE(p.is_excluded, 0) = 0 AND p.direction = 'IN'
        AND (
          (p.reference_type = 'order' AND p.reference_id = ?)
          OR (? IS NOT NULL AND p.reference_type = 'preorder' AND p.reference_id = ?
              AND p.stage = 'PREORDER_DEPOSIT')
        )
      GROUP BY pm.id, pm.code, pm.name_ar, pm.refund_mode, pm.sort_order
      ORDER BY pm.sort_order, pm.id;`,
    [order.id, order.preorder_id, order.preorder_id]
  );
  const refunded = await connection.all(
    `SELECT p.method_id, COALESCE(SUM(COALESCE(p.applied_amount, p.amount)), 0) AS amount
       FROM payments p
      WHERE p.reference_type = 'order' AND p.reference_id = ?
        AND p.direction = 'OUT' AND p.stage = 'REFUND' AND COALESCE(p.is_excluded, 0) = 0
      GROUP BY p.method_id;`,
    [order.id]
  );
  const refundedByMethod = new Map(refunded.map((row) => [row.method_id, Number(row.amount)]));
  return original.map((row) => ({
    method_id: row.method_id,
    code: row.code,
    name_ar: row.name_ar,
    refund_mode: row.refund_mode,
    sort_order: Number(row.sort_order),
    originalAmount: Number(row.amount),
    refundedAmount: refundedByMethod.get(row.method_id) || 0,
    balance: Math.max(0, Number(row.amount) - (refundedByMethod.get(row.method_id) || 0)),
  }));
}

async function buildQuote(connection, { orderId, items }, { enforceNoActive = false } = {}) {
  const numericOrderId = requireInteger(Number(orderId), 'orderId', { min: 1 });
  const normalizedItems = normalizeItems(items);
  const order = await connection.get(
    `SELECT o.*, r.receipt_number
       FROM orders o
       LEFT JOIN receipts r ON r.reference_type = 'order_sale' AND r.reference_id = o.id
      WHERE o.id = ? ORDER BY r.id LIMIT 1;`,
    [numericOrderId]
  );
  if (!order) throw new AppError('Invoice not found.', 404, 'INVOICE_NOT_FOUND');
  if (!['COMPLETED', 'PARTIALLY_RETURNED'].includes(order.status)) {
    throw new AppError('This invoice is not returnable.', 409, 'INVOICE_NOT_RETURNABLE');
  }
  if (enforceNoActive) {
    // Expiry is derived read-only everywhere else. During issuance we persist
    // it inside the same write transaction so the partial unique ACTIVE index
    // can safely admit the replacement card without a race.
    await connection.run(
      `UPDATE return_authorizations SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ? AND status = 'ACTIVE' AND expires_at <= CURRENT_TIMESTAMP;`,
      [numericOrderId]
    );
    const current = await connection.get(
      `SELECT id, authorization_number, expires_at FROM return_authorizations
        WHERE order_id = ? AND status = 'ACTIVE' LIMIT 1;`,
      [numericOrderId]
    );
    if (current) {
      throw new AppError(
        'This invoice already has an active return authorization.',
        409,
        'ACTIVE_RETURN_AUTHORIZATION_EXISTS',
        {
          authorizationId: current.id,
          authorizationNumber: current.authorization_number,
          expiresAt: current.expires_at,
        }
      );
    }
  }

  const lines = await connection.all(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price,
            oi.product_name_snapshot, oi.sku_snapshot, oi.price_tier_name_snapshot,
            COALESCE((
              SELECT SUM(ri.quantity) FROM return_items ri JOIN returns r ON r.id = ri.return_id
               WHERE r.order_id = oi.order_id
                 AND (ri.order_item_id = oi.id OR (ri.order_item_id IS NULL AND ri.product_id = oi.product_id))
            ), 0) AS returned_quantity
       FROM order_items oi WHERE oi.order_id = ? ORDER BY oi.id;`,
    [numericOrderId]
  );
  const byId = new Map(lines.map((line) => [line.id, line]));
  const previous = await connection.get(
    `SELECT COALESCE(SUM(r.total_refunded), 0) AS refunded,
            COALESCE(SUM(ri.quantity * oi.unit_price), 0) AS gross
       FROM returns r
       LEFT JOIN return_items ri ON ri.return_id = r.id
       LEFT JOIN order_items oi ON oi.id = ri.order_item_id
      WHERE r.order_id = ?;`,
    [numericOrderId]
  );
  let cumulativeGross = Number(previous.gross);
  const alreadyRefunded = Number(previous.refunded);
  let quoteTotal = 0;
  const processed = [];
  for (const request of normalizedItems) {
    const line = byId.get(request.orderItemId);
    if (!line) {
      throw new AppError(
        `Invoice line ${request.orderItemId} is not on this invoice.`,
        400,
        'RETURN_ITEM_NOT_IN_INVOICE'
      );
    }
    const remainingQuantity = Number(line.quantity) - Number(line.returned_quantity);
    if (request.quantity > remainingQuantity) {
      throw new AppError(
        'Return quantity exceeds the remaining returnable quantity.',
        409,
        'RETURN_QUANTITY_EXCEEDED',
        {
          orderItemId: line.id,
          requested: request.quantity,
          remaining: remainingQuantity,
        }
      );
    }
    cumulativeGross += Number(line.unit_price) * request.quantity;
    const cumulativeTarget =
      Number(order.subtotal) > 0
        ? Math.min(
            Number(order.total),
            Math.round(
              (Number(order.total) * Math.min(cumulativeGross, Number(order.subtotal))) /
                Number(order.subtotal)
            )
          )
        : 0;
    const refundAmount = Math.max(0, cumulativeTarget - alreadyRefunded - quoteTotal);
    quoteTotal += refundAmount;
    processed.push({
      orderItemId: line.id,
      productId: line.product_id,
      productName: line.product_name_snapshot,
      sku: line.sku_snapshot,
      priceTierName: line.price_tier_name_snapshot,
      soldQuantity: Number(line.quantity),
      previouslyReturnedQuantity: Number(line.returned_quantity),
      remainingQuantity,
      quantity: request.quantity,
      unitPrice: Number(line.unit_price),
      refundAmount,
      disposition: request.disposition,
      noRestockReason: request.noRestockReason,
    });
  }

  const balances = await originalTenderBalances(connection, order);
  const allocations = largestRemainderAllocate(quoteTotal, balances);
  const disabled = allocations.filter((allocation) => allocation.refund_mode === 'DISABLED');
  if (disabled.length > 0) {
    throw new AppError(
      'An original payment method is configured to block refunds.',
      409,
      'REFUND_METHOD_DISABLED',
      {
        methods: disabled.map((row) => ({
          id: row.method_id,
          code: row.code,
          name: row.name_ar,
          amount: row.amount,
        })),
      }
    );
  }

  return {
    order: {
      id: order.id,
      invoiceNumber: order.invoice_number,
      receiptNumber: order.receipt_number,
      status: order.status,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      total: Number(order.total),
      preorderId: order.preorder_id,
    },
    items: processed,
    totalRefund: quoteTotal,
    previouslyRefunded: alreadyRefunded,
    remainingRefundable: Math.max(0, Number(order.total) - alreadyRefunded - quoteTotal),
    allocations: allocations.map((row) => ({
      paymentMethodId: row.method_id,
      method: row.code,
      methodName: row.name_ar,
      refundMode: row.refund_mode,
      amount: row.amount,
      originalAmount: row.originalAmount,
      previouslyRefunded: row.refundedAmount,
    })),
  };
}

export async function quoteReturnAuthorization(input, connection = db) {
  return buildQuote(connection, input);
}

async function loadAuthorizationRows(connection, id) {
  const authorization = await connection.get(
    `SELECT ra.*, o.invoice_number, o.status AS invoice_status, o.total AS invoice_total,
            creator.name AS created_by_name, consumer.name AS consumed_by_name,
            revoker.name AS revoked_by_name
       FROM return_authorizations ra
       JOIN orders o ON o.id = ra.order_id
       JOIN users creator ON creator.id = ra.created_by
       LEFT JOIN users consumer ON consumer.id = ra.consumed_by
       LEFT JOIN users revoker ON revoker.id = ra.revoked_by
      WHERE ra.id = ?;`,
    [id]
  );
  if (!authorization) {
    throw new AppError('Return authorization not found.', 404, 'RETURN_AUTHORIZATION_NOT_FOUND');
  }
  const [items, allocations] = await Promise.all([
    connection.all(
      `SELECT id, order_item_id, product_id, product_name_snapshot, sku_snapshot,
              quantity, unit_price, refund_amount, disposition, no_restock_reason
         FROM return_authorization_items WHERE authorization_id = ? ORDER BY id;`,
      [id]
    ),
    connection.all(
      `SELECT id, payment_method_id, method_code_snapshot, method_name_snapshot,
              refund_mode, amount
         FROM return_authorization_allocations WHERE authorization_id = ? ORDER BY id;`,
      [id]
    ),
  ]);
  return { authorization, items, allocations };
}

function presentAuthorization({ authorization, items, allocations }, { includeToken = true } = {}) {
  const status = effectiveStatus(authorization);
  return {
    id: authorization.id,
    authorizationNumber: authorization.authorization_number,
    orderId: authorization.order_id,
    invoiceNumber: authorization.invoice_number,
    invoiceStatus: authorization.invoice_status,
    status,
    reason: authorization.reason,
    totalRefund: Number(authorization.total_refund),
    expiresAt: authorization.expires_at,
    createdBy: authorization.created_by,
    createdByName: authorization.created_by_name,
    consumedReturnId: authorization.consumed_return_id,
    consumedBy: authorization.consumed_by,
    consumedByName: authorization.consumed_by_name,
    consumedShiftId: authorization.consumed_shift_id,
    consumedAt: authorization.consumed_at,
    revokedBy: authorization.revoked_by,
    revokedByName: authorization.revoked_by_name,
    revokedReason: authorization.revoked_reason,
    revokedAt: authorization.revoked_at,
    printCount: Number(authorization.print_count),
    lastPrintedAt: authorization.last_printed_at,
    createdAt: authorization.created_at,
    items: items.map((item) => ({
      id: item.id,
      orderItemId: item.order_item_id,
      productId: item.product_id,
      productName: item.product_name_snapshot,
      sku: item.sku_snapshot,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      refundAmount: Number(item.refund_amount),
      disposition: item.disposition,
      noRestockReason: item.no_restock_reason,
    })),
    allocations: allocations.map((allocation) => ({
      id: allocation.id,
      paymentMethodId: allocation.payment_method_id,
      method: allocation.method_code_snapshot,
      methodName: allocation.method_name_snapshot,
      refundMode: allocation.refund_mode,
      amount: Number(allocation.amount),
    })),
    ...(includeToken && status === ACTIVE ? { qrToken: createQrToken(authorization) } : {}),
  };
}

export async function createReturnAuthorization({ adminId, input, idempotencyKey }) {
  const orderId = requireInteger(Number(input.orderId), 'orderId', { min: 1 });
  const items = normalizeItems(input.items);
  const reason = normalizeReason(input.reason);
  const expiresAt = expiryValue(input.expiresAt);
  const payload = { orderId, items, reason, expiresAt };
  return withIdempotency(
    {
      key: idempotencyKey,
      userId: adminId,
      operation: 'RETURN_AUTHORIZATION_CREATE',
      payload,
    },
    async (connection) => {
      const quote = await buildQuote(connection, { orderId, items }, { enforceNoActive: true });
      const authorizationNumber = await nextDocumentNumber(connection, 'returnAuthorization');
      const nonce = crypto.randomBytes(24).toString('base64url');
      const result = await connection.run(
        `INSERT INTO return_authorizations
         (authorization_number, order_id, status, reason, total_refund, expires_at,
          created_by, token_nonce, token_version)
         VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, ?, 1);`,
        [authorizationNumber, orderId, reason, quote.totalRefund, expiresAt, adminId, nonce]
      );
      for (const item of quote.items) {
        await connection.run(
          `INSERT INTO return_authorization_items
           (authorization_id, order_item_id, product_id, product_name_snapshot, sku_snapshot,
            quantity, unit_price, refund_amount, disposition, no_restock_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            result.lastID,
            item.orderItemId,
            item.productId,
            item.productName,
            item.sku,
            item.quantity,
            item.unitPrice,
            item.refundAmount,
            item.disposition,
            item.noRestockReason,
          ]
        );
      }
      for (const allocation of quote.allocations) {
        await connection.run(
          `INSERT INTO return_authorization_allocations
           (authorization_id, payment_method_id, method_code_snapshot, method_name_snapshot,
            refund_mode, amount) VALUES (?, ?, ?, ?, ?, ?);`,
          [
            result.lastID,
            allocation.paymentMethodId,
            allocation.method,
            allocation.methodName,
            allocation.refundMode,
            allocation.amount,
          ]
        );
      }
      await writeAuditLog({
        userId: adminId,
        actionType: 'RETURN_AUTHORIZATION_CREATE',
        entityType: 'return_authorizations',
        entityId: result.lastID,
        afterValues: {
          authorizationNumber,
          orderId,
          totalRefund: quote.totalRefund,
          expiresAt,
          items: quote.items.map(({ orderItemId, quantity, disposition }) => ({
            orderItemId,
            quantity,
            disposition,
          })),
          allocations: quote.allocations.map(({ method, amount }) => ({ method, amount })),
        },
        connection,
      });
      const detail = await loadAuthorizationRows(connection, result.lastID);
      return { statusCode: 201, data: presentAuthorization(detail) };
    }
  );
}

export async function listReturnAuthorizations(filters = {}, connection = db) {
  const limit = requireInteger(Number(filters.limit ?? 50), 'limit', { min: 1, max: 100 });
  const offset = requireInteger(Number(filters.offset ?? 0), 'offset', { min: 0 });
  const where = [];
  const params = [];
  if (filters.status) {
    if (filters.status === 'EXPIRED') {
      where.push(
        "(ra.status = 'EXPIRED' OR (ra.status = 'ACTIVE' AND ra.expires_at <= CURRENT_TIMESTAMP))"
      );
    } else if (filters.status === 'ACTIVE') {
      where.push("ra.status = 'ACTIVE' AND ra.expires_at > CURRENT_TIMESTAMP");
    } else {
      where.push('ra.status = ?');
      params.push(filters.status);
    }
  }
  if (filters.invoiceNumber) {
    where.push('o.invoice_number LIKE ?');
    params.push(`%${filters.invoiceNumber}%`);
  }
  if (filters.orderId) {
    where.push('ra.order_id = ?');
    params.push(Number(filters.orderId));
  }
  if (filters.startDate) {
    where.push('ra.created_at >= ?');
    params.push(cairoMidnightUtc(filters.startDate));
  }
  if (filters.endDate) {
    where.push('ra.created_at < ?');
    params.push(cairoMidnightUtc(addCalendarDay(filters.endDate)));
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await connection.get(
    `SELECT COUNT(*) AS count FROM return_authorizations ra
      JOIN orders o ON o.id = ra.order_id ${clause};`,
    params
  );
  const rows = await connection.all(
    `SELECT ra.*, o.invoice_number, o.status AS invoice_status, creator.name AS created_by_name,
            CASE WHEN ra.status = 'ACTIVE' AND ra.expires_at <= CURRENT_TIMESTAMP
                 THEN 'EXPIRED' ELSE ra.status END AS effective_status,
            (SELECT COUNT(*) FROM return_authorization_items rai
              WHERE rai.authorization_id = ra.id) AS item_count
       FROM return_authorizations ra
       JOIN orders o ON o.id = ra.order_id
       JOIN users creator ON creator.id = ra.created_by
       ${clause}
      ORDER BY ra.id DESC LIMIT ? OFFSET ?;`,
    [...params, limit, offset]
  );
  return {
    authorizations: rows.map((row) => ({
      id: row.id,
      authorizationNumber: row.authorization_number,
      orderId: row.order_id,
      invoiceNumber: row.invoice_number,
      invoiceStatus: row.invoice_status,
      status: row.effective_status,
      reason: row.reason,
      totalRefund: Number(row.total_refund),
      expiresAt: row.expires_at,
      itemCount: Number(row.item_count),
      createdByName: row.created_by_name,
      createdAt: row.created_at,
    })),
    pagination: { total: Number(total.count), limit, offset },
  };
}

export async function getReturnAuthorization(id, connection = db) {
  const numericId = requireInteger(Number(id), 'authorizationId', { min: 1 });
  return presentAuthorization(await loadAuthorizationRows(connection, numericId));
}

export async function revokeReturnAuthorization(id, { adminId, reason }) {
  const numericId = requireInteger(Number(id), 'authorizationId', { min: 1 });
  const cleanReason = normalizeReason(reason);
  return withTransaction(async (connection) => {
    const before = await connection.get('SELECT * FROM return_authorizations WHERE id = ?;', [
      numericId,
    ]);
    if (!before) {
      throw new AppError('Return authorization not found.', 404, 'RETURN_AUTHORIZATION_NOT_FOUND');
    }
    if (effectiveStatus(before) !== ACTIVE) {
      throw new AppError(
        'Only an active return authorization can be revoked.',
        409,
        'RETURN_AUTHORIZATION_NOT_ACTIVE',
        { status: effectiveStatus(before) }
      );
    }
    const changed = await connection.run(
      `UPDATE return_authorizations
          SET status = 'REVOKED', revoked_by = ?, revoked_reason = ?,
              revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'ACTIVE';`,
      [adminId, cleanReason, numericId]
    );
    if (changed.changes !== 1) {
      throw new AppError('Return authorization state changed.', 409, 'RETURN_STATE_CONFLICT');
    }
    await writeAuditLog({
      userId: adminId,
      actionType: 'RETURN_AUTHORIZATION_REVOKE',
      entityType: 'return_authorizations',
      entityId: numericId,
      beforeValues: { status: before.status },
      afterValues: { status: 'REVOKED', reason: cleanReason },
      connection,
    });
    return presentAuthorization(await loadAuthorizationRows(connection, numericId), {
      includeToken: false,
    });
  });
}

export async function reissueReturnAuthorization(id, { adminId, expiresAt }) {
  const numericId = requireInteger(Number(id), 'authorizationId', { min: 1 });
  const normalizedExpiry = expiryValue(expiresAt);
  return withTransaction(async (connection) => {
    const before = await connection.get('SELECT * FROM return_authorizations WHERE id = ?;', [
      numericId,
    ]);
    if (!before) {
      throw new AppError('Return authorization not found.', 404, 'RETURN_AUTHORIZATION_NOT_FOUND');
    }
    if (before.status !== ACTIVE) {
      throw new AppError(
        'Only an unconsumed return authorization can be reissued.',
        409,
        'RETURN_AUTHORIZATION_NOT_ACTIVE',
        { status: before.status }
      );
    }
    const nonce = crypto.randomBytes(24).toString('base64url');
    const changed = await connection.run(
      `UPDATE return_authorizations
          SET token_nonce = ?, token_version = token_version + 1, expires_at = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'ACTIVE' AND token_version = ?;`,
      [nonce, normalizedExpiry, numericId, before.token_version]
    );
    if (changed.changes !== 1) {
      throw new AppError('Return authorization state changed.', 409, 'RETURN_STATE_CONFLICT');
    }
    await writeAuditLog({
      userId: adminId,
      actionType: 'RETURN_AUTHORIZATION_REISSUE',
      entityType: 'return_authorizations',
      entityId: numericId,
      beforeValues: { tokenVersion: before.token_version, expiresAt: before.expires_at },
      afterValues: { tokenVersion: before.token_version + 1, expiresAt: normalizedExpiry },
      connection,
    });
    return presentAuthorization(await loadAuthorizationRows(connection, numericId));
  });
}

export async function requestReturnAuthorizationPrint(id, input, actor) {
  const numericId = requireInteger(Number(id), 'authorizationId', { min: 1 });
  const requestKey = String(input.requestKey || input.request_key || '').trim();
  if (requestKey.length < 8 || requestKey.length > 200) {
    throw new AppError(
      'requestKey is required (8-200 characters).',
      400,
      'PRINT_REQUEST_KEY_REQUIRED'
    );
  }
  const copies = requireInteger(Number(input.copies ?? 1), 'copies', { min: 1, max: 20 });
  const reason = input.reason == null ? null : String(input.reason).trim() || null;
  return withTransaction(async (connection) => {
    const detail = await loadAuthorizationRows(connection, numericId);
    if (effectiveStatus(detail.authorization) !== ACTIVE) {
      throw new AppError(
        'Only an active return card can be printed.',
        409,
        'RETURN_AUTHORIZATION_NOT_ACTIVE',
        { status: effectiveStatus(detail.authorization) }
      );
    }
    const existing = await connection.get(
      `SELECT * FROM return_authorization_print_requests
        WHERE user_id = ? AND request_key = ?;`,
      [actor.id, requestKey]
    );
    if (existing) {
      const same =
        existing.authorization_id === numericId &&
        existing.copies === copies &&
        (existing.reason || null) === reason;
      if (!same) {
        throw new AppError(
          'requestKey was already used with different print input.',
          409,
          'PRINT_REQUEST_KEY_CONFLICT'
        );
      }
      return {
        replayed: true,
        requestId: existing.id,
        copies,
        card: presentAuthorization(detail),
      };
    }
    const result = await connection.run(
      `INSERT INTO return_authorization_print_requests
       (authorization_id, user_id, request_key, copies, reason) VALUES (?, ?, ?, ?, ?);`,
      [numericId, actor.id, requestKey, copies, reason]
    );
    await connection.run(
      `UPDATE return_authorizations SET print_count = print_count + 1,
       last_printed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [numericId]
    );
    await writeAuditLog({
      userId: actor.id,
      actionType: 'RETURN_AUTHORIZATION_PRINT_REQUEST',
      entityType: 'return_authorizations',
      entityId: numericId,
      afterValues: { requestId: result.lastID, copies, requestKey },
      notes: 'Browser print requested; physical output is not observable.',
      connection,
    });
    return {
      replayed: false,
      requestId: result.lastID,
      copies,
      card: presentAuthorization(await loadAuthorizationRows(connection, numericId)),
    };
  });
}

async function authorizationFromToken(connection, token) {
  const parsed = parseQrToken(token);
  const rows = await loadAuthorizationRows(connection, parsed.id);
  const authorization = rows.authorization;
  if (
    authorization.token_version !== parsed.version ||
    authorization.token_nonce !== parsed.nonce
  ) {
    throw new AppError(
      'This return QR was superseded by a newer card.',
      409,
      'RETURN_QR_SUPERSEDED'
    );
  }
  return rows;
}

export async function resolveReturnAuthorizationToken(token, actor, connection = db) {
  void actor;
  const rows = await authorizationFromToken(connection, token);
  const data = presentAuthorization(rows, { includeToken: false });
  return {
    type: 'return_authorization',
    action: data.status === ACTIVE ? 'RETURN_REVIEW' : 'BLOCKED',
    data,
  };
}

async function requireOwnOpenShift(connection, cashierId) {
  const shift = await connection.get(
    "SELECT * FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
    [cashierId]
  );
  if (!shift) {
    throw new AppError(
      'An open shift belonging to the acting cashier is required.',
      409,
      'OPEN_SHIFT_REQUIRED'
    );
  }
  return shift;
}

async function expectedCashDrawer(connection, shift) {
  const payments = await connection.get(
    `SELECT COALESCE(SUM(
              CASE WHEN p.direction = 'OUT' THEN -COALESCE(p.applied_amount, p.amount)
                   ELSE COALESCE(p.applied_amount, p.amount) END
            ), 0) AS total
       FROM payments p
       LEFT JOIN payment_methods pm ON pm.id = p.method_id
      WHERE p.shift_id = ? AND COALESCE(p.is_excluded, 0) = 0
        AND COALESCE(pm.refund_mode,
                     CASE WHEN p.payment_method = 'Cash' THEN 'CASH_DRAWER'
                          ELSE 'EXTERNAL_REFERENCE' END) = 'CASH_DRAWER';`,
    [shift.id]
  );
  const movements = await connection.get(
    `SELECT COALESCE(SUM(CASE WHEN type = 'PAY_IN' THEN amount
                             WHEN type = 'PAY_OUT' AND COALESCE(notes, '') NOT LIKE 'Cash refund for %'
                             THEN -amount ELSE 0 END), 0) AS total
       FROM cash_movements WHERE shift_id = ?;`,
    [shift.id]
  );
  return Number(shift.opening_cash) + Number(payments.total) + Number(movements.total);
}

function normalizeRefundReferences(input, allocations) {
  const rows = Array.isArray(input) ? input : [];
  const byAllocation = new Map();
  for (const row of rows) {
    const allocationId = requireInteger(
      Number(row.allocationId ?? row.allocation_id),
      'allocationId',
      { min: 1 }
    );
    if (byAllocation.has(allocationId)) {
      throw new AppError(
        'Each refund allocation reference may appear once.',
        400,
        'DUPLICATE_REFUND_REFERENCE'
      );
    }
    byAllocation.set(
      allocationId,
      String(row.referenceNumber ?? row.reference_number ?? '').trim()
    );
  }
  for (const allocation of allocations) {
    if (allocation.refund_mode === EXTERNAL_REFERENCE && !byAllocation.get(allocation.id)) {
      throw new AppError(
        `An external refund reference is required for ${allocation.method_name_snapshot}.`,
        400,
        'REFUND_REFERENCE_REQUIRED',
        { allocationId: allocation.id, method: allocation.method_code_snapshot }
      );
    }
  }
  for (const id of byAllocation.keys()) {
    if (!allocations.some((allocation) => allocation.id === id)) {
      throw new AppError(
        'A refund reference targets an unknown allocation.',
        400,
        'UNKNOWN_REFUND_ALLOCATION'
      );
    }
  }
  return byAllocation;
}

export async function executeReturnAuthorization({
  cashierId,
  token,
  refundReferences = [],
  cashierNote = null,
  expectedOrderId = null,
  idempotencyKey,
}) {
  const normalizedToken = typeof token === 'string' ? token.trim() : '';
  // Reject malformed or forged input before creating an idempotency row.
  parseQrToken(normalizedToken);
  const note = cashierNote == null ? null : String(cashierNote).trim() || null;
  const normalizedExpectedOrderId =
    expectedOrderId === null
      ? null
      : requireInteger(Number(expectedOrderId), 'orderId', { min: 1 });
  const payload = {
    token: normalizedToken,
    refundReferences,
    cashierNote: note,
    expectedOrderId: normalizedExpectedOrderId,
  };
  return withIdempotency(
    {
      key: idempotencyKey,
      userId: cashierId,
      operation: 'RETURN_AUTHORIZATION_EXECUTE',
      payload,
    },
    async (connection) => {
      const detail = await authorizationFromToken(connection, normalizedToken);
      const authorization = detail.authorization;
      if (
        normalizedExpectedOrderId !== null &&
        authorization.order_id !== normalizedExpectedOrderId
      ) {
        throw new AppError(
          'Return authorization does not belong to this invoice.',
          409,
          'RETURN_AUTHORIZATION_INVOICE_MISMATCH'
        );
      }
      const status = effectiveStatus(authorization);
      if (status !== ACTIVE) {
        const code =
          status === 'EXPIRED'
            ? 'RETURN_AUTHORIZATION_EXPIRED'
            : status === 'CONSUMED'
              ? 'RETURN_AUTHORIZATION_CONSUMED'
              : 'RETURN_AUTHORIZATION_REVOKED';
        throw new AppError('Return authorization is not active.', 409, code, { status });
      }
      const shift = await requireOwnOpenShift(connection, cashierId);
      const references = normalizeRefundReferences(refundReferences, detail.allocations);
      const cashRefund = detail.allocations
        .filter((allocation) => allocation.refund_mode === CASH_DRAWER)
        .reduce((sum, allocation) => sum + Number(allocation.amount), 0);
      const cashBefore = await expectedCashDrawer(connection, shift);
      if (cashBefore < cashRefund) {
        throw new AppError(
          'The shift drawer does not contain enough cash for this refund.',
          409,
          'INSUFFICIENT_DRAWER_CASH',
          { available: cashBefore, required: cashRefund }
        );
      }

      const consumed = await connection.run(
        `UPDATE return_authorizations
            SET status = 'CONSUMED', consumed_by = ?, consumed_shift_id = ?,
                consumed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'ACTIVE' AND token_version = ? AND token_nonce = ?
            AND expires_at > CURRENT_TIMESTAMP;`,
        [
          cashierId,
          shift.id,
          authorization.id,
          authorization.token_version,
          authorization.token_nonce,
        ]
      );
      if (consumed.changes !== 1) {
        throw new AppError('Return authorization state changed.', 409, 'RETURN_STATE_CONFLICT');
      }

      const { returnNumber, receiptNumber } = await nextReturnNumbers(connection);
      const result = await connection.run(
        `INSERT INTO returns
         (order_id, shift_id, cashier_id, total_refunded, notes, payment_method_snapshot,
          authorization_id, return_number, authorized_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          authorization.order_id,
          shift.id,
          cashierId,
          authorization.total_refund,
          note,
          detail.allocations.map((allocation) => allocation.method_code_snapshot).join(' + '),
          authorization.id,
          returnNumber,
          authorization.created_by,
        ]
      );
      for (const item of detail.items) {
        const restocked = item.disposition === 'RESTOCK' ? 1 : 0;
        await connection.run(
          `INSERT INTO return_items
           (return_id, product_id, order_item_id, quantity, refund_amount, disposition, restocked)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            result.lastID,
            item.product_id,
            item.order_item_id,
            item.quantity,
            item.refund_amount,
            item.disposition,
            restocked,
          ]
        );
        if (restocked) {
          const stock = await connection.get(
            `SELECT after_quantity FROM inventory_ledger
              WHERE product_id = ? ORDER BY id DESC LIMIT 1;`,
            [item.product_id]
          );
          const before = Number(stock?.after_quantity || 0);
          await connection.run(
            `INSERT INTO inventory_ledger
             (product_id, transaction_type, quantity_changed, before_quantity, after_quantity,
              reference_type, reference_id, user_id, shift_id, notes)
             VALUES (?, 'RETURN', ?, ?, ?, 'returns', ?, ?, ?, ?);`,
            [
              item.product_id,
              item.quantity,
              before,
              before + Number(item.quantity),
              result.lastID,
              cashierId,
              shift.id,
              `Return ${returnNumber}; authorization ${authorization.authorization_number}`,
            ]
          );
        }
      }

      const refundPayments = [];
      for (const allocation of detail.allocations) {
        const referenceNumber = references.get(allocation.id) || null;
        const paymentResult = await connection.run(
          `INSERT INTO payments
           (shift_id, cashier_id, reference_type, reference_id, payment_method, amount,
            method_id, stage, direction, applied_amount, reference_number, note,
            cash_received, change_amount, method_snapshot, return_id)
           VALUES (?, ?, 'order', ?, ?, ?, ?, 'REFUND', 'OUT', ?, ?, ?, NULL, 0, ?, ?);`,
          [
            shift.id,
            cashierId,
            authorization.order_id,
            allocation.method_code_snapshot,
            allocation.amount,
            allocation.payment_method_id,
            allocation.amount,
            referenceNumber,
            note,
            allocation.method_name_snapshot,
            result.lastID,
          ]
        );
        refundPayments.push({
          id: paymentResult.lastID,
          method: allocation.method_code_snapshot,
          methodName: allocation.method_name_snapshot,
          refundMode: allocation.refund_mode,
          amount: Number(allocation.amount),
          referenceNumber,
        });
      }

      const quantities = await connection.all(
        `SELECT oi.id, oi.quantity,
                COALESCE(SUM(ri.quantity), 0) AS returned_quantity
           FROM order_items oi
           LEFT JOIN return_items ri ON ri.order_item_id = oi.id
           LEFT JOIN returns r ON r.id = ri.return_id AND r.order_id = oi.order_id
          WHERE oi.order_id = ? GROUP BY oi.id, oi.quantity;`,
        [authorization.order_id]
      );
      const invoiceStatus = quantities.every(
        (item) => Number(item.returned_quantity) >= Number(item.quantity)
      )
        ? 'RETURNED'
        : 'PARTIALLY_RETURNED';
      await connection.run('UPDATE orders SET status = ? WHERE id = ?;', [
        invoiceStatus,
        authorization.order_id,
      ]);

      const cashier = await connection.get('SELECT name FROM users WHERE id = ?;', [cashierId]);
      const receipt = await createReceipt({
        referenceType: 'order_return',
        referenceId: result.lastID,
        printedBy: cashierId,
        receiptNumber,
        connection,
        snapshot: {
          version: 3,
          returnId: result.lastID,
          returnNumber,
          orderId: authorization.order_id,
          authorizationId: authorization.id,
          authorizationNumber: authorization.authorization_number,
          invoiceId: authorization.order_id,
          invoiceNumber: authorization.invoice_number,
          status: invoiceStatus,
          cashierName: cashier?.name,
          total: Number(authorization.total_refund),
          reason: authorization.reason,
          items: detail.items.map((item) => ({
            orderItemId: item.order_item_id,
            productId: item.product_id,
            productName: item.product_name_snapshot,
            productSku: item.sku_snapshot,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            totalPrice: Number(item.refund_amount),
            disposition: item.disposition,
          })),
          payments: refundPayments.map((payment) => ({
            method: payment.method,
            methodName: payment.methodName,
            stage: 'REFUND',
            direction: 'OUT',
            amount: payment.amount,
            referenceNumber: payment.referenceNumber,
          })),
        },
      });
      await connection.run(
        `UPDATE return_authorizations SET consumed_return_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?;`,
        [result.lastID, authorization.id]
      );
      await writeAuditLog({
        userId: cashierId,
        shiftId: shift.id,
        actionType: 'ORDER_REFUND_AUTHORIZED',
        entityType: 'returns',
        entityId: result.lastID,
        afterValues: {
          returnNumber,
          authorizationId: authorization.id,
          authorizationNumber: authorization.authorization_number,
          orderId: authorization.order_id,
          totalRefunded: Number(authorization.total_refund),
          invoiceStatus,
          refundPayments: refundPayments.map(({ method, amount, referenceNumber }) => ({
            method,
            amount,
            referenceNumber,
          })),
        },
        connection,
      });

      return {
        statusCode: 201,
        data: {
          returnId: result.lastID,
          returnNumber,
          authorizationNumber: authorization.authorization_number,
          invoiceStatus,
          totalRefunded: Number(authorization.total_refund),
          refundPayments,
          cashDrawerEffect: {
            amount: cashRefund === 0 ? 0 : -cashRefund,
            before: cashBefore,
            after: cashBefore - cashRefund,
          },
          receiptId: receipt.id,
          receiptNumber: receipt.receipt_number,
        },
      };
    }
  );
}

import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import {
  AppError,
  nextReturnNumbers,
  requireInteger,
  withIdempotency,
} from '../../utils/financial.js';
import { createReceipt } from '../receipts/receipts.service.js';
import { quoteReturnAuthorization } from '../returnAuthorizations/returnAuthorizations.service.js';
import { requireActiveCard } from '../returnApprovalCards/returnApprovalCards.service.js';
import { addCalendarDay, cairoMidnightUtc } from '../invoices/invoices.service.js';
import { publishLiveEvent } from '../liveAdmin/liveEvents.js';

const CASH_DRAWER = 'CASH_DRAWER';
const EXTERNAL_REFERENCE = 'EXTERNAL_REFERENCE';

function requireCashier(actor) {
  if (actor?.role !== 'Cashier') {
    throw new AppError('Cashier role required.', 403, 'CASHIER_REQUIRED');
  }
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
      'OPEN_OWN_SHIFT_REQUIRED'
    );
  }
  return shift;
}

function normalizedText(value, field, { required = false, max = 1000 } = {}) {
  const text = value == null ? '' : String(value).trim();
  if (required && !text) {
    throw new AppError(`${field} is required.`, 400, `${field.toUpperCase()}_REQUIRED`);
  }
  if (text.length > max) {
    throw new AppError(`${field} is too long.`, 400, `${field.toUpperCase()}_TOO_LONG`);
  }
  return text || null;
}

async function resolveInvoiceCode(connection, invoiceCode) {
  const code = normalizedText(invoiceCode, 'invoiceCode', { required: true, max: 500 });
  let row = await connection.get(
    `SELECT o.id FROM orders o
      WHERE o.qr_token = ?
         OR o.id = (SELECT st.reference_id FROM secure_tokens st
                     WHERE st.token = ? AND st.token_type = 'invoice')
      LIMIT 1;`,
    [code, code]
  );
  if (row) return { orderId: row.id, matchedBy: 'token' };

  row = await connection.get('SELECT id FROM orders WHERE invoice_number = ?;', [code]);
  if (row) return { orderId: row.id, matchedBy: 'invoiceNumber' };

  row = await connection.get(
    `SELECT o.id
       FROM orders o
       JOIN receipts r ON (
         (r.reference_type = 'order_sale' AND r.reference_id = o.id)
         OR (r.reference_type = 'order_return' AND EXISTS (
           SELECT 1 FROM returns rr WHERE rr.id = r.reference_id AND rr.order_id = o.id
         ))
         OR (r.reference_type IN ('preorder_deposit', 'preorder_pickup') AND EXISTS (
           SELECT 1 FROM preorders pr WHERE pr.id = r.reference_id
             AND pr.pickup_order_id = o.id
         ))
       )
      WHERE r.receipt_number = ?
      ORDER BY o.id DESC LIMIT 1;`,
    [code]
  );
  if (row) return { orderId: row.id, matchedBy: 'receiptNumber' };
  throw new AppError('Invoice not found.', 404, 'INVOICE_NOT_FOUND');
}

function presentReturnableLine(row) {
  const soldQuantity = Number(row.quantity);
  const returnedQuantity = Number(row.returned_quantity || 0);
  return {
    orderItemId: row.id,
    productId: row.product_id,
    productName: row.product_name_snapshot,
    sku: row.sku_snapshot,
    currentSku: row.current_sku || row.sku_snapshot,
    barcode: row.barcode || row.current_sku || row.sku_snapshot,
    priceTierName: row.price_tier_name_snapshot,
    soldQuantity,
    returnedQuantity,
    remainingQuantity: Math.max(0, soldQuantity - returnedQuantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.total_price),
    productActive: Number(row.product_is_active) === 1,
  };
}

async function loadReturnableLines(connection, orderId) {
  const rows = await connection.all(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price,
            oi.product_name_snapshot, oi.sku_snapshot, oi.price_tier_name_snapshot,
            p.barcode, p.sku AS current_sku, p.is_active AS product_is_active,
            COALESCE((
              SELECT SUM(ri.quantity)
                FROM return_items ri
                JOIN returns r ON r.id = ri.return_id
               WHERE r.order_id = oi.order_id
                 AND (ri.order_item_id = oi.id
                      OR (ri.order_item_id IS NULL AND ri.product_id = oi.product_id))
            ), 0) AS returned_quantity
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? ORDER BY oi.id;`,
    [orderId]
  );
  return rows.map(presentReturnableLine);
}

async function loadReturnOrder(connection, orderId) {
  const order = await connection.get(
    `SELECT o.*, cashier.name AS cashier_name,
            (SELECT r.receipt_number FROM receipts r
              WHERE r.reference_type = 'order_sale' AND r.reference_id = o.id
              ORDER BY r.id DESC LIMIT 1) AS receipt_number
       FROM orders o
       JOIN users cashier ON cashier.id = o.cashier_id
      WHERE o.id = ?;`,
    [orderId]
  );
  if (!order) throw new AppError('Invoice not found.', 404, 'INVOICE_NOT_FOUND');
  if (!['COMPLETED', 'PARTIALLY_RETURNED'].includes(order.status)) {
    throw new AppError('This invoice is not returnable.', 409, 'INVOICE_NOT_RETURNABLE');
  }
  return order;
}

export async function prepareReturn(input, actor, connection = db) {
  requireCashier(actor);
  const shift = await requireOwnOpenShift(connection, actor.id);
  const resolved = await resolveInvoiceCode(connection, input?.invoiceCode);
  const order = await loadReturnOrder(connection, resolved.orderId);
  const items = await loadReturnableLines(connection, order.id);
  const returnable = items.filter((item) => item.remainingQuantity > 0);
  if (returnable.length === 0) {
    throw new AppError('This invoice has no returnable quantity.', 409, 'INVOICE_NOT_RETURNABLE');
  }
  const previousReturns = await connection.all(
    `SELECT id, return_number, total_refunded, shift_id, cashier_id, created_at
       FROM returns WHERE order_id = ? ORDER BY created_at, id;`,
    [order.id]
  );
  return {
    shiftId: shift.id,
    matchedBy: resolved.matchedBy,
    order: {
      id: order.id,
      invoiceNumber: order.invoice_number,
      receiptNumber: order.receipt_number,
      status: order.status,
      origin: order.origin,
      cashierId: order.cashier_id,
      cashierName: order.cashier_name,
      customerName: order.customer_name_snapshot,
      customerPhone: order.customer_phone_snapshot,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      total: Number(order.total),
      createdAt: order.created_at,
    },
    items: returnable,
    previousReturns: previousReturns.map((row) => ({
      id: row.id,
      returnNumber: row.return_number,
      totalRefunded: Number(row.total_refunded),
      shiftId: row.shift_id,
      cashierId: row.cashier_id,
      createdAt: row.created_at,
    })),
  };
}

export async function resolveReturnItem(input, actor, connection = db) {
  requireCashier(actor);
  await requireOwnOpenShift(connection, actor.id);
  const orderId = requireInteger(Number(input?.orderId), 'orderId', { min: 1 });
  const code = normalizedText(input?.code, 'code', { required: true, max: 500 });
  await loadReturnOrder(connection, orderId);
  const lines = await loadReturnableLines(connection, orderId);
  const matches = lines.filter(
    (line) =>
      line.remainingQuantity > 0 &&
      [line.barcode, line.sku, line.currentSku].some(
        (candidate) =>
          String(candidate || '')
            .trim()
            .toLocaleLowerCase() === code.toLocaleLowerCase()
      )
  );
  if (matches.length === 0) {
    throw new AppError(
      'Scanned product is not a returnable line on this invoice.',
      404,
      'RETURN_ITEM_NOT_FOUND'
    );
  }
  return {
    orderId,
    code,
    matches,
    requiresSelection: matches.length > 1,
    item: matches.length === 1 ? matches[0] : null,
  };
}

export async function quoteReturn(input, actor, connection = db) {
  requireCashier(actor);
  await requireOwnOpenShift(connection, actor.id);
  return quoteReturnAuthorization({ orderId: input.orderId, items: input.items }, connection);
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
  const byMethod = new Map();
  for (const row of rows) {
    const methodId = requireInteger(
      Number(row.paymentMethodId ?? row.payment_method_id ?? row.allocationId ?? row.allocation_id),
      'paymentMethodId',
      { min: 1 }
    );
    if (byMethod.has(methodId)) {
      throw new AppError(
        'Each refund payment method reference may appear once.',
        400,
        'DUPLICATE_REFUND_REFERENCE'
      );
    }
    byMethod.set(
      methodId,
      normalizedText(row.referenceNumber ?? row.reference_number, 'referenceNumber', { max: 200 })
    );
  }
  for (const allocation of allocations) {
    if (allocation.refundMode === EXTERNAL_REFERENCE && !byMethod.get(allocation.paymentMethodId)) {
      throw new AppError(
        `An external refund reference is required for ${allocation.methodName}.`,
        400,
        'REFUND_REFERENCE_REQUIRED',
        { paymentMethodId: allocation.paymentMethodId, method: allocation.method }
      );
    }
  }
  for (const methodId of byMethod.keys()) {
    if (!allocations.some((allocation) => allocation.paymentMethodId === methodId)) {
      throw new AppError(
        'A refund reference targets an unknown payment method.',
        400,
        'UNKNOWN_REFUND_ALLOCATION'
      );
    }
  }
  return byMethod;
}

export async function executeReturn({ input, actor, idempotencyKey }) {
  requireCashier(actor);
  const reason = normalizedText(input?.reason, 'return_reason', { required: true, max: 1000 });
  const cashierNote = normalizedText(input?.cashierNote, 'cashier_note', { max: 1000 });
  const approvalCardToken = normalizedText(input?.approvalCardToken, 'approval_card_token', {
    required: true,
    max: 500,
  });
  const payload = {
    orderId: input?.orderId,
    items: input?.items,
    reason,
    cashierNote,
    approvalCardToken,
    refundReferences: input?.refundReferences || [],
  };

  const outcome = await withIdempotency(
    {
      key: idempotencyKey,
      userId: actor.id,
      operation: 'DIRECT_RETURN_EXECUTE',
      payload,
    },
    async (connection) => {
      const shift = await requireOwnOpenShift(connection, actor.id);
      const card = await requireActiveCard(approvalCardToken, connection);
      const quote = await quoteReturnAuthorization(
        { orderId: input.orderId, items: input.items },
        connection
      );
      const references = normalizeRefundReferences(input.refundReferences, quote.allocations);
      const cashRefund = quote.allocations
        .filter((allocation) => allocation.refundMode === CASH_DRAWER)
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

      const approvalSnapshot = {
        cardId: card.id,
        cardNumber: card.card_number,
        label: card.label,
        ownerAdminId: card.owner_admin_id,
        ownerAdminName: card.owner_admin_name,
        tokenVersion: card.token_version,
      };
      const { returnNumber, receiptNumber } = await nextReturnNumbers(connection);
      const result = await connection.run(
        `INSERT INTO returns
         (order_id, shift_id, cashier_id, total_refunded, notes, return_reason,
          payment_method_snapshot, authorization_id, return_number, authorized_by,
          approval_card_id, approval_card_version, approval_snapshot_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?);`,
        [
          quote.order.id,
          shift.id,
          actor.id,
          quote.totalRefund,
          cashierNote,
          reason,
          quote.allocations.map((allocation) => allocation.method).join(' + '),
          returnNumber,
          card.owner_admin_id,
          card.id,
          card.token_version,
          JSON.stringify(approvalSnapshot),
        ]
      );

      for (const item of quote.items) {
        const restocked = item.disposition === 'RESTOCK' ? 1 : 0;
        await connection.run(
          `INSERT INTO return_items
           (return_id, product_id, order_item_id, quantity, refund_amount, disposition,
            restocked, no_restock_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            result.lastID,
            item.productId,
            item.orderItemId,
            item.quantity,
            item.refundAmount,
            item.disposition,
            restocked,
            item.noRestockReason,
          ]
        );
        if (restocked) {
          const stock = await connection.get(
            `SELECT after_quantity FROM inventory_ledger
              WHERE product_id = ? ORDER BY id DESC LIMIT 1;`,
            [item.productId]
          );
          const before = Number(stock?.after_quantity || 0);
          await connection.run(
            `INSERT INTO inventory_ledger
             (product_id, transaction_type, quantity_changed, before_quantity, after_quantity,
              reference_type, reference_id, user_id, shift_id, notes)
             VALUES (?, 'RETURN', ?, ?, ?, 'returns', ?, ?, ?, ?);`,
            [
              item.productId,
              item.quantity,
              before,
              before + Number(item.quantity),
              result.lastID,
              actor.id,
              shift.id,
              `Return ${returnNumber}; approval card ${card.card_number}`,
            ]
          );
        }
      }

      const refundPayments = [];
      for (const allocation of quote.allocations) {
        const referenceNumber = references.get(allocation.paymentMethodId) || null;
        const payment = await connection.run(
          `INSERT INTO payments
           (shift_id, cashier_id, reference_type, reference_id, payment_method, amount,
            method_id, stage, direction, applied_amount, reference_number, note,
            cash_received, change_amount, method_snapshot, return_id)
           VALUES (?, ?, 'order', ?, ?, ?, ?, 'REFUND', 'OUT', ?, ?, ?, NULL, 0, ?, ?);`,
          [
            shift.id,
            actor.id,
            quote.order.id,
            allocation.method,
            allocation.amount,
            allocation.paymentMethodId,
            allocation.amount,
            referenceNumber,
            cashierNote,
            allocation.methodName,
            result.lastID,
          ]
        );
        refundPayments.push({
          id: payment.lastID,
          paymentMethodId: allocation.paymentMethodId,
          method: allocation.method,
          methodName: allocation.methodName,
          refundMode: allocation.refundMode,
          amount: Number(allocation.amount),
          referenceNumber,
        });
      }

      const outstanding = await connection.get(
        `SELECT COUNT(*) AS count FROM order_items oi
          WHERE oi.order_id = ?
            AND oi.quantity > COALESCE((
              SELECT SUM(ri.quantity) FROM return_items ri
              JOIN returns r ON r.id = ri.return_id
              WHERE r.order_id = oi.order_id
                AND (ri.order_item_id = oi.id
                     OR (ri.order_item_id IS NULL AND ri.product_id = oi.product_id))
            ), 0);`,
        [quote.order.id]
      );
      const invoiceStatus = Number(outstanding.count) === 0 ? 'RETURNED' : 'PARTIALLY_RETURNED';
      await connection.run('UPDATE orders SET status = ? WHERE id = ?;', [
        invoiceStatus,
        quote.order.id,
      ]);

      const cashier = await connection.get('SELECT name FROM users WHERE id = ?;', [actor.id]);
      const receipt = await createReceipt({
        referenceType: 'order_return',
        referenceId: result.lastID,
        printedBy: actor.id,
        receiptNumber,
        connection,
        snapshot: {
          version: 4,
          returnId: result.lastID,
          returnNumber,
          orderId: quote.order.id,
          invoiceId: quote.order.id,
          invoiceNumber: quote.order.invoiceNumber,
          status: invoiceStatus,
          cashierName: cashier?.name,
          total: Number(quote.totalRefund),
          reason,
          approvalCard: approvalSnapshot,
          items: quote.items.map((item) => ({
            orderItemId: item.orderItemId,
            productId: item.productId,
            productName: item.productName,
            productSku: item.sku,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.refundAmount),
            disposition: item.disposition,
            noRestockReason: item.noRestockReason,
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
        `UPDATE return_approval_cards
            SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'ACTIVE' AND token_version = ?;`,
        [card.id, card.token_version]
      );

      await writeAuditLog({
        userId: actor.id,
        shiftId: shift.id,
        actionType: 'ORDER_REFUND_APPROVAL_CARD',
        entityType: 'returns',
        entityId: result.lastID,
        afterValues: {
          returnNumber,
          orderId: quote.order.id,
          invoiceNumber: quote.order.invoiceNumber,
          totalRefunded: Number(quote.totalRefund),
          invoiceStatus,
          approvalCard: approvalSnapshot,
          refundPayments: refundPayments.map(({ method, amount, referenceNumber }) => ({
            method,
            amount,
            referenceNumber,
          })),
        },
        connection,
      });
      await writeAuditLog({
        userId: actor.id,
        shiftId: shift.id,
        actionType: 'RETURN_APPROVAL_CARD_USE',
        entityType: 'return_approval_cards',
        entityId: card.id,
        afterValues: {
          returnId: result.lastID,
          returnNumber,
          cardNumber: card.card_number,
          tokenVersion: card.token_version,
          ownerAdminId: card.owner_admin_id,
        },
        connection,
      });

      return {
        statusCode: 201,
        data: {
          returnId: result.lastID,
          returnNumber,
          invoiceStatus,
          totalRefunded: Number(quote.totalRefund),
          refundPayments,
          cashDrawerEffect: {
            amount: cashRefund === 0 ? 0 : -cashRefund,
            before: cashBefore,
            after: cashBefore - cashRefund,
          },
          receiptId: receipt.id,
          receiptNumber: receipt.receipt_number,
          shiftId: shift.id,
          orderId: quote.order.id,
          approvalCardId: card.id,
          approvalCardNumber: card.card_number,
        },
      };
    }
  );
  if (!outcome.replayed) {
    publishLiveEvent('return.created', {
      returnId: outcome.data.returnId,
      shiftId: outcome.data.shiftId,
      orderId: outcome.data.orderId,
    });
  }
  return outcome;
}

function positiveInteger(value, field, { defaultValue, max = Number.MAX_SAFE_INTEGER } = {}) {
  if ((value === undefined || value === null || value === '') && defaultValue !== undefined) {
    return defaultValue;
  }
  return requireInteger(Number(value), field, { min: 1, max });
}

function offsetInteger(value) {
  if (value === undefined || value === null || value === '') return 0;
  return requireInteger(Number(value), 'offset', { min: 0 });
}

function returnFilters(filters = {}) {
  const where = ['1 = 1'];
  const params = [];
  const exact = [
    ['r.return_number', filters.returnNumber],
    ['o.invoice_number', filters.invoiceNumber],
    ['r.cashier_id', filters.cashierId],
    ['r.shift_id', filters.shiftId],
    ['r.approval_card_id', filters.approvalCardId],
  ];
  for (const [column, value] of exact) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      where.push(`${column} = ?`);
      params.push(value);
    }
  }
  if (filters.q) {
    const query = `%${String(filters.q).trim()}%`;
    where.push(`(
      r.return_number LIKE ? OR o.invoice_number LIKE ?
      OR EXISTS (SELECT 1 FROM users search_cashier
                  WHERE search_cashier.id = r.cashier_id AND search_cashier.name LIKE ?)
      OR EXISTS (SELECT 1 FROM return_approval_cards search_card
                  WHERE search_card.id = r.approval_card_id
                    AND (search_card.card_number LIKE ? OR search_card.label LIKE ?))
    )`);
    params.push(query, query, query, query, query);
  }
  const startDate = filters.startDate || filters.from;
  const endDate = filters.endDate || filters.to;
  if (startDate) {
    where.push('r.created_at >= ?');
    params.push(cairoMidnightUtc(startDate));
  }
  if (endDate) {
    where.push('r.created_at < ?');
    params.push(cairoMidnightUtc(addCalendarDay(endDate)));
  }
  return { where: where.join(' AND '), params };
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function presentReturnRow(row) {
  return {
    id: row.id,
    returnNumber: row.return_number,
    orderId: row.order_id,
    invoiceNumber: row.invoice_number,
    receiptNumber: row.receipt_number,
    shiftId: row.shift_id,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    totalRefunded: Number(row.total_refunded),
    reason: row.return_reason,
    cashierNote: row.notes,
    invoiceStatus: row.invoice_status,
    approvalCardId: row.approval_card_id,
    approvalCardNumber: row.card_number,
    approvalCardLabel: row.card_label,
    approvalCardVersion: row.approval_card_version,
    approvalCardCurrentVersion: row.card_current_version,
    approvalCardStatus: row.card_status,
    approvalCardOwnerId: row.card_owner_admin_id,
    approvalCardOwnerName: row.card_owner_admin_name,
    approvalCardOwnerActive:
      row.card_owner_admin_active == null ? null : Number(row.card_owner_admin_active) === 1,
    authorizedBy: row.authorized_by,
    authorizedByName: row.authorized_by_name,
    legacyAuthorizationId: row.authorization_id,
    createdAt: row.created_at,
  };
}

const adminReturnSelect = `SELECT r.*, o.invoice_number, o.status AS invoice_status,
       cashier.name AS cashier_name, card.card_number, card.label AS card_label,
       card.token_version AS card_current_version, card.status AS card_status,
       card.owner_admin_id AS card_owner_admin_id,
       card_owner.name AS card_owner_admin_name,
       card_owner.username AS card_owner_admin_username,
       card_owner.role AS card_owner_admin_role,
       card_owner.is_active AS card_owner_admin_active,
       approver.name AS authorized_by_name,
       (SELECT receipt_number FROM receipts receipt
         WHERE receipt.reference_type = 'order_return' AND receipt.reference_id = r.id
         ORDER BY receipt.id DESC LIMIT 1) AS receipt_number
  FROM returns r
  JOIN orders o ON o.id = r.order_id
  JOIN users cashier ON cashier.id = r.cashier_id
  LEFT JOIN return_approval_cards card ON card.id = r.approval_card_id
  LEFT JOIN users card_owner ON card_owner.id = card.owner_admin_id
  LEFT JOIN users approver ON approver.id = r.authorized_by`;

export async function listAdminReturns(filters = {}, connection = db) {
  const limit = positiveInteger(filters.limit, 'limit', { defaultValue: 50, max: 100 });
  const page = positiveInteger(filters.page, 'page', { defaultValue: 1 });
  const offset =
    filters.offset === undefined || filters.offset === null || filters.offset === ''
      ? (page - 1) * limit
      : offsetInteger(filters.offset);
  const built = returnFilters(filters);
  const [rows, count] = await Promise.all([
    connection.all(
      `${adminReturnSelect} WHERE ${built.where}
       ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?;`,
      [...built.params, limit, offset]
    ),
    connection.get(
      `SELECT COUNT(*) AS total FROM returns r JOIN orders o ON o.id = r.order_id
        WHERE ${built.where};`,
      built.params
    ),
  ]);
  return {
    returns: rows.map(presentReturnRow),
    total: Number(count?.total || 0),
    pagination: { limit, offset, page: Math.floor(offset / limit) + 1 },
  };
}

export async function getAdminReturn(id, connection = db) {
  const returnId = positiveInteger(id, 'returnId');
  const row = await connection.get(`${adminReturnSelect} WHERE r.id = ?;`, [returnId]);
  if (!row) throw new AppError('Return not found.', 404, 'RETURN_NOT_FOUND');
  const [items, payments, receipt, inventoryMovements, auditTimeline] = await Promise.all([
    connection.all(
      `SELECT ri.*, oi.product_name_snapshot AS product_name,
              oi.sku_snapshot AS product_sku, oi.unit_price
         FROM return_items ri
         LEFT JOIN order_items oi ON oi.id = ri.order_item_id
        WHERE ri.return_id = ? ORDER BY ri.id;`,
      [returnId]
    ),
    connection.all(
      `SELECT p.id, p.method_id, p.payment_method, p.method_snapshot, p.amount,
              p.applied_amount, p.reference_number, p.note, p.created_at
         FROM payments p WHERE p.return_id = ? ORDER BY p.id;`,
      [returnId]
    ),
    connection.get(
      `SELECT id, receipt_number, print_count, last_printed_at, created_at, snapshot_json
         FROM receipts WHERE reference_type = 'order_return' AND reference_id = ?
         ORDER BY id DESC LIMIT 1;`,
      [returnId]
    ),
    connection.all(
      `SELECT il.*, product.name AS product_name, product.sku AS product_sku,
              actor.name AS user_name
         FROM inventory_ledger il
         JOIN products product ON product.id = il.product_id
         LEFT JOIN users actor ON actor.id = il.user_id
        WHERE il.transaction_type = 'RETURN'
          AND lower(il.reference_type) IN ('return', 'returns', 'order_return')
          AND il.reference_id = ?
        ORDER BY il.id;`,
      [returnId]
    ),
    connection.all(
      `SELECT al.*, u.name AS user_name, u.username, u.role AS user_role
         FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
        WHERE (al.entity_type = 'returns' AND al.entity_id = ?)
           OR (al.action_type = 'RETURN_APPROVAL_CARD_USE'
               AND json_extract(al.after_values, '$.returnId') = ?)
        ORDER BY al.created_at, al.id;`,
      [returnId, returnId]
    ),
  ]);
  const approvalSnapshot = parseJson(row.approval_snapshot_json);
  return {
    return: {
      ...presentReturnRow(row),
      approvalSnapshot,
      paymentMethodSnapshot: row.payment_method_snapshot,
    },
    approvalCard: row.approval_card_id
      ? {
          id: row.approval_card_id,
          cardNumber: row.card_number || approvalSnapshot?.cardNumber || null,
          label: row.card_label || approvalSnapshot?.label || null,
          usedVersion: row.approval_card_version ?? approvalSnapshot?.tokenVersion ?? null,
          currentVersion: row.card_current_version ?? null,
          status: row.card_status || null,
          owner: {
            id:
              row.card_owner_admin_id ??
              approvalSnapshot?.ownerAdminId ??
              row.authorized_by ??
              null,
            name:
              row.card_owner_admin_name ||
              approvalSnapshot?.ownerAdminName ||
              row.authorized_by_name ||
              null,
            username: row.card_owner_admin_username || null,
            role: row.card_owner_admin_role || null,
            isActive:
              row.card_owner_admin_active == null
                ? null
                : Number(row.card_owner_admin_active) === 1,
          },
        }
      : null,
    items: items.map((item) => ({
      id: item.id,
      orderItemId: item.order_item_id,
      productId: item.product_id,
      productName: item.product_name,
      sku: item.product_sku,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price || 0),
      refundAmount: Number(item.refund_amount),
      disposition: item.disposition,
      restocked: Number(item.restocked) === 1,
      noRestockReason: item.no_restock_reason,
      createdAt: item.created_at,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      paymentMethodId: payment.method_id,
      method: payment.payment_method,
      methodName: payment.method_snapshot,
      amount: Number(payment.applied_amount ?? payment.amount),
      referenceNumber: payment.reference_number,
      note: payment.note,
      createdAt: payment.created_at,
    })),
    receipt: receipt
      ? {
          id: receipt.id,
          receiptNumber: receipt.receipt_number,
          printCount: Number(receipt.print_count),
          lastPrintedAt: receipt.last_printed_at,
          createdAt: receipt.created_at,
          snapshot: parseJson(receipt.snapshot_json),
        }
      : null,
    inventoryMovements: inventoryMovements.map((movement) => ({
      id: movement.id,
      productId: movement.product_id,
      productName: movement.product_name,
      sku: movement.product_sku,
      transactionType: movement.transaction_type,
      quantityChanged: Number(movement.quantity_changed),
      beforeQuantity: Number(movement.before_quantity),
      afterQuantity: Number(movement.after_quantity),
      referenceType: movement.reference_type,
      referenceId: movement.reference_id,
      userId: movement.user_id,
      userName: movement.user_name,
      shiftId: movement.shift_id,
      notes: movement.notes,
      createdAt: movement.created_at,
    })),
    auditTimeline: auditTimeline.map((entry) => ({
      ...entry,
      before_values: parseJson(entry.before_values),
      after_values: parseJson(entry.after_values),
    })),
  };
}

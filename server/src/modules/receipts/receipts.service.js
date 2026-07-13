import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError, nextDocumentNumber, requireInteger } from '../../utils/financial.js';

function parseSnapshot(value) {
  if (!value) return null;
  try {
    const snapshot = JSON.parse(value);
    return snapshot && typeof snapshot === 'object' ? snapshot : null;
  } catch {
    return null;
  }
}

function normalizeItem(item) {
  return {
    ...item,
    product_id: item.product_id ?? item.productId ?? null,
    product_name: item.product_name ?? item.productName ?? null,
    product_sku: item.product_sku ?? item.productSku ?? item.sku ?? null,
    price_tier_name: item.price_tier_name ?? item.priceTierName ?? null,
    availability_policy: item.availability_policy ?? item.availabilityPolicy ?? null,
    unit_price: item.unit_price ?? item.unitPrice,
    total_price: item.total_price ?? item.totalPrice,
  };
}

function normalizePayment(payment) {
  return {
    ...payment,
    method: payment.method ?? payment.payment_method ?? payment.method_snapshot ?? null,
    amount: payment.amount ?? payment.applied_amount ?? payment.appliedAmount,
    cash_received: payment.cash_received ?? payment.cashReceived ?? null,
    change_amount: payment.change_amount ?? payment.changeAmount ?? 0,
    reference_number: payment.reference_number ?? payment.referenceNumber ?? null,
  };
}

async function findReceipt(identifier, connection = db) {
  const text = String(identifier ?? '').trim();
  if (!text) throw new AppError('Receipt identifier is required.', 400, 'RECEIPT_ID_REQUIRED');
  const numericId = /^\d+$/.test(text) ? Number(text) : -1;
  const receipt = await connection.get(
    `SELECT r.*, u.name AS printed_by_name, u.username AS printed_by_username
       FROM receipts r JOIN users u ON u.id = r.printed_by
      WHERE r.id = ? OR r.receipt_number = ?
      ORDER BY CASE WHEN r.receipt_number = ? THEN 0 ELSE 1 END
      LIMIT 1;`,
    [numericId, text, text]
  );
  if (!receipt) throw new AppError('Receipt not found.', 404, 'RECEIPT_NOT_FOUND');
  return { receipt, exactReceiptNumber: text === receipt.receipt_number };
}

async function cashierOwnsReceipt(receipt, cashierId, connection) {
  if (receipt.reference_type === 'order_sale') {
    const row = await connection.get(
      `SELECT 1 AS allowed
         FROM orders o JOIN shifts s ON s.id = o.shift_id
        WHERE o.id = ? AND (o.cashier_id = ? OR s.user_id = ?);`,
      [receipt.reference_id, cashierId, cashierId]
    );
    return Boolean(row);
  }

  if (
    receipt.reference_type === 'preorder_deposit' ||
    receipt.reference_type === 'preorder_pickup'
  ) {
    const row = await connection.get(
      `SELECT 1 AS allowed
         FROM preorders p
         JOIN shifts creation_shift ON creation_shift.id = p.shift_id
         LEFT JOIN orders pickup_order ON pickup_order.id = p.pickup_order_id
        WHERE p.id = ?
          AND (
            p.cashier_id = ? OR creation_shift.user_id = ?
            OR p.pickup_cashier_id = ? OR pickup_order.cashier_id = ?
          );`,
      [receipt.reference_id, cashierId, cashierId, cashierId, cashierId]
    );
    return Boolean(row);
  }
  if (receipt.reference_type === 'order_return') {
    const row = await connection.get(
      `SELECT 1 AS allowed FROM returns r
        WHERE r.id = ? AND r.cashier_id = ?;`,
      [receipt.reference_id, cashierId]
    );
    return Boolean(row);
  }
  return false;
}

async function assertReceiptAccess(
  receipt,
  actor,
  { exactReceiptNumber = false, connection = db } = {}
) {
  if (actor?.role === 'Admin') return;
  if (actor?.role !== 'Cashier')
    throw new AppError('Receipt access is forbidden.', 403, 'FORBIDDEN');
  // An exact receipt number is an explicitly supported customer-service lookup.
  if (exactReceiptNumber) return;
  if (await cashierOwnsReceipt(receipt, actor.id, connection)) return;
  throw new AppError(
    "This receipt is outside the cashier's permitted scope.",
    403,
    'RECEIPT_SCOPE_FORBIDDEN'
  );
}

function flattenReceipt(receipt) {
  const snapshot = parseSnapshot(receipt.snapshot_json);
  if (!snapshot) {
    throw new AppError(
      'The immutable receipt snapshot is unavailable.',
      409,
      'RECEIPT_SNAPSHOT_MISSING'
    );
  }

  return {
    id: receipt.id,
    receipt_number: receipt.receipt_number,
    reference_type: receipt.reference_type,
    reference_id: receipt.reference_id,
    print_count: receipt.print_count,
    last_printed_at: receipt.last_printed_at,
    created_at: receipt.created_at,
    printed_by: receipt.printed_by,
    printed_by_name: receipt.printed_by_name,
    printed_by_username: receipt.printed_by_username,
    invoice_id: snapshot.invoiceId ?? snapshot.invoice_id ?? null,
    invoice_number: snapshot.invoiceNumber ?? snapshot.invoice_number ?? null,
    preorder_id: snapshot.preorderId ?? snapshot.preorder_id ?? null,
    preorder_number: snapshot.preorderNumber ?? snapshot.preorder_number ?? null,
    return_id: snapshot.returnId ?? snapshot.return_id ?? null,
    return_number: snapshot.returnNumber ?? snapshot.return_number ?? null,
    authorization_number: snapshot.authorizationNumber ?? snapshot.authorization_number ?? null,
    qr_token: receipt.qr_token || snapshot.qrToken || snapshot.qr_token || null,
    origin: snapshot.origin || null,
    status: snapshot.status || null,
    cashier_name: snapshot.cashierName ?? snapshot.cashier_name ?? null,
    cashier_name_snapshot: snapshot.cashierName ?? snapshot.cashier_name ?? null,
    customer_name: snapshot.customerName ?? snapshot.customer_name ?? null,
    customer_phone: snapshot.customerPhone ?? snapshot.customer_phone ?? null,
    customer_name_snapshot: snapshot.customerName ?? snapshot.customer_name ?? null,
    customer_phone_snapshot: snapshot.customerPhone ?? snapshot.customer_phone ?? null,
    subtotal: snapshot.subtotal ?? 0,
    discount: snapshot.discount ?? 0,
    total: snapshot.total ?? 0,
    deposit_required: snapshot.depositRequired ?? snapshot.deposit_required ?? null,
    deposit_paid: snapshot.depositPaid ?? snapshot.deposit_paid ?? null,
    remaining_amount: snapshot.remainingAmount ?? snapshot.remaining_amount ?? null,
    pickup_amount: snapshot.pickupAmount ?? snapshot.pickup_amount ?? null,
    pickup_method: snapshot.pickupMethod ?? snapshot.pickup_method ?? null,
    items: Array.isArray(snapshot.items) ? snapshot.items.map(normalizeItem) : [],
    payments: Array.isArray(snapshot.payments) ? snapshot.payments.map(normalizePayment) : [],
    snapshot,
  };
}

/**
 * Receipt creation helper for financial workflows. Callers should pass their
 * transaction connection so the immutable snapshot commits with the workflow.
 */
export async function createReceipt({
  referenceType,
  referenceId,
  printedBy,
  snapshot,
  qrToken = null,
  connection = null,
}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new AppError(
      'An immutable receipt snapshot is required.',
      500,
      'RECEIPT_SNAPSHOT_REQUIRED'
    );
  }
  const allowedTypes = ['order_sale', 'preorder_deposit', 'preorder_pickup', 'order_return'];
  if (!allowedTypes.includes(referenceType)) {
    throw new AppError('Unsupported receipt reference type.', 400, 'INVALID_RECEIPT_TYPE');
  }

  const insert = async (tx) => {
    const receiptNumber = await nextDocumentNumber(tx, 'receipt');
    const persistedSnapshot = {
      version: snapshot.version || 1,
      ...snapshot,
      receiptNumber,
      referenceType,
    };
    const result = await tx.run(
      `INSERT INTO receipts
       (receipt_number, reference_type, reference_id, printed_by, print_count,
        last_printed_at, snapshot_json, qr_token, created_at)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP);`,
      [
        receiptNumber,
        referenceType,
        referenceId,
        printedBy,
        JSON.stringify(persistedSnapshot),
        qrToken,
      ]
    );
    return { id: result.lastID, receipt_number: receiptNumber, snapshot: persistedSnapshot };
  };

  return connection ? insert(connection) : withTransaction(insert);
}

export async function getReceiptDetails(receiptIdOrNumber, actor, connection = db) {
  const { receipt, exactReceiptNumber } = await findReceipt(receiptIdOrNumber, connection);
  await assertReceiptAccess(receipt, actor, { exactReceiptNumber, connection });
  return flattenReceipt(receipt);
}

function normalizePrintInput(input = {}) {
  const requestKey = typeof input.requestKey === 'string' ? input.requestKey.trim() : '';
  if (requestKey.length < 8 || requestKey.length > 200) {
    throw new AppError(
      'requestKey is required (8-200 characters).',
      400,
      'PRINT_REQUEST_KEY_REQUIRED'
    );
  }
  const copies = input.copies === undefined ? 1 : Number(input.copies);
  requireInteger(copies, 'copies', { min: 1, max: 20 });
  if (input.isReprint !== undefined && typeof input.isReprint !== 'boolean') {
    throw new AppError('isReprint must be a boolean.', 400, 'INVALID_PRINT_REQUEST');
  }
  const reason =
    input.reason === undefined || input.reason === null ? null : String(input.reason).trim();
  if (reason && reason.length > 500) {
    throw new AppError('Print reason cannot exceed 500 characters.', 400, 'INVALID_PRINT_REASON');
  }
  return { requestKey, copies, reason: reason || null, isReprint: Boolean(input.isReprint) };
}

export async function requestReceiptPrint(receiptIdOrNumber, input, actor) {
  const normalized = normalizePrintInput(input);
  return withTransaction(async (connection) => {
    const { receipt, exactReceiptNumber } = await findReceipt(receiptIdOrNumber, connection);
    await assertReceiptAccess(receipt, actor, { exactReceiptNumber, connection });

    const existing = await connection.get(
      `SELECT pr.*, r.print_count
         FROM print_requests pr JOIN receipts r ON r.id = pr.receipt_id
        WHERE pr.user_id = ? AND pr.request_key = ?;`,
      [actor.id, normalized.requestKey]
    );
    if (existing) {
      const sameInput =
        existing.receipt_id === receipt.id &&
        existing.copies === normalized.copies &&
        existing.is_reprint === (normalized.isReprint ? 1 : 0) &&
        (existing.reason || null) === normalized.reason;
      if (!sameInput) {
        throw new AppError(
          'requestKey was already used with different print input.',
          409,
          'PRINT_REQUEST_KEY_CONFLICT'
        );
      }
      return {
        request_id: existing.id,
        print_count: existing.print_count,
        copies: existing.copies,
        replayed: true,
      };
    }

    const shift = await connection.get(
      "SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
      [actor.id]
    );
    if (!shift) {
      throw new AppError(
        'An OPEN shift owned by the acting user is required to print.',
        409,
        'OPEN_OWN_SHIFT_REQUIRED'
      );
    }

    const result = await connection.run(
      `INSERT INTO print_requests
       (receipt_id, user_id, shift_id, request_key, is_reprint, reason, copies, requested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
      [
        receipt.id,
        actor.id,
        shift.id,
        normalized.requestKey,
        normalized.isReprint ? 1 : 0,
        normalized.reason,
        normalized.copies,
      ]
    );
    const printCount = receipt.print_count + (normalized.isReprint ? 1 : 0);
    await connection.run(
      'UPDATE receipts SET print_count = ?, last_printed_at = CURRENT_TIMESTAMP WHERE id = ?;',
      [printCount, receipt.id]
    );

    await writeAuditLog({
      userId: actor.id,
      shiftId: shift.id,
      actionType: normalized.isReprint ? 'RECEIPT_REPRINT_REQUEST' : 'RECEIPT_PRINT_REQUEST',
      entityType: 'receipt',
      entityId: receipt.id,
      beforeValues: { print_count: receipt.print_count },
      afterValues: {
        print_count: printCount,
        request_id: result.lastID,
        copies: normalized.copies,
        request_key: normalized.requestKey,
      },
      notes: `Browser print requested for receipt ${receipt.receipt_number}; physical output is not observable.`,
      connection,
    });

    return {
      request_id: result.lastID,
      print_count: printCount,
      copies: normalized.copies,
      replayed: false,
    };
  });
}

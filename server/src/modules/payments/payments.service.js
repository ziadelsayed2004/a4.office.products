import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError, requireInteger, requirePiasters } from '../../utils/financial.js';

export async function getPaymentMethods({ activeOnly = false } = {}, connection = db) {
  let sql = `SELECT id, code, code AS method, name_ar, is_active, accepts_cash_received, sort_order
             FROM payment_methods`;
  if (activeOnly) sql += ' WHERE is_active = 1';
  sql += ' ORDER BY sort_order, id;';
  return connection.all(sql);
}

export async function updatePaymentMethods(activeIds, adminUserId) {
  if (!Array.isArray(activeIds)) throw new AppError('active_ids must be an array.', 400, 'INVALID_ACTIVE_METHODS');
  return withTransaction(async (connection) => {
    const methods = await getPaymentMethods({}, connection);
    const selected = new Set(activeIds.map(String));
    const valid = new Set(methods.flatMap((method) => [String(method.id), method.code]));
    for (const value of selected) {
      if (!valid.has(value)) throw new AppError(`Unknown payment method: ${value}`, 400, 'PAYMENT_METHOD_NOT_FOUND');
    }
    for (const method of methods) {
      const active = selected.has(String(method.id)) || selected.has(method.code) ? 1 : 0;
      await connection.run(
        'UPDATE payment_methods SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
        [active, method.id]
      );
    }
    await writeAuditLog({
      userId: adminUserId, actionType: 'PAYMENT_METHODS_UPDATE', entityType: 'payment_methods',
      afterValues: { activeIds: [...selected] }, connection
    });
    return getPaymentMethods({}, connection);
  });
}

export async function createPaymentMethod(data, adminUserId) {
  const code = String(data.code || '').trim();
  const name = String(data.name_ar || data.nameAr || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{1,39}$/.test(code)) {
    throw new AppError('Payment method code must use 2-40 Latin letters, numbers, _ or -.', 400, 'INVALID_PAYMENT_METHOD_CODE');
  }
  if (!name) throw new AppError('Arabic payment method name is required.', 400, 'PAYMENT_METHOD_NAME_REQUIRED');
  return withTransaction(async (connection) => {
    const result = await connection.run(
      `INSERT INTO payment_methods (code, name_ar, is_active, accepts_cash_received, sort_order)
       VALUES (?, ?, ?, ?, ?);`,
      [code, name, data.is_active === 0 ? 0 : 1, data.accepts_cash_received ? 1 : 0, requireInteger(Number(data.sort_order || 0), 'sort_order', { min: 0 })]
    );
    await writeAuditLog({
      userId: adminUserId, actionType: 'PAYMENT_METHOD_CREATE', entityType: 'payment_methods', entityId: result.lastID,
      afterValues: { code, name }, connection
    });
    return connection.get('SELECT * FROM payment_methods WHERE id = ?;', [result.lastID]);
  }).catch((error) => {
    if (error.code === 'SQLITE_CONSTRAINT') throw new AppError('Payment method code already exists.', 409, 'PAYMENT_METHOD_CONFLICT');
    throw error;
  });
}

export async function updatePaymentMethod(id, data, adminUserId) {
  const methodId = requireInteger(Number(id), 'paymentMethodId', { min: 1 });
  return withTransaction(async (connection) => {
    const old = await connection.get('SELECT * FROM payment_methods WHERE id = ?;', [methodId]);
    if (!old) throw new AppError('Payment method not found.', 404, 'PAYMENT_METHOD_NOT_FOUND');
    const name = data.name_ar === undefined && data.nameAr === undefined ? old.name_ar : String(data.name_ar ?? data.nameAr).trim();
    if (!name) throw new AppError('Arabic payment method name is required.', 400, 'PAYMENT_METHOD_NAME_REQUIRED');
    const active = data.is_active === undefined ? old.is_active : (data.is_active ? 1 : 0);
    const acceptsCash = data.accepts_cash_received === undefined
      ? old.accepts_cash_received : (data.accepts_cash_received ? 1 : 0);
    const sortOrder = data.sort_order === undefined ? old.sort_order
      : requireInteger(Number(data.sort_order), 'sort_order', { min: 0 });
    await connection.run(
      `UPDATE payment_methods SET name_ar = ?, is_active = ?, accepts_cash_received = ?, sort_order = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [name, active, acceptsCash, sortOrder, methodId]
    );
    await writeAuditLog({
      userId: adminUserId, actionType: 'PAYMENT_METHOD_UPDATE', entityType: 'payment_methods', entityId: methodId,
      beforeValues: old, afterValues: { name_ar: name, is_active: active, accepts_cash_received: acceptsCash, sort_order: sortOrder }, connection
    });
    return connection.get('SELECT * FROM payment_methods WHERE id = ?;', [methodId]);
  });
}

/** Validates and normalizes applied amounts in integer piasters. */
export async function validateSplitPayments(paymentsList, expectedTotalAmount, connection = db) {
  const expected = requirePiasters(expectedTotalAmount, 'expectedTotalAmount');
  if (expected === 0) {
    if (!paymentsList || paymentsList.length === 0) return [];
    throw new AppError('Payments must be empty when the required amount is zero.', 400, 'ZERO_PAYMENT_MUST_BE_EMPTY');
  }
  if (!Array.isArray(paymentsList) || paymentsList.length === 0) {
    throw new AppError('At least one payment row is required.', 400, 'PAYMENTS_REQUIRED');
  }

  const active = await getPaymentMethods({ activeOnly: true }, connection);
  const byCode = new Map(active.map((method) => [method.code, method]));
  const byId = new Map(active.map((method) => [String(method.id), method]));
  const seen = new Set();
  const normalized = [];
  let appliedTotal = 0;

  for (const row of paymentsList) {
    const method = byCode.get(String(row.method || '')) || byId.get(String(row.methodId || row.method_id || ''));
    if (!method) throw new AppError(`Payment method is disabled or invalid: ${row.method || row.methodId || ''}`, 400, 'PAYMENT_METHOD_DISABLED');
    if (seen.has(method.id)) throw new AppError('A payment method may only appear once.', 400, 'DUPLICATE_PAYMENT_METHOD');
    seen.add(method.id);
    const amount = requirePiasters(row.amount, 'payment.amount', { allowZero: false });
    let cashReceived = null;
    let changeAmount = 0;
    if (method.accepts_cash_received) {
      cashReceived = requirePiasters(row.cashReceived, 'payment.cashReceived', { allowZero: false });
      if (cashReceived < amount) throw new AppError('Cash received cannot be less than the applied cash amount.', 400, 'INSUFFICIENT_CASH_RECEIVED');
      changeAmount = cashReceived - amount;
    } else if (row.cashReceived !== undefined && row.cashReceived !== null) {
      throw new AppError('cashReceived is allowed only for cash-like payment methods.', 400, 'CASH_RECEIVED_NOT_ALLOWED');
    }
    appliedTotal += amount;
    normalized.push({
      methodId: method.id,
      method: method.code,
      methodSnapshot: method.name_ar,
      amount,
      cashReceived,
      changeAmount,
      referenceNumber: row.referenceNumber ? String(row.referenceNumber).trim() : null,
      note: row.note ? String(row.note).trim() : null
    });
  }
  if (appliedTotal !== expected) {
    throw new AppError(`Applied payment total ${appliedTotal} must equal required amount ${expected}.`, 400, 'PAYMENT_TOTAL_MISMATCH');
  }
  return normalized;
}

export async function insertPayments(connection, {
  shiftId, cashierId, referenceType, referenceId, stage, direction = 'IN', returnId = null
}, normalizedPayments) {
  for (const payment of normalizedPayments) {
    await connection.run(
      `INSERT INTO payments
       (shift_id, cashier_id, reference_type, reference_id, payment_method, amount,
        method_id, stage, direction, applied_amount, reference_number, note,
        cash_received, change_amount, method_snapshot, return_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        shiftId, cashierId, referenceType, referenceId, payment.method, payment.amount,
        payment.methodId, stage, direction, payment.amount, payment.referenceNumber, payment.note,
        payment.cashReceived, payment.changeAmount, payment.methodSnapshot, returnId
      ]
    );
  }
}

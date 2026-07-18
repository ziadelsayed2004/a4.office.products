import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { normalizeCustomerPhone } from '../../utils/customerPhone.js';
import { AppError, requireInteger, requirePiasters } from '../../utils/financial.js';

const SYSTEM_PAYMENT_CODES = new Set(['Cash', 'Card', 'InstaPay', 'Wallet']);
const RETIRED_PAYMENT_CODES = new Set(['Transfer']);

function requirePaymentEvidence(method, value) {
  const reference = String(value || '').trim();
  if (method.code === 'Card') {
    const digits = normalizeCustomerPhone(reference);
    if (!/^\d{4}$/.test(digits)) {
      throw new AppError(
        'Card payments require the last four card digits.',
        400,
        'CARD_DIGITS_REQUIRED'
      );
    }
    return digits;
  }
  if (method.code === 'InstaPay' || method.code === 'Wallet') {
    const phone = normalizeCustomerPhone(reference);
    if (phone.length < 5 || phone.length > 30) {
      throw new AppError(
        'This payment method requires a valid phone number.',
        400,
        'PAYMENT_PHONE_REQUIRED'
      );
    }
    return phone;
  }
  if (!method.accepts_cash_received && !reference) {
    throw new AppError(
      'Payment evidence is required for this method.',
      400,
      'PAYMENT_EVIDENCE_REQUIRED'
    );
  }
  return reference || null;
}

function decoratePaymentMethod(method) {
  const {
    payment_count: paymentCount = 0,
    return_allocation_count: returnAllocationCount = 0,
    ...data
  } = method;
  const isSystem =
    method.is_system === undefined
      ? SYSTEM_PAYMENT_CODES.has(method.code)
        ? 1
        : 0
      : Number(method.is_system);
  const dependencyCounts = {
    payments: Number(paymentCount) + Number(returnAllocationCount),
    payment_records: Number(paymentCount),
    return_authorization_allocations: Number(returnAllocationCount),
  };
  return {
    ...data,
    method: method.code,
    is_system: isSystem,
    refund_mode:
      method.refund_mode || (method.code === 'Cash' ? 'CASH_DRAWER' : 'EXTERNAL_REFERENCE'),
    can_delete:
      isSystem === 0 &&
      Number(method.is_active) === 0 &&
      Object.values(dependencyCounts).every((count) => count === 0),
    dependency_counts: dependencyCounts,
  };
}

export async function getPaymentMethods({ activeOnly = false } = {}, connection = db) {
  let sql = `SELECT pm.*,
    (SELECT COUNT(*) FROM payments p
      WHERE p.method_id = pm.id
         OR (p.method_id IS NULL AND p.payment_method = pm.code)) AS payment_count,
    (SELECT COUNT(*) FROM return_authorization_allocations raa
      WHERE raa.payment_method_id = pm.id) AS return_allocation_count
    FROM payment_methods pm`;
  const filters = [`pm.code NOT IN (${[...RETIRED_PAYMENT_CODES].map(() => '?').join(', ')})`];
  if (activeOnly) filters.push('pm.is_active = 1');
  sql += ` WHERE ${filters.join(' AND ')}`;
  sql += ' ORDER BY pm.sort_order, pm.id;';
  return (await connection.all(sql, [...RETIRED_PAYMENT_CODES])).map(decoratePaymentMethod);
}

export async function updatePaymentMethods(activeIds, adminUserId) {
  if (!Array.isArray(activeIds))
    throw new AppError('active_ids must be an array.', 400, 'INVALID_ACTIVE_METHODS');
  return withTransaction(async (connection) => {
    const methods = await getPaymentMethods({}, connection);
    const selected = new Set(activeIds.map(String));
    const valid = new Set(methods.flatMap((method) => [String(method.id), method.code]));
    for (const value of selected) {
      if (!valid.has(value))
        throw new AppError(`Unknown payment method: ${value}`, 400, 'PAYMENT_METHOD_NOT_FOUND');
    }
    for (const method of methods) {
      const active = selected.has(String(method.id)) || selected.has(method.code) ? 1 : 0;
      await connection.run(
        'UPDATE payment_methods SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
        [active, method.id]
      );
    }
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PAYMENT_METHODS_UPDATE',
      entityType: 'payment_methods',
      afterValues: { activeIds: [...selected] },
      connection,
    });
    return getPaymentMethods({}, connection);
  });
}

export async function createPaymentMethod(data, adminUserId) {
  const code = String(data.code || '').trim();
  const name = String(data.name_ar || data.nameAr || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{1,39}$/.test(code)) {
    throw new AppError(
      'Payment method code must use 2-40 Latin letters, numbers, _ or -.',
      400,
      'INVALID_PAYMENT_METHOD_CODE'
    );
  }
  if (!name)
    throw new AppError(
      'Arabic payment method name is required.',
      400,
      'PAYMENT_METHOD_NAME_REQUIRED'
    );
  const refundMode = data.refund_mode || 'EXTERNAL_REFERENCE';
  if (!['CASH_DRAWER', 'EXTERNAL_REFERENCE', 'DISABLED'].includes(refundMode)) {
    throw new AppError('Invalid payment refund mode.', 400, 'INVALID_REFUND_MODE');
  }
  return withTransaction(async (connection) => {
    const result = await connection.run(
      `INSERT INTO payment_methods
       (code, name_ar, is_active, accepts_cash_received, sort_order, is_system, refund_mode)
       VALUES (?, ?, ?, ?, ?, 0, ?);`,
      [
        code,
        name,
        data.is_active === 0 || data.is_active === false ? 0 : 1,
        data.accepts_cash_received ? 1 : 0,
        requireInteger(Number(data.sort_order || 0), 'sort_order', { min: 0 }),
        refundMode,
      ]
    );
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PAYMENT_METHOD_CREATE',
      entityType: 'payment_methods',
      entityId: result.lastID,
      afterValues: { code, name, refund_mode: refundMode },
      connection,
    });
    const created = await connection.get('SELECT * FROM payment_methods WHERE id = ?;', [
      result.lastID,
    ]);
    return decoratePaymentMethod(created);
  }).catch((error) => {
    if (error.code === 'SQLITE_CONSTRAINT')
      throw new AppError('Payment method code already exists.', 409, 'PAYMENT_METHOD_CONFLICT');
    throw error;
  });
}

export async function updatePaymentMethod(id, data, adminUserId) {
  const methodId = requireInteger(Number(id), 'paymentMethodId', { min: 1 });
  return withTransaction(async (connection) => {
    const old = await connection.get('SELECT * FROM payment_methods WHERE id = ?;', [methodId]);
    if (!old) throw new AppError('Payment method not found.', 404, 'PAYMENT_METHOD_NOT_FOUND');
    if (RETIRED_PAYMENT_CODES.has(old.code)) {
      throw new AppError('Payment method has been retired.', 404, 'PAYMENT_METHOD_NOT_FOUND');
    }
    const name =
      data.name_ar === undefined && data.nameAr === undefined
        ? old.name_ar
        : String(data.name_ar ?? data.nameAr).trim();
    if (!name)
      throw new AppError(
        'Arabic payment method name is required.',
        400,
        'PAYMENT_METHOD_NAME_REQUIRED'
      );
    const active = data.is_active === undefined ? old.is_active : data.is_active ? 1 : 0;
    const acceptsCash =
      data.accepts_cash_received === undefined
        ? old.accepts_cash_received
        : data.accepts_cash_received
          ? 1
          : 0;
    const sortOrder =
      data.sort_order === undefined
        ? old.sort_order
        : requireInteger(Number(data.sort_order), 'sort_order', { min: 0 });
    const refundMode = data.refund_mode === undefined ? old.refund_mode : data.refund_mode;
    if (!['CASH_DRAWER', 'EXTERNAL_REFERENCE', 'DISABLED'].includes(refundMode)) {
      throw new AppError('Invalid payment refund mode.', 400, 'INVALID_REFUND_MODE');
    }
    await connection.run(
      `UPDATE payment_methods SET name_ar = ?, is_active = ?, accepts_cash_received = ?, sort_order = ?, refund_mode = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [name, active, acceptsCash, sortOrder, refundMode, methodId]
    );
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PAYMENT_METHOD_UPDATE',
      entityType: 'payment_methods',
      entityId: methodId,
      beforeValues: old,
      afterValues: {
        name_ar: name,
        is_active: active,
        accepts_cash_received: acceptsCash,
        sort_order: sortOrder,
        refund_mode: refundMode,
      },
      connection,
    });
    const updated = await connection.get('SELECT * FROM payment_methods WHERE id = ?;', [methodId]);
    return decoratePaymentMethod(updated);
  });
}

export async function deletePaymentMethod(id, adminUserId) {
  const methodId = requireInteger(Number(id), 'paymentMethodId', { min: 1 });
  return withTransaction(async (connection) => {
    const methods = await getPaymentMethods({}, connection);
    const method = methods.find((item) => item.id === methodId);
    if (!method) throw new AppError('Payment method not found.', 404, 'PAYMENT_METHOD_NOT_FOUND');

    if (method.is_system) {
      throw new AppError(
        'System payment methods cannot be deleted. Disable the method if it is not currently used.',
        409,
        'SYSTEM_PAYMENT_METHOD',
        {
          ...method.dependency_counts,
          is_system: 1,
          is_active: Number(method.is_active),
        }
      );
    }
    if (Object.values(method.dependency_counts).some((count) => count > 0)) {
      throw new AppError(
        'Payment method has financial history and cannot be deleted.',
        409,
        'PAYMENT_METHOD_IN_USE',
        method.dependency_counts
      );
    }
    if (Number(method.is_active) === 1) {
      throw new AppError(
        'Disable the custom payment method before deleting it.',
        409,
        'PAYMENT_METHOD_MUST_BE_DISABLED',
        {
          ...method.dependency_counts,
          is_system: 0,
          is_active: 1,
        }
      );
    }

    const result = await connection.run('DELETE FROM payment_methods WHERE id = ?;', [methodId]);
    if (result.changes !== 1)
      throw new AppError('Payment method not found.', 404, 'PAYMENT_METHOD_NOT_FOUND');
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PAYMENT_METHOD_DELETE',
      entityType: 'payment_methods',
      entityId: methodId,
      beforeValues: method,
      afterValues: { id: methodId, deleted: true },
      notes: `Unused custom payment method deleted: ${method.code}`,
      connection,
    });
    return { id: methodId };
  });
}

/** Validates and normalizes applied amounts in integer piasters. */
export async function validateSplitPayments(paymentsList, expectedTotalAmount, connection = db) {
  const expected = requirePiasters(expectedTotalAmount, 'expectedTotalAmount');
  if (expected === 0) {
    if (!paymentsList || paymentsList.length === 0) return [];
    throw new AppError(
      'Payments must be empty when the required amount is zero.',
      400,
      'ZERO_PAYMENT_MUST_BE_EMPTY'
    );
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
    const method =
      byCode.get(String(row.method || '')) || byId.get(String(row.methodId || row.method_id || ''));
    if (!method)
      throw new AppError(
        `Payment method is disabled or invalid: ${row.method || row.methodId || ''}`,
        400,
        'PAYMENT_METHOD_DISABLED'
      );
    if (seen.has(method.id))
      throw new AppError('A payment method may only appear once.', 400, 'DUPLICATE_PAYMENT_METHOD');
    seen.add(method.id);
    const amount = requirePiasters(row.amount, 'payment.amount', { allowZero: false });
    let cashReceived = null;
    let changeAmount = 0;
    if (method.accepts_cash_received) {
      cashReceived = requirePiasters(row.cashReceived, 'payment.cashReceived', {
        allowZero: false,
      });
      if (cashReceived < amount)
        throw new AppError(
          'Cash received cannot be less than the applied cash amount.',
          400,
          'INSUFFICIENT_CASH_RECEIVED'
        );
      changeAmount = cashReceived - amount;
    } else if (row.cashReceived !== undefined && row.cashReceived !== null) {
      throw new AppError(
        'cashReceived is allowed only for cash-like payment methods.',
        400,
        'CASH_RECEIVED_NOT_ALLOWED'
      );
    }
    const referenceNumber = requirePaymentEvidence(method, row.referenceNumber);
    appliedTotal += amount;
    normalized.push({
      methodId: method.id,
      method: method.code,
      methodSnapshot: method.name_ar,
      amount,
      cashReceived,
      changeAmount,
      referenceNumber,
      note: row.note ? String(row.note).trim() : null,
    });
  }
  if (appliedTotal !== expected) {
    throw new AppError(
      `Applied payment total ${appliedTotal} must equal required amount ${expected}.`,
      400,
      'PAYMENT_TOTAL_MISMATCH'
    );
  }
  return normalized;
}

export async function insertPayments(
  connection,
  { shiftId, cashierId, referenceType, referenceId, stage, direction = 'IN', returnId = null },
  normalizedPayments
) {
  for (const payment of normalizedPayments) {
    await connection.run(
      `INSERT INTO payments
       (shift_id, cashier_id, reference_type, reference_id, payment_method, amount,
        method_id, stage, direction, applied_amount, reference_number, note,
        cash_received, change_amount, method_snapshot, return_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        shiftId,
        cashierId,
        referenceType,
        referenceId,
        payment.method,
        payment.amount,
        payment.methodId,
        stage,
        direction,
        payment.amount,
        payment.referenceNumber,
        payment.note,
        payment.cashReceived,
        payment.changeAmount,
        payment.methodSnapshot,
        returnId,
      ]
    );
  }
}

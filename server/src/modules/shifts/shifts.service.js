import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

/**
 * Opens a new shift for the cashier, or resumes an already open shift if exists.
 * Prevents multiple active shifts for the same cashier.
 */
export async function openShift(userId, openingCashEgp) {
  // Enforce money is integer minor units
  const openingCash = Math.round(parseFloat(openingCashEgp) * 100);
  if (isNaN(openingCash) || openingCash < 0) {
    throw new Error('مبلغ عهدة البداية غير صالح.');
  }

  // Check if cashier has any active/open shift
  const existingShift = await db.get(
    "SELECT * FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
    [userId]
  );

  // If already open, return it (Resumes the shift)
  if (existingShift) {
    return {
      shift: existingShift,
      resumed: true
    };
  }

  // Ensure no shift is currently awaiting close approval for this user
  const pendingReviewShift = await db.get(
    "SELECT * FROM shifts WHERE user_id = ? AND status = 'PENDING_ADMIN_REVIEW' ORDER BY id DESC LIMIT 1;",
    [userId]
  );
  if (pendingReviewShift) {
    throw new Error('الوردية الحالية قيد المراجعة للإغلاق من قبل الإدارة. يرجى انتظار الموافقة أولاً.');
  }

  await db.run('BEGIN TRANSACTION;');
  try {
    const result = await db.run(
      `INSERT INTO shifts (user_id, status, opened_at, opening_cash, created_at, updated_at)
       VALUES (?, 'OPEN', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [userId, openingCash]
    );

    const shiftId = result.lastID;
    const newShift = await db.get('SELECT * FROM shifts WHERE id = ?;', [shiftId]);

    // Insert opening movement into cash_movements
    await db.run(
      `INSERT INTO cash_movements (shift_id, user_id, type, amount, notes, created_at)
       VALUES (?, ?, 'OPENING', ?, 'عهدة بداية الوردية', CURRENT_TIMESTAMP);`,
      [shiftId, userId, openingCash]
    );

    // Write Audit Log
    await writeAuditLog({
      userId,
      actionType: 'SHIFT_OPEN',
      entityType: 'shifts',
      entityId: shiftId,
      notes: `تم فتح وردية جديدة عهدة بداية: ${(openingCash / 100).toFixed(2)} ج.م`
    });

    await db.run('COMMIT;');

    return {
      shift: newShift,
      resumed: false
    };
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Returns current cashier active shift details.
 */
export async function getCurrentShift(userId) {
  const shift = await db.get(
    "SELECT * FROM shifts WHERE user_id = ? AND status IN ('OPEN', 'PENDING_ADMIN_REVIEW') ORDER BY id DESC LIMIT 1;",
    [userId]
  );
  return shift || null;
}

/**
 * Calculates current active shift aggregates (sales total, payment breakdowns, expected closing cash).
 */
export async function getCurrentShiftSummary(userId) {
  const shift = await db.get(
    "SELECT * FROM shifts WHERE user_id = ? AND status IN ('OPEN', 'PENDING_ADMIN_REVIEW') ORDER BY id DESC LIMIT 1;",
    [userId]
  );
  if (!shift) {
    return null;
  }

  const shiftId = shift.id;

  // 1. Total sales count and sum
  const salesStats = await db.get(
    "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total_amount FROM orders WHERE shift_id = ?;",
    [shiftId]
  );

  // 2. Payments by method
  const paymentStats = await db.all(
    "SELECT payment_method, COALESCE(SUM(amount), 0) as total_amount FROM payments WHERE shift_id = ? GROUP BY payment_method;",
    [shiftId]
  );

  // 3. Cash movements stats
  const cashMovementStats = await db.all(
    "SELECT type, COALESCE(SUM(amount), 0) as total_amount FROM cash_movements WHERE shift_id = ? GROUP BY type;",
    [shiftId]
  );

  // Calculate expected closing cash
  const cashPayments = paymentStats.find(p => p.payment_method === 'Cash')?.total_amount || 0;
  const payIns = cashMovementStats.find(m => m.type === 'PAY_IN')?.total_amount || 0;
  const payOuts = cashMovementStats.find(m => m.type === 'PAY_OUT')?.total_amount || 0;

  const expectedClosingCash = shift.opening_cash + cashPayments + payIns - payOuts;

  return {
    shift,
    sales: {
      count: salesStats.count,
      total_amount: salesStats.total_amount
    },
    payments: paymentStats,
    cashMovements: cashMovementStats,
    expectedClosingCash
  };
}

/**
 * Cashier requests to close the shift.
 * Enters actual cash in drawer, calculates expected closing cash, and changes status to 'PENDING_ADMIN_REVIEW'.
 */
export async function requestCloseShift(userId, actualClosingCashEgp) {
  const actualClosingCash = Math.round(parseFloat(actualClosingCashEgp) * 100);
  if (isNaN(actualClosingCash) || actualClosingCash < 0) {
    throw new Error('مبلغ عهدة النهاية الفعلية غير صالح.');
  }

  // 1. Fetch current open shift
  const shift = await db.get(
    "SELECT * FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
    [userId]
  );
  if (!shift) {
    throw new Error('لا توجد وردية نشطة مفتوحة حالياً لهذا الكاشير لتقديم طلب إغلاق.');
  }

  const shiftId = shift.id;

  // 2. Calculate expected closing cash and payments by method
  const paymentStats = await db.all(
    "SELECT payment_method, COALESCE(SUM(amount), 0) as total_amount FROM payments WHERE shift_id = ? GROUP BY payment_method;",
    [shiftId]
  );

  const cashMovementStats = await db.all(
    "SELECT type, COALESCE(SUM(amount), 0) as total_amount FROM cash_movements WHERE shift_id = ? GROUP BY type;",
    [shiftId]
  );

  const cashPayments = paymentStats.find(p => p.payment_method === 'Cash')?.total_amount || 0;
  const cardPayments = paymentStats.find(p => p.payment_method === 'Card')?.total_amount || 0;
  const instaPayPayments = paymentStats.find(p => p.payment_method === 'InstaPay')?.total_amount || 0;
  const walletPayments = paymentStats.find(p => p.payment_method === 'Wallet')?.total_amount || 0;
  const transferPayments = paymentStats.find(p => p.payment_method === 'Transfer')?.total_amount || 0;

  const payIns = cashMovementStats.find(m => m.type === 'PAY_IN')?.total_amount || 0;
  const payOuts = cashMovementStats.find(m => m.type === 'PAY_OUT')?.total_amount || 0;

  const expectedClosingCash = shift.opening_cash + cashPayments + payIns - payOuts;

  await db.run('BEGIN TRANSACTION;');
  try {
    // 3. Update shifts record to PENDING_ADMIN_REVIEW status and set details
    await db.run(
      `UPDATE shifts
       SET status = 'PENDING_ADMIN_REVIEW',
           closed_at = CURRENT_TIMESTAMP,
           system_total_cash = ?,
           system_total_card = ?,
           system_total_instapay = ?,
           system_total_wallet = ?,
           system_total_transfer = ?,
           cashier_declared_cash = ?,
           cashier_declared_card = ?,
           cashier_declared_instapay = ?,
           cashier_declared_wallet = ?,
           cashier_declared_transfer = ?,
           actual_closed_cash = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [
        expectedClosingCash,
        cardPayments,
        instaPayPayments,
        walletPayments,
        transferPayments,
        actualClosingCash,
        cardPayments,
        instaPayPayments,
        walletPayments,
        transferPayments,
        actualClosingCash,
        shiftId
      ]
    );

    // 4. Insert closing movement into cash_movements
    await db.run(
      `INSERT INTO cash_movements (shift_id, user_id, type, amount, notes, created_at)
       VALUES (?, ?, 'CLOSING', ?, 'تقفيل الوردية وإدخال العهدة الفعلية للكاشير', CURRENT_TIMESTAMP);`,
      [shiftId, userId, actualClosingCash]
    );

    // 5. Write Audit Log
    await writeAuditLog({
      userId,
      actionType: 'SHIFT_CLOSE_REQUEST',
      entityType: 'shifts',
      entityId: shiftId,
      notes: `تم تقديم طلب إغلاق الوردية رقم ${shiftId} بعهدة فعلية: ${(actualClosingCash / 100).toFixed(2)} ج.م (المتوقعة: ${(expectedClosingCash / 100).toFixed(2)} ج.م)`
    });

    await db.run('COMMIT;');

    const updatedShift = await db.get('SELECT * FROM shifts WHERE id = ?;', [shiftId]);
    return updatedShift;

  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Lists all cashier shifts awaiting review (Admin only).
 */
export async function getPendingReviewShifts() {
  return await db.all(
    `SELECT s.*, u.name as cashier_name, u.username as cashier_username
     FROM shifts s
     JOIN users u ON s.user_id = u.id
     WHERE s.status = 'PENDING_ADMIN_REVIEW'
     ORDER BY s.id DESC;`
  );
}

/**
 * Admin approves cashier shift closing. Sets status to CLOSED.
 */
export async function approveShiftClose(adminId, shiftId, adminNotes) {
  const shift = await db.get("SELECT * FROM shifts WHERE id = ?;", [shiftId]);
  if (!shift) {
    throw new Error('الوردية المطلوبة غير موجودة.');
  }
  if (shift.status !== 'PENDING_ADMIN_REVIEW') {
    throw new Error('لا يمكن اعتماد وردية ليست قيد المراجعة.');
  }

  await db.run('BEGIN TRANSACTION;');
  try {
    await db.run(
      `UPDATE shifts
       SET status = 'CLOSED',
           admin_notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [adminNotes || null, shiftId]
    );

    // Write Audit Log
    await writeAuditLog({
      userId: adminId,
      actionType: 'SHIFT_APPROVE',
      entityType: 'shifts',
      entityId: shiftId,
      notes: `اعتماد إغلاق الوردية رقم ${shiftId}. ملاحظات الأدمن: ${adminNotes || 'لا يوجد'}`
    });

    await db.run('COMMIT;');

    return await db.get("SELECT * FROM shifts WHERE id = ?;", [shiftId]);
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Admin rejects cashier shift closing. Sets status to REJECTED.
 */
export async function rejectShiftClose(adminId, shiftId, adminNotes) {
  const shift = await db.get("SELECT * FROM shifts WHERE id = ?;", [shiftId]);
  if (!shift) {
    throw new Error('الوردية المطلوبة غير موجودة.');
  }
  if (shift.status !== 'PENDING_ADMIN_REVIEW') {
    throw new Error('لا يمكن رفض وردية ليست قيد المراجعة.');
  }

  await db.run('BEGIN TRANSACTION;');
  try {
    await db.run(
      `UPDATE shifts
       SET status = 'REJECTED',
           admin_notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [adminNotes || null, shiftId]
    );

    // Write Audit Log
    await writeAuditLog({
      userId: adminId,
      actionType: 'SHIFT_REJECT',
      entityType: 'shifts',
      entityId: shiftId,
      notes: `رفض إغلاق الوردية رقم ${shiftId}. ملاحظات الأدمن: ${adminNotes || 'لا يوجد'}`
    });

    await db.run('COMMIT;');

    return await db.get("SELECT * FROM shifts WHERE id = ?;", [shiftId]);
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Registers an arbitrary cash movement (PAY_IN/PAY_OUT) under the cashier's active shift.
 */
export async function registerCashMovement(userId, { type, amountEgp, notes }) {
  const amount = Math.round(parseFloat(amountEgp) * 100);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('مبلغ الحركة النقدية يجب أن يكون أكبر من الصفر.');
  }
  if (type !== 'PAY_IN' && type !== 'PAY_OUT') {
    throw new Error('نوع الحركة غير صالح (يجب أن يكون PAY_IN أو PAY_OUT).');
  }

  // Find cashier's current open shift
  const shift = await db.get(
    "SELECT * FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
    [userId]
  );
  if (!shift) {
    throw new Error('لا يمكن تسجيل حركة نقدية بدون وردية نشطة مفتوحة حالياً للكاشير.');
  }

  const shiftId = shift.id;

  await db.run('BEGIN TRANSACTION;');
  try {
    await db.run(
      `INSERT INTO cash_movements (shift_id, user_id, type, amount, notes, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
      [shiftId, userId, type, amount, notes || null]
    );

    // Write Audit Log
    const movementLabel = type === 'PAY_IN' ? 'واردة PAY_IN' : 'منصرفة PAY_OUT';
    await writeAuditLog({
      userId,
      actionType: 'CASH_MOVEMENT',
      entityType: 'shifts',
      entityId: shiftId,
      notes: `تسجيل حركة نقدية ${movementLabel} بقيمة ${(amount / 100).toFixed(2)} ج.م. ملاحظات: ${notes || 'لا يوجد'}`
    });

    await db.run('COMMIT;');

    // Return current stats
    return {
      shiftId,
      type,
      amount,
      notes
    };
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

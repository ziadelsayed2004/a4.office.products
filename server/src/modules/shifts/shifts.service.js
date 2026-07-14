import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import {
  AppError,
  requireInteger,
  requirePiasters,
  withIdempotency,
} from '../../utils/financial.js';
import { addCalendarDay, cairoMidnightUtc } from '../invoices/invoices.service.js';

async function paymentTotals(connection, shiftId) {
  const rows = await connection.all(
    `SELECT COALESCE(pm.code, p.payment_method) AS method,
            COALESCE(SUM(CASE WHEN p.direction = 'OUT' THEN -COALESCE(p.applied_amount, p.amount)
                              ELSE COALESCE(p.applied_amount, p.amount) END), 0) AS total
       FROM payments p LEFT JOIN payment_methods pm ON pm.id = p.method_id
      WHERE p.shift_id = ? AND COALESCE(p.is_excluded, 0) = 0
      GROUP BY COALESCE(pm.code, p.payment_method);`,
    [shiftId]
  );
  return Object.fromEntries(rows.map((row) => [row.method, Number(row.total)]));
}

async function cashDrawerPaymentTotal(connection, shiftId) {
  const row = await connection.get(
    `SELECT COALESCE(SUM(CASE WHEN p.direction = 'OUT'
                              THEN -COALESCE(p.applied_amount, p.amount)
                              ELSE COALESCE(p.applied_amount, p.amount) END), 0) AS total
       FROM payments p LEFT JOIN payment_methods pm ON pm.id = p.method_id
      WHERE p.shift_id = ? AND COALESCE(p.is_excluded, 0) = 0
        AND COALESCE(pm.refund_mode,
                     CASE WHEN p.payment_method = 'Cash' THEN 'CASH_DRAWER'
                          ELSE 'EXTERNAL_REFERENCE' END) = 'CASH_DRAWER';`,
    [shiftId]
  );
  return Number(row.total);
}

async function movementTotals(connection, shiftId) {
  const rows = await connection.all(
    `SELECT type, COALESCE(SUM(amount), 0) AS total
       FROM cash_movements
      WHERE shift_id = ?
        AND (type != 'PAY_OUT' OR COALESCE(notes, '') NOT LIKE 'Cash refund for %')
      GROUP BY type;`,
    [shiftId]
  );
  return Object.fromEntries(rows.map((row) => [row.type, Number(row.total)]));
}

async function operationalBreakdown(connection, shiftId) {
  const rows = await connection.all(
    `SELECT stage, direction, COUNT(*) AS row_count,
            COALESCE(SUM(COALESCE(applied_amount, amount)), 0) AS amount,
            COALESCE(SUM(COALESCE(cash_received, 0)), 0) AS cash_received,
            COALESCE(SUM(COALESCE(change_amount, 0)), 0) AS change_amount
       FROM payments WHERE shift_id = ? AND COALESCE(is_excluded, 0) = 0
      GROUP BY stage, direction;`,
    [shiftId]
  );
  return rows;
}

async function getShiftSystemSnapshot(connection, shift) {
  const methods = await connection.all(
    `SELECT pm.code FROM payment_methods pm
      WHERE pm.is_active = 1 OR EXISTS (
        SELECT 1 FROM payments p
         WHERE p.shift_id = ? AND p.method_id = pm.id AND COALESCE(p.is_excluded, 0) = 0
      )
      ORDER BY pm.sort_order, pm.id;`,
    [shift.id]
  );
  const payments = await paymentTotals(connection, shift.id);
  const drawerPayments = await cashDrawerPaymentTotal(connection, shift.id);
  const movements = await movementTotals(connection, shift.id);
  const totals = {};
  for (const method of methods) totals[method.code] = payments[method.code] || 0;
  totals.Cash =
    Number(shift.opening_cash) +
    drawerPayments +
    (movements.PAY_IN || 0) -
    (movements.PAY_OUT || 0);
  return {
    methods: totals,
    movements: {
      opening: Number(shift.opening_cash),
      payIn: movements.PAY_IN || 0,
      payOut: movements.PAY_OUT || 0,
    },
    operations: await operationalBreakdown(connection, shift.id),
  };
}

export async function openShift(userId, openingCash) {
  const amount = requirePiasters(openingCash, 'openingCash');
  return withTransaction(async (connection) => {
    const cashier = await connection.get(
      "SELECT id FROM users WHERE id=? AND role='Cashier' AND is_active=1;",
      [userId]
    );
    if (!cashier)
      throw new AppError('Only an active Cashier can open a shift.', 403, 'CASHIER_REQUIRED');
    const existing = await connection.get(
      "SELECT * FROM shifts WHERE user_id = ? AND status IN ('OPEN', 'PENDING_ADMIN_REVIEW') ORDER BY id DESC LIMIT 1;",
      [userId]
    );
    if (existing?.status === 'OPEN') return { shift: existing, resumed: true };
    if (existing)
      throw new AppError('The current shift is pending Admin review.', 409, 'SHIFT_PENDING_REVIEW');
    let result;
    try {
      result = await connection.run(
        "INSERT INTO shifts (user_id, status, opening_cash) VALUES (?, 'OPEN', ?);",
        [userId, amount]
      );
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT')
        throw new AppError('An unfinished shift already exists.', 409, 'UNFINISHED_SHIFT_EXISTS');
      throw error;
    }
    await connection.run(
      `INSERT INTO cash_movements (shift_id, user_id, type, amount, notes)
       VALUES (?, ?, 'OPENING', ?, ?);`,
      [result.lastID, userId, amount, 'Opening cash']
    );
    await writeAuditLog({
      userId,
      shiftId: result.lastID,
      actionType: 'SHIFT_OPEN',
      entityType: 'shifts',
      entityId: result.lastID,
      afterValues: { openingCash: amount },
      connection,
    });
    return {
      shift: await connection.get('SELECT * FROM shifts WHERE id = ?;', [result.lastID]),
      resumed: false,
    };
  });
}

export async function getCurrentShift(userId, connection = db) {
  return (
    (await connection.get(
      "SELECT * FROM shifts WHERE user_id = ? AND status IN ('OPEN', 'PENDING_ADMIN_REVIEW') ORDER BY id DESC LIMIT 1;",
      [userId]
    )) || null
  );
}

export async function getCurrentShiftSummary(userId, connection = db) {
  const shift = await getCurrentShift(userId, connection);
  if (!shift) return null;
  const [snapshot, sales, movementsList, revisions] = await Promise.all([
    getShiftSystemSnapshot(connection, shift),
    connection.get(
      'SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total_amount FROM orders WHERE shift_id = ?;',
      [shift.id]
    ),
    connection.all('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY id DESC;', [shift.id]),
    connection.all(
      'SELECT * FROM shift_close_revisions WHERE shift_id = ? ORDER BY revision_number DESC;',
      [shift.id]
    ),
  ]);
  return {
    shift,
    sales,
    payments: Object.entries(snapshot.methods).map(([payment_method, total_amount]) => ({
      payment_method,
      total_amount,
    })),
    cashMovements: [
      { type: 'PAY_IN', total_amount: snapshot.movements.payIn },
      { type: 'PAY_OUT', total_amount: snapshot.movements.payOut },
    ],
    cashMovementsList: movementsList,
    expectedClosingCash: snapshot.methods.Cash || 0,
    systemTotals: snapshot,
    operations: snapshot.operations,
    closeRevisions: revisions.map(parseRevision),
  };
}

function parseRevision(row) {
  if (!row) return null;
  return {
    ...row,
    systemTotals: JSON.parse(row.system_totals_json),
    declaredTotals: JSON.parse(row.declared_totals_json),
    variances: JSON.parse(row.variances_json),
  };
}

function normalizeActuals(actuals, activeMethods) {
  if (!actuals || typeof actuals !== 'object' || Array.isArray(actuals)) {
    throw new AppError('Per-method actual totals are required.', 400, 'SHIFT_ACTUALS_REQUIRED');
  }
  const result = {};
  for (const method of activeMethods) {
    if (actuals[method.code] === undefined) {
      throw new AppError(
        `Actual total is required for ${method.code}.`,
        400,
        'SHIFT_METHOD_ACTUAL_REQUIRED'
      );
    }
    result[method.code] = requirePiasters(actuals[method.code], `actuals.${method.code}`);
  }
  const invalid = Object.keys(actuals).filter(
    (code) => !activeMethods.some((method) => method.code === code)
  );
  if (invalid.length)
    throw new AppError(
      `Unknown payment methods: ${invalid.join(', ')}`,
      400,
      'UNKNOWN_SHIFT_PAYMENT_METHOD'
    );
  return result;
}

export async function requestCloseShift(userId, closeData) {
  return withTransaction(async (connection) => {
    const shift = await connection.get(
      "SELECT * FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
      [userId]
    );
    if (!shift)
      throw new AppError('No open shift is available to close.', 409, 'OPEN_SHIFT_REQUIRED');
    let suppliedActuals = closeData?.actuals;
    // Compatibility for older clients is intentionally narrow and still stores
    // a full revision; non-cash values default to their system totals.
    const system = await getShiftSystemSnapshot(connection, shift);
    const activeMethods = Object.keys(system.methods).map((code) => ({ code }));
    if (!suppliedActuals && closeData?.actualClosingCash !== undefined) {
      suppliedActuals = { ...system.methods, Cash: closeData.actualClosingCash };
    }
    const actuals = normalizeActuals(suppliedActuals, activeMethods);
    const variances = Object.fromEntries(
      activeMethods.map(({ code }) => [code, actuals[code] - (system.methods[code] || 0)])
    );
    const row = await connection.get(
      'SELECT COALESCE(MAX(revision_number), 0) + 1 AS next FROM shift_close_revisions WHERE shift_id = ?;',
      [shift.id]
    );
    const revision = await connection.run(
      `INSERT INTO shift_close_revisions
       (shift_id, revision_number, submitted_by, status, system_totals_json,
        declared_totals_json, variances_json, cashier_note)
       VALUES (?, ?, ?, 'SUBMITTED', ?, ?, ?, ?);`,
      [
        shift.id,
        row.next,
        userId,
        JSON.stringify(system),
        JSON.stringify(actuals),
        JSON.stringify(variances),
        closeData?.cashierNote || null,
      ]
    );
    const update = await connection.run(
      `UPDATE shifts SET status = 'PENDING_ADMIN_REVIEW', closed_at = CURRENT_TIMESTAMP,
       system_total_cash = ?, system_total_card = ?, system_total_instapay = ?,
       system_total_wallet = ?, system_total_transfer = ?, cashier_declared_cash = ?,
       cashier_declared_card = ?, cashier_declared_instapay = ?, cashier_declared_wallet = ?,
       cashier_declared_transfer = ?, actual_closed_cash = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'OPEN';`,
      [
        system.methods.Cash || 0,
        system.methods.Card || 0,
        system.methods.InstaPay || 0,
        system.methods.Wallet || 0,
        system.methods.Transfer || 0,
        actuals.Cash || 0,
        actuals.Card || 0,
        actuals.InstaPay || 0,
        actuals.Wallet || 0,
        actuals.Transfer || 0,
        actuals.Cash || 0,
        shift.id,
      ]
    );
    if (update.changes !== 1)
      throw new AppError('Shift state changed concurrently.', 409, 'SHIFT_STATE_CONFLICT');
    await writeAuditLog({
      userId,
      shiftId: shift.id,
      actionType: 'SHIFT_CLOSE_REQUEST',
      entityType: 'shift_close_revisions',
      entityId: revision.lastID,
      afterValues: { revisionNumber: row.next, actuals, variances },
      connection,
    });
    return {
      shift: await connection.get('SELECT * FROM shifts WHERE id = ?;', [shift.id]),
      revision: parseRevision(
        await connection.get('SELECT * FROM shift_close_revisions WHERE id = ?;', [revision.lastID])
      ),
    };
  });
}

export async function getPendingReviewShifts(connection = db) {
  const rows = await connection.all(
    `SELECT s.*, u.name AS cashier_name, u.username AS cashier_username,
            r.id AS revision_id, r.revision_number, r.system_totals_json,
            r.declared_totals_json, r.variances_json, r.cashier_note, r.submitted_at
       FROM shifts s JOIN users u ON u.id = s.user_id
       JOIN shift_close_revisions r ON r.id = (
         SELECT r2.id FROM shift_close_revisions r2
          WHERE r2.shift_id = s.id AND r2.status = 'SUBMITTED'
          ORDER BY r2.revision_number DESC LIMIT 1
       )
      WHERE s.status = 'PENDING_ADMIN_REVIEW' ORDER BY r.submitted_at;`
  );
  return rows.map((row) => {
    const parsed = parseRevision(row);
    return {
      ...parsed,
      system_total_cash: parsed.systemTotals.methods.Cash || 0,
      cashier_declared_cash: parsed.declaredTotals.Cash || 0,
    };
  });
}

async function getSubmittedRevision(connection, shiftId) {
  const shift = await connection.get('SELECT * FROM shifts WHERE id = ?;', [shiftId]);
  if (!shift) throw new AppError('Shift not found.', 404, 'SHIFT_NOT_FOUND');
  if (shift.status !== 'PENDING_ADMIN_REVIEW')
    throw new AppError('Shift is not pending review.', 409, 'SHIFT_NOT_PENDING');
  const revision = await connection.get(
    `SELECT * FROM shift_close_revisions WHERE shift_id = ? AND status = 'SUBMITTED'
     ORDER BY revision_number DESC LIMIT 1;`,
    [shiftId]
  );
  if (!revision)
    throw new AppError('Submitted close revision not found.', 409, 'SHIFT_REVISION_NOT_FOUND');
  return { shift, revision };
}

export async function approveShiftClose(adminId, shiftId, adminNotes) {
  const id = requireInteger(Number(shiftId), 'shiftId', { min: 1 });
  return withTransaction(async (connection) => {
    const { shift, revision } = await getSubmittedRevision(connection, id);
    const reviewed = await connection.run(
      `UPDATE shift_close_revisions SET status = 'APPROVED', admin_id = ?, admin_reason = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'SUBMITTED';`,
      [adminId, adminNotes || null, revision.id]
    );
    if (reviewed.changes !== 1)
      throw new AppError('Revision was reviewed concurrently.', 409, 'SHIFT_REVIEW_CONFLICT');
    const update = await connection.run(
      `UPDATE shifts SET status = 'CLOSED', approved_close_revision_id = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'PENDING_ADMIN_REVIEW';`,
      [revision.id, adminNotes || null, id]
    );
    if (update.changes !== 1)
      throw new AppError('Shift state changed concurrently.', 409, 'SHIFT_STATE_CONFLICT');
    const declared = JSON.parse(revision.declared_totals_json);
    await connection.run(
      `INSERT INTO cash_movements (shift_id, user_id, type, amount, notes)
       VALUES (?, ?, 'CLOSING', ?, ?);`,
      [id, shift.user_id, declared.Cash || 0, 'Approved closing total']
    );
    await writeAuditLog({
      userId: adminId,
      shiftId: id,
      actionType: 'SHIFT_APPROVE',
      entityType: 'shift_close_revisions',
      entityId: revision.id,
      afterValues: { adminNotes: adminNotes || null },
      connection,
    });
    return getShiftDetails(id, connection);
  });
}

export async function rejectShiftClose(adminId, shiftId, reason) {
  const id = requireInteger(Number(shiftId), 'shiftId', { min: 1 });
  const cleanReason = String(reason || '').trim();
  if (!cleanReason)
    throw new AppError('A rejection reason is required.', 400, 'SHIFT_REJECTION_REASON_REQUIRED');
  return withTransaction(async (connection) => {
    const { revision } = await getSubmittedRevision(connection, id);
    const reviewed = await connection.run(
      `UPDATE shift_close_revisions SET status = 'REJECTED', admin_id = ?, admin_reason = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'SUBMITTED';`,
      [adminId, cleanReason, revision.id]
    );
    if (reviewed.changes !== 1)
      throw new AppError('Revision was reviewed concurrently.', 409, 'SHIFT_REVIEW_CONFLICT');
    const update = await connection.run(
      `UPDATE shifts SET status = 'OPEN', closed_at = NULL, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'PENDING_ADMIN_REVIEW';`,
      [cleanReason, id]
    );
    if (update.changes !== 1)
      throw new AppError('Shift state changed concurrently.', 409, 'SHIFT_STATE_CONFLICT');
    await writeAuditLog({
      userId: adminId,
      shiftId: id,
      actionType: 'SHIFT_REJECT',
      entityType: 'shift_close_revisions',
      entityId: revision.id,
      afterValues: { reason: cleanReason, resumedStatus: 'OPEN' },
      connection,
    });
    return getShiftDetails(id, connection);
  });
}

export async function registerCashMovement(userId, { type, amount, notes }, idempotencyKey) {
  if (!['PAY_IN', 'PAY_OUT'].includes(type))
    throw new AppError('Movement type must be PAY_IN or PAY_OUT.', 400, 'INVALID_CASH_MOVEMENT');
  const value = requirePiasters(amount, 'amount', { allowZero: false });
  const cleanNotes = String(notes || '').trim();
  if (!cleanNotes)
    throw new AppError('Cash movement reason is required.', 400, 'CASH_MOVEMENT_REASON_REQUIRED');
  return withIdempotency(
    {
      key: idempotencyKey,
      userId,
      operation: 'CASH_MOVEMENT',
      payload: { type, amount: value, notes: cleanNotes },
    },
    async (connection) => {
      const shift = await connection.get(
        "SELECT * FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
        [userId]
      );
      if (!shift) throw new AppError('An open shift is required.', 409, 'OPEN_SHIFT_REQUIRED');
      const result = await connection.run(
        'INSERT INTO cash_movements (shift_id, user_id, type, amount, notes) VALUES (?, ?, ?, ?, ?);',
        [shift.id, userId, type, value, cleanNotes]
      );
      await writeAuditLog({
        userId,
        shiftId: shift.id,
        actionType: 'CASH_MOVEMENT',
        entityType: 'cash_movements',
        entityId: result.lastID,
        afterValues: { type, amount: value, notes: cleanNotes },
        connection,
      });
      return {
        statusCode: 200,
        data: { id: result.lastID, shiftId: shift.id, type, amount: value, notes: cleanNotes },
      };
    }
  );
}

export async function listAllShifts(filters = {}, connection = db) {
  let sql = `SELECT s.*, u.name AS cashier_name, u.username AS cashier_username
               FROM shifts s JOIN users u ON u.id = s.user_id WHERE 1 = 1`;
  const params = [];
  if (filters.status) {
    sql += ' AND s.status = ?';
    params.push(filters.status);
  }
  if (filters.cashierId) {
    sql += ' AND s.user_id = ?';
    params.push(filters.cashierId);
  }
  if (filters.startDate) {
    sql += ' AND s.opened_at >= ?';
    params.push(cairoMidnightUtc(filters.startDate));
  }
  if (filters.endDate) {
    sql += ' AND s.opened_at < ?';
    params.push(cairoMidnightUtc(addCalendarDay(filters.endDate)));
  }
  sql += ' ORDER BY s.id DESC LIMIT 500;';
  return connection.all(sql, params);
}

export async function getShiftDetails(shiftId, connection = db) {
  const shift = await connection.get(
    `SELECT s.*, u.name AS cashier_name, u.username AS cashier_username
       FROM shifts s JOIN users u ON u.id = s.user_id WHERE s.id = ?;`,
    [shiftId]
  );
  if (!shift) throw new AppError('Shift not found.', 404, 'SHIFT_NOT_FOUND');
  const [summary, revisions, movements] = await Promise.all([
    getShiftSystemSnapshot(connection, shift),
    connection.all(
      'SELECT * FROM shift_close_revisions WHERE shift_id = ? ORDER BY revision_number DESC;',
      [shift.id]
    ),
    connection.all('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY id;', [shift.id]),
  ]);
  return {
    shift,
    systemTotals: summary,
    closeRevisions: revisions.map(parseRevision),
    cashMovements: movements,
  };
}

import bcrypt from 'bcryptjs';
import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError } from '../../utils/errors.js';
import { addCalendarDay, cairoMidnightUtc } from '../invoices/invoices.service.js';

const ROLES = new Set(['Admin', 'Cashier']);

function requireRole(role) {
  if (!ROLES.has(role))
    throw new AppError('Role must be Admin or Cashier.', 400, 'INVALID_USER_ROLE');
  return role;
}

function requirePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    throw new AppError('Password must be between 8 and 200 characters.', 400, 'INVALID_PASSWORD');
  }
  return password;
}

function requireText(value, field, code, max = 150) {
  const result = String(value || '').trim();
  if (!result || result.length > max) throw new AppError(`${field} is required.`, 400, code);
  return result;
}

async function assertAdminWillRemain(connection, user) {
  if (user.role !== 'Admin' || user.is_active !== 1) return;
  const remaining = await connection.get(
    'SELECT COUNT(*) AS count FROM users WHERE role = ? AND is_active = 1 AND id != ?;',
    ['Admin', user.id]
  );
  if (remaining.count < 1) {
    throw new AppError(
      'The last active Admin cannot be disabled or demoted.',
      409,
      'LAST_ACTIVE_ADMIN'
    );
  }
}

async function assertNoUnfinishedCashierShift(connection, user) {
  if (user.role !== 'Cashier') return;
  const shift = await connection.get(
    `SELECT id, status FROM shifts
      WHERE user_id = ? AND status IN ('OPEN', 'PENDING_ADMIN_REVIEW')
      ORDER BY id DESC LIMIT 1;`,
    [user.id]
  );
  if (shift) {
    throw new AppError(
      'A Cashier with an unfinished shift cannot be disabled or assigned another role.',
      409,
      'USER_HAS_UNFINISHED_SHIFT',
      { shiftId: shift.id, shiftStatus: shift.status }
    );
  }
}

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

export async function getAllUsers(connection = db) {
  const date = cairoToday();
  const start = cairoMidnightUtc(date);
  const end = cairoMidnightUtc(addCalendarDay(date));
  return connection.all(
    `SELECT u.id, u.username, u.role, u.name, u.phone, u.is_active,
            u.created_at, u.updated_at,
            (SELECT MAX(a.created_at) FROM audit_logs a
              WHERE a.user_id = u.id AND a.action_type = 'LOGIN') AS last_login_at,
            (SELECT MAX(s.last_seen_at) FROM sessions s
              WHERE s.user_id = u.id AND datetime(s.expires_at) > CURRENT_TIMESTAMP) AS last_seen_at,
            (SELECT COUNT(*) FROM sessions s
              WHERE s.user_id = u.id AND datetime(s.expires_at) > CURRENT_TIMESTAMP) AS active_sessions_count,
            CASE WHEN EXISTS (
              SELECT 1 FROM sessions s WHERE s.user_id = u.id
               AND datetime(s.expires_at) > CURRENT_TIMESTAMP
               AND datetime(s.last_seen_at) >= datetime('now', '-90 seconds')
            ) THEN 1 ELSE 0 END AS is_online,
            (SELECT id FROM shifts sh WHERE sh.user_id = u.id AND sh.status = 'OPEN'
              ORDER BY sh.id DESC LIMIT 1) AS open_shift_id,
            (SELECT opened_at FROM shifts sh WHERE sh.user_id = u.id AND sh.status = 'OPEN'
              ORDER BY sh.id DESC LIMIT 1) AS open_shift_opened_at,
            (SELECT id FROM shifts sh WHERE sh.user_id = u.id
              AND sh.status IN ('OPEN', 'PENDING_ADMIN_REVIEW')
              ORDER BY sh.id DESC LIMIT 1) AS unfinished_shift_id,
            (SELECT status FROM shifts sh WHERE sh.user_id = u.id
              AND sh.status IN ('OPEN', 'PENDING_ADMIN_REVIEW')
              ORDER BY sh.id DESC LIMIT 1) AS unfinished_shift_status,
            (SELECT COUNT(*) FROM orders o WHERE o.cashier_id = u.id
              AND o.created_at >= ? AND o.created_at < ?) AS today_sales_count,
            (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.cashier_id = u.id
              AND o.created_at >= ? AND o.created_at < ?) AS today_sales
       FROM users u ORDER BY u.created_at DESC;`,
    [start, end, start, end]
  );
}

export async function getUserById(id, connection = db) {
  return connection.get(
    'SELECT id, username, role, name, phone, is_active, created_at, updated_at FROM users WHERE id = ?;',
    [id]
  );
}

export async function createUser({ username, password, role, name, phone }, adminUserId) {
  const cleanUsername = requireText(username, 'Username', 'USERNAME_REQUIRED', 100);
  const cleanName = requireText(name, 'Name', 'USER_NAME_REQUIRED', 150);
  const cleanRole = requireRole(role);
  const cleanPassword = requirePassword(password);
  const cleanPhone =
    phone === undefined || phone === null || phone === '' ? null : String(phone).trim();
  if (cleanPhone && cleanPhone.length > 30)
    throw new AppError('Phone is too long.', 400, 'INVALID_PHONE');
  const passwordHash = await bcrypt.hash(cleanPassword, 10);

  return withTransaction(async (connection) => {
    const existing = await connection.get('SELECT id FROM users WHERE username = ?;', [
      cleanUsername,
    ]);
    if (existing) throw new AppError('Username already exists.', 409, 'USERNAME_CONFLICT');
    let result;
    try {
      result = await connection.run(
        `INSERT INTO users (username, password_hash, role, name, phone)
         VALUES (?, ?, ?, ?, ?);`,
        [cleanUsername, passwordHash, cleanRole, cleanName, cleanPhone]
      );
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT')
        throw new AppError('Username already exists.', 409, 'USERNAME_CONFLICT');
      throw error;
    }
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'USER_CREATE',
      entityType: 'users',
      entityId: result.lastID,
      afterValues: { username: cleanUsername, role: cleanRole, name: cleanName, phone: cleanPhone },
      notes: `User created: ${cleanUsername}`,
      connection,
    });
    return getUserById(result.lastID, connection);
  });
}

export async function updateUser(id, { role, name, phone }, adminUserId) {
  return withTransaction(async (connection) => {
    const oldUser = await getUserById(id, connection);
    if (!oldUser) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    const finalRole = role === undefined ? oldUser.role : requireRole(role);
    const finalName =
      name === undefined ? oldUser.name : requireText(name, 'Name', 'USER_NAME_REQUIRED', 150);
    const finalPhone =
      phone === undefined
        ? oldUser.phone
        : phone === null || phone === ''
          ? null
          : String(phone).trim();
    if (finalPhone && finalPhone.length > 30)
      throw new AppError('Phone is too long.', 400, 'INVALID_PHONE');
    if (oldUser.role === 'Admin' && finalRole !== 'Admin')
      await assertAdminWillRemain(connection, oldUser);
    if (finalRole !== oldUser.role) await assertNoUnfinishedCashierShift(connection, oldUser);

    await connection.run(
      `UPDATE users SET role = ?, name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [finalRole, finalName, finalPhone, id]
    );
    if (finalRole !== oldUser.role)
      await connection.run('DELETE FROM sessions WHERE user_id = ?;', [id]);
    const updatedUser = await getUserById(id, connection);
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'USER_UPDATE',
      entityType: 'users',
      entityId: id,
      beforeValues: oldUser,
      afterValues: updatedUser,
      notes: `User ${id} updated`,
      connection,
    });
    return updatedUser;
  });
}

export async function updateUserPassword(id, newPassword, adminUserId) {
  const passwordHash = await bcrypt.hash(requirePassword(newPassword), 10);
  return withTransaction(async (connection) => {
    const user = await getUserById(id, connection);
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    await connection.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
      [passwordHash, id]
    );
    await connection.run('DELETE FROM sessions WHERE user_id = ?;', [id]);
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'USER_PASSWORD_CHANGE',
      entityType: 'users',
      entityId: id,
      notes: `Password changed and sessions revoked for user ${user.username}`,
      connection,
    });
    return true;
  });
}

export async function setUserActiveStatus(id, isActive, adminUserId) {
  return withTransaction(async (connection) => {
    const user = await getUserById(id, connection);
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    const newStatus = isActive ? 1 : 0;
    if (user.is_active === newStatus) return true;
    if (newStatus === 0) await assertAdminWillRemain(connection, user);
    if (newStatus === 0) await assertNoUnfinishedCashierShift(connection, user);

    await connection.run(
      'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
      [newStatus, id]
    );
    if (newStatus === 0) await connection.run('DELETE FROM sessions WHERE user_id = ?;', [id]);
    await writeAuditLog({
      userId: adminUserId,
      actionType: isActive ? 'USER_ENABLE' : 'USER_DISABLE',
      entityType: 'users',
      entityId: id,
      beforeValues: { is_active: user.is_active },
      afterValues: { is_active: newStatus },
      notes: `${isActive ? 'Enabled' : 'Disabled'} user ${user.username}`,
      connection,
    });
    return true;
  });
}

export async function listUserSessions(userId, connection = db) {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new AppError('Invalid user identifier.', 400, 'INVALID_USER_ID');
  const user = await connection.get('SELECT id FROM users WHERE id = ?;', [id]);
  if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  return connection.all(
    `SELECT id, created_at, expires_at, last_seen_at,
            CASE WHEN datetime(expires_at) > CURRENT_TIMESTAMP
              AND datetime(last_seen_at) >= datetime('now', '-90 seconds')
              THEN 1 ELSE 0 END AS is_online
       FROM sessions WHERE user_id = ? ORDER BY created_at DESC, id DESC;`,
    [id]
  );
}

export async function revokeUserSessions(userId, adminUserId, sessionId = null) {
  const id = Number(userId);
  const selectedSessionId = sessionId === null ? null : Number(sessionId);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new AppError('Invalid user identifier.', 400, 'INVALID_USER_ID');
  if (
    selectedSessionId !== null &&
    (!Number.isSafeInteger(selectedSessionId) || selectedSessionId < 1)
  ) {
    throw new AppError('Invalid session identifier.', 400, 'INVALID_SESSION_ID');
  }
  return withTransaction(async (connection) => {
    const user = await getUserById(id, connection);
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    let result;
    if (selectedSessionId === null) {
      result = await connection.run('DELETE FROM sessions WHERE user_id = ?;', [id]);
    } else {
      result = await connection.run('DELETE FROM sessions WHERE id = ? AND user_id = ?;', [
        selectedSessionId,
        id,
      ]);
      if (result.changes !== 1) throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
    }
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'USER_SESSIONS_REVOKE',
      entityType: 'users',
      entityId: id,
      afterValues: {
        revokedCount: result.changes,
        sessionId: selectedSessionId,
      },
      notes: `Revoked ${result.changes} session(s) for ${user.username}`,
      connection,
    });
    return { revokedCount: result.changes, sessionId: selectedSessionId };
  });
}

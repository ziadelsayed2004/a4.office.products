import bcrypt from 'bcryptjs';
import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError } from '../../utils/errors.js';

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

export async function getAllUsers(connection = db) {
  return connection.all(
    'SELECT id, username, role, name, phone, is_active, created_at, updated_at FROM users ORDER BY created_at DESC;'
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

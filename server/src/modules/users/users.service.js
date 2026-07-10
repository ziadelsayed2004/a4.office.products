import bcrypt from 'bcryptjs';
import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

/**
 * Retrieve all users in the system.
 */
export async function getAllUsers() {
  const users = await db.all(
    'SELECT id, username, role, name, phone, is_active, created_at, updated_at FROM users ORDER BY created_at DESC;'
  );
  return users;
}

/**
 * Retrieve single user by ID.
 */
export async function getUserById(id) {
  const user = await db.get(
    'SELECT id, username, role, name, phone, is_active, created_at FROM users WHERE id = ?;',
    [id]
  );
  return user;
}

/**
 * Create a new user.
 */
export async function createUser({ username, password, role, name, phone }, adminUserId) {
  // Check validation
  if (!username || !password || !role || !name) {
    throw new Error('جميع الحقول الأساسية مطلوبة (اسم المستخدم، كلمة المرور، الاسم الكامل، الصلاحية).');
  }

  if (role !== 'Admin' && role !== 'Cashier') {
    throw new Error('صلاحية غير صالحة. يجب أن تكون Admin أو Cashier.');
  }

  // Check unique username
  const existing = await db.get('SELECT id FROM users WHERE username = ?;', [username]);
  if (existing) {
    throw new Error('اسم المستخدم موجود بالفعل.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.run(
    `INSERT INTO users (username, password_hash, role, name, phone)
     VALUES (?, ?, ?, ?, ?);`,
    [username, passwordHash, role, name, phone || null]
  );

  const newUserId = result.lastID;

  // Log audit trail
  await writeAuditLog({
    userId: adminUserId,
    actionType: 'USER_CREATE',
    entityType: 'users',
    entityId: newUserId,
    afterValues: { username, role, name, phone },
    notes: `تم إنشاء حساب مستخدم جديد: ${username} بصلاحية ${role}`
  });

  return await getUserById(newUserId);
}

/**
 * Update user details (role, name, phone).
 */
export async function updateUser(id, { role, name, phone }, adminUserId) {
  const oldUser = await db.get('SELECT role, name, phone FROM users WHERE id = ?;', [id]);
  if (!oldUser) {
    throw new Error('المستخدم غير موجود.');
  }

  if (role && role !== 'Admin' && role !== 'Cashier') {
    throw new Error('صلاحية غير صالحة. يجب أن تكون Admin أو Cashier.');
  }

  const finalRole = role || oldUser.role;
  const finalName = name || oldUser.name;
  const finalPhone = phone !== undefined ? phone : oldUser.phone;

  await db.run(
    `UPDATE users
     SET role = ?, name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?;`,
    [finalRole, finalName, finalPhone, id]
  );

  // Log audit trail
  await writeAuditLog({
    userId: adminUserId,
    actionType: 'USER_UPDATE',
    entityType: 'users',
    entityId: id,
    beforeValues: oldUser,
    afterValues: { role: finalRole, name: finalName, phone: finalPhone },
    notes: `تم تحديث بيانات المستخدم ذو المعرف (${id})`
  });

  return await getUserById(id);
}

/**
 * Update user password.
 */
export async function updateUserPassword(id, newPassword, adminUserId) {
  const user = await db.get('SELECT username FROM users WHERE id = ?;', [id]);
  if (!user) {
    throw new Error('المستخدم غير موجود.');
  }

  if (!newPassword || newPassword.length < 4) {
    throw new Error('كلمة المرور يجب ألا تقل عن 4 أحرف.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db.run(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
    [passwordHash, id]
  );

  // Log audit trail
  await writeAuditLog({
    userId: adminUserId,
    actionType: 'USER_PASSWORD_CHANGE',
    entityType: 'users',
    entityId: id,
    notes: `تم تغيير كلمة المرور للمستخدم: ${user.username}`
  });

  return true;
}

/**
 * Enable/Disable user status.
 */
export async function setUserActiveStatus(id, isActive, adminUserId) {
  const user = await db.get('SELECT username, is_active FROM users WHERE id = ?;', [id]);
  if (!user) {
    throw new Error('المستخدم غير موجود.');
  }

  const newStatus = isActive ? 1 : 0;
  if (user.is_active === newStatus) {
    return true; // Already in target status
  }

  await db.run(
    'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
    [newStatus, id]
  );

  const action = isActive ? 'USER_ENABLE' : 'USER_DISABLE';
  const notes = isActive ? `تم تفعيل حساب المستخدم: ${user.username}` : `تم تعطيل حساب المستخدم: ${user.username}`;

  // Log audit trail
  await writeAuditLog({
    userId: adminUserId,
    actionType: action,
    entityType: 'users',
    entityId: id,
    beforeValues: { is_active: user.is_active },
    afterValues: { is_active: newStatus },
    notes
  });

  return true;
}

const bcrypt = require('bcrypt');
const db = require('../../db');

/**
 * Creates a new user with hashed password.
 */
async function createUser({ username, password, fullName, status = 'active' }) {
  if (!username || !password || !fullName) {
    throw new Error('Username, password, and full name are required');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const sql = `
    INSERT INTO users (username, password_hash, full_name, status)
    VALUES (?, ?, ?, ?)
  `;
  const result = await db.run(sql, [username.trim().toLowerCase(), passwordHash, fullName, status]);
  return { id: result.lastID, username, fullName, status };
}

/**
 * Find user by ID.
 */
async function findById(id) {
  const sql = `SELECT id, username, full_name, status, created_at, updated_at FROM users WHERE id = ?`;
  return await db.get(sql, [id]);
}

/**
 * Find user by username.
 */
async function findByUsername(username) {
  const sql = `SELECT * FROM users WHERE username = ?`;
  return await db.get(sql, [username.trim().toLowerCase()]);
}

/**
 * Update user status (active, disabled, archived).
 */
async function updateStatus(id, status) {
  if (!['active', 'disabled', 'archived'].includes(status)) {
    throw new Error('Invalid user status');
  }
  const sql = `UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const result = await db.run(sql, [status, id]);
  return result.changes > 0;
}

/**
 * Update user password.
 */
async function updatePassword(id, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const sql = `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const result = await db.run(sql, [passwordHash, id]);
  return result.changes > 0;
}

/**
 * Assign role to a user.
 */
async function assignRole(userId, roleId) {
  const sql = `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`;
  const result = await db.run(sql, [userId, roleId]);
  return result.changes > 0;
}

/**
 * Get roles for a user.
 */
async function getUserRoles(userId) {
  const sql = `
    SELECT r.id, r.name, r.description 
    FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ?
  `;
  return await db.all(sql, [userId]);
}

/**
 * Get compiled permissions for a user.
 */
async function getUserPermissions(userId) {
  // Retrieve user roles first
  const roles = await getUserRoles(userId);
  const roleNames = roles.map(r => r.name);
  
  // If super_admin, return all permissions in the database
  if (roleNames.includes('super_admin')) {
    const allPerms = await db.all('SELECT name FROM permissions');
    return allPerms.map(p => p.name);
  }

  // Otherwise, compile permissions assigned to the user's roles
  const sql = `
    SELECT DISTINCT p.name
    FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = ?
  `;
  const rows = await db.all(sql, [userId]);
  return rows.map(r => r.name);
}

async function updateUser(id, { fullName }) {
  const sql = `UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const result = await db.run(sql, [fullName, id]);
  return result.changes > 0;
}

async function clearRoles(userId) {
  const sql = `DELETE FROM user_roles WHERE user_id = ?`;
  await db.run(sql, [userId]);
}

async function getUsers({ limit = 50, offset = 0, search = '' } = {}) {
  let sql = `
    SELECT id, username, full_name, status, created_at, updated_at
    FROM users
    WHERE status != 'archived'
  `;
  const params = [];
  if (search) {
    sql += ` AND (username LIKE ? OR full_name LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term);
  }
  sql += ` ORDER BY username ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const users = await db.all(sql, params);
  
  // Load roles for each user
  for (const u of users) {
    const roles = await getUserRoles(u.id);
    u.roles = roles.map(r => r.name);
  }
  
  return users;
}

module.exports = {
  createUser,
  findById,
  findByUsername,
  updateStatus,
  updatePassword,
  assignRole,
  getUserRoles,
  getUserPermissions,
  updateUser,
  clearRoles,
  getUsers
};

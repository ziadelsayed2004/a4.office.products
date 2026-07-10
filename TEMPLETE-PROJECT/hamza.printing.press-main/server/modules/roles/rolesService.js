const db = require('../../db');

/**
 * Create a new role.
 */
async function createRole(name, description = '') {
  const sql = `INSERT INTO roles (name, description) VALUES (?, ?)`;
  const result = await db.run(sql, [name.trim(), description]);
  return { id: result.lastID, name, description };
}

/**
 * Assign a permission to a role.
 */
async function assignPermissionToRole(roleId, permissionId) {
  const sql = `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`;
  const result = await db.run(sql, [roleId, permissionId]);
  return result.changes > 0;
}

/**
 * Fetch all roles.
 */
async function getAllRoles() {
  return await db.all('SELECT * FROM roles ORDER BY name ASC');
}

/**
 * Fetch all permissions.
 */
async function getAllPermissions() {
  return await db.all('SELECT * FROM permissions ORDER BY name ASC');
}

/**
 * Fetch permissions assigned to a role.
 */
async function getRolePermissions(roleId) {
  const sql = `
    SELECT p.id, p.name, p.description
    FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    WHERE rp.role_id = ?
  `;
  return await db.all(sql, [roleId]);
}

/**
 * Update permissions for a role.
 */
async function updateRolePermissions(roleId, permissionIds) {
  await db.run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
  for (const permId of permissionIds) {
    await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permId]);
  }
}

/**
 * Update a role's name and description.
 */
async function updateRole(roleId, name, description) {
  const sql = `UPDATE roles SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const result = await db.run(sql, [name.trim(), description, roleId]);
  return result.changes > 0;
}

/**
 * Delete a role by ID.
 */
async function deleteRole(roleId) {
  const sql = `DELETE FROM roles WHERE id = ?`;
  const result = await db.run(sql, [roleId]);
  return result.changes > 0;
}

module.exports = {
  createRole,
  assignPermissionToRole,
  getAllRoles,
  getAllPermissions,
  getRolePermissions,
  updateRolePermissions,
  updateRole,
  deleteRole
};


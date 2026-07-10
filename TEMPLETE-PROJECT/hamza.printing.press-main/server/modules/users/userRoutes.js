const express = require('express');
const router = express.Router();
const usersService = require('./usersService');
const rolesService = require('../roles/rolesService');
const { requireAuth, checkPermission } = require('../../middleware/rbac');
const { auditLog } = require('../../middleware/audit');
const db = require('../../db');

// 1. GET /api/users/permissions - List all permissions in the system
router.get('/permissions', requireAuth, checkPermission('roles.manage'), async (req, res) => {
  try {
    const permissions = await rolesService.getAllPermissions();
    res.status(200).json(permissions);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 8. GET /api/users/roles - List all roles
router.get('/roles', requireAuth, checkPermission('roles.manage'), async (req, res) => {
  try {
    const roles = await rolesService.getAllRoles();
    // Fetch permissions associated with each role
    for (const role of roles) {
      const perms = await rolesService.getRolePermissions(role.id);
      role.permissions = perms.map(p => p.name);
    }
    res.status(200).json(roles);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 9. POST /api/users/roles/:roleId/permissions - Update permissions for a role
router.post('/roles/:roleId/permissions', requireAuth, checkPermission('roles.manage'), auditLog('update_role_permissions', 'roles'), async (req, res) => {
  const { roleId } = req.params;
  const { permissionIds } = req.body;

  if (!Array.isArray(permissionIds)) {
    return res.status(400).json({ error: 'Bad Request', message: 'permissionIds must be an array.' });
  }

  try {
    await rolesService.updateRolePermissions(roleId, permissionIds);
    res.status(200).json({
      success: true,
      message: 'Role permissions updated successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/users/roles - Create a new custom role
router.post('/roles', requireAuth, checkPermission('roles.manage'), auditLog('create_role', 'roles'), async (req, res) => {
  const { name, description, permissionIds } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Bad Request', message: 'Role name is required.' });
  }
  try {
    const allRoles = await rolesService.getAllRoles();
    if (allRoles.some(r => r.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(409).json({ error: 'Conflict', message: 'Role name is already taken.' });
    }
    const role = await rolesService.createRole(name, description);
    if (Array.isArray(permissionIds) && permissionIds.length > 0) {
      await rolesService.updateRolePermissions(role.id, permissionIds);
    }
    res.status(201).json({
      success: true,
      message: 'Role created successfully.',
      role
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/users/roles/:roleId - Update a custom role and its permissions
router.put('/roles/:roleId', requireAuth, checkPermission('roles.manage'), auditLog('update_role', 'roles'), async (req, res) => {
  const { roleId } = req.params;
  const { name, description, permissionIds } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Bad Request', message: 'Role name is required.' });
  }

  const SYSTEM_ROLES = ['super_admin', 'admin', 'accountant', 'inventory_manager', 'sales_staff', 'shipping_user', 'author', 'outlet', 'visitor', 'assistant'];
  try {
    const allRoles = await rolesService.getAllRoles();
    const targetRole = allRoles.find(r => r.id === parseInt(roleId, 10));
    if (!targetRole) {
      return res.status(404).json({ error: 'Not Found', message: 'Role not found.' });
    }
    if (SYSTEM_ROLES.includes(targetRole.name)) {
      return res.status(403).json({ error: 'Forbidden', message: 'System roles cannot be modified.' });
    }

    await rolesService.updateRole(roleId, name, description);
    if (Array.isArray(permissionIds)) {
      await rolesService.updateRolePermissions(roleId, permissionIds);
    }
    res.status(200).json({
      success: true,
      message: 'Role updated successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/users/roles/:roleId - Delete a custom role safely
router.delete('/roles/:roleId', requireAuth, checkPermission('roles.manage'), auditLog('delete_role', 'roles'), async (req, res) => {
  const { roleId } = req.params;
  const SYSTEM_ROLES = ['super_admin', 'admin', 'accountant', 'inventory_manager', 'sales_staff', 'shipping_user', 'author', 'outlet', 'visitor', 'assistant'];
  try {
    const allRoles = await rolesService.getAllRoles();
    const targetRole = allRoles.find(r => r.id === parseInt(roleId, 10));
    if (!targetRole) {
      return res.status(404).json({ error: 'Not Found', message: 'Role not found.' });
    }
    if (SYSTEM_ROLES.includes(targetRole.name)) {
      return res.status(403).json({ error: 'Forbidden', message: 'System roles cannot be deleted.' });
    }

    const usersWithRole = await db.all('SELECT user_id FROM user_roles WHERE role_id = ?', [roleId]);
    if (usersWithRole.length > 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot delete a role currently assigned to active users.' });
    }

    await rolesService.deleteRole(roleId);
    res.status(200).json({
      success: true,
      message: 'Role deleted successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 10. GET /api/users/audit-logs - List audit logs
router.get('/audit-logs', requireAuth, checkPermission('audit.view'), async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const action = req.query.action || null;
  const targetType = req.query.targetType || null;
  
  try {
    const auditService = require('../audit/auditService');
    const logs = await auditService.getLogs({ limit, offset, action, targetType });
    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 2. GET /api/users - Paginated user list with search filters
router.get('/', requireAuth, checkPermission('users.view'), async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const search = req.query.search || '';
  
  try {
    const users = await usersService.getUsers({ limit, offset, search });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 3. GET /api/users/:id - Fetch single user profile details
router.get('/:id', requireAuth, checkPermission('users.view'), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await usersService.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }
    const roles = await usersService.getUserRoles(id);
    user.roles = roles.map(r => r.name);
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 4. POST /api/users - Create user with initial roles
router.post('/', requireAuth, checkPermission('users.create'), auditLog('create_user', 'users'), async (req, res) => {
  const { username, password, fullName, status = 'active', roles = [] } = req.body;

  if (!username || !password || !fullName) {
    return res.status(400).json({ error: 'Bad Request', message: 'Username, password, and full name are required.' });
  }

  try {
    // Check if user exists
    const existing = await usersService.findByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Username is already taken.' });
    }

    // 1. Create user
    const newUser = await usersService.createUser({ username, password, fullName, status });

    // 2. Map and assign roles
    if (roles.length > 0) {
      const allRoles = await rolesService.getAllRoles();
      const roleMap = new Map(allRoles.map(r => [r.name, r.id]));
      
      for (const rName of roles) {
        const roleId = roleMap.get(rName);
        if (roleId) {
          await usersService.assignRole(newUser.id, roleId);
        }
      }
    }

    newUser.roles = roles;
    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: newUser
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 5. PUT /api/users/:id - Edit user profile details and roles
router.put('/:id', requireAuth, checkPermission('users.update'), auditLog('update_user', 'users'), async (req, res) => {
  const { id } = req.params;
  const { fullName, roles = [] } = req.body;

  if (!fullName) {
    return res.status(400).json({ error: 'Bad Request', message: 'Full name is required.' });
  }

  try {
    const user = await usersService.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    // 1. Update user info
    await usersService.updateUser(id, { fullName });

    // 2. Clear old roles and map/assign new roles
    await usersService.clearRoles(id);
    if (roles.length > 0) {
      const allRoles = await rolesService.getAllRoles();
      const roleMap = new Map(allRoles.map(r => [r.name, r.id]));
      
      for (const rName of roles) {
        const roleId = roleMap.get(rName);
        if (roleId) {
          await usersService.assignRole(id, roleId);
        }
      }
    }

    const updatedUser = await usersService.findById(id);
    updatedUser.roles = roles;

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user: updatedUser
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 6. PUT /api/users/:id/status - Update account status explicitly (enable, disable, archive)
router.put('/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['active', 'disabled', 'archived'].includes(status)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid user status.' });
  }

  try {
    const user = await usersService.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    // Enforce dynamic status permissions checking
    let requiredPerm = 'users.update';
    if (status === 'disabled') requiredPerm = 'users.disable';
    if (status === 'archived') requiredPerm = 'users.archive';

    // We can evaluate permissions check programmatically inside the route handler
    const currentUserPermissions = await usersService.getUserPermissions(req.session.user.id);
    const superAdminCheck = await usersService.getUserRoles(req.session.user.id);
    const isSuperAdmin = superAdminCheck.map(r => r.name).includes('super_admin');

    if (!currentUserPermissions.includes(requiredPerm) && !isSuperAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. You do not have the required permission: '${requiredPerm}' to perform this status update.`
      });
    }

    // Update status
    await usersService.updateStatus(id, status);
    
    // Explicitly audit log the status change
    const auditService = require('../audit/auditService');
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditService.log({
      userId: req.session.user.id,
      action: status === 'archived' ? 'archive_user' : (status === 'disabled' ? 'disable_user' : 'enable_user'),
      targetType: 'users',
      targetId: id,
      details: { status },
      ipAddress
    });

    res.status(200).json({
      success: true,
      message: `User account status updated to '${status}' successfully.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});
// 7. DELETE /api/users/:id - Soft-delete/Archive user
router.delete('/:id', requireAuth, checkPermission('users.archive'), auditLog('archive_user', 'users'), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await usersService.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    await usersService.updateStatus(id, 'archived');
    res.status(200).json({
      success: true,
      message: 'User archived successfully (soft deleted).'
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;

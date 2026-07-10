const bcrypt = require('bcrypt');
const dbHelper = require('../index');

async function seed() {
  const isTest = process.env.NODE_ENV === 'test';
  console.log(`--- Seeding Database (Mode: ${isTest ? 'TEST' : 'PRODUCTION FRESH'}) ---`);

  // 1. Seed Permissions
  const permissionsList = [
    'users.view', 'users.create', 'users.update', 'users.disable', 'users.archive',
    'roles.manage', 'permissions.manage',
    'authors.view', 'authors.create', 'authors.update',
    'products.view', 'products.create', 'products.update', 'products.delete',
    'product_prices.view', 'product_prices.update',
    'outlet_types.view', 'outlet_types.manage',
    'outlets.view', 'outlets.create', 'outlets.update', 'outlets.disable',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.cancel', 'invoices.export',
    'invoices.pay', 'invoices.ship', 'invoices.return',
    'payments.view', 'payments.create', 'payments.reverse', 'payments.receipt.view', 'payments.receipt.upload',
    'inventory.view', 'inventory.receipts.create', 'inventory.adjustments.create',
    'shipments.view', 'shipments.create', 'shipments.update', 'shipments.deliver',
    'returns.view', 'returns.create',
    'reports.view', 'reports.export',
    'exports.run',
    'audit.view', 'settings.update',
    'backup.create', 'backup.restore',
    'finance.view', 'finance.adjust', 'finance.export', 'finance.statement.view',
    'payments.mark_supplied', 'payments.supply_batch',
    'notifications.view', 'notifications.manage'
  ];

  console.log('Seeding permissions...');
  for (const perm of permissionsList) {
    await dbHelper.run(
      'INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)',
      [perm, `Permission to access ${perm}`]
    );
  }

  // 2. Seed Roles
  // Always seed all 9 legacy and core roles expected by the system.
  const rolesList = [
    { name: 'super_admin', desc: 'System Super Administrator' },
    { name: 'admin', desc: 'Administrator' },
    { name: 'accountant', desc: 'Financial Accountant' },
    { name: 'inventory_manager', desc: 'Inventory Manager' },
    { name: 'sales_staff', desc: 'Sales Representative' },
    { name: 'shipping_user', desc: 'Shipping and Logistics User' },
    { name: 'readonly_viewer', desc: 'Read Only Auditor' },
    { name: 'author', desc: 'Book Author View' },
    { name: 'outlet', desc: 'Outlet Partner Account' }
  ];

  console.log('Seeding roles...');
  for (const r of rolesList) {
    await dbHelper.run(
      'INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)',
      [r.name, r.desc]
    );
  }

  // 3. Link super_admin role with all permissions
  console.log('Linking super_admin with all permissions...');
  const permissions = await dbHelper.all('SELECT id, name FROM permissions');
  const superAdminRole = await dbHelper.get('SELECT id FROM roles WHERE name = ?', ['super_admin']);
  
  if (superAdminRole) {
    for (const perm of permissions) {
      await dbHelper.run(
        'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [superAdminRole.id, perm.id]
      );
    }
  }

  // Seed and link permissions for all roles
  if (true) {
    const roles = await dbHelper.all('SELECT id, name FROM roles');
    const permMap = new Map(permissions.map(p => [p.name, p.id]));
    const roleMap = new Map(roles.map(r => [r.name, r.id]));

    const linkPerm = async (roleName, permName) => {
      const roleId = roleMap.get(roleName);
      const permId = permMap.get(permName);
      if (roleId && permId) {
        await dbHelper.run(
          'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [roleId, permId]
        );
      }
    };

    // Admin gets all permissions too
    for (const perm of permissionsList) {
      await linkPerm('admin', perm);
    }

    // Accountant permissions
    const accountantPerms = [
      'invoices.view', 'payments.view', 'payments.create', 'payments.reverse', 'reports.view', 'reports.export',
      'finance.view', 'finance.export', 'finance.statement.view', 'payments.mark_supplied', 'payments.supply_batch'
    ];
    for (const p of accountantPerms) {
      await linkPerm('accountant', p);
    }

    // Sales Staff permissions
    const salesPerms = [
      'products.view', 'outlets.view', 'invoices.view', 'invoices.create', 'invoices.update', 'payments.view', 'payments.create', 'payments.mark_supplied'
    ];
    for (const p of salesPerms) {
      await linkPerm('sales_staff', p);
    }

    // Inventory Manager permissions
    const inventoryPerms = [
      'products.view', 'products.create', 'products.update', 'inventory.view', 'inventory.receipts.create', 'inventory.adjustments.create'
    ];
    for (const p of inventoryPerms) {
      await linkPerm('inventory_manager', p);
    }

    // Author permissions
    const authorPerms = [
      'products.view', 'invoices.view', 'finance.view'
    ];
    for (const p of authorPerms) {
      await linkPerm('author', p);
    }

    // Outlet permissions
    const outletPerms = [
      'invoices.view', 'finance.view', 'finance.statement.view', 'shipments.view'
    ];
    for (const p of outletPerms) {
      await linkPerm('outlet', p);
    }
  }

  // 4. Seed a single active super admin user
  console.log('Seeding super admin user...');
  const adminUsername = process.env.SUPER_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || '912Isk912';

  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const userResult = await dbHelper.run(
    'INSERT OR IGNORE INTO users (username, password_hash, full_name, status) VALUES (?, ?, ?, ?)',
    [adminUsername, hashedPassword, 'System Administrator', 'active']
  );
  
  let userId;
  if (userResult.lastID) {
    userId = userResult.lastID;
  } else {
    const userRow = await dbHelper.get('SELECT id FROM users WHERE username = ?', [adminUsername]);
    if (userRow) userId = userRow.id;
  }
  
  if (userId && superAdminRole) {
    await dbHelper.run(
      'INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, superAdminRole.id]
    );
  }


  console.log(`✓ Seeding completed successfully. Environment setup verified.`);
}

module.exports = seed;

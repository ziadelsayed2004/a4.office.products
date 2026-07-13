import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError } from '../../utils/errors.js';

function normalizeCustomer({ name, phone } = {}) {
  const cleanName = String(name || '').trim();
  const cleanPhone = String(phone || '').trim();
  if (!cleanName) throw new AppError('Customer name is required.', 400, 'CUSTOMER_NAME_REQUIRED');
  if (cleanName.length > 200)
    throw new AppError('Customer name is too long.', 400, 'CUSTOMER_NAME_INVALID');
  if (cleanPhone.length < 5 || cleanPhone.length > 30) {
    throw new AppError('A valid customer phone is required.', 400, 'CUSTOMER_PHONE_INVALID');
  }
  return { name: cleanName, phone: cleanPhone };
}

export async function searchCustomers(queryStr = '', connection = db) {
  let query = `SELECT c.*,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
    (SELECT COUNT(*) FROM preorders p WHERE p.customer_id = c.id) AS preorder_count
    FROM customers c WHERE 1=1`;
  const params = [];
  const search = String(queryStr || '').trim();
  if (search) {
    const value = `%${search}%`;
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(value, value);
  }
  query += ' ORDER BY c.name ASC LIMIT 50;';
  return (await connection.all(query, params)).map(decorateCustomerDependencies);
}

function decorateCustomerDependencies(customer) {
  const { order_count: orderCount = 0, preorder_count: preorderCount = 0, ...data } = customer;
  const dependencyCounts = {
    orders: Number(orderCount),
    preorders: Number(preorderCount),
  };
  return {
    ...data,
    can_delete: Object.values(dependencyCounts).every((count) => count === 0),
    dependency_counts: dependencyCounts,
  };
}

export async function getCustomerById(id, connection = db) {
  const customer = await connection.get(
    `SELECT c.*,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
      (SELECT COUNT(*) FROM preorders p WHERE p.customer_id = c.id) AS preorder_count
     FROM customers c WHERE c.id = ?;`,
    [id]
  );
  return customer ? decorateCustomerDependencies(customer) : null;
}

async function insertCustomer(connection, customer, creatorUserId) {
  const existing = await connection.get('SELECT * FROM customers WHERE name = ? AND phone = ?;', [
    customer.name,
    customer.phone,
  ]);
  if (existing)
    throw new AppError('This customer is already registered.', 409, 'CUSTOMER_CONFLICT');

  let result;
  try {
    result = await connection.run(
      `INSERT INTO customers (name, phone, created_at, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [customer.name, customer.phone]
    );
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      throw new AppError('This customer is already registered.', 409, 'CUSTOMER_CONFLICT');
    }
    throw error;
  }

  await writeAuditLog({
    userId: creatorUserId,
    actionType: 'CUSTOMER_CREATE',
    entityType: 'customers',
    entityId: result.lastID,
    afterValues: customer,
    notes: `Customer registered: ${customer.name}`,
    connection,
  });
  return { id: result.lastID, ...customer };
}

export async function createCustomer(input, creatorUserId) {
  const customer = normalizeCustomer(input);
  return withTransaction((connection) => insertCustomer(connection, customer, creatorUserId));
}

export async function findOrCreateCustomer(input, creatorUserId) {
  const customer = normalizeCustomer(input);
  return withTransaction(async (connection) => {
    const existing = await connection.get('SELECT * FROM customers WHERE name = ? AND phone = ?;', [
      customer.name,
      customer.phone,
    ]);
    return existing || insertCustomer(connection, customer, creatorUserId);
  });
}

export async function updateCustomer(id, input, adminUserId) {
  return withTransaction(async (connection) => {
    const old = await getCustomerById(id, connection);
    if (!old) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    const customer = normalizeCustomer({
      name: input.name === undefined ? old.name : input.name,
      phone: input.phone === undefined ? old.phone : input.phone,
    });
    const conflict = await connection.get(
      'SELECT id FROM customers WHERE name = ? AND phone = ? AND id != ?;',
      [customer.name, customer.phone, id]
    );
    if (conflict)
      throw new AppError('This customer is already registered.', 409, 'CUSTOMER_CONFLICT');

    try {
      await connection.run(
        `UPDATE customers SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
        [customer.name, customer.phone, id]
      );
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new AppError('This customer is already registered.', 409, 'CUSTOMER_CONFLICT');
      }
      throw error;
    }

    const updated = await getCustomerById(id, connection);
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'CUSTOMER_UPDATE',
      entityType: 'customers',
      entityId: Number(id),
      beforeValues: old,
      afterValues: updated,
      notes: `Customer ${id} updated`,
      connection,
    });
    return updated;
  });
}

export async function deleteCustomer(id, adminUserId) {
  return withTransaction(async (connection) => {
    const customer = await getCustomerById(id, connection);
    if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    if (!customer.can_delete) {
      throw new AppError(
        'Customer has invoice or preorder history and cannot be deleted.',
        409,
        'CUSTOMER_IN_USE',
        customer.dependency_counts
      );
    }

    const result = await connection.run('DELETE FROM customers WHERE id = ?;', [id]);
    if (result.changes !== 1) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'CUSTOMER_DELETE',
      entityType: 'customers',
      entityId: Number(id),
      beforeValues: customer,
      afterValues: { id: Number(id), deleted: true },
      notes: `Unused customer deleted: ${customer.name}`,
      connection,
    });
    return { id: Number(id) };
  });
}

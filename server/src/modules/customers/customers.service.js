import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

/**
 * Search customers by fuzzy name or phone match.
 */
export async function searchCustomers(queryStr = '') {
  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];

  if (queryStr && queryStr.trim().length > 0) {
    const searchVal = `%${queryStr.trim()}%`;
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(searchVal, searchVal);
  }

  query += ' ORDER BY name ASC LIMIT 50;';
  return await db.all(query, params);
}

/**
 * Register a new customer. Enforces mandatory name and phone.
 */
export async function createCustomer({ name, phone }, creatorUserId) {
  if (!name || name.trim().length === 0) {
    throw new Error('اسم العميل إلزامي.');
  }
  if (!phone || phone.trim().length === 0) {
    throw new Error('رقم الهاتف إلزامي.');
  }

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();

  // Validate phone format (minimal length check, digits-only or similar)
  if (trimmedPhone.length < 5) {
    throw new Error('رقم الهاتف غير صالح.');
  }

  await db.run('BEGIN TRANSACTION;');
  try {
    // Check if duplicate name + phone exists
    const existing = await db.get(
      'SELECT * FROM customers WHERE name = ? AND phone = ?;',
      [trimmedName, trimmedPhone]
    );

    if (existing) {
      throw new Error('هذا العميل (الاسم ورقم الهاتف) مسجل بالفعل.');
    }

    const result = await db.run(
      `INSERT INTO customers (name, phone, created_at, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [trimmedName, trimmedPhone]
    );

    const newId = result.lastID;

    await writeAuditLog({
      userId: creatorUserId,
      actionType: 'CUSTOMER_CREATE',
      entityType: 'customers',
      entityId: newId,
      notes: `تم تسجيل عميل جديد: ${trimmedName} (هاتف: ${trimmedPhone})`
    });

    await db.run('COMMIT;');

    return {
      id: newId,
      name: trimmedName,
      phone: trimmedPhone
    };
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Helper to look up or create a customer on the fly (useful during preorders).
 */
export async function findOrCreateCustomer({ name, phone }, creatorUserId) {
  if (!name || name.trim().length === 0) {
    throw new Error('اسم العميل إلزامي.');
  }
  if (!phone || phone.trim().length === 0) {
    throw new Error('رقم الهاتف إلزامي.');
  }

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();

  const existing = await db.get(
    'SELECT * FROM customers WHERE name = ? AND phone = ?;',
    [trimmedName, trimmedPhone]
  );

  if (existing) {
    return existing;
  }

  return await createCustomer({ name: trimmedName, phone: trimmedPhone }, creatorUserId);
}

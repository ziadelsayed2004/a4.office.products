import crypto from 'node:crypto';
import { normalizeCustomerPhone } from '../../utils/customerPhone.js';

export const version = '009';
export const name = 'customer_phone_identity';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-18-v1`)
  .digest('hex');

export async function up(db) {
  const customers = await db.all('SELECT id, phone FROM customers ORDER BY id;');
  const owners = new Map();
  const normalizedRows = customers.map((customer) => {
    const phone = normalizeCustomerPhone(customer.phone);
    if (phone.length < 5 || phone.length > 30) {
      throw new Error(`CUSTOMER_PHONE_MIGRATION_INVALID:${customer.id}`);
    }
    const existingId = owners.get(phone);
    if (existingId) {
      throw new Error(`CUSTOMER_PHONE_MIGRATION_DUPLICATE:${phone}:${existingId},${customer.id}`);
    }
    owners.set(phone, customer.id);
    return { id: customer.id, phone };
  });

  for (const customer of normalizedRows) {
    await db.run('UPDATE customers SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;', [
      customer.phone,
      customer.id,
    ]);
  }

  await db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique ON customers(phone);'
  );
}

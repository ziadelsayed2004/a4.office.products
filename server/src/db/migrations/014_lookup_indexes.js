import crypto from 'node:crypto';

export const version = '014';
export const name = 'lookup_indexes';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-08-08-v1`)
  .digest('hex');

export async function up(db) {
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_preorders_customer_phone_lookup
      ON preorders(customer_phone_snapshot, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_preorders_customer_status_lookup
      ON preorders(customer_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_lookup
      ON orders(customer_phone_snapshot, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_lookup
      ON orders(customer_id, created_at DESC);
  `);
}

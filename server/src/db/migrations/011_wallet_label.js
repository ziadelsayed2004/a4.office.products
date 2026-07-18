import crypto from 'node:crypto';

export const version = '011';
export const name = 'wallet_label';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-18-v1`)
  .digest('hex');

export async function up(db) {
  await db.run("UPDATE payment_methods SET name_ar = 'محفظة' WHERE code = 'Wallet';");
}

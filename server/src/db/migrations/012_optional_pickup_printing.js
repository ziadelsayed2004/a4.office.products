import crypto from 'node:crypto';

export const version = '012';
export const name = 'optional_pickup_printing';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-24-v1`)
  .digest('hex');

export async function up(db) {
  await db.run(
    `INSERT INTO printer_settings (key, value)
     VALUES ('auto_print_preorder_pickup', 'false')
     ON CONFLICT(key) DO UPDATE SET value = 'false';`
  );
}

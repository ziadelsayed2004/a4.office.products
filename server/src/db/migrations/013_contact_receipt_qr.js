import crypto from 'node:crypto';

export const version = '013';
export const name = 'contact_receipt_qr';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-25-v1`)
  .digest('hex');

export async function up(db) {
  await db.run(
    `INSERT INTO printer_settings (key, value)
     VALUES ('print_show_contact_qr', 'false')
     ON CONFLICT(key) DO NOTHING;`
  );
  await db.run(
    `INSERT INTO printer_settings (key, value)
     VALUES ('contact_qr_url', '')
     ON CONFLICT(key) DO NOTHING;`
  );
}

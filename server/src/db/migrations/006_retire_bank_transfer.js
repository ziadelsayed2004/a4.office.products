import crypto from 'node:crypto';

export const version = '006';
export const name = 'retire_bank_transfer';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-15-v1`)
  .digest('hex');

/**
 * Keep the legacy row for financial history and shift snapshots, but prevent
 * bank transfer from being selected or configured for any new transaction.
 */
export async function up(db) {
  await db.exec(`
    UPDATE payment_methods
       SET is_active = 0,
           is_system = 0,
           refund_mode = 'DISABLED',
           updated_at = CURRENT_TIMESTAMP
     WHERE code = 'Transfer';

    UPDATE business_settings
       SET value = CASE
         WHEN json_valid(value) THEN (
           SELECT json_group_array(item.value)
             FROM json_each(business_settings.value) AS item
            WHERE item.value <> 'Transfer'
         )
         ELSE '["Cash","Card","InstaPay","Wallet"]'
       END
     WHERE key = 'active_payment_methods';
  `);
}

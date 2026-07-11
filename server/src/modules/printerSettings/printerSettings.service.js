import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

const DEFAULT_SETTINGS = {
  receipt_printer_type: 'simulation',
  receipt_printer_address: '',
  receipt_printer_width: '80mm',
  receipt_printer_header: 'مكتبة A4 للأدوات المكتبية',
  receipt_printer_footer: 'شكراً لتعاملكم معنا!',
  qr_printer_type: 'simulation',
  qr_printer_address: '',
  qr_printer_width: '50',
  qr_printer_height: '25',
  print_show_customer: 'true',
  print_show_price_tier: 'true',
  print_show_qr: 'true',
  qr_label_count: '1',
  qr_label_margin: '2',
  qr_label_spacing: '2'
};

/**
 * Get all printer settings, merging defaults for any missing keys.
 */
export async function getPrinterSettings() {
  const rows = await db.all('SELECT key, value FROM printer_settings;');
  const settings = { ...DEFAULT_SETTINGS };
  
  if (rows && rows.length > 0) {
    for (const row of rows) {
      settings[row.key] = row.value;
    }
  }
  
  return settings;
}

/**
 * Save printer settings (Admin only).
 */
export async function updatePrinterSettings(settingsMap, adminUserId) {
  if (typeof settingsMap !== 'object' || settingsMap === null) {
    throw new Error('يجب توفير الإعدادات ككائن صالح.');
  }

  // Get before values for audit log
  const beforeSettings = await getPrinterSettings();

  await db.run('BEGIN TRANSACTION;');
  try {
    for (const [key, value] of Object.entries(settingsMap)) {
      // Basic key validation
      if (!Object.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
        continue;
      }
      
      const valStr = String(value);
      await db.run(
        `INSERT INTO printer_settings (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`,
        [key, valStr]
      );
    }

    const afterSettings = await getPrinterSettings();

    await writeAuditLog({
      userId: adminUserId,
      actionType: 'SETTINGS_UPDATE',
      entityType: 'printer_settings',
      entityId: 0,
      beforeValues: beforeSettings,
      afterValues: afterSettings,
      notes: 'تم تحديث إعدادات الطباعة وقوالب الفواتير والملصقات بنجاح.'
    });

    await db.run('COMMIT;');
    return afterSettings;
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

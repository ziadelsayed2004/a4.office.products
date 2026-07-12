import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

const DEFAULT_SETTINGS = {
  print_mode: 'browser',
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
  receipt_copies: '1',
  auto_print_sale: 'true',
  auto_print_preorder_deposit: 'true',
  auto_print_preorder_pickup: 'true',
  qr_label_count: '1',
  qr_label_margin: '2',
  qr_label_spacing: '2'
};

const SAFE_SETTING_KEYS = [
  'print_mode', 'receipt_printer_width', 'receipt_printer_header',
  'receipt_printer_footer', 'receipt_copies', 'auto_print_sale',
  'auto_print_preorder_deposit', 'auto_print_preorder_pickup',
  'print_show_customer', 'print_show_price_tier', 'print_show_qr'
];

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
 * Settings needed by authenticated print clients. Device addresses and legacy
 * transport fields are deliberately excluded.
 */
export async function getSafePrinterSettings() {
  const settings = await getPrinterSettings();
  return Object.fromEntries(SAFE_SETTING_KEYS.map((key) => [key, settings[key]]));
}

/**
 * Save printer settings (Admin only).
 */
export async function updatePrinterSettings(settingsMap, adminUserId) {
  if (typeof settingsMap !== 'object' || settingsMap === null) {
    throw new Error('يجب توفير الإعدادات ككائن صالح.');
  }

  if (settingsMap.print_mode !== undefined && !['browser', 'kiosk'].includes(settingsMap.print_mode)) {
    throw new Error('print_mode must be browser or kiosk.');
  }
  if (settingsMap.receipt_printer_width !== undefined && !['58', '58mm', '80', '80mm'].includes(String(settingsMap.receipt_printer_width))) {
    throw new Error('Receipt width must be 58mm or 80mm.');
  }
  if (settingsMap.receipt_copies !== undefined) {
    const copies = Number(settingsMap.receipt_copies);
    if (!Number.isInteger(copies) || copies < 1 || copies > 20) throw new Error('Receipt copies must be from 1 to 20.');
  }

  return withTransaction(async (connection) => {
    const rows = await connection.all('SELECT key, value FROM printer_settings;');
    const beforeSettings = { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
    for (const [key, value] of Object.entries(settingsMap)) {
      // Basic key validation
      if (!Object.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
        continue;
      }
      
      const valStr = String(value);
      await connection.run(
        `INSERT INTO printer_settings (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`,
        [key, valStr]
      );
    }

    const afterRows = await connection.all('SELECT key, value FROM printer_settings;');
    const afterSettings = { ...DEFAULT_SETTINGS, ...Object.fromEntries(afterRows.map((row) => [row.key, row.value])) };

    await writeAuditLog({
      userId: adminUserId,
      actionType: 'SETTINGS_UPDATE',
      entityType: 'printer_settings',
      entityId: 0,
      beforeValues: beforeSettings,
      afterValues: afterSettings,
      notes: 'تم تحديث إعدادات الطباعة وقوالب الفواتير والملصقات بنجاح.',
      connection
    });
    return afterSettings;
  });
}

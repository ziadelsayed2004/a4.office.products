import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError } from '../../utils/errors.js';

const DEFAULT_SETTINGS = Object.freeze({
  print_mode: 'browser',
  receipt_printer_width: '80mm',
  receipt_printer_header: 'مكتبة A4 فرع السويس',
  receipt_printer_footer: 'شكراً لتعاملكم معنا',
  print_show_customer: 'true',
  print_show_price_tier: 'true',
  print_show_qr: 'true',
  receipt_copies: '1',
  auto_print_sale: 'true',
  auto_print_preorder_deposit: 'true',
  auto_print_preorder_pickup: 'true',
  qr_printer_width: '50',
  qr_printer_height: '25',
  qr_label_count: '1',
});

const SAFE_SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS));
const BOOLEAN_KEYS = new Set([
  'print_show_customer',
  'print_show_price_tier',
  'print_show_qr',
  'auto_print_sale',
  'auto_print_preorder_deposit',
  'auto_print_preorder_pickup',
]);
const LABEL_SIZES = new Set(['38x25', '50x25', '80x50']);

function supportedSettings(rows) {
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const settings = Object.fromEntries(
    SAFE_SETTING_KEYS.map((key) => [key, stored[key] ?? DEFAULT_SETTINGS[key]])
  );
  // Direct/kiosk modes are legacy values only. Browser Print is the sole
  // supported effective mode even before an Admin saves the settings again.
  settings.print_mode = 'browser';
  return settings;
}

export async function getPrinterSettings(connection = db) {
  return supportedSettings(await connection.all('SELECT key, value FROM printer_settings;'));
}

export async function getSafePrinterSettings(connection = db) {
  return getPrinterSettings(connection);
}

function normalizeSettings(settingsMap, current) {
  if (!settingsMap || typeof settingsMap !== 'object' || Array.isArray(settingsMap)) {
    throw new AppError('Printer settings must be an object.', 400, 'INVALID_PRINTER_SETTINGS');
  }
  const normalized = {};
  for (const key of SAFE_SETTING_KEYS) {
    if (settingsMap[key] === undefined) continue;
    normalized[key] = String(settingsMap[key]).trim();
  }
  if (normalized.print_mode !== undefined && normalized.print_mode !== 'browser') {
    throw new AppError('Only browser print mode is supported.', 400, 'UNSUPPORTED_PRINT_MODE');
  }
  if (normalized.receipt_printer_width !== undefined) {
    const width = normalized.receipt_printer_width.replace(/mm$/i, '');
    if (!['58', '80'].includes(width)) {
      throw new AppError('Receipt width must be 58mm or 80mm.', 400, 'INVALID_RECEIPT_WIDTH');
    }
    normalized.receipt_printer_width = `${width}mm`;
  }
  for (const key of BOOLEAN_KEYS) {
    if (normalized[key] !== undefined && !['true', 'false'].includes(normalized[key])) {
      throw new AppError(`${key} must be true or false.`, 400, 'INVALID_PRINT_BOOLEAN');
    }
  }
  for (const key of ['receipt_printer_header', 'receipt_printer_footer']) {
    if (normalized[key] !== undefined && normalized[key].length > 300) {
      throw new AppError(`${key} cannot exceed 300 characters.`, 400, 'INVALID_PRINT_TEXT');
    }
  }
  if (normalized.receipt_copies !== undefined) {
    const copies = Number(normalized.receipt_copies);
    if (!Number.isInteger(copies) || copies < 1 || copies > 20) {
      throw new AppError('Receipt copies must be from 1 to 20.', 400, 'INVALID_RECEIPT_COPIES');
    }
    normalized.receipt_copies = String(copies);
  }
  if (normalized.qr_label_count !== undefined) {
    const count = Number(normalized.qr_label_count);
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      throw new AppError('Label count must be from 1 to 500.', 400, 'INVALID_LABEL_COUNT');
    }
    normalized.qr_label_count = String(count);
  }
  const labelWidth = normalized.qr_printer_width ?? current.qr_printer_width;
  const labelHeight = normalized.qr_printer_height ?? current.qr_printer_height;
  if (!LABEL_SIZES.has(`${labelWidth}x${labelHeight}`)) {
    throw new AppError(
      'Label size must be 38x25, 50x25, or 80x50 millimeters.',
      400,
      'INVALID_LABEL_SIZE'
    );
  }
  normalized.qr_printer_width = String(Number(labelWidth));
  normalized.qr_printer_height = String(Number(labelHeight));
  return normalized;
}

export async function updatePrinterSettings(settingsMap, adminUserId) {
  return withTransaction(async (connection) => {
    const beforeSettings = await getPrinterSettings(connection);
    const normalized = normalizeSettings(settingsMap, beforeSettings);
    // Any supported update also repairs a legacy stored mode without touching
    // the retained, inactive printer type/address keys.
    normalized.print_mode = 'browser';
    for (const [key, value] of Object.entries(normalized)) {
      await connection.run(
        `INSERT INTO printer_settings (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`,
        [key, value]
      );
    }
    const afterSettings = await getPrinterSettings(connection);
    if (Object.keys(normalized).length > 0) {
      await writeAuditLog({
        userId: adminUserId,
        actionType: 'SETTINGS_UPDATE',
        entityType: 'printer_settings',
        entityId: 0,
        beforeValues: beforeSettings,
        afterValues: afterSettings,
        notes: 'Browser print settings updated.',
        connection,
      });
    }
    return afterSettings;
  });
}

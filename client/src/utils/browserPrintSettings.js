const BOOLEAN_KEYS = [
  'auto_print_sale',
  'auto_print_preorder_deposit',
  'auto_print_preorder_pickup',
  'print_show_customer',
  'print_show_price_tier',
  'print_show_qr',
];

export const PRINTER_SETTINGS_UNAVAILABLE_MESSAGE =
  'تعذر تحميل إعدادات الطباعة الآمنة. أعد المحاولة أو تواصل مع مسؤول النظام.';

export const FAIL_CLOSED_BROWSER_PRINT_SETTINGS = Object.freeze({
  print_mode: 'browser',
  receipt_printer_width: '80mm',
  receipt_copies: '1',
  receipt_printer_header: '',
  receipt_printer_footer: '',
  auto_print_sale: 'false',
  auto_print_preorder_deposit: 'false',
  auto_print_preorder_pickup: 'false',
  print_show_customer: 'false',
  print_show_price_tier: 'false',
  print_show_qr: 'false',
  qr_printer_width: '50',
  qr_printer_height: '25',
  qr_label_count: '1',
});

function boundedInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10);
  return String(Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback);
}

function safeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeBrowserPrintSettings(settings) {
  const value =
    settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  const normalized = {
    ...FAIL_CLOSED_BROWSER_PRINT_SETTINGS,
    receipt_printer_width: String(value.receipt_printer_width).startsWith('58') ? '58mm' : '80mm',
    receipt_copies: boundedInteger(value.receipt_copies, 1, 20, 1),
    receipt_printer_header: safeText(value.receipt_printer_header),
    receipt_printer_footer: safeText(value.receipt_printer_footer),
    qr_label_count: boundedInteger(value.qr_label_count, 1, 500, 1),
  };

  for (const key of BOOLEAN_KEYS) {
    normalized[key] = value[key] === true || value[key] === 'true' ? 'true' : 'false';
  }

  const dimensions = `${Number.parseInt(value.qr_printer_width, 10)}x${Number.parseInt(
    value.qr_printer_height,
    10
  )}`;
  const [width, height] = ['38x25', '50x25', '80x50'].includes(dimensions)
    ? dimensions.split('x')
    : ['50', '25'];
  normalized.qr_printer_width = width;
  normalized.qr_printer_height = height;
  return normalized;
}

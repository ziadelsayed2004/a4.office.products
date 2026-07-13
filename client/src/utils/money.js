/** Parse a decimal EGP input without binary floating-point rounding. */
export function parsePiasters(value, { allowEmpty = false } = {}) {
  const text = String(value ?? '').trim();
  if (allowEmpty && text === '') return null;
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text)) {
    throw new Error('اكتب المبلغ بالجنيه وبحد أقصى رقمين بعد العلامة العشرية.');
  }
  const [pounds, fraction = ''] = text.split('.');
  const amount = Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new Error('المبلغ أكبر من الحد المسموح.');
  return amount;
}

export function piastersToInput(value) {
  const amount = Number(value || 0);
  return `${Math.trunc(amount / 100)}.${String(Math.abs(amount % 100)).padStart(2, '0')}`;
}

export function createIdempotencyKey(prefix = 'pos') {
  const random =
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_ZERO = 0x06f0;

export function normalizeCustomerPhone(value) {
  return String(value ?? '')
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - EASTERN_ARABIC_ZERO))
    .replace(/\D/g, '');
}

export function isValidCustomerPhone(value) {
  const phone = normalizeCustomerPhone(value);
  return phone.length >= 5 && phone.length <= 30;
}

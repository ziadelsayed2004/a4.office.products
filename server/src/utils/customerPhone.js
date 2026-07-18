const ARABIC_INDIC_ZERO = '٠'.charCodeAt(0);
const EASTERN_ARABIC_ZERO = '۰'.charCodeAt(0);

export function normalizeCustomerPhone(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - EASTERN_ARABIC_ZERO))
    .replace(/\D/g, '');
}

export function isValidCustomerPhone(value) {
  const phone = normalizeCustomerPhone(value);
  return phone.length >= 5 && phone.length <= 30;
}

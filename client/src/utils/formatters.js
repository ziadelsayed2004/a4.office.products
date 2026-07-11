export const money = (minor = 0) => `${(Number(minor || 0) / 100).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
export const number = (value = 0) => Number(value || 0).toLocaleString('ar-EG');
export const dateTime = (value) => value ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(value)) : '—';
export const dateOnly = (value) => value ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(new Date(value)) : '—';
export const ltr = (value) => value || '—';
export const statusLabel = (status) => ({
  OPEN: 'مفتوحة', PENDING_ADMIN_REVIEW: 'بانتظار المراجعة', CLOSED: 'مغلقة',
  DEPOSIT_PAID_WAITING_STOCK: 'بانتظار المخزون', READY_FOR_PICKUP: 'جاهز للاستلام', PICKED_UP: 'تم الاستلام', CANCELLED: 'ملغي', EXPIRED: 'منتهي', DRAFT: 'مسودة'
}[status] || status || '—');

import { api } from './apiClient.js';

export const ADMIN_NOTIFICATIONS_CHANGED_EVENT = 'a4:admin-notifications-changed';

export function emitAdminNotificationsChanged() {
  globalThis.dispatchEvent?.(new Event(ADMIN_NOTIFICATIONS_CHANGED_EVENT));
}

export async function getAdminNotifications({ limit = 20, offset = 0, unreadOnly = false } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (unreadOnly) query.set('unreadOnly', 'true');
  return (await api.get(`/api/admin/notifications?${query}`)).data || {};
}

export async function markAdminNotificationRead(id) {
  const response = await api.patch(`/api/admin/notifications/${encodeURIComponent(id)}/read`, {});
  emitAdminNotificationsChanged();
  return response.data;
}

export async function markAllAdminNotificationsRead() {
  const response = await api.post('/api/admin/notifications/read-all', {});
  emitAdminNotificationsChanged();
  return response.data;
}

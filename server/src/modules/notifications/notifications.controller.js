import * as notificationsService from './notifications.service.js';

export async function listNotifications(req, res, next) {
  try {
    const data = await notificationsService.listAdminNotifications(req.user.id, req.query);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const found = await notificationsService.markAdminNotificationRead(req.user.id, req.params.id);
    if (!found) {
      return res.status(404).json({ error: 'الإشعار غير موجود.', code: 'NOTIFICATION_NOT_FOUND' });
    }
    return res.status(200).json({ status: 'success', data: { id: req.params.id, read: true } });
  } catch (error) {
    return next(error);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    const updated = await notificationsService.markAllAdminNotificationsRead(req.user.id);
    return res.status(200).json({ status: 'success', data: { updated } });
  } catch (error) {
    return next(error);
  }
}

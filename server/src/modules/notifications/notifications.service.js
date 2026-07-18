import db from '../../db/index.js';
import { requireInteger } from '../../utils/financial.js';

const AUDIT_NOTIFICATION_DEFINITIONS = Object.freeze({
  SHIFT_CLOSE_REQUEST: ({ shiftId }) => ({
    type: 'SHIFT_REVIEW',
    severity: 'WARNING',
    title: 'طلب مراجعة شيفت',
    message: `تم إرسال الشيفت #${shiftId} للمراجعة والاعتماد.`,
    actionPath: '/shifts',
  }),
  PREORDER_CREATE: ({ entityId, afterValues }) => ({
    type: 'PREORDER_CREATED',
    severity: 'INFO',
    title: 'حجز مسبق جديد',
    message: `تم إنشاء الحجز ${afterValues?.preorderNumber || `#${entityId}`}.`,
    actionPath: '/preorders',
  }),
  PREORDER_PICKUP: ({ entityId, afterValues }) => ({
    type: 'PREORDER_PICKED_UP',
    severity: 'SUCCESS',
    title: 'تم تسليم حجز مسبق',
    message: `تم تسليم الحجز #${entityId}${afterValues?.invoiceNumber ? ` وإصدار ${afterValues.invoiceNumber}` : ''}.`,
    actionPath: '/preorders',
  }),
  ORDER_REFUND_APPROVAL_CARD: ({ entityId, afterValues }) => ({
    type: 'RETURN_COMPLETED',
    severity: 'WARNING',
    title: 'عملية مرتجع جديدة',
    message: `تم تنفيذ المرتجع ${afterValues?.returnNumber || `#${entityId}`}${afterValues?.invoiceNumber ? ` للفاتورة ${afterValues.invoiceNumber}` : ''}.`,
    actionPath: '/returns',
  }),
});

function pagination(filters = {}) {
  return {
    limit: requireInteger(Number(filters.limit ?? 20), 'limit', { min: 1, max: 100 }),
    offset: requireInteger(Number(filters.offset ?? 0), 'offset', { min: 0 }),
  };
}

export async function createAdminNotificationFromAudit(
  { auditLogId, userId, shiftId = null, actionType, entityId = null, afterValues = null },
  connection = db
) {
  const definition = AUDIT_NOTIFICATION_DEFINITIONS[actionType];
  if (!definition) return null;

  const actor = await connection.get('SELECT role FROM users WHERE id = ?;', [userId]);
  if (actor?.role !== 'Cashier') return null;

  const notification = definition({ shiftId, entityId, afterValues });
  const result = await connection.run(
    `INSERT OR IGNORE INTO notifications (
       type, severity, title, message, action_path, actor_user_id, source_type, source_id
     ) VALUES (?, ?, ?, ?, ?, ?, 'audit_log', ?);`,
    [
      notification.type,
      notification.severity,
      notification.title,
      notification.message,
      notification.actionPath,
      userId,
      auditLogId,
    ]
  );
  return result.lastID || null;
}

function filtersSql(filters, userId) {
  const clauses = [];
  const params = [userId];
  if (filters.unreadOnly === true || filters.unreadOnly === 'true') {
    clauses.push('nr.notification_id IS NULL');
  }
  if (filters.type) {
    clauses.push('n.type = ?');
    params.push(filters.type);
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export async function listAdminNotifications(userId, filters = {}, connection = db) {
  const page = pagination(filters);
  const filtered = filtersSql(filters, userId);
  const rows = await connection.all(
    `SELECT n.*, u.name AS actor_name,
            CASE WHEN nr.notification_id IS NULL THEN 0 ELSE 1 END AS is_read,
            nr.read_at
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_user_id
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.user_id = ?
       ${filtered.where}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ? OFFSET ?;`,
    [...filtered.params, page.limit, page.offset]
  );
  const [{ count: total = 0 } = {}, { count: unreadCount = 0 } = {}] = await Promise.all([
    connection.get(
      `SELECT COUNT(*) AS count
         FROM notifications n
         LEFT JOIN notification_reads nr
           ON nr.notification_id = n.id AND nr.user_id = ?
         ${filtered.where};`,
      filtered.params
    ),
    connection.get(
      `SELECT COUNT(*) AS count
         FROM notifications n
         LEFT JOIN notification_reads nr
           ON nr.notification_id = n.id AND nr.user_id = ?
        WHERE nr.notification_id IS NULL;`,
      [userId]
    ),
  ]);

  return {
    notifications: rows.map((row) => ({ ...row, is_read: row.is_read === 1 })),
    unreadCount: Number(unreadCount),
    pagination: { total: Number(total), limit: page.limit, offset: page.offset },
  };
}

export async function markAdminNotificationRead(userId, notificationId, connection = db) {
  const id = requireInteger(Number(notificationId), 'notificationId', { min: 1 });
  const exists = await connection.get('SELECT 1 FROM notifications WHERE id = ?;', [id]);
  if (!exists) return false;
  await connection.run(
    `INSERT INTO notification_reads (notification_id, user_id)
     VALUES (?, ?) ON CONFLICT(notification_id, user_id) DO NOTHING;`,
    [id, userId]
  );
  return true;
}

export async function markAllAdminNotificationsRead(userId, connection = db) {
  const result = await connection.run(
    `INSERT INTO notification_reads (notification_id, user_id)
     SELECT n.id, ? FROM notifications n
      WHERE NOT EXISTS (
        SELECT 1 FROM notification_reads nr
         WHERE nr.notification_id = n.id AND nr.user_id = ?
      );`,
    [userId, userId]
  );
  return Number(result.changes || 0);
}

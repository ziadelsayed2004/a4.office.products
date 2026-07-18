import db from '../db/index.js';
import { createAdminNotificationFromAudit } from '../modules/notifications/notifications.service.js';

/**
 * Log a financial, user-management, shift, or printing operation to the Audit Ledger.
 */
export async function writeAuditLog({
  userId,
  shiftId = null,
  actionType,
  entityType = null,
  entityId = null,
  beforeValues = null,
  afterValues = null,
  notes = null,
  connection = db,
}) {
  const beforeStr = beforeValues === null ? null : JSON.stringify(beforeValues);
  const afterStr = afterValues === null ? null : JSON.stringify(afterValues);

  // Audit writes are part of the financial transaction. Deliberately allow a
  // failure to bubble so the business mutation cannot commit without its trail.
  const result = await connection.run(
    `INSERT INTO audit_logs (
      user_id, shift_id, action_type, entity_type, entity_id, before_values, after_values, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [userId, shiftId, actionType, entityType, entityId, beforeStr, afterStr, notes]
  );

  await createAdminNotificationFromAudit(
    {
      auditLogId: result.lastID,
      userId,
      shiftId,
      actionType,
      entityId,
      afterValues,
    },
    connection
  );

  console.log(`[AUDIT LOG] Action: ${actionType} | User: ${userId}`);
}

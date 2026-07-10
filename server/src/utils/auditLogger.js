import db from '../db/index.js';

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
  notes = null
}) {
  try {
    const beforeStr = beforeValues ? JSON.stringify(beforeValues) : null;
    const afterStr = afterValues ? JSON.stringify(afterValues) : null;

    await db.run(
      `INSERT INTO audit_logs (
        user_id, shift_id, action_type, entity_type, entity_id, before_values, after_values, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [userId, shiftId, actionType, entityType, entityId, beforeStr, afterStr, notes]
    );

    console.log(`[AUDIT LOG] Action: ${actionType} | User: ${userId} | Notes: ${notes}`);
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
  }
}

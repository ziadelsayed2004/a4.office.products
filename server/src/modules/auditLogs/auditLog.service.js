import db from '../../db/index.js';

/**
 * Retrieve database audit log entries with optional filters and pagination.
 */
export async function getAuditLogs(filters = {}) {
  let query = `
    SELECT al.*, u.username, u.name AS user_name, u.role AS user_role
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  // Filter validations
  if (filters.userId) {
    query += ' AND al.user_id = ?';
    params.push(filters.userId);
  }
  if (filters.shiftId) {
    query += ' AND al.shift_id = ?';
    params.push(filters.shiftId);
  }
  if (filters.actionType) {
    query += ' AND al.action_type = ?';
    params.push(filters.actionType);
  }
  if (filters.entityType) {
    query += ' AND al.entity_type = ?';
    params.push(filters.entityType);
  }
  if (filters.startDate) {
    query += ' AND al.created_at >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += ' AND al.created_at <= ?';
    params.push(filters.endDate);
  }

  query += ' ORDER BY al.created_at DESC';

  // Pagination parameters
  const limit = parseInt(filters.limit || '100', 10);
  const offset = parseInt(filters.offset || '0', 10);
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const logs = await db.all(query, params);

  // Parse before_values and after_values back into JSON objects
  return logs.map((log) => ({
    ...log,
    before_values: log.before_values ? JSON.parse(log.before_values) : null,
    after_values: log.after_values ? JSON.parse(log.after_values) : null
  }));
}

/**
 * Fetch total count of audit logs matching filters for metadata response.
 */
export async function getAuditLogsCount(filters = {}) {
  let query = 'SELECT COUNT(*) AS count FROM audit_logs WHERE 1=1';
  const params = [];

  if (filters.userId) {
    query += ' AND user_id = ?';
    params.push(filters.userId);
  }
  if (filters.shiftId) {
    query += ' AND shift_id = ?';
    params.push(filters.shiftId);
  }
  if (filters.actionType) {
    query += ' AND action_type = ?';
    params.push(filters.actionType);
  }
  if (filters.entityType) {
    query += ' AND entity_type = ?';
    params.push(filters.entityType);
  }
  if (filters.startDate) {
    query += ' AND created_at >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += ' AND created_at <= ?';
    params.push(filters.endDate);
  }

  const result = await db.get(query, params);
  return result ? result.count : 0;
}

import db from '../../db/index.js';
import { requireInteger } from '../../utils/financial.js';
import { addCalendarDay, cairoMidnightUtc } from '../invoices/invoices.service.js';

function page(filters) {
  const limit =
    filters.limit === undefined
      ? 100
      : requireInteger(Number(filters.limit), 'limit', { min: 1, max: 100 });
  const offset =
    filters.offset === undefined ? 0 : requireInteger(Number(filters.offset), 'offset', { min: 0 });
  return { limit, offset };
}

function buildFilters(filters) {
  const clauses = ['1 = 1'];
  const params = [];
  if (filters.userId) {
    clauses.push('al.user_id = ?');
    params.push(requireInteger(Number(filters.userId), 'userId', { min: 1 }));
  }
  if (filters.shiftId) {
    clauses.push('al.shift_id = ?');
    params.push(requireInteger(Number(filters.shiftId), 'shiftId', { min: 1 }));
  }
  if (filters.actionType) {
    clauses.push('al.action_type = ?');
    params.push(filters.actionType);
  }
  if (filters.entityType) {
    clauses.push('al.entity_type = ?');
    params.push(filters.entityType);
  }
  if (filters.startDate) {
    clauses.push('al.created_at >= ?');
    params.push(cairoMidnightUtc(filters.startDate));
  }
  if (filters.endDate) {
    clauses.push('al.created_at < ?');
    params.push(cairoMidnightUtc(addCalendarDay(filters.endDate)));
  }
  return { where: clauses.join(' AND '), params };
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getAuditLogs(filters = {}, connection = db) {
  const pagination = page(filters);
  const { where, params } = buildFilters(filters);
  const logs = await connection.all(
    `SELECT al.*, u.username, u.name AS user_name, u.role AS user_role
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
      WHERE ${where}
      ORDER BY al.created_at DESC, al.id DESC LIMIT ? OFFSET ?;`,
    [...params, pagination.limit, pagination.offset]
  );
  return logs.map((log) => ({
    ...log,
    before_values: parseJson(log.before_values),
    after_values: parseJson(log.after_values),
  }));
}

export async function getAuditLogsCount(filters = {}, connection = db) {
  const { where, params } = buildFilters(filters);
  const result = await connection.get(
    `SELECT COUNT(*) AS count FROM audit_logs al WHERE ${where};`,
    params
  );
  return result?.count || 0;
}

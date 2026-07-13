import * as auditLogService from './auditLog.service.js';

export async function getAuditLogsController(req, res, next) {
  try {
    const filters = req.query;
    const [logs, total] = await Promise.all([
      auditLogService.getAuditLogs(filters),
      auditLogService.getAuditLogsCount(filters),
    ]);
    return res.status(200).json({
      status: 'success',
      data: {
        logs,
        pagination: {
          total,
          limit: filters.limit ?? 100,
          offset: filters.offset ?? 0,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

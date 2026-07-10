import * as auditLogService from './auditLog.service.js';

export async function getAuditLogsController(req, res, next) {
  try {
    const {
      userId,
      shiftId,
      actionType,
      entityType,
      startDate,
      endDate,
      limit,
      offset
    } = req.query;

    const filters = {
      userId,
      shiftId,
      actionType,
      entityType,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0
    };

    const logs = await auditLogService.getAuditLogs(filters);
    const total = await auditLogService.getAuditLogsCount(filters);

    return res.status(200).json({
      status: 'success',
      data: {
        logs,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء تحميل سجل العمليات.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * Application-level error that is safe to expose through the HTTP API.
 */
export class AppError extends Error {
  constructor(message, status = 400, code = 'VALIDATION_ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
    Error.captureStackTrace?.(this, AppError);
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}

export function notFoundHandler(req, res) {
  return res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const exposed = isAppError(error);
  const status = exposed
    ? Number(error.status) || 400
    : error?.type === 'entity.parse.failed'
      ? 400
      : 500;
  const payload = {
    error: exposed
      ? error.message
      : status === 400
        ? 'Request body contains invalid JSON.'
        : 'Internal Server Error',
    code: exposed
      ? error.code || 'REQUEST_FAILED'
      : status === 400
        ? 'INVALID_JSON'
        : 'INTERNAL_SERVER_ERROR',
  };

  if (exposed && error.details !== undefined) payload.details = error.details;
  if (status >= 500) console.error(error?.stack || error);
  return res.status(status).json(payload);
}

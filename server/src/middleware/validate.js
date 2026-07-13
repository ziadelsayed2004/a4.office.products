import { AppError } from '../utils/errors.js';

function validationDetails(error) {
  const issues = error?.issues || error?.errors || [];
  return issues.map((issue) => ({
    field: issue.path?.join('.') || 'request',
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validate and normalize any combination of request body, query, and params
 * with Zod schemas. Parsed values replace the raw Express values so services
 * receive bounded numbers and normalized strings rather than unchecked input.
 */
export function validate(schemas) {
  return (req, res, next) => {
    try {
      for (const location of ['params', 'query', 'body']) {
        const schema = schemas[location];
        if (!schema) continue;
        const result = schema.safeParse(req[location]);
        if (!result.success) {
          throw new AppError(
            'Request validation failed.',
            400,
            'VALIDATION_ERROR',
            validationDetails(result.error).map((issue) => ({
              ...issue,
              field: issue.field === 'request' ? location : `${location}.${issue.field}`,
            }))
          );
        }
        Object.defineProperty(req, location, {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

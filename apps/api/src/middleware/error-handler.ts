import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors';
import { sendError } from '../common/response';
import { mapDbError } from '../db/errors';
import type { Logger } from '../common/logger';

export function createErrorHandler(logger: Logger) {
  // Express 4/5 4-parameter error middleware
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    const requestId = req.id;

    // 1. Direct AppError
    if (err instanceof AppError) {
      if (err.status >= 500) {
        logger.error({ err, requestId }, `AppError ${err.code}: ${err.message}`);
      } else {
        logger.warn({ code: err.code, status: err.status, requestId }, err.message);
      }
      return sendError(res, err.status, err.code, err.message, err.details);
    }

    // 2. Mapped Database Error (PostgreSQL constraint violations, duplicates, foreign keys)
    const dbAppError = mapDbError(err);
    if (dbAppError) {
      logger.warn({ code: dbAppError.code, status: dbAppError.status, requestId }, dbAppError.message);
      return sendError(res, dbAppError.status, dbAppError.code, dbAppError.message, dbAppError.details);
    }

    // 3. Unhandled Unexpected Error
    const message = err instanceof Error ? err.message : 'An unexpected server error occurred';
    logger.error({ err, requestId }, `Unhandled internal error: ${message}`);

    // In non-production, return message for developer convenience; in production keep opaque
    const clientMessage = process.env.NODE_ENV === 'production'
      ? 'An internal error occurred. Please contact your system administrator.'
      : message;

    return sendError(res, 500, 'INTERNAL_ERROR', clientMessage);
  };
}

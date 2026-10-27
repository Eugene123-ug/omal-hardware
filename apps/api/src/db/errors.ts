import { AppError } from '../common/errors';

interface PgLikeError {
  code?: string;
  constraint?: string;
  column?: string;
  table?: string;
}

function isPgError(err: unknown): err is PgLikeError & Error {
  return typeof err === 'object' && err !== null && typeof (err as PgLikeError).code === 'string';
}

/**
 * Translate database failures into controlled, client-safe errors.
 * Raw SQL, values and stack traces are never returned to the client.
 * Returns undefined when the error is not a recognised database error.
 */
export function mapDbError(err: unknown): AppError | undefined {
  if (!isPgError(err)) return undefined;
  const code = err.code as string;

  switch (code) {
    case '23505':
      return new AppError(409, 'DUPLICATE_RECORD', 'A record with the same unique value already exists', {
        constraint: err.constraint,
      });
    case '23503':
      return new AppError(
        409,
        'REFERENCE_VIOLATION',
        'This record is linked to other records, or refers to a record that does not exist',
        { constraint: err.constraint },
      );
    case '23502':
      return new AppError(400, 'CONSTRAINT_VIOLATION', 'A required value is missing', { column: err.column });
    case '23514':
    case '22003':
    case '22001':
      return new AppError(400, 'CONSTRAINT_VIOLATION', 'A value is outside the allowed range or format', {
        constraint: err.constraint,
      });
    case '22P02':
    case '22007':
    case '22008':
      return AppError.badRequest('A value has an invalid format');
    case '40001':
    case '40P01':
      return AppError.conflict('The operation conflicted with another change. Please retry.');
    case '53300':
    case '57P01':
    case '57P03':
    case '08000':
    case '08003':
    case '08006':
      return AppError.unavailable('The database is temporarily unavailable. Please retry shortly.');
    default:
      return undefined;
  }
}

/** Node-level connection failures (database server down or unreachable). */
export function isConnectionFailure(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: string }).code;
  return code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ECONNRESET';
}

import type { Response } from 'express';
import type { ErrorCode } from './errors';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/** Every API response uses one of these two shapes. */
export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; meta?: Record<string, unknown> } = {},
): void {
  const body: SuccessEnvelope<T> = { success: true, data };
  if (options.meta) body.meta = options.meta;
  res.status(options.status ?? 200).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
): void {
  const requestId = typeof res.req?.id === 'string' ? res.req.id : undefined;
  const body: ErrorEnvelope = { success: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  if (requestId) body.error.requestId = requestId;
  res.status(status).json(body);
}

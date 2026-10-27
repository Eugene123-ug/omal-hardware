import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Assigns or preserves a unique correlation ID for every incoming HTTP request.
 * Sets `req.id` and the `x-request-id` response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers['x-request-id'];
  const id = typeof existing === 'string' && existing.length > 0 && existing.length <= 128
    ? existing
    : crypto.randomUUID();

  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}

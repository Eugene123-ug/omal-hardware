import type { Request } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id attached to every request and echoed in `x-request-id`. */
      id?: string;
    }
  }
}

export type { Request };

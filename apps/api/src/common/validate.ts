import type { ZodType } from 'zod';
import { AppError } from './errors';

export interface FieldIssue {
  field: string;
  message: string;
}

/** Parse untrusted input with a zod schema; throws a client-safe validation error. */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issues: FieldIssue[] = result.error.issues.map((i) => ({
    field: i.path.join('.') || '(body)',
    message: i.message,
  }));
  throw AppError.validation('The submitted data is not valid', { issues });
}

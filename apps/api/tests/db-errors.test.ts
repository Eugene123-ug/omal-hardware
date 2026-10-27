import { describe, it, expect } from 'vitest';
import { mapDbError } from '../src/db/errors';

describe('Phase 1: PostgreSQL Error Translation Tests', () => {
  it('1.8. Maps unique constraint violation (23505) to DUPLICATE_RECORD 409 AppError', () => {
    const pgError = Object.assign(new Error('duplicate key value'), {
      code: '23505',
      constraint: 'branches_code_unique',
    });

    const appError = mapDbError(pgError);
    expect(appError).toBeDefined();
    expect(appError?.status).toBe(409);
    expect(appError?.code).toBe('DUPLICATE_RECORD');
  });

  it('1.9. Maps foreign key violation (23503) to REFERENCE_VIOLATION 409 AppError', () => {
    const pgError = Object.assign(new Error('foreign key constraint failure'), {
      code: '23503',
      constraint: 'warehouses_branch_id_foreign',
    });

    const appError = mapDbError(pgError);
    expect(appError).toBeDefined();
    expect(appError?.status).toBe(409);
    expect(appError?.code).toBe('REFERENCE_VIOLATION');
  });

  it('1.10. Maps not-null violation (23502) to CONSTRAINT_VIOLATION 400 AppError', () => {
    const pgError = Object.assign(new Error('null value in column violates not-null'), {
      code: '23502',
      column: 'name',
    });

    const appError = mapDbError(pgError);
    expect(appError).toBeDefined();
    expect(appError?.status).toBe(400);
    expect(appError?.code).toBe('CONSTRAINT_VIOLATION');
  });
});

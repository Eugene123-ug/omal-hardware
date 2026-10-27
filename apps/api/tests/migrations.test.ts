import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Knex } from 'knex';
import { getConfig } from '../src/config/env';
import { createDb } from '../src/db/connection';

describe('Phase 1: Database Schema & Reference Data Integrity Tests', () => {
  let db: Knex;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_NAME = 'omal_business_test';
    const config = getConfig();
    db = createDb(config);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('1.14. Branches table contains Accra Showroom and Tema Depot', async () => {
    const branches = await db('branches').orderBy('code', 'asc').select('code', 'name');
    expect(branches).toHaveLength(2);
    expect(branches).toEqual([
      { code: 'ACC', name: 'Accra Showroom' },
      { code: 'TEM', name: 'Tema Depot' },
    ]);
  });

  it('1.15. Warehouses table contains ACC-SHOWROOM and TEM-DEPOT linked to branches', async () => {
    const warehouses = await db('warehouses as w')
      .join('branches as b', 'w.branch_id', 'b.id')
      .orderBy('w.code', 'asc')
      .select('w.code', 'w.name', 'w.kind', 'b.code as branch_code');

    expect(warehouses).toHaveLength(2);
    expect(warehouses[0]).toMatchObject({
      code: 'ACC-SHOWROOM',
      name: 'Accra Showroom',
      kind: 'showroom',
      branch_code: 'ACC',
    });
    expect(warehouses[1]).toMatchObject({
      code: 'TEM-DEPOT',
      name: 'Tema Depot',
      kind: 'depot',
      branch_code: 'TEM',
    });
  });

  it('1.16. Roles table contains the 5 required commercial system roles', async () => {
    const roles = await db('roles').orderBy('key', 'asc').select('key', 'name', 'is_system');
    const roleKeys = roles.map((r) => r.key);
    expect(roleKeys).toContain('owner');
    expect(roleKeys).toContain('administrator');
    expect(roleKeys).toContain('cashier');
    expect(roleKeys).toContain('accountant');
    expect(roleKeys).toContain('branch_manager');
  });

  it('1.17. IMMUTABILITY TRIGGER: Audit logs strictly reject UPDATE and DELETE statements', async () => {
    // Insert a valid audit log entry
    const [entry] = await db('audit_logs')
      .insert({
        actor_label: 'System Boot Test',
        action: 'BOOT_TEST',
        result: 'success',
      })
      .returning('id');

    const logId = entry.id || entry;

    // Attempting an update must trigger the PostgreSQL trigger exception
    await expect(
      db('audit_logs').where({ id: logId }).update({ action: 'TAMPERED_ACTION' }),
    ).rejects.toThrow(/append-only/i);

    // Attempting a delete must trigger the PostgreSQL trigger exception
    await expect(
      db('audit_logs').where({ id: logId }).delete(),
    ).rejects.toThrow(/append-only/i);
  });
});

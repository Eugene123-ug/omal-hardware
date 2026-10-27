import type { AppConfig } from '../config/env';
import { createDb } from './connection';

const SAFE_NAME = /^[a-z][a-z0-9_]{2,62}$/;

function assertSafeName(name: string): void {
  if (!SAFE_NAME.test(name)) throw new Error(`Unsafe database name: ${name}`);
}

/** Create the configured database if it does not exist. Returns true when created. */
export async function ensureDatabase(config: AppConfig, name = config.db.database): Promise<boolean> {
  assertSafeName(name);
  const admin = createDb(config, { database: 'postgres' });
  try {
    const exists = await admin.raw('select 1 from pg_database where datname = ?', [name]);
    if (exists.rows.length > 0) return false;
    await admin.raw(`create database "${name}" encoding 'UTF8'`);
    return true;
  } finally {
    await admin.destroy();
  }
}

/** Drop a database. Only allowed for names ending in `_test` or `_migtest`. */
export async function dropTestDatabase(config: AppConfig, name: string): Promise<void> {
  assertSafeName(name);
  if (!/_(test|migtest)$/.test(name)) throw new Error(`Refusing to drop non-test database: ${name}`);
  const admin = createDb(config, { database: 'postgres' });
  try {
    await admin.raw(`drop database if exists "${name}" with (force)`);
  } finally {
    await admin.destroy();
  }
}

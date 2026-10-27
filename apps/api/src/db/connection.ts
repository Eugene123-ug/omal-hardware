import path from 'node:path';
import knex, { type Knex } from 'knex';
import pg from 'pg';
import { getConfig, type AppConfig } from '../config/env';

// Keep PostgreSQL NUMERIC (money and quantities) as exact strings - never floating point.
// Convert BIGINT (ids, counts) to JS numbers; ids stay far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export type { Knex };

export function migrationConfig(): Knex.MigratorConfig {
  const isTs = __filename.endsWith('.ts');
  return {
    directory: path.join(__dirname, 'migrations'),
    loadExtensions: isTs ? ['.ts'] : ['.js'],
    tableName: 'knex_migrations',
  };
}

let globalDb: Knex | undefined;

export function createDb(config: Pick<AppConfig, 'db'>, overrides: { database?: string } = {}): Knex {
  const { db } = config;
  const connectionConfig: any = db.connectionString
    ? {
        connectionString: db.connectionString,
        ssl: { rejectUnauthorized: false },
        application_name: 'omal-erp-api',
        statement_timeout: 30_000,
      }
    : {
        host: db.host,
        port: db.port,
        user: db.user,
        password: db.password,
        database: overrides.database ?? db.database,
        ssl: db.ssl ? { rejectUnauthorized: false } : false,
        application_name: 'omal-erp-api',
        statement_timeout: 30_000,
      };

  const instance = knex({
    client: 'pg',
    connection: connectionConfig,
    pool: { min: db.poolMin, max: db.poolMax, idleTimeoutMillis: 10_000 },
    migrations: migrationConfig(),
  });
  if (!globalDb) {
    globalDb = instance;
  }
  return instance;
}

export function getDb(): Knex {
  if (!globalDb) {
    const config = getConfig();
    globalDb = createDb(config);
  }
  return globalDb;
}

/** Cheap connectivity probe used by health checks and start-up. */
export async function pingDb(
  db: Knex,
  timeoutMs = 3000,
): Promise<{ connected: boolean; latencyMs?: number }> {
  const started = Date.now();
  try {
    await Promise.race([
      db.raw('select 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return { connected: true, latencyMs: Date.now() - started };
  } catch {
    return { connected: false };
  }
}

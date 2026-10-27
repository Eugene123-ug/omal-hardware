import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Environment configuration.
 *
 * - Real process environment variables always win.
 * - For local work, values are read from `.env.<NODE_ENV>` at the repository root
 *   (`.env.development`, `.env.test`). Those files are git-ignored.
 * - There are deliberately NO default secrets. Missing or weak secrets stop the process.
 */

const PLACEHOLDER = /change[-_ ]?me|replace|example|your[-_ ]|placeholder|password123|secret123|xxxx/i;

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  /** Number of reverse-proxy hops to trust for client IPs (0 = none). */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  /** Comma-separated list of browser origins allowed to call the API. */
  CORS_ORIGINS: z.string().default(''),

  DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_USER: z.string().min(1).default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('omal_business_dev'),
  DB_SSL: bool.default(false),
  DB_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  /** Used for signing sessions (Phase 2). Must be long and random. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  APP_NAME: z.string().default('OMAL ERP'),
  APP_TIMEZONE: z.string().default('Africa/Accra'),
  CURRENCY: z.string().length(3).default('GHS'),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('onboarding@resend.dev'),
  APP_BASE_URL: z.string().default('https://omal-hardware.vercel.app'),
});

export type RawEnv = Record<string, string | undefined>;

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  isTest: boolean;
  host: string;
  port: number;
  logLevel: string;
  trustProxy: number;
  corsOrigins: string[];
  db: {
    connectionString?: string;
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
    poolMin: number;
    poolMax: number;
  };
  supabase?: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
  };
  jwtSecret: string;
  appName: string;
  timezone: string;
  currency: string;
  resend: {
    apiKey?: string;
    fromEmail: string;
  };
  appBaseUrl: string;
}

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n - ${problems.join('\n - ')}`);
    this.name = 'ConfigError';
  }
}

/** Validate an environment object and return typed configuration. Pure and testable. */
export function loadConfig(env: RawEnv): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`));
  }
  const e = parsed.data;
  const problems: string[] = [];
  const corsOrigins = e.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (e.NODE_ENV === 'test' && !e.DB_NAME.endsWith('_test')) {
    problems.push('DB_NAME must end with "_test" when NODE_ENV=test (protects real data from test runs)');
  }
  if (e.NODE_ENV === 'production') {
    if (PLACEHOLDER.test(e.JWT_SECRET)) problems.push('JWT_SECRET looks like a placeholder');
    if (!e.DATABASE_URL && (!e.DB_PASSWORD || PLACEHOLDER.test(e.DB_PASSWORD))) {
      problems.push('DB_PASSWORD must be set in production unless DATABASE_URL is provided');
    }
    if (!e.DATABASE_URL && e.DB_NAME.endsWith('_test')) {
      problems.push('DB_NAME must not be a test database in production');
    }
  }
  if (problems.length > 0) throw new ConfigError(problems);

  return {
    nodeEnv: e.NODE_ENV,
    isProduction: e.NODE_ENV === 'production',
    isTest: e.NODE_ENV === 'test',
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL ?? (e.NODE_ENV === 'test' ? 'silent' : e.NODE_ENV === 'production' ? 'info' : 'debug'),
    trustProxy: e.TRUST_PROXY,
    corsOrigins,
    db: {
      connectionString: e.DATABASE_URL,
      host: e.DB_HOST,
      port: e.DB_PORT,
      user: e.DB_USER,
      password: e.DB_PASSWORD,
      database: e.DB_NAME,
      ssl: Boolean(e.DB_SSL || e.DATABASE_URL),
      poolMin: e.DB_POOL_MIN,
      poolMax: e.DB_POOL_MAX,
    },
    supabase: {
      url: e.SUPABASE_URL,
      anonKey: e.SUPABASE_ANON_KEY,
      serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    },
    jwtSecret: e.JWT_SECRET,
    appName: e.APP_NAME,
    timezone: e.APP_TIMEZONE,
    currency: e.CURRENCY,
    resend: {
      apiKey: e.RESEND_API_KEY || process.env.RESEND_API_KEY,
      fromEmail: e.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    },
    appBaseUrl: e.APP_BASE_URL || process.env.APP_BASE_URL || 'https://omal-hardware.vercel.app',
  };
}

/** Safe summary for logs: never includes secrets. */
export function describeConfig(config: AppConfig): Record<string, unknown> {
  return {
    nodeEnv: config.nodeEnv,
    host: config.host,
    port: config.port,
    logLevel: config.logLevel,
    corsOrigins: config.corsOrigins,
    db: {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      database: config.db.database,
      ssl: config.db.ssl,
      password: '[REDACTED]',
    },
    jwtSecret: '[REDACTED]',
    timezone: config.timezone,
    currency: config.currency,
  };
}

let cached: AppConfig | undefined;

/** Load `.env.<NODE_ENV>` (if present) and return the validated config (cached). */
export function getConfig(): AppConfig {
  if (cached) return cached;
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const repoRoot = path.resolve(__dirname, '../../../..');
  dotenv.config({ path: path.join(repoRoot, `.env.${nodeEnv}`), quiet: true });
  cached = loadConfig({ ...process.env, NODE_ENV: process.env.NODE_ENV ?? nodeEnv });
  return cached;
}

/** For tests only. */
export function resetConfigCache(): void {
  cached = undefined;
}

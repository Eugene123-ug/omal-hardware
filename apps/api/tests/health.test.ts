import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Knex } from 'knex';
import type { Express } from 'express';
import { getConfig } from '../src/config/env';
import { createDb } from '../src/db/connection';
import { createApp } from '../src/app';

describe('Phase 1: API Server & Health Check Endpoints Tests', () => {
  let db: Knex;
  let app: Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_NAME = 'omal_business_test';
    const config = getConfig();
    db = createDb(config);
    app = createApp({ config, db });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('1.11. GET /health returns 200 OK with database connection latency and metrics', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.environment).toBe('test');
    expect(res.body.data.database.connected).toBe(true);
    expect(typeof res.body.data.database.latencyMs).toBe('number');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('1.12. GET /api/v1/health returns standardized health response', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database.connected).toBe(true);
  });

  it('1.13. Unmatched route returns standardized 404 NOT_FOUND envelope', async () => {
    const res = await request(app).get('/api/v1/non_existent_route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
  });
});

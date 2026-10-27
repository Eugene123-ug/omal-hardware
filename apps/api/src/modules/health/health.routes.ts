import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { pingDb } from '../../db/connection';
import { sendSuccess } from '../../common/response';
import type { AppConfig } from '../../config/env';

export function createHealthRouter(db: Knex, config: AppConfig): Router {
  const router = Router();
  const startTime = Date.now();

  const handleHealth = async (_req: Request, res: Response) => {
    const dbStatus = await pingDb(db, 5000);
    const uptimeSecs = Math.floor((Date.now() - startTime) / 1000);
    const memory = process.memoryUsage();

    const isHealthy = dbStatus.connected;
    const statusCode = isHealthy ? 200 : 503;

    return sendSuccess(
      res,
      {
        status: isHealthy ? 'healthy' : 'degraded',
        service: config.appName,
        environment: config.nodeEnv,
        uptimeSeconds: uptimeSecs,
        timestamp: new Date().toISOString(),
        database: {
          connected: dbStatus.connected,
          latencyMs: dbStatus.latencyMs,
          name: config.db.database,
        },
        system: {
          rssMb: Math.round(memory.rss / (1024 * 1024)),
          heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
          nodeVersion: process.version,
        },
      },
      { status: statusCode },
    );
  };

  router.get('/health', handleHealth);
  router.get('/api/v1/health', handleHealth);

  return router;
}

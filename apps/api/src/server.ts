import http from 'node:http';
import { getConfig, describeConfig } from './config/env';
import { createLogger } from './common/logger';
import { createDb, pingDb } from './db/connection';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  const config = getConfig();
  const logger = createLogger(config);

  logger.info({ config: describeConfig(config) }, 'Starting OMAL ERP Core API Server...');

  const db = createDb(config);

  // Probe database connectivity on startup
  const dbHealth = await pingDb(db, 5000);
  if (!dbHealth.connected) {
    logger.fatal(
      { db: config.db.database, host: config.db.host, port: config.db.port },
      'FATAL: Unable to connect to PostgreSQL database. Exiting.',
    );
    await db.destroy();
    process.exit(1);
  }

  logger.info(
    { db: config.db.database, latencyMs: dbHealth.latencyMs },
    'PostgreSQL database connection established successfully.',
  );

  const app = createApp({ config, logger, db });
  const server = http.createServer(app);

  server.listen(config.port, config.host, () => {
    logger.info(
      {
        host: config.host,
        port: config.port,
        env: config.nodeEnv,
        appName: config.appName,
      },
      `🚀 OMAL ERP API Server is live at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`,
    );
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received termination signal. Closing HTTP server gracefully...');
    server.close(async () => {
      logger.info('HTTP server closed. Terminating database pool...');
      try {
        await db.destroy();
        logger.info('Database pool closed. Process exiting cleanly.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error closing database pool.');
        process.exit(1);
      }
    });

    // Force close after 10s if connections linger
    setTimeout(() => {
      logger.error('Forced shutdown timeout exceeded. Exiting process.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap failure:', err);
  process.exit(1);
});

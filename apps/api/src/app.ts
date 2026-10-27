import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Knex } from 'knex';
import type { AppConfig } from './config/env';
import { createLogger, REDACT_PATHS, type Logger } from './common/logger';
import { requestIdMiddleware } from './middleware/request-id';
import { createErrorHandler } from './middleware/error-handler';
import { sendError } from './common/response';
import { createHealthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { productsRouter } from './modules/products/products.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { salesRouter } from './modules/sales/sales.routes';
import { purchasingRouter } from './modules/purchasing/purchasing.routes';
import { transfersRouter } from './modules/transfers/transfers.routes';
import { financeRouter } from './modules/finance/finance.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { rolesRouter } from './modules/roles/roles.routes';
import { usersRouter } from './modules/users/users.routes';
import { settingsRouter } from './modules/settings/settings.routes';

export interface AppDependencies {
  config: AppConfig;
  logger?: Logger;
  db: Knex;
}

export function createApp(deps: AppDependencies): Express {
  const { config, db } = deps;
  const logger = deps.logger ?? createLogger(config);
  const app = express();

  // Trust reverse proxy if configured
  if (config.trustProxy > 0) {
    app.set('trust proxy', config.trustProxy);
  }

  // Security headers
  app.use(helmet());

  // Cross-Origin Resource Sharing (CORS)
  const corsOrigins = config.corsOrigins;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        const isVercel = /\.vercel\.app$/.test(origin);
        if (
          (!config.isProduction && isLocalDev) ||
          isVercel ||
          corsOrigins.length === 0 ||
          corsOrigins.includes(origin) ||
          corsOrigins.includes('*')
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Origin "${origin}" is not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
      exposedHeaders: ['x-request-id'],
    }),
  );

  // Correlation ID
  app.use(requestIdMiddleware);

  // Structured HTTP request logger
  if (config.logLevel !== 'silent') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.id || 'unknown',
        autoLogging: {
          ignore: (req) => req.url === '/health' || req.url === '/api/v1/health',
        },
        redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      }),
    );
  }

  // Request body parsing with generous size limits for company logo uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Root / Health check routes
  app.use(createHealthRouter(db, config));

  // Enterprise API v1 Modules
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/products', productsRouter);
  app.use('/api/v1/inventory', inventoryRouter);
  app.use('/api/v1/sales', salesRouter);
  app.use('/api/v1/purchasing', purchasingRouter);
  app.use('/api/v1/transfers', transfersRouter);
  app.use('/api/v1/finance', financeRouter);
  app.use('/api/v1/customers', customersRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/settings', settingsRouter);

  // 404 Route Handler
  app.use((req, res) => {
    return sendError(
      res,
      404,
      'NOT_FOUND',
      `Cannot ${req.method} ${req.path}. Endpoint does not exist on this server.`,
    );
  });

  // Centralized Error Handler
  app.use(createErrorHandler(logger));

  return app;
}

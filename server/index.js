const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (supports .env, .env.development, .env.test, .env.production)
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
dotenv.config({ path: envFile });
dotenv.config(); // fallback to .env if specific file doesn't override

const { checkDbHealth } = require('./database/db');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { ApiResponse } = require('./common/response');

const app = express();
const PORT = process.env.PORT || 5000;
const startTime = Date.now();

// Security & Parsing Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Structured Request Logging Middleware
app.use((req, res, next) => {
  const reqStart = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - reqStart;
    const logData = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.socket.remoteAddress
    };

    if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, logData);
    } else if (process.env.NODE_ENV !== 'test') {
      logger.debug(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, logData);
    }
  });
  next();
});

// ============================================================================
// HEALTH-CHECK ENDPOINTS (Task 1)
// ============================================================================
const healthCheckHandler = async (req, res) => {
  const dbHealth = await checkDbHealth();
  const memory = process.memoryUsage();
  const uptimeSecs = Math.floor((Date.now() - startTime) / 1000);

  const isHealthy = dbHealth.connected;
  const status = isHealthy ? 'healthy' : 'degraded';

  const healthData = {
    status,
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSecs} seconds`,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0-phase1',
    service: 'OMAL Business ERP Core',
    database: dbHealth,
    system: {
      memory: {
        rssMB: (memory.rss / (1024 * 1024)).toFixed(2),
        heapUsedMB: (memory.heapUsed / (1024 * 1024)).toFixed(2),
        heapTotalMB: (memory.heapTotal / (1024 * 1024)).toFixed(2)
      },
      nodeVersion: process.version,
      platform: process.platform
    }
  };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json(healthData);
};

app.get('/health', healthCheckHandler);
app.get('/api/health', healthCheckHandler);
app.get('/api/v1/health', healthCheckHandler);

// ============================================================================
// MODULAR API ROUTES (Task 3: 11 Core Domain Modules)
// ============================================================================
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const permissionsRoutes = require('./modules/permissions/permissions.routes');
const productsRoutes = require('./modules/products/products.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const purchasingRoutes = require('./modules/purchasing/purchasing.routes');
const salesRoutes = require('./modules/sales/sales.routes');
const customersRoutes = require('./modules/customers/customers.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const approvalsRoutes = require('./modules/approvals/approvals.routes');
const securityRoutes = require('./modules/security/security.routes');
const auditRoutes = require('./routes/audit');
const settingsRoutes = require('./routes/settings');

// Mount routes under both /api/v1 and /api for compatibility
const modules = [
  { path: '/auth', router: authRoutes },
  { path: '/users', router: usersRoutes },
  { path: '/permissions', router: permissionsRoutes },
  { path: '/products', router: productsRoutes },
  { path: '/inventory', router: inventoryRoutes },
  { path: '/stock', router: inventoryRoutes }, // alias
  { path: '/purchasing', router: purchasingRoutes },
  { path: '/suppliers', router: purchasingRoutes }, // alias
  { path: '/sales', router: salesRoutes },
  { path: '/customers', router: customersRoutes },
  { path: '/finance', router: financeRoutes },
  { path: '/money', router: financeRoutes }, // alias
  { path: '/reports', router: reportsRoutes },
  { path: '/notifications', router: notificationsRoutes },
  { path: '/approvals', router: approvalsRoutes },
  { path: '/security', router: securityRoutes },
  { path: '/audit', router: auditRoutes },
  { path: '/settings', router: settingsRoutes }
];

modules.forEach(({ path: modPath, router: modRouter }) => {
  app.use(`/api/v1${modPath}`, modRouter);
  app.use(`/api${modPath}`, modRouter);
});

// Serve frontend build if present
const clientDist = path.join(__dirname, '../dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/health')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    } else {
      next();
    }
  });
}

// 404 handler for API routes
app.use('/api', (req, res) => {
  return ApiResponse.error(res, `API route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND');
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start server if not imported as module in test suites
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`OMAL Business ERP Server running on port ${PORT}`, {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      db: process.env.DB_NAME || 'omal_business_dev'
    });
    console.log(`=======================================================`);
    console.log(`  OMAL BUSINESS ERP [PHASE 1 - POSTGRESQL FOUNDATION]   `);
    console.log(`  Server: http://localhost:${PORT}                      `);
    console.log(`  Health: http://localhost:${PORT}/health               `);
    console.log(`  Database: PostgreSQL (db: ${process.env.DB_NAME || 'omal_business_dev'})`);
    console.log(`=======================================================`);
  });
}

module.exports = app;

const knex = require('knex');
const knexConfig = require('../../knexfile');
const logger = require('../utils/logger');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment] || knexConfig.development;

const db = knex(config);

/**
 * Health check to verify PostgreSQL connectivity and response latency
 */
async function checkDbHealth() {
  const start = Date.now();
  try {
    const result = await db.raw('SELECT 1 as connected, current_database() as database, version() as version');
    const latency = Date.now() - start;
    return {
      status: 'healthy',
      connected: true,
      database: result.rows[0].database,
      version: result.rows[0].version.split(',')[0],
      latencyMs: latency
    };
  } catch (err) {
    logger.error('PostgreSQL database health check failed', { error: err.message, stack: err.stack });
    return {
      status: 'unhealthy',
      connected: false,
      error: err.message,
      latencyMs: Date.now() - start
    };
  }
}

/**
 * Normalizes PostgreSQL errors into standardized domain API error structures
 */
function handleDatabaseError(err) {
  // PostgreSQL Error Codes:
  // 23505 = unique_violation
  // 23503 = foreign_key_violation
  // 23502 = not_null_violation
  // 23514 = check_violation
  // 08006 / 08001 / ECONNREFUSED = connection failure
  if (err.code === '23505') {
    return {
      statusCode: 409,
      type: 'UNIQUE_VIOLATION',
      message: `A record with this unique identifier already exists (${err.detail || 'Duplicate key'}).`,
      detail: err.detail
    };
  }

  if (err.code === '23503') {
    return {
      statusCode: 400,
      type: 'FOREIGN_KEY_VIOLATION',
      message: `Referenced entity does not exist or cannot be removed due to existing dependencies.`,
      detail: err.detail
    };
  }

  if (err.code === '23502') {
    return {
      statusCode: 400,
      type: 'NOT_NULL_VIOLATION',
      message: `Missing required field: ${err.column || 'column cannot be null'}.`,
      column: err.column
    };
  }

  if (err.code === '23514') {
    return {
      statusCode: 400,
      type: 'CHECK_CONSTRAINT_VIOLATION',
      message: `Data violates system check constraint (${err.constraint || 'validation failed'}).`
    };
  }

  if (err.code === 'ECONNREFUSED' || err.code === '08006' || err.code === '08001') {
    return {
      statusCode: 503,
      type: 'DATABASE_UNAVAILABLE',
      message: 'PostgreSQL database server is currently unreachable. Please verify connection parameters.'
    };
  }

  return {
    statusCode: 500,
    type: 'DATABASE_ERROR',
    message: 'An unexpected database error occurred.',
    detail: process.env.NODE_ENV !== 'production' ? err.message : undefined
  };
}

module.exports = {
  db,
  checkDbHealth,
  handleDatabaseError
};

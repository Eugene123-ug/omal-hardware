const { ApiResponse } = require('../common/response');
const { handleDatabaseError } = require('../database/db');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled request error caught by middleware', {
    message: err.message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: err.stack
  });

  // Database error handling
  if (err.code || err.routine) {
    const dbErr = handleDatabaseError(err);
    return ApiResponse.error(res, dbErr.message, dbErr.statusCode, dbErr.type, dbErr.detail);
  }

  // JWT authentication errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.error(res, 'Invalid authentication token provided.', 401, 'INVALID_TOKEN');
  }
  if (err.name === 'TokenExpiredError') {
    return ApiResponse.error(res, 'Authentication token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
  }

  // Custom application error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const type = err.type || 'INTERNAL_SERVER_ERROR';

  return ApiResponse.error(res, message, statusCode, type);
}

module.exports = errorHandler;

const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { ApiResponse } = require('../common/response');
const logger = require('../utils/logger');
const { isSessionValid, checkUserPermission } = require('../utils/security');

const JWT_SECRET = process.env.JWT_SECRET || 'omal_dev_jwt_secret_key_ghana_hardware_2026_super_secure_entropy';

/**
 * Authenticate incoming Bearer token, check active account status and session revocation
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return ApiResponse.error(res, 'Authentication token required. Please log in.', 401, 'UNAUTHORIZED');
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return ApiResponse.error(res, 'Session expired. Please log in again.', 401, 'TOKEN_EXPIRED');
      }
      return ApiResponse.error(res, 'Invalid authentication token.', 403, 'FORBIDDEN');
    }

    // Temporary MFA pending tokens cannot be used to access protected APIs
    if (decoded.type === 'mfa_pending' || !decoded.jti) {
      return ApiResponse.error(res, 'Multi-Factor Authentication verification required before accessing resources.', 401, 'MFA_REQUIRED');
    }

    try {
      // 1. Fetch user from database to ensure fresh status
      const user = await db('users')
        .where({ id: decoded.id })
        .select('id', 'name', 'email', 'role', 'status', 'branch', 'locked_until')
        .first();

      if (!user) {
        return ApiResponse.error(res, 'User account no longer exists.', 401, 'UNAUTHORIZED');
      }

      // 2. Immediate check for deactivated accounts
      if (user.status !== 'active') {
        return ApiResponse.error(res, 'User account is deactivated. Access revoked.', 403, 'ACCOUNT_INACTIVE');
      }

      // 3. Immediate check for locked accounts
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return ApiResponse.error(res, 'User account is currently locked.', 403, 'ACCOUNT_LOCKED');
      }

      // 4. Session revocation check if token has JTI
      if (decoded.jti) {
        const sessionActive = await isSessionValid(user.id, decoded.jti);
        if (!sessionActive) {
          return ApiResponse.error(res, 'Session has been revoked or logged out. Please log in again.', 401, 'SESSION_REVOKED');
        }
      }

      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        jti: decoded.jti || null
      };

      next();
    } catch (dbErr) {
      logger.error('Error during token authentication check', { error: dbErr.message });
      return ApiResponse.error(res, 'Authentication verification error.', 500, 'INTERNAL_ERROR');
    }
  });
}

/**
 * Role-level authorization middleware
 */
function requireRole(...roles) {
  const allowedRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }
    if (!allowedRoles.includes(req.user.role)) {
      return ApiResponse.error(
        res,
        `Permission denied. Required role(s): [${allowedRoles.join(', ')}]. Your role: ${req.user.role}`,
        403,
        'INSUFFICIENT_PERMISSIONS'
      );
    }
    next();
  };
}

/**
 * Granular Permission authorization middleware (Task 3)
 */
function requirePermission(permissionName) {
  return async (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }

    try {
      const allowed = await checkUserPermission(req.user, permissionName);
      if (!allowed) {
        return ApiResponse.error(
          res,
          `Permission denied. Missing required permission: "${permissionName}"`,
          403,
          'INSUFFICIENT_PERMISSIONS'
        );
      }
      next();
    } catch (err) {
      logger.error('Permission check error', { error: err.message, permission: permissionName });
      return ApiResponse.error(res, 'Internal authorization error.', 500, 'INTERNAL_ERROR');
    }
  };
}

/**
 * Security: Hide cost price from unauthorized roles (sales staff, cashiers)
 */
function sanitizeProductForRole(product, role) {
  if (role === 'sales') {
    const { cost_price, ...safeProduct } = product;
    return safeProduct;
  }
  return product;
}

/**
 * Supervisor PIN verification helper
 */
async function verifyAdminPin(pin) {
  if (!pin) return { valid: false, message: 'Admin PIN code is required' };

  const user = await db('users')
    .where({ admin_pin: String(pin).trim(), status: 'active' })
    .whereIn('role', ['super_admin', 'admin'])
    .select('id', 'name', 'role')
    .first();

  if (!user) {
    return { valid: false, message: 'Invalid Admin PIN authorization code.' };
  }
  return { valid: true, user };
}

/**
 * System audit logger
 */
async function logAudit(userId, userName, userRole, action, details, ip = '127.0.0.1') {
  try {
    await db('audit_logs').insert({
      user_id: userId || null,
      user_name: userName || 'System',
      user_role: userRole || 'system',
      action,
      details,
      ip_address: ip
    });
  } catch (err) {
    logger.error('Failed to write audit log entry', { error: err.message, action, details });
  }
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireRole,
  requirePermission,
  sanitizeProductForRole,
  verifyAdminPin,
  logAudit
};

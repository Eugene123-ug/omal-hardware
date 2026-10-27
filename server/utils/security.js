const crypto = require('crypto');
const { db } = require('../database/db');
const logger = require('./logger');

// In-memory rate limiting store (IP -> array of failure timestamps)
const failedAttemptsByIp = new Map();
const MAX_IP_FAILURES = 15;
const IP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check IP-based rate limiting
 */
function checkIpRateLimit(ip) {
  const now = Date.now();
  const attempts = failedAttemptsByIp.get(ip) || [];
  const recent = attempts.filter(ts => now - ts < IP_WINDOW_MS);
  failedAttemptsByIp.set(ip, recent);

  if (recent.length >= MAX_IP_FAILURES) {
    const oldestInWindow = recent[0];
    const retryAfterSecs = Math.ceil((oldestInWindow + IP_WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      retryAfterSecs: Math.max(1, retryAfterSecs)
    };
  }

  return { allowed: true };
}

/**
 * Record a failed attempt for an IP
 */
function recordIpFailure(ip) {
  const attempts = failedAttemptsByIp.get(ip) || [];
  attempts.push(Date.now());
  failedAttemptsByIp.set(ip, attempts);
}

/**
 * Clear failed attempts for an IP upon successful login
 */
function clearIpFailures(ip) {
  failedAttemptsByIp.delete(ip);
}

/**
 * Generate RFC 6238 TOTP Code from Secret (Hex)
 */
function generateTotp(secretHex, timeStepOffset = 0) {
  const timeStep = Math.floor(Date.now() / 1000 / 30) + timeStepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac('sha1', Buffer.from(secretHex, 'hex')).update(buf).digest();
  const offset = hmac[19] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 |
                (hmac[offset + 1] << 16) |
                (hmac[offset + 2] << 8) |
                (hmac[offset + 3])) % 1000000;
  return code.toString().padStart(6, '0');
}

/**
 * Verify TOTP Code with +/- 1 step drift tolerance
 */
function verifyTotp(secretHex, inputCode) {
  if (!secretHex || !inputCode) return false;
  const cleanCode = String(inputCode).trim();
  for (const offset of [0, -1, 1]) {
    if (generateTotp(secretHex, offset) === cleanCode) {
      return true;
    }
  }
  return false;
}

/**
 * Generate 8 Backup Recovery Codes (e.g. "ABCD-1234")
 */
function generateBackupCodes(count = 8) {
  const rawCodes = [];
  const hashedCodes = [];

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    rawCodes.push(formatted);
    const hash = crypto.createHash('sha256').update(formatted).digest('hex');
    hashedCodes.push(hash);
  }

  return { rawCodes, hashedCodes };
}

/**
 * Verify & Consume a Backup Code
 */
async function verifyAndConsumeBackupCode(userId, inputCode) {
  const user = await db('users').where({ id: userId }).first();
  if (!user || !user.mfa_backup_codes) return false;

  let storedHashes = [];
  try {
    storedHashes = JSON.parse(user.mfa_backup_codes);
  } catch (e) {
    return false;
  }

  const inputHash = crypto.createHash('sha256').update(String(inputCode).trim().toUpperCase()).digest('hex');
  const index = storedHashes.indexOf(inputHash);

  if (index === -1) return false;

  // Consume code
  storedHashes.splice(index, 1);
  await db('users').where({ id: userId }).update({
    mfa_backup_codes: JSON.stringify(storedHashes)
  });

  return true;
}

/**
 * Create a new user session in database
 */
async function createSession(userId, ip, userAgent) {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const [session] = await db('user_sessions').insert({
    user_id: userId,
    token_jti: jti,
    ip_address: ip || '127.0.0.1',
    user_agent: userAgent || 'Unknown Client',
    is_revoked: false,
    expires_at: expiresAt
  }).returning(['id', 'token_jti', 'expires_at']);

  return session;
}

/**
 * Revoke a specific session
 */
async function revokeSession(jti) {
  if (!jti) return;
  await db('user_sessions')
    .where({ token_jti: jti })
    .update({
      is_revoked: true,
      revoked_at: new Date()
    });
}

/**
 * Revoke all active sessions for a user (e.g. password reset or admin revoke)
 */
async function revokeAllUserSessions(userId) {
  if (!userId) return;
  await db('user_sessions')
    .where({ user_id: userId, is_revoked: false })
    .update({
      is_revoked: true,
      revoked_at: new Date()
    });
}

/**
 * Check if a session is currently active and not revoked
 */
async function isSessionValid(userId, jti) {
  if (!userId || !jti) return false;

  const session = await db('user_sessions')
    .where({ user_id: userId, token_jti: jti, is_revoked: false })
    .where('expires_at', '>', new Date())
    .first();

  return Boolean(session);
}

/**
 * Record an entry into login history
 */
async function recordLoginHistory(userId, email, ip, userAgent, status, failureReason = null) {
  try {
    await db('login_history').insert({
      user_id: userId || null,
      email: (email || '').toLowerCase().trim(),
      ip_address: ip || '127.0.0.1',
      user_agent: userAgent || 'Unknown',
      status,
      failure_reason: failureReason
    });
  } catch (err) {
    logger.error('Failed to record login history', { error: err.message, email, status });
  }
}

/**
 * Record a security alert / notification
 */
async function recordSecurityNotification(userId, type, severity, title, message, ip = '127.0.0.1') {
  try {
    await db('security_notifications').insert({
      user_id: userId || null,
      type,
      severity,
      title,
      message,
      ip_address: ip
    });
  } catch (err) {
    logger.error('Failed to record security notification', { error: err.message, type, title });
  }
}

/**
 * Fetch effective permissions for a user
 * Returns Array of permission strings
 */
async function getUserPermissions(userId, userRole) {
  // Super admin possesses all permissions
  if (userRole === 'super_admin') {
    const all = await db('permissions').select('name');
    return all.map(p => p.name);
  }

  // 1. Get base role permissions
  const rolePerms = await db('role_permissions as rp')
    .join('permissions as p', 'rp.permission_id', 'p.id')
    .where('rp.role', userRole)
    .select('p.name');

  const permSet = new Set(rolePerms.map(r => r.name));

  // 2. Apply user-specific overrides if any
  const userOverrides = await db('user_permissions as up')
    .join('permissions as p', 'up.permission_id', 'p.id')
    .where('up.user_id', userId)
    .select('p.name', 'up.is_granted');

  for (const override of userOverrides) {
    if (override.is_granted) {
      permSet.add(override.name);
    } else {
      permSet.delete(override.name);
    }
  }

  return Array.from(permSet);
}

/**
 * Check if a user has a specific permission
 */
async function checkUserPermission(user, permissionName) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;

  const permissions = await getUserPermissions(user.id, user.role);
  return permissions.includes(permissionName);
}

module.exports = {
  checkIpRateLimit,
  recordIpFailure,
  clearIpFailures,
  generateTotp,
  verifyTotp,
  generateBackupCodes,
  verifyAndConsumeBackupCode,
  createSession,
  revokeSession,
  revokeAllUserSessions,
  isSessionValid,
  recordLoginHistory,
  recordSecurityNotification,
  getUserPermissions,
  checkUserPermission
};

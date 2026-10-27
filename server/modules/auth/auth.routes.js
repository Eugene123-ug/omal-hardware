const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../../database/db');
const { ApiResponse } = require('../../common/response');
const { validateBody } = require('../../middleware/validate');
const {
  loginSchema,
  mfaVerifySchema,
  mfaEnableSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyPinSchema
} = require('./auth.validation');
const {
  JWT_SECRET,
  authenticateToken,
  verifyAdminPin,
  logAudit
} = require('../../middleware/auth');
const {
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
  recordLoginHistory,
  recordSecurityNotification,
  getUserPermissions
} = require('../../utils/security');
const logger = require('../../utils/logger');

// POST /api/v1/auth/login
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // 1. IP Rate Limiting & Brute-Force Check
    const rateCheck = checkIpRateLimit(ip);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', rateCheck.retryAfterSecs);
      return ApiResponse.error(
        res,
        `Too many failed login attempts from this network. Try again in ${rateCheck.retryAfterSecs} seconds.`,
        429,
        'TOO_MANY_REQUESTS'
      );
    }

    // 2. Fetch User by Email
    const user = await db('users')
      .whereRaw('LOWER(email) = LOWER(?)', [email.trim()])
      .first();

    if (!user) {
      recordIpFailure(ip);
      await recordLoginHistory(null, email, ip, userAgent, 'FAILED', 'User account not found');
      return ApiResponse.error(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // 3. Check Account Lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const waitMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
      await recordLoginHistory(user.id, email, ip, userAgent, 'LOCKED', 'Attempt on locked account');
      return ApiResponse.error(
        res,
        `Account is temporarily locked due to multiple failed login attempts. Try again in ${waitMinutes} minute(s) or contact the owner.`,
        423,
        'ACCOUNT_LOCKED'
      );
    }

    // 4. Check Account Active Status
    if (user.status !== 'active') {
      await recordLoginHistory(user.id, email, ip, userAgent, 'FAILED', 'Account inactive or disabled');
      return ApiResponse.error(res, 'User account is inactive. Please contact store owner.', 403, 'ACCOUNT_INACTIVE');
    }

    // 5. Verify Password
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      recordIpFailure(ip);
      const newFailedCount = (user.failed_login_attempts || 0) + 1;

      if (newFailedCount >= 5) {
        // Lock account for 15 minutes
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await db('users').where({ id: user.id }).update({
          failed_login_attempts: newFailedCount,
          locked_until: lockUntil
        });

        await recordLoginHistory(user.id, email, ip, userAgent, 'LOCKED', 'Locked after 5 failed attempts');
        await recordSecurityNotification(
          user.id,
          'ACCOUNT_LOCKED',
          'CRITICAL',
          'Account Locked: Excessive Failed Logins',
          `Account for ${user.email} was locked after 5 consecutive failed login attempts from IP: ${ip}.`,
          ip
        );
        await logAudit(user.id, user.name, user.role, 'ACCOUNT_LOCKED', `Account locked after 5 failed login attempts from ${ip}`, ip);

        return ApiResponse.error(
          res,
          'Account has been locked due to 5 consecutive failed login attempts. Please wait 15 minutes or contact the owner.',
          423,
          'ACCOUNT_LOCKED'
        );
      } else {
        await db('users').where({ id: user.id }).update({
          failed_login_attempts: newFailedCount
        });
        await recordLoginHistory(user.id, email, ip, userAgent, 'FAILED', `Invalid password (attempt ${newFailedCount}/5)`);
        return ApiResponse.error(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }
    }

    // 6. Successful Password Authentication: Reset failed counters
    clearIpFailures(ip);
    await db('users').where({ id: user.id }).update({
      failed_login_attempts: 0,
      locked_until: null
    });

    // 7. Check Multi-Factor Authentication (Task 1)
    if (user.mfa_enabled && user.mfa_secret) {
      const tempToken = jwt.sign(
        { id: user.id, email: user.email, type: 'mfa_pending' },
        JWT_SECRET,
        { expiresIn: '5m' }
      );

      await recordLoginHistory(user.id, email, ip, userAgent, 'MFA_REQUIRED', 'Password correct, awaiting 2FA code');

      return ApiResponse.success(res, {
        mfa_required: true,
        temp_token: tempToken
      }, 'Multi-Factor Authentication required. Enter the 6-digit code or backup code.');
    }

    // 8. Create Session & Issue Access Token
    const session = await createSession(user.id, ip, userAgent);
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch || 'Main Showroom',
        jti: session.token_jti
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const permissions = await getUserPermissions(user.id, user.role);
    await recordLoginHistory(user.id, email, ip, userAgent, 'SUCCESS');
    await logAudit(user.id, user.name, user.role, 'LOGIN', `User signed in from ${ip}`, ip);

    return ApiResponse.success(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        branch: user.branch || 'Main Showroom',
        mfa_enabled: Boolean(user.mfa_enabled),
        permissions
      }
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/mfa/verify
router.post('/mfa/verify', validateBody(mfaVerifySchema), async (req, res, next) => {
  try {
    const { temp_token, code } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
      if (decoded.type !== 'mfa_pending') {
        return ApiResponse.error(res, 'Invalid MFA session token', 401, 'INVALID_TOKEN');
      }
    } catch (tokenErr) {
      return ApiResponse.error(res, 'MFA session has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
    }

    const user = await db('users').where({ id: decoded.id }).first();
    if (!user || user.status !== 'active') {
      return ApiResponse.error(res, 'User account is invalid or inactive', 403, 'FORBIDDEN');
    }

    // Verify TOTP or Backup Recovery Code
    let isCodeValid = verifyTotp(user.mfa_secret, code);
    if (!isCodeValid) {
      isCodeValid = await verifyAndConsumeBackupCode(user.id, code);
    }

    if (!isCodeValid) {
      await recordLoginHistory(user.id, user.email, ip, userAgent, 'MFA_FAILED', 'Invalid MFA code entered');
      return ApiResponse.error(res, 'Invalid verification code or backup code', 401, 'INVALID_MFA_CODE');
    }

    // Create session and issue full token
    const session = await createSession(user.id, ip, userAgent);
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch || 'Main Showroom',
        jti: session.token_jti
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const permissions = await getUserPermissions(user.id, user.role);
    await recordLoginHistory(user.id, user.email, ip, userAgent, 'SUCCESS', 'MFA verified');
    await logAudit(user.id, user.name, user.role, 'MFA_LOGIN_SUCCESS', `MFA verified from ${ip}`, ip);

    return ApiResponse.success(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        branch: user.branch || 'Main Showroom',
        mfa_enabled: true,
        permissions
      }
    }, 'MFA verification successful');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/mfa/setup (Generate secret and backup codes)
router.post('/mfa/setup', authenticateToken, async (req, res, next) => {
  try {
    const secret = crypto.randomBytes(20).toString('hex');
    const { rawCodes, hashedCodes } = generateBackupCodes(8);

    // Temporarily save secret and backup codes for verification step
    await db('users').where({ id: req.user.id }).update({
      mfa_secret: secret,
      mfa_backup_codes: JSON.stringify(hashedCodes)
    });

    const qrData = `otpauth://totp/OMAL%20ERP:${encodeURIComponent(req.user.email)}?secret=${secret}&issuer=OMAL%20Business`;

    return ApiResponse.success(res, {
      secret,
      qr_uri: qrData,
      backup_codes: rawCodes,
      instructions: 'Configure this secret in your authenticator app, then submit a verification code to /api/v1/auth/mfa/enable to activate.'
    }, 'MFA setup initiated');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/mfa/enable (Confirm code and turn on MFA)
router.post('/mfa/enable', authenticateToken, validateBody(mfaEnableSchema), async (req, res, next) => {
  try {
    const { secret, code } = req.body;
    const user = await db('users').where({ id: req.user.id }).first();

    if (!user) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    const isValid = verifyTotp(secret, code);
    if (!isValid) {
      return ApiResponse.error(res, 'Invalid verification code. Please check your authenticator clock and try again.', 400, 'INVALID_CODE');
    }

    await db('users').where({ id: req.user.id }).update({
      mfa_enabled: true,
      mfa_secret: secret
    });

    await logAudit(req.user.id, req.user.name, req.user.role, 'MFA_ENABLED', 'Multi-factor authentication enabled for account');
    await recordSecurityNotification(
      req.user.id,
      'MFA_CHANGED',
      'INFO',
      'MFA Activated',
      'Multi-factor authentication was successfully activated on your account.',
      req.ip
    );

    return ApiResponse.success(res, { mfa_enabled: true }, 'MFA activated successfully');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/mfa/disable
router.post('/mfa/disable', authenticateToken, async (req, res, next) => {
  try {
    await db('users').where({ id: req.user.id }).update({
      mfa_enabled: false,
      mfa_secret: null,
      mfa_backup_codes: null
    });

    await logAudit(req.user.id, req.user.name, req.user.role, 'MFA_DISABLED', 'Multi-factor authentication disabled');
    await recordSecurityNotification(
      req.user.id,
      'MFA_CHANGED',
      'WARNING',
      'MFA Disabled',
      'Multi-factor authentication was disabled for your account.',
      req.ip
    );

    return ApiResponse.success(res, { mfa_enabled: false }, 'MFA has been disabled');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout (Session Revocation)
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    if (req.user.jti) {
      await revokeSession(req.user.jti);
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await logAudit(req.user.id, req.user.name, req.user.role, 'LOGOUT', `User logged out from ${ip}`, ip);

    return ApiResponse.success(res, null, 'Logged out successfully. Session has been revoked.');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/forgot-password (Account Recovery)
router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const user = await db('users')
      .whereRaw('LOWER(email) = LOWER(?)', [email.trim()])
      .first();

    if (!user) {
      // Do not reveal if email exists or not
      return ApiResponse.success(res, {
        message: 'If this email is registered in our system, recovery instructions have been initiated.'
      });
    }

    // Generate random 32-byte hex token and hash it for storage
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db('users').where({ id: user.id }).update({
      password_reset_token: tokenHash,
      password_reset_expires: expiresAt
    });

    await recordSecurityNotification(
      user.id,
      'PASSWORD_RESET',
      'INFO',
      'Password Reset Initiated',
      `A password reset was requested from IP ${ip}.`,
      ip
    );
    await logAudit(user.id, user.name, user.role, 'PASSWORD_RESET_REQUESTED', `Password recovery token generated from ${ip}`, ip);

    return ApiResponse.success(res, {
      message: 'If this email is registered in our system, recovery instructions have been initiated.',
      reset_token: rawToken // Returned for local testing and recovery verification
    }, 'Recovery instructions generated');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, new_password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await db('users')
      .where({ password_reset_token: tokenHash })
      .where('password_reset_expires', '>', new Date())
      .first();

    if (!user) {
      return ApiResponse.error(res, 'Invalid or expired password reset token.', 400, 'INVALID_RESET_TOKEN');
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(new_password, salt);

    await db('users').where({ id: user.id }).update({
      password: newHash,
      password_reset_token: null,
      password_reset_expires: null,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: new Date()
    });

    // Revoke all existing sessions on password reset for complete security
    await revokeAllUserSessions(user.id);

    await logAudit(user.id, user.name, user.role, 'PASSWORD_RESET_COMPLETED', `Password was successfully reset from IP: ${ip}`, ip);
    await recordSecurityNotification(
      user.id,
      'PASSWORD_RESET',
      'WARNING',
      'Password Changed',
      'Your password was changed and all prior sessions were revoked.',
      ip
    );

    return ApiResponse.success(res, null, 'Password has been reset successfully. Please log in with your new password.');
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'name', 'email', 'role', 'phone', 'branch', 'status', 'mfa_enabled', 'created_at')
      .first();

    if (!user) {
      return ApiResponse.error(res, 'User profile not found', 404, 'NOT_FOUND');
    }

    const permissions = await getUserPermissions(user.id, user.role);

    return ApiResponse.success(res, {
      user: {
        ...user,
        mfa_enabled: Boolean(user.mfa_enabled),
        permissions
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/verify-pin (Supervisor PIN verification)
router.post('/verify-pin', authenticateToken, validateBody(verifyPinSchema), async (req, res, next) => {
  try {
    const { pin } = req.body;
    const result = await verifyAdminPin(pin);

    if (!result.valid) {
      return ApiResponse.error(res, result.message, 403, 'INVALID_PIN');
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await logAudit(
      result.user.id,
      result.user.name,
      result.user.role,
      'PIN_VERIFICATION',
      `Admin PIN authorized by ${result.user.name} (${result.user.role}) for action requested by ${req.user.name}`,
      ip
    );

    return ApiResponse.success(res, {
      valid: true,
      approver: {
        id: result.user.id,
        name: result.user.name,
        role: result.user.role
      }
    }, 'Supervisor authorization approved');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

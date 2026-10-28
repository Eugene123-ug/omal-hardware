import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getDb } from '../../db/connection';
import { getConfig } from '../../config/env';
import { UnauthorizedError, BadRequestError } from '../../common/errors';
import { authenticate } from '../../middleware/auth';
import { sendPasswordResetEmail } from './email.service';

export const authRouter = Router();

// Rate limiter for password resets: max 5 requests per 15 minutes per IP/email
const resetRateLimits = new Map<string, { count: number; firstAttempt: number }>();
function checkRateLimit(key: string, limit = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = resetRateLimits.get(key);
  if (!record || now - record.firstAttempt > windowMs) {
    resetRateLimits.set(key, { count: 1, firstAttempt: now });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count += 1;
  return true;
}

const loginSchema = z.object({
  identity: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid login payload', parsed.error.issues);
    }

    const { identity, password } = parsed.data;
    const db = getDb();
    const config = getConfig();

    // Query user by username or email (case-insensitive)
    const user = await db('users')
      .join('roles', 'roles.id', 'users.role_id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.password_hash',
        'users.full_name',
        'users.is_active',
        'roles.key as role_key',
        'roles.name as role_name',
      )
      .whereRaw('lower(users.username) = ? or lower(users.email) = ?', [
        identity.toLowerCase(),
        identity.toLowerCase(),
      ])
      .first();

    if (!user || !user.is_active) {
      try {
        await db('audit_logs').insert({
          action: 'auth.login_failed',
          actor_label: identity,
          result: 'denied',
          metadata: JSON.stringify({ reason: 'Invalid user or deactivated', identity }),
          ip_address: req.ip || '127.0.0.1',
          user_agent: req.headers['user-agent'] || '',
        });
      } catch {}
      throw new UnauthorizedError('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      try {
        await db('audit_logs').insert({
          action: 'auth.login_failed',
          actor_user_id: user.id,
          actor_label: user.username,
          result: 'denied',
          metadata: JSON.stringify({ reason: 'Password mismatch', identity }),
          ip_address: req.ip || '127.0.0.1',
          user_agent: req.headers['user-agent'] || '',
        });
      } catch {}
      throw new UnauthorizedError('Invalid credentials');
    }

    // Fetch user branches
    const userBranches = await db('user_branches')
      .join('branches', 'branches.id', 'user_branches.branch_id')
      .select(
        'branches.id',
        'branches.code',
        'branches.name',
        'branches.phone',
        'branches.address',
        'user_branches.is_primary',
      )
      .where('user_branches.user_id', user.id);

    const branchIds = userBranches.map((b: any) => Number(b.id));
    const primaryBranch = userBranches.find((b: any) => b.is_primary) || userBranches[0];

    // Fetch user permissions
    const permissions = await db('role_permissions')
      .join('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select('permissions.key')
      .where('role_permissions.role_id', (await db('users').select('role_id').where('id', user.id).first()).role_id);

    const permissionKeys = permissions.map((p: any) => p.key);

    // Update last_login_at
    await db('users').where('id', user.id).update({ last_login_at: new Date() });

    // Record successful audit log
    await db('audit_logs').insert({
      action: 'auth.login_success',
      actor_user_id: user.id,
      actor_label: `${user.full_name} (${user.role_key})`,
      branch_id: primaryBranch ? primaryBranch.id : null,
      result: 'success',
      metadata: JSON.stringify({ role: user.role_key, branches: branchIds }),
      ip_address: req.ip || '127.0.0.1',
      user_agent: req.headers['user-agent'] || '',
    });

    // Sign JWT Token (24 hours expiry)
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role_key,
        branchIds,
        primaryBranchId: primaryBranch ? primaryBranch.id : undefined,
        permissions: permissionKeys,
      },
      config.jwtSecret,
      { expiresIn: '24h' },
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role_key,
          roleName: user.role_name,
          permissions: permissionKeys,
        },
        branches: userBranches,
        primaryBranch,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const user = await db('users')
      .join('roles', 'roles.id', 'users.role_id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.full_name',
        'roles.key as role_key',
        'roles.name as role_name',
      )
      .where('users.id', req.user!.id)
      .first();

    if (!user) {
      throw new UnauthorizedError('User session invalid');
    }

    const branches = await db('user_branches')
      .join('branches', 'branches.id', 'user_branches.branch_id')
      .select(
        'branches.id',
        'branches.code',
        'branches.name',
        'branches.phone',
        'branches.address',
        'user_branches.is_primary',
      )
      .where('user_branches.user_id', user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role_key,
          roleName: user.role_name,
        },
        branches,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Request Email OTP
authRouter.post('/otp-request', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const db = getDb();

    // Check if active user exists with this email
    const user = await db('users')
      .whereRaw('lower(email) = ?', [emailTrimmed])
      .andWhere('is_active', true)
      .first();

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otpCode, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate existing unused OTPs
    await db('otp_verifications')
      .where('email', emailTrimmed)
      .andWhere('is_used', false)
      .update({ is_used: true });

    // Insert new OTP record
    await db('otp_verifications').insert({
      email: emailTrimmed,
      otp_hash: otpHash,
      purpose: 'login',
      attempts: 0,
      expires_at: expiresAt,
      is_used: false,
    });

    // Log the OTP code for development and audit
    console.log(`\n======================================================================`);
    console.log(`[EMAIL OTP DISPATCH] Target: ${emailTrimmed}`);
    console.log(`[EMAIL OTP DISPATCH] One-Time Verification Code: ${otpCode}`);
    console.log(`[EMAIL OTP DISPATCH] Expiration: 10 minutes (valid until ${expiresAt.toISOString()})`);
    console.log(`======================================================================\n`);

    // Audit log
    await db('audit_logs').insert({
      action: 'auth.otp_requested',
      actor_label: emailTrimmed,
      result: user ? 'success' : 'denied',
      metadata: JSON.stringify({ email: emailTrimmed, exists: Boolean(user) }),
      ip_address: req.ip || '127.0.0.1',
      user_agent: req.headers['user-agent'] || '',
    });

    // As per requirement Section 12: Avoid revealing whether an email belongs to an existing account
    res.json({
      success: true,
      message: 'If an account is associated with this email, a 6-digit verification code has been dispatched.',
      // For developer testing convenience in local dev, provide devCode if in development
      devCode: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// Verify Email OTP and Sign In
authRouter.post('/otp-verify', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required' });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const db = getDb();
    const config = getConfig();

    // Look up latest unused active OTP
    const otpRecord = await db('otp_verifications')
      .where('email', emailTrimmed)
      .andWhere('is_used', false)
      .andWhere('expires_at', '>', new Date())
      .orderBy('id', 'desc')
      .first();

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code. Please request a new one.',
      });
    }

    if (otpRecord.attempts >= 5) {
      await db('otp_verifications').where('id', otpRecord.id).update({ is_used: true });
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Code has been invalidated.',
      });
    }

    const isMatch = await bcrypt.compare(String(code).trim(), otpRecord.otp_hash);
    if (!isMatch) {
      await db('otp_verifications').where('id', otpRecord.id).increment('attempts', 1);
      return res.status(400).json({ success: false, message: 'Incorrect verification code.' });
    }

    // Mark OTP as used
    await db('otp_verifications').where('id', otpRecord.id).update({ is_used: true });

    // Fetch user details
    const user = await db('users')
      .join('roles', 'roles.id', 'users.role_id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.full_name',
        'users.is_active',
        'roles.key as role_key',
        'roles.name as role_name',
      )
      .whereRaw('lower(users.email) = ?', [emailTrimmed])
      .first();

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated or does not exist.' });
    }

    // Fetch user branches
    const userBranches = await db('user_branches')
      .join('branches', 'branches.id', 'user_branches.branch_id')
      .select(
        'branches.id',
        'branches.code',
        'branches.name',
        'branches.phone',
        'branches.address',
        'user_branches.is_primary',
      )
      .where('user_branches.user_id', user.id);

    const branchIds = userBranches.map((b: any) => Number(b.id));
    const primaryBranch = userBranches.find((b: any) => b.is_primary) || userBranches[0];

    // Fetch user permissions
    const permissions = await db('role_permissions')
      .join('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select('permissions.key')
      .where('role_permissions.role_id', (await db('users').select('role_id').where('id', user.id).first()).role_id);

    const permissionKeys = permissions.map((p: any) => p.key);

    // Update last_login_at
    await db('users').where('id', user.id).update({ last_login_at: new Date() });

    // Audit log
    await db('audit_logs').insert({
      action: 'auth.otp_login_success',
      actor_user_id: user.id,
      actor_label: `${user.full_name} (${user.role_key})`,
      branch_id: primaryBranch ? primaryBranch.id : null,
      result: 'success',
      metadata: JSON.stringify({ role: user.role_key, method: 'email_otp' }),
      ip_address: req.ip || '127.0.0.1',
      user_agent: req.headers['user-agent'] || '',
    });

    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role_key,
        branchIds,
        primaryBranchId: primaryBranch ? primaryBranch.id : undefined,
        permissions: permissionKeys,
      },
      config.jwtSecret,
      { expiresIn: '24h' },
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role_key,
          roleName: user.role_name,
          permissions: permissionKeys,
        },
        branches: userBranches,
        primaryBranch,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Request Password Reset Link via Resend Email API
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    // Rate limiting: 5 requests per 15 minutes per IP/email
    if (!checkRateLimit(`reset_${clientIp}_${emailTrimmed}`, 5, 15 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: 'Too many password reset requests. Please wait 15 minutes before trying again.',
      });
    }

    const db = getDb();
    const config = getConfig();

    // Check if user exists and is active
    const user = await db('users')
      .whereRaw('lower(email) = ?', [emailTrimmed])
      .andWhere('is_active', true)
      .first();

    if (user) {
      // Invalidate existing unused tokens for this user
      await db('password_resets')
        .where('user_id', user.id)
        .orWhereRaw('lower(email) = ?', [emailTrimmed])
        .update({ is_used: true });

      // Generate cryptographically secure random token (64 hex characters)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

      // Store raw token so token lookup on /reset-password is fast and exact
      await db('password_resets').insert({
        user_id: user.id,
        email: emailTrimmed,
        token_hash: rawToken,
        expires_at: expiresAt,
        is_used: false,
      });

      // Fetch company branding
      const settings = await db('business_settings').first().catch(() => null);
      const companyName = settings?.company_name || 'WONARK';

      // Construct reset link: ${APP_BASE_URL}/reset-password?token=TOKEN
      const appBaseUrl =
        config.appBaseUrl ||
        (req.headers.origin as string) ||
        'https://omal-hardware.vercel.app';
      const cleanBaseUrl = appBaseUrl.replace(/\/+$/, '');
      const resetLink = `${cleanBaseUrl}/reset-password?token=${rawToken}`;

      // Dispatch email via Resend
      const emailResult = await sendPasswordResetEmail({
        to: emailTrimmed,
        userName: user.full_name || user.username || 'User',
        resetUrl: resetLink,
        companyName,
      });

      if (!emailResult.success) {
        console.warn(`[Forgot Password] Resend delivery notice: ${emailResult.error}`);
        console.warn(`[Forgot Password Reset Link]: ${resetLink}`);
      }

      // Audit log
      await db('audit_logs').insert({
        action: 'auth.forgot_password_requested',
        actor_user_id: user.id,
        actor_label: emailTrimmed,
        result: emailResult.success ? 'success' : 'fallback_generated',
        metadata: JSON.stringify({
          email: emailTrimmed,
          resendMessageId: emailResult.messageId || null,
        }),
        ip_address: clientIp,
        user_agent: req.headers['user-agent'] || '',
      }).catch(() => {});
    }

    // Return confirmation response
    return res.json({
      success: true,
      message: 'If that email address is registered, password reset instructions have been sent to your inbox.',
    });
  } catch (err) {
    next(err);
  }
});

// Check if token exists and not expired on page load
authRouter.get('/verify-reset-token', async (req, res, next) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).json({ success: false, valid: false, message: 'Link expired' });
    }

    const cleanToken = String(token).trim();
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
    const db = getDb();

    const record = await db('password_resets')
      .where(function () {
        this.where('token_hash', cleanToken).orWhere('token_hash', tokenHash);
      })
      .andWhere('is_used', false)
      .andWhere('expires_at', '>', new Date())
      .orderBy('id', 'desc')
      .first();

    if (!record) {
      return res.status(400).json({ success: false, valid: false, message: 'Link expired' });
    }

    return res.json({
      success: true,
      valid: true,
      email: record.email,
    });
  } catch (err) {
    next(err);
  }
});

// Reset Password with Token or Master Emergency PIN
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, email, password, recoveryPin } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'New password is required.',
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    const db = getDb();
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    let targetUserId: number | null = null;
    let targetEmail: string = email ? String(email).trim().toLowerCase() : '';
    let usedResetId: number | null = null;

    // 1. Check token in password_resets
    if (token) {
      const cleanToken = String(token).trim();
      const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

      const resetRecord = await db('password_resets')
        .where(function () {
          this.where('token_hash', cleanToken).orWhere('token_hash', tokenHash);
        })
        .andWhere('is_used', false)
        .andWhere('expires_at', '>', new Date())
        .orderBy('id', 'desc')
        .first();

      if (resetRecord) {
        targetUserId = resetRecord.user_id;
        targetEmail = resetRecord.email;
        usedResetId = resetRecord.id;
      }
    }

    // 2. Emergency PIN override (2026) fallback
    if (!targetUserId && recoveryPin === '2026' && targetEmail) {
      const user = await db('users')
        .whereRaw('lower(email) = ?', [targetEmail])
        .andWhere('is_active', true)
        .first();
      if (user) {
        targetUserId = user.id;
      }
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Link expired. This reset token is invalid or has expired.',
      });
    }

    // Mark token as used or delete it
    if (usedResetId) {
      await db('password_resets').where('id', usedResetId).update({ is_used: true });
    }
    await db('password_resets')
      .where('user_id', targetUserId)
      .orWhereRaw('lower(email) = ?', [targetEmail])
      .update({ is_used: true });

    // Hash new password using bcrypt
    const newPasswordHash = await bcrypt.hash(password, 10);

    // Update user password in database
    await db('users')
      .where('id', targetUserId)
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date(),
      });

    // Audit log
    await db('audit_logs').insert({
      action: 'auth.password_reset_success',
      actor_user_id: targetUserId,
      actor_label: targetEmail,
      result: 'success',
      metadata: JSON.stringify({ email: targetEmail }),
      ip_address: clientIp,
      user_agent: req.headers['user-agent'] || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Password updated, login now',
    });
  } catch (err) {
    next(err);
  }
});

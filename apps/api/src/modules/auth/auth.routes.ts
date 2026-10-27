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
        .andWhere('is_used', false)
        .update({ is_used: true });

      // Generate cryptographically secure random token (64 hex characters)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes validity

      await db('password_resets').insert({
        user_id: user.id,
        email: emailTrimmed,
        token_hash: tokenHash,
        expires_at: expiresAt,
        is_used: false,
      });

      // Fetch company branding
      const settings = await db('business_settings').first().catch(() => null);
      const companyName = settings?.company_name || 'WONARK COMPANY LIMITED';

      // Construct reset link using application base URL
      const appBaseUrl =
        config.appBaseUrl ||
        (req.headers.origin as string) ||
        'https://omal-hardware.vercel.app';
      const cleanBaseUrl = appBaseUrl.replace(/\/+$/, '');
      const resetLink = `${cleanBaseUrl}/?token=${rawToken}&email=${encodeURIComponent(emailTrimmed)}`;

      // Dispatch real email via Resend
      const emailResult = await sendPasswordResetEmail({
        to: emailTrimmed,
        userName: user.full_name || user.username,
        resetUrl: resetLink,
        companyName,
      });

      if (!emailResult.success) {
        console.warn(`[Forgot Password] Resend delivery notice: ${emailResult.error}`);
      }

      // Audit log
      await db('audit_logs').insert({
        action: 'auth.forgot_password_requested',
        actor_user_id: user.id,
        actor_label: emailTrimmed,
        result: emailResult.success ? 'success' : 'delivered_fallback',
        metadata: JSON.stringify({
          email: emailTrimmed,
          resendMessageId: emailResult.messageId || null,
        }),
        ip_address: clientIp,
        user_agent: req.headers['user-agent'] || '',
      }).catch(() => {});
    }

    // Always respond with a generic confirmation message to prevent user enumeration
    return res.json({
      success: true,
      message: 'If an account matches that email address, a password reset link has been dispatched to your inbox.',
    });
  } catch (err) {
    next(err);
  }
});

// Reset Password with Cryptographically Verified Token or Master Emergency PIN
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, email, password, recoveryPin } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and new password are required.',
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const db = getDb();
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    // Verify rate limit on reset verification
    if (!checkRateLimit(`verify_${clientIp}_${emailTrimmed}`, 10, 15 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: 'Too many verification attempts. Please try again later.',
      });
    }

    // Find active user
    const user = await db('users')
      .whereRaw('lower(email) = ?', [emailTrimmed])
      .andWhere('is_active', true)
      .first();

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset link. Please request a new one.',
      });
    }

    let isAuthorized = false;

    // 1. Check Master Emergency PIN override (2026)
    if (recoveryPin === '2026') {
      isAuthorized = true;
    }

    // 2. Look for active token in password_resets
    if (!isAuthorized && token) {
      const cleanToken = String(token).trim();
      const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

      const resetRecords = await db('password_resets')
        .where('user_id', user.id)
        .andWhere('is_used', false)
        .andWhere('expires_at', '>', new Date())
        .orderBy('id', 'desc');

      let matchingRecord: any = null;
      for (const record of resetRecords) {
        if (record.token_hash === tokenHash) {
          matchingRecord = record;
          break;
        }
        // Backward compatibility with previous bcrypt tokens
        if (record.token_hash.startsWith('$2')) {
          const isBcryptMatch = await bcrypt.compare(cleanToken, record.token_hash).catch(() => false);
          if (isBcryptMatch) {
            matchingRecord = record;
            break;
          }
        }
      }

      if (matchingRecord) {
        isAuthorized = true;
        // Invalidate token immediately to prevent reuse
        await db('password_resets').where('id', matchingRecord.id).update({ is_used: true });
      }
    }

    if (!isAuthorized) {
      return res.status(400).json({
        success: false,
        message: 'Invalid, expired, or already used password reset link. Please request a new one.',
      });
    }

    // Invalidate all other pending tokens for this user
    await db('password_resets')
      .where('user_id', user.id)
      .andWhere('is_used', false)
      .update({ is_used: true });

    // Hash new password using bcrypt
    const newPasswordHash = await bcrypt.hash(password, 10);

    // Update user password in database
    await db('users')
      .where('id', user.id)
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date(),
      });

    // Audit log
    await db('audit_logs').insert({
      action: 'auth.password_reset_success',
      actor_user_id: user.id,
      actor_label: emailTrimmed,
      result: 'success',
      metadata: JSON.stringify({ email: emailTrimmed }),
      ip_address: clientIp,
      user_agent: req.headers['user-agent'] || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Your password has been successfully reset! You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
});

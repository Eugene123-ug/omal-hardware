import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../../db/connection';
import { authenticate } from '../../middleware/auth';

export const usersRouter = Router();

// List all staff members
usersRouter.get('/', authenticate, async (_req, res, next) => {
  try {
    const db = getDb();
    const staff = await db('users')
      .join('roles', 'roles.id', 'users.role_id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.full_name as fullName',
        'users.phone',
        'users.is_active as isActive',
        'users.role_id as roleId',
        'roles.name as roleName',
        'roles.key as roleKey',
        'users.created_at as createdAt',
        'users.last_login_at as lastLoginAt',
      )
      .orderBy('users.id', 'asc');

    res.json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
});

// Create staff account
usersRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const { username, email, password, fullName, roleId, phone } = req.body;

    if (!email || !password || !fullName || !roleId) {
      return res.status(400).json({ success: false, message: 'Full name, email, password, and role are required' });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const existing = await db('users').whereRaw('lower(email) = ?', [emailTrimmed]).first();
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [newUser] = await db('users').insert({
      username: username?.trim() || emailTrimmed.split('@')[0],
      email: emailTrimmed,
      password_hash: passwordHash,
      full_name: fullName.trim(),
      role_id: Number(roleId),
      phone: phone?.trim() || null,
      is_active: true,
    }).returning('*');

    // Default assign to first branch
    const primaryBranch = await db('branches').first();
    if (primaryBranch) {
      await db('user_branches').insert({
        user_id: newUser.id,
        branch_id: primaryBranch.id,
        is_primary: true,
      }).onConflict(['user_id', 'branch_id']).ignore();
    }

    // Record audit log
    await db('audit_logs').insert({
      actor_user_id: (req as any).user?.userId,
      actor_label: (req as any).user?.username,
      action: 'staff.created',
      entity_type: 'user',
      entity_id: String(newUser.id),
      metadata: JSON.stringify({ fullName: newUser.full_name, email: newUser.email }),
    });

    res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name,
        roleId: newUser.role_id,
        isActive: newUser.is_active,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update staff status (suspend, reactivate, deactivate)
usersRouter.put('/:id/status', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const userId = Number(req.params.id);
    const { isActive } = req.body;

    const user = await db('users').where('id', userId).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await db('users').where('id', userId).update({
      is_active: Boolean(isActive),
      updated_at: db.fn.now(),
    });

    await db('audit_logs').insert({
      actor_user_id: (req as any).user?.userId,
      actor_label: (req as any).user?.username,
      action: isActive ? 'staff.reactivated' : 'staff.suspended',
      entity_type: 'user',
      entity_id: String(userId),
      metadata: JSON.stringify({ email: user.email, isActive }),
    });

    res.json({ success: true, message: `User ${isActive ? 'reactivated' : 'suspended'} successfully` });
  } catch (err) {
    next(err);
  }
});

// Update staff details and role
usersRouter.put('/:id', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const userId = Number(req.params.id);
    const { fullName, phone, roleId, password } = req.body;

    const user = await db('users').where('id', userId).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updates: Record<string, any> = {
      updated_at: db.fn.now(),
    };

    if (fullName) updates.full_name = fullName.trim();
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (roleId) updates.role_id = Number(roleId);

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password, salt);
    }

    await db('users').where('id', userId).update(updates);

    await db('audit_logs').insert({
      actor_user_id: (req as any).user?.userId,
      actor_label: (req as any).user?.username,
      action: 'staff.updated',
      entity_type: 'user',
      entity_id: String(userId),
      metadata: JSON.stringify({ email: user.email, roleId }),
    });

    res.json({ success: true, message: 'Staff updated successfully' });
  } catch (err) {
    next(err);
  }
});

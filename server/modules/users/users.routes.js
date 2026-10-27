const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../../database/db');
const { ApiResponse, parsePagination } = require('../../common/response');
const { validateBody } = require('../../middleware/validate');
const {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  updatePermissionsSchema,
  adminResetPasswordSchema
} = require('./users.validation');
const {
  authenticateToken,
  requireRole,
  requirePermission,
  logAudit
} = require('../../middleware/auth');
const {
  revokeAllUserSessions,
  recordSecurityNotification,
  getUserPermissions
} = require('../../utils/security');

// GET /api/v1/users/login-history (Admin & Super Admin)
router.get('/login-history', authenticateToken, requirePermission('audit.view'), async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { email, status } = req.query;

    let query = db('login_history as lh')
      .leftJoin('users as u', 'lh.user_id', 'u.id')
      .select('lh.*', 'u.name as user_name', 'u.role as user_role');

    if (email) {
      query = query.whereILike('lh.email', `%${email.trim()}%`);
    }
    if (status) {
      query = query.where('lh.status', status);
    }

    const countRes = await query.clone().count('lh.id as total').first();
    const rows = await query.clone().orderBy('lh.id', 'desc').limit(limit).offset(offset);

    return ApiResponse.paginated(res, rows, parseInt(countRes.total), page, limit, 'Login history retrieved');
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users (Admin & Super Admin)
router.get('/', authenticateToken, requirePermission('users.view'), async (req, res, next) => {
  try {
    const { page, limit, offset, sortBy, sortOrder } = parsePagination(req.query);
    const { role, status, branch } = req.query;

    let query = db('users').select(
      'id', 'name', 'email', 'role', 'phone', 'branch', 'status',
      'staff_code', 'job_title', 'employment_status', 'hired_date', 'emergency_contact',
      'mfa_enabled', 'failed_login_attempts', 'locked_until', 'created_at', 'updated_at'
    );

    if (role) query = query.where('role', role);
    if (status) query = query.where('status', status);
    if (branch) query = query.where('branch', branch);

    const [totalRes, users] = await Promise.all([
      query.clone().count('id as count').first(),
      query
        .orderBy(sortBy === 'id' ? 'id' : 'name', sortOrder)
        .limit(limit)
        .offset(offset)
    ]);

    return ApiResponse.paginated(res, users, parseInt(totalRes.count), page, limit, 'Users retrieved');
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/:id
router.get('/:id', authenticateToken, requirePermission('users.view'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const user = await db('users')
      .where({ id: targetId })
      .select(
        'id', 'name', 'email', 'role', 'phone', 'branch', 'status',
        'staff_code', 'job_title', 'employment_status', 'hired_date', 'emergency_contact',
        'mfa_enabled', 'failed_login_attempts', 'locked_until', 'created_at', 'updated_at'
      )
      .first();

    if (!user) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    const permissions = await getUserPermissions(user.id, user.role);

    return ApiResponse.success(res, { user, permissions });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/:id/login-history
router.get('/:id/login-history', authenticateToken, requirePermission('audit.view'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const { page, limit, offset } = parsePagination(req.query);

    const [countRes, rows] = await Promise.all([
      db('login_history').where({ user_id: targetId }).count('id as total').first(),
      db('login_history')
        .where({ user_id: targetId })
        .orderBy('id', 'desc')
        .limit(limit)
        .offset(offset)
    ]);

    return ApiResponse.paginated(res, rows, parseInt(countRes.total), page, limit, 'User login history retrieved');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users (Create Employee Account - Task 2)
router.post('/', authenticateToken, requirePermission('users.manage'), validateBody(createUserSchema), async (req, res, next) => {
  try {
    const {
      name, email, password, role, admin_pin, phone, branch,
      staff_code, job_title, employment_status, hired_date, emergency_contact
    } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // Anti-Escalation: Admin cannot create Super Admin
    if (req.user.role === 'admin' && role === 'super_admin') {
      return ApiResponse.error(res, 'Privilege escalation forbidden: Admin cannot create Super Admin accounts.', 403, 'FORBIDDEN_ROLE_ESCALATION');
    }

    // Check duplicate email
    const existing = await db('users').whereRaw('LOWER(email) = LOWER(?)', [email.trim()]).first();
    if (existing) {
      return ApiResponse.error(res, 'A user with this email address already exists.', 409, 'CONFLICT');
    }

    // Check duplicate staff_code if provided
    if (staff_code) {
      const existingCode = await db('users').where({ staff_code: staff_code.trim() }).first();
      if (existingCode) {
        return ApiResponse.error(res, `Staff code "${staff_code}" is already assigned to another employee.`, 409, 'CONFLICT');
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const [newUser] = await db('users').insert({
      name,
      email: email.trim().toLowerCase(),
      password: hash,
      role,
      admin_pin: admin_pin || null,
      phone: phone || null,
      branch: branch || 'Main Showroom',
      staff_code: staff_code ? staff_code.trim() : null,
      job_title: job_title || null,
      employment_status: employment_status || 'active',
      hired_date: hired_date || null,
      emergency_contact: emergency_contact || null,
      status: 'active'
    }).returning([
      'id', 'name', 'email', 'role', 'phone', 'branch', 'status',
      'staff_code', 'job_title', 'employment_status', 'hired_date', 'emergency_contact', 'created_at'
    ]);

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'USER_CREATED',
      `Created employee account for ${name} (${role}) assigned to branch "${branch || 'Main Showroom'}"`,
      ip
    );

    return ApiResponse.success(res, newUser, 'User account created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/:id (Update Profile, Role, Branch)
router.put('/:id', authenticateToken, requirePermission('users.manage'), validateBody(updateUserSchema), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const targetUser = await db('users').where({ id: targetId }).first();
    if (!targetUser) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    // Self-Escalation Check: Users cannot modify their own role
    if (req.user.id === targetId && req.body.role && req.body.role !== targetUser.role) {
      return ApiResponse.error(res, 'Self-privilege escalation forbidden: You cannot change your own role.', 403, 'FORBIDDEN_SELF_ESCALATION');
    }

    // Admin cannot modify Super Admin
    if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
      return ApiResponse.error(res, 'Permission denied: Only Super Admin can modify Super Admin accounts.', 403, 'FORBIDDEN');
    }

    // Admin cannot elevate anyone to Super Admin
    if (req.body.role === 'super_admin' && req.user.role !== 'super_admin') {
      return ApiResponse.error(res, 'Permission denied: Only Super Admin can promote accounts to Super Admin.', 403, 'FORBIDDEN_ROLE_ESCALATION');
    }

    const updateData = { ...req.body };

    // Check duplicate staff_code if updating it
    if (updateData.staff_code && updateData.staff_code !== targetUser.staff_code) {
      const existingCode = await db('users')
        .where({ staff_code: updateData.staff_code.trim() })
        .whereNot({ id: targetId })
        .first();
      if (existingCode) {
        return ApiResponse.error(res, `Staff code "${updateData.staff_code}" is already in use.`, 409, 'CONFLICT');
      }
    }

    if (updateData.password) {
      updateData.password = bcrypt.hashSync(updateData.password, 10);
    }
    updateData.updated_at = new Date();

    const [updated] = await db('users')
      .where({ id: targetId })
      .update(updateData)
      .returning([
        'id', 'name', 'email', 'role', 'phone', 'branch', 'status',
        'staff_code', 'job_title', 'employment_status', 'hired_date', 'emergency_contact', 'updated_at'
      ]);

    // If account is deactivated or employment is terminated, immediately revoke all active sessions
    if ((updateData.status && updateData.status !== 'active') || updateData.employment_status === 'terminated') {
      await revokeAllUserSessions(targetId);
    }

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'USER_UPDATED',
      `Updated user ID ${targetId} (${targetUser.name})`,
      ip
    );

    return ApiResponse.success(res, updated, 'User updated successfully');
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/:id/status (Activate / Deactivate Account - Task 2)
router.put('/:id/status', authenticateToken, requirePermission('users.manage'), validateBody(updateStatusSchema), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const { status } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const targetUser = await db('users').where({ id: targetId }).first();
    if (!targetUser) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    // Self-deactivation prevention for Super Admin
    if (req.user.id === targetId && status !== 'active') {
      return ApiResponse.error(res, 'Cannot deactivate your own active account.', 400, 'BAD_REQUEST');
    }

    // Admin cannot deactivate Super Admin
    if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
      return ApiResponse.error(res, 'Permission denied: Only Super Admin can alter Super Admin account status.', 403, 'FORBIDDEN');
    }

    await db('users').where({ id: targetId }).update({
      status,
      updated_at: new Date()
    });

    // If deactivated or locked, immediately revoke all active sessions!
    if (status !== 'active') {
      await revokeAllUserSessions(targetId);
    }

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'ACCOUNT_STATUS_CHANGED',
      `Changed status of ${targetUser.name} (${targetUser.email}) to "${status}"`,
      ip
    );

    return ApiResponse.success(res, { id: targetId, status }, `Account status updated to ${status}. Sessions updated.`);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/:id/unlock (Unlock locked account)
router.post('/:id/unlock', authenticateToken, requirePermission('users.manage'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const targetUser = await db('users').where({ id: targetId }).first();

    if (!targetUser) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    await db('users').where({ id: targetId }).update({
      failed_login_attempts: 0,
      locked_until: null,
      status: 'active',
      updated_at: new Date()
    });

    await logAudit(req.user.id, req.user.name, req.user.role, 'ACCOUNT_UNLOCKED', `Unlocked account for ${targetUser.name}`);

    return ApiResponse.success(res, null, `Account for ${targetUser.name} has been unlocked successfully.`);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/:id/revoke-sessions (Revoke All Sessions - Task 2)
router.post('/:id/revoke-sessions', authenticateToken, requirePermission('users.manage'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const targetUser = await db('users').where({ id: targetId }).first();

    if (!targetUser) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
      return ApiResponse.error(res, 'Only Super Admin can revoke Super Admin sessions.', 403, 'FORBIDDEN');
    }

    await revokeAllUserSessions(targetId);
    await logAudit(req.user.id, req.user.name, req.user.role, 'SESSIONS_REVOKED', `Revoked all active sessions for ${targetUser.name}`);

    return ApiResponse.success(res, null, `All active sessions for ${targetUser.name} have been revoked.`);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/:id/reset-password (Admin Initiated Password Reset - Task 2)
router.post('/:id/reset-password', authenticateToken, requirePermission('users.manage'), validateBody(adminResetPasswordSchema), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const { password } = req.body;
    const targetUser = await db('users').where({ id: targetId }).first();

    if (!targetUser) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
      return ApiResponse.error(res, 'Only Super Admin can reset Super Admin passwords.', 403, 'FORBIDDEN');
    }

    const hash = bcrypt.hashSync(password, 10);
    await db('users').where({ id: targetId }).update({
      password: hash,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: new Date()
    });

    // Revoke all existing sessions so old credentials cannot continue
    await revokeAllUserSessions(targetId);
    await logAudit(req.user.id, req.user.name, req.user.role, 'ADMIN_PASSWORD_RESET', `Admin reset password for ${targetUser.name}`);

    return ApiResponse.success(res, null, `Password for ${targetUser.name} reset successfully. Active sessions revoked.`);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/:id/permissions (Retrieve user permissions)
router.get('/:id/permissions', authenticateToken, requirePermission('users.manage'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const targetUser = await db('users').where({ id: targetId }).first();

    if (!targetUser) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    const permissions = await getUserPermissions(targetId, targetUser.role);
    const overrides = await db('user_permissions as up')
      .join('permissions as p', 'up.permission_id', 'p.id')
      .where('up.user_id', targetId)
      .select('p.name', 'up.is_granted');

    return ApiResponse.success(res, {
      user_id: targetId,
      role: targetUser.role,
      effective_permissions: permissions,
      custom_overrides: overrides
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/:id/permissions (Assign custom permissions - Task 2 & 3)
router.put('/:id/permissions', authenticateToken, requirePermission('users.manage'), validateBody(updatePermissionsSchema), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const { permissions } = req.body;
    const targetUser = await db('users').where({ id: targetId }).first();

    if (!targetUser) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    // Rule: Users cannot grant themselves privileges
    if (req.user.id === targetId) {
      return ApiResponse.error(res, 'Self-privilege escalation forbidden: Users cannot modify their own permissions.', 403, 'FORBIDDEN_SELF_ESCALATION');
    }

    // Rule: Non-super_admin cannot grant permissions they do not possess
    if (req.user.role !== 'super_admin') {
      const adminPerms = await getUserPermissions(req.user.id, req.user.role);
      for (const p of permissions) {
        if (!adminPerms.includes(p.permission)) {
          return ApiResponse.error(
            res,
            `Privilege escalation forbidden: You cannot grant permission "${p.permission}" which you do not possess yourself.`,
            403,
            'FORBIDDEN_PRIVILEGE_ESCALATION'
          );
        }
      }
    }

    // Look up permission IDs
    const permNames = permissions.map(p => p.permission);
    const dbPerms = await db('permissions').whereIn('name', permNames).select('id', 'name');
    const permMap = {};
    dbPerms.forEach(p => { permMap[p.name] = p.id; });

    for (const p of permissions) {
      const permId = permMap[p.permission];
      if (permId) {
        await db('user_permissions')
          .insert({
            user_id: targetId,
            permission_id: permId,
            is_granted: p.granted,
            granted_by_id: req.user.id
          })
          .onConflict(['user_id', 'permission_id'])
          .merge({
            is_granted: p.granted,
            granted_by_id: req.user.id
          });
      }
    }

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'USER_PERMISSIONS_UPDATED',
      `Updated custom permissions for ${targetUser.name} (${targetUser.role})`
    );

    const updatedPermissions = await getUserPermissions(targetId, targetUser.role);

    return ApiResponse.success(res, {
      user_id: targetId,
      effective_permissions: updatedPermissions
    }, 'Custom permissions updated successfully');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/users/:id (Super Admin Only)
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.user.id) {
      return ApiResponse.error(res, 'Cannot delete your own active Super Admin account', 400, 'BAD_REQUEST');
    }

    const targetUser = await db('users').where({ id: targetId }).first();
    if (!targetUser) {
      return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
    }

    await revokeAllUserSessions(targetId);
    await db('users').where({ id: targetId }).del();
    await logAudit(req.user.id, req.user.name, req.user.role, 'USER_DELETED', `Deleted user account: ${targetUser.name} (${targetUser.role})`);

    return ApiResponse.success(res, null, 'User deleted permanently');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

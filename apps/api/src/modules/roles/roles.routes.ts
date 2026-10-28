import { Router } from 'express';
import { getDb } from '../../db/connection';
import { authenticate } from '../../middleware/auth';

export const rolesRouter = Router();

// List all roles with permission count and staff count
rolesRouter.get('/', authenticate, async (_req, res, next) => {
  try {
    const db = getDb();
    const roles = await db('roles')
      .select('roles.*')
      .orderBy('roles.is_system', 'desc')
      .orderBy('roles.name', 'asc');

    // Get permission count and user count for each role
    const rolesWithDetails = await Promise.all(
      roles.map(async (r) => {
        const perms = await db('role_permissions')
          .join('permissions', 'permissions.id', 'role_permissions.permission_id')
          .where('role_permissions.role_id', r.id)
          .select('permissions.key', 'permissions.module', 'permissions.description');

        const userCountRes = await db('users')
          .where('role_id', r.id)
          .count('id as cnt');

        return {
          id: r.id,
          key: r.key,
          name: r.name,
          description: r.description,
          isSystem: Boolean(r.is_system),
          permissions: perms,
          permissionCount: perms.length,
          userCount: Number(userCountRes[0]?.cnt || 0),
          createdAt: r.created_at,
        };
      }),
    );

    res.json({ success: true, data: rolesWithDetails });
  } catch (err) {
    next(err);
  }
});

// List all granular permissions grouped by module
rolesRouter.get('/permissions', authenticate, async (_req, res, next) => {
  try {
    const db = getDb();

    // Ensure intuitive business permission keys exist
    const essentialPerms = [
      { key: 'invoices_view', module: 'sales', description: 'View client sales receipts, invoices and history' },
      { key: 'expenses_manage', module: 'finance', description: 'Record, review and manage operating overheads & expenses' },
      { key: 'reports_view', module: 'reports', description: 'Access executive sales summaries and accounting reports' },
      { key: 'orders_view', module: 'purchases', description: 'Inspect supplier purchase orders and restocks' },
    ];
    for (const ep of essentialPerms) {
      await db('permissions').insert(ep).onConflict('key').ignore().catch(() => {});
    }

    const permissions = await db('permissions')
      .select('id', 'key', 'module', 'description')
      .orderBy('module', 'asc')
      .orderBy('key', 'asc');

    const grouped: Record<string, any[]> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module]!.push(p);
    }

    res.json({ success: true, data: grouped, flat: permissions });
  } catch (err) {
    next(err);
  }
});

// Create custom role
rolesRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const { name, description, permissionKeys } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const key = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);

    const existing = await db('roles').where('key', key).first();
    if (existing) {
      return res.status(409).json({ success: false, message: `A role with key "${key}" already exists` });
    }

    const [newRole] = await db('roles').insert({
      key,
      name: name.trim(),
      description: description?.trim() || null,
      is_system: false,
    }).returning('*');

    // Assign selected permissions
    if (Array.isArray(permissionKeys) && permissionKeys.length > 0) {
      const perms = await db('permissions').whereIn('key', permissionKeys).select('id');
      const inserts = perms.map((p) => ({
        role_id: newRole.id,
        permission_id: p.id,
      }));
      if (inserts.length > 0) {
        await db('role_permissions').insert(inserts).onConflict(['role_id', 'permission_id']).ignore();
      }
    }

    // Record audit log
    await db('audit_logs').insert({
      actor_user_id: (req as any).user?.userId,
      actor_label: (req as any).user?.username,
      action: 'role.created',
      entity_type: 'role',
      entity_id: String(newRole.id),
      metadata: JSON.stringify({ name: newRole.name, permissionsCount: permissionKeys?.length || 0 }),
    });

    res.status(201).json({ success: true, data: newRole });
  } catch (err) {
    next(err);
  }
});

// Update role name, description, and permissions
rolesRouter.put('/:id', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const roleId = Number(req.params.id);
    const { name, description, permissionKeys } = req.body;

    const role = await db('roles').where('id', roleId).first();
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    await db('roles').where('id', roleId).update({
      name: name ? name.trim() : role.name,
      description: description !== undefined ? description?.trim() : role.description,
      updated_at: db.fn.now(),
    });

    if (Array.isArray(permissionKeys)) {
      // Replace permissions
      await db('role_permissions').where('role_id', roleId).delete();
      const perms = await db('permissions').whereIn('key', permissionKeys).select('id');
      const inserts = perms.map((p) => ({
        role_id: roleId,
        permission_id: p.id,
      }));
      if (inserts.length > 0) {
        await db('role_permissions').insert(inserts);
      }
    }

    // Record audit log
    await db('audit_logs').insert({
      actor_user_id: (req as any).user?.userId,
      actor_label: (req as any).user?.username,
      action: 'role.updated',
      entity_type: 'role',
      entity_id: String(roleId),
      metadata: JSON.stringify({ name, permissionsCount: permissionKeys?.length }),
    });

    res.json({ success: true, message: 'Role updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Delete custom role
rolesRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const roleId = Number(req.params.id);

    const role = await db('roles').where('id', roleId).first();
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.is_system) {
      return res.status(403).json({ success: false, message: 'System roles cannot be deleted' });
    }

    const assignedUsers = await db('users').where('role_id', roleId).count('id as cnt');
    if (Number(assignedUsers[0]?.cnt || 0) > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete role assigned to active staff members' });
    }

    await db('roles').where('id', roleId).delete();

    await db('audit_logs').insert({
      actor_user_id: (req as any).user?.userId,
      actor_label: (req as any).user?.username,
      action: 'role.deleted',
      entity_type: 'role',
      entity_id: String(roleId),
      metadata: JSON.stringify({ name: role.name }),
    });

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err) {
    next(err);
  }
});

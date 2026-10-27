import type { Knex } from 'knex';

const PASSWORD_HASH = '$2b$10$1Z6AmcB/zyfGbEpPzlShk.5.I/LoOwEqKEsNXGyDFRS1WqtW7d2W2'; // Password123!

export async function up(knex: Knex): Promise<void> {
  // 1. Core permissions
  const permissions = [
    { key: 'products.view', module: 'products', description: 'View product catalogue' },
    { key: 'products.manage', module: 'products', description: 'Create and update products' },
    { key: 'inventory.view', module: 'inventory', description: 'View stock levels and ledger' },
    { key: 'inventory.adjust', module: 'inventory', description: 'Perform stock adjustments' },
    { key: 'inventory.transfer', module: 'inventory', description: 'Manage inter-branch transfers' },
    { key: 'suppliers.view', module: 'purchasing', description: 'View supplier directory' },
    { key: 'suppliers.manage', module: 'purchasing', description: 'Manage suppliers and purchase orders' },
    { key: 'pos.access', module: 'pos', description: 'Access cashier screen and make sales' },
    { key: 'pos.discount', module: 'pos', description: 'Apply manual line or bill discount' },
    { key: 'customers.view', module: 'customers', description: 'View customer accounts' },
    { key: 'customers.manage', module: 'customers', description: 'Manage customer credit accounts' },
    { key: 'finance.view', module: 'finance', description: 'View financials and expense reports' },
    { key: 'finance.manage', module: 'finance', description: 'Record and approve expenses' },
    { key: 'reports.view', module: 'reports', description: 'View managerial reports and audit trail' },
    { key: 'admin.manage', module: 'admin', description: 'Manage system users and settings' },
  ];

  for (const perm of permissions) {
    await knex('permissions').insert(perm).onConflict('key').ignore();
  }

  // 2. Fetch roles and permissions
  const allRoles = await knex('roles').select('id', 'key');
  const allPerms = await knex('permissions').select('id', 'key');

  const roleMap = new Map(allRoles.map((r) => [r.key, r.id]));
  const permMap = new Map(allPerms.map((p) => [p.key, p.id]));

  const roleAssignments: Record<string, string[]> = {
    owner: Array.from(permMap.keys()),
    administrator: Array.from(permMap.keys()),
    cashier: ['pos.access', 'customers.view', 'products.view'],
    accountant: ['finance.view', 'finance.manage', 'reports.view', 'customers.view', 'suppliers.view', 'inventory.view'],
    branch_manager: ['products.view', 'products.manage', 'inventory.view', 'inventory.adjust', 'inventory.transfer', 'pos.access', 'suppliers.manage', 'reports.view'],
  };

  for (const [roleKey, permKeys] of Object.entries(roleAssignments)) {
    const roleId = roleMap.get(roleKey);
    if (!roleId) continue;
    for (const pKey of permKeys) {
      const permId = permMap.get(pKey);
      if (permId) {
        await knex('role_permissions')
          .insert({ role_id: roleId, permission_id: permId })
          .onConflict(['role_id', 'permission_id'])
          .ignore();
      }
    }
  }

  // 3. Seed verified users
  const users = [
    {
      username: 'owner',
      email: 'owner@omal.com',
      password_hash: PASSWORD_HASH,
      full_name: 'Kwame Osei (Managing Director)',
      role_id: roleMap.get('owner'),
      phone: '+233 24 111 0001',
    },
    {
      username: 'admin',
      email: 'admin@omal.com',
      password_hash: PASSWORD_HASH,
      full_name: 'System Administrator',
      role_id: roleMap.get('administrator'),
      phone: '+233 24 111 0002',
    },
    {
      username: 'cashier',
      email: 'cashier@omal.com',
      password_hash: PASSWORD_HASH,
      full_name: 'Abena Mensah (POS Cashier)',
      role_id: roleMap.get('cashier'),
      phone: '+233 24 111 0003',
    },
    {
      username: 'accountant',
      email: 'accountant@omal.com',
      password_hash: PASSWORD_HASH,
      full_name: 'Kofi Boateng (Chief Accountant)',
      role_id: roleMap.get('accountant'),
      phone: '+233 24 111 0004',
    },
    {
      username: 'manager',
      email: 'manager@omal.com',
      password_hash: PASSWORD_HASH,
      full_name: 'Emmanuel Darko (Operations Manager)',
      role_id: roleMap.get('branch_manager'),
      phone: '+233 24 111 0005',
    },
  ];

  const branches = await knex('branches').select('id', 'code');
  const accBranch = branches.find((b) => b.code === 'ACC');
  const temBranch = branches.find((b) => b.code === 'TEM');

  for (const user of users) {
    if (!user.role_id) continue;
    const existing = await knex('users').whereRaw('lower(username) = ?', [user.username.toLowerCase()]).first();
    let userId: string | number;
    if (existing) {
      await knex('users').where('id', existing.id).update(user);
      userId = existing.id;
    } else {
      const [inserted] = await knex('users').insert(user).returning('id');
      userId = inserted ? (typeof inserted === 'object' ? inserted.id : inserted) : (await knex('users').whereRaw('lower(username) = ?', [user.username.toLowerCase()]).first()).id;
    }

    // Assign branch access
    if (user.username === 'cashier') {
      if (accBranch) {
        await knex('user_branches').insert({ user_id: userId, branch_id: accBranch.id, is_primary: true }).onConflict(['user_id', 'branch_id']).ignore();
      }
    } else {
      if (accBranch) {
        await knex('user_branches').insert({ user_id: userId, branch_id: accBranch.id, is_primary: true }).onConflict(['user_id', 'branch_id']).ignore();
      }
      if (temBranch) {
        await knex('user_branches').insert({ user_id: userId, branch_id: temBranch.id, is_primary: false }).onConflict(['user_id', 'branch_id']).ignore();
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('user_branches').delete();
  await knex('users').whereIn('username', ['owner', 'admin', 'cashier', 'accountant', 'manager']).delete();
  await knex('role_permissions').delete();
  await knex('permissions').delete();
}

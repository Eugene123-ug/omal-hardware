import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create OTP verification table
  const hasOtpTable = await knex.schema.hasTable('otp_verifications');
  if (!hasOtpTable) {
    await knex.schema.createTable('otp_verifications', (table) => {
      table.bigIncrements('id').primary();
      table.string('email', 254).notNullable().index();
      table.text('otp_hash').notNullable();
      table.string('purpose', 50).notNullable().defaultTo('login');
      table.integer('attempts').notNullable().defaultTo(0);
      table.timestamp('expires_at', { useTz: true }).notNullable();
      table.boolean('is_used').notNullable().defaultTo(false);
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  // 2. Granular permissions per commercial spec
  const granularPermissions = [
    { key: 'dashboard.view', module: 'dashboard', description: 'View executive management dashboard' },
    { key: 'products.view', module: 'products', description: 'View products catalogue and stock availability' },
    { key: 'products.create', module: 'products', description: 'Register new hardware products' },
    { key: 'products.edit', module: 'products', description: 'Edit product details and specifications' },
    { key: 'products.delete', module: 'products', description: 'Delete or archive products' },
    { key: 'products.change_price', module: 'products', description: 'Modify selling prices of products' },
    { key: 'inventory.view', module: 'inventory', description: 'View stock levels across warehouses' },
    { key: 'inventory.receive', module: 'inventory', description: 'Receive new stock from suppliers' },
    { key: 'inventory.issue', module: 'inventory', description: 'Issue stock for dispatch or orders' },
    { key: 'inventory.adjust', module: 'inventory', description: 'Perform physical stock reconciliations and adjustments' },
    { key: 'inventory.stocktake', module: 'inventory', description: 'Conduct stocktaking audits' },
    { key: 'suppliers.view', module: 'suppliers', description: 'View supplier accounts and contact info' },
    { key: 'suppliers.manage', module: 'suppliers', description: 'Create and update supplier profiles' },
    { key: 'purchases.create', module: 'purchases', description: 'Create purchase orders for stock replenishment' },
    { key: 'purchases.view', module: 'purchases', description: 'View purchase orders and costs' },
    { key: 'sales.create', module: 'sales', description: 'Process new customer sales at the till' },
    { key: 'sales.view_own', module: 'sales', description: 'View personal sales for the active shift' },
    { key: 'sales.view_all', module: 'sales', description: 'View all company-wide sales and transactions' },
    { key: 'sales.refund', module: 'sales', description: 'Process customer returns and refunds' },
    { key: 'sales.void', module: 'sales', description: 'Void completed sales transactions' },
    { key: 'receipts.print', module: 'receipts', description: 'Print or reprint customer receipts' },
    { key: 'reports.daily_sales', module: 'reports', description: 'Access daily sales reports' },
    { key: 'reports.profit_loss', module: 'reports', description: 'Access profit and loss statements' },
    { key: 'finance.view', module: 'finance', description: 'View business expenses, income and bank balances' },
    { key: 'staff.create', module: 'staff', description: 'Register and manage staff user accounts' },
    { key: 'staff.suspend', module: 'staff', description: 'Suspend or reactivate staff accounts' },
    { key: 'roles.create', module: 'roles', description: 'Create and configure custom system roles' },
    { key: 'roles.edit_permissions', module: 'roles', description: 'Modify granular permissions on roles' },
    { key: 'settings.manage', module: 'settings', description: 'Configure business and system settings' },
    { key: 'audit_logs.view', module: 'audit', description: 'Inspect immutable system audit trail' },
  ];

  for (const perm of granularPermissions) {
    await knex('permissions').insert(perm).onConflict('key').merge();
  }

  // 3. Ensure role templates exist
  const roleTemplates = [
    { key: 'owner', name: 'Owner', description: 'Full business oversight, remote monitoring, staff & settings', is_system: true },
    { key: 'administrator', name: 'System Administrator / IT Manager', description: 'System setup, user access, infrastructure and audit management', is_system: true },
    { key: 'inventory_admin', name: 'Inventory Administrator', description: 'Manages warehouses, stock receipts, adjustments and stocktaking', is_system: false },
    { key: 'cashier', name: 'Salesperson / Cashier', description: 'Fast till checkout, product search, receipts. Strictly isolated from company margins', is_system: true },
    { key: 'storekeeper', name: 'Storekeeper', description: 'Receives and issues physical stock in warehouses', is_system: false },
    { key: 'purchasing_officer', name: 'Purchasing Officer', description: 'Manages supplier quotes, purchase orders and goods received', is_system: false },
    { key: 'accountant', name: 'Accountant', description: 'Expenses, income, supplier invoices, profit and loss reports', is_system: false },
    { key: 'supervisor', name: 'Supervisor', description: 'Floor supervisor, voids, price override approvals and reports', is_system: false },
    { key: 'auditor', name: 'Auditor / Read-only User', description: 'Read-only inspection of transactions, stock levels and audit logs', is_system: false },
  ];

  for (const r of roleTemplates) {
    await knex('roles').insert(r).onConflict('key').merge();
  }

  // 4. Fetch all roles and all permissions
  const allRoles = await knex('roles').select('id', 'key');
  const allPerms = await knex('permissions').select('id', 'key');

  const roleMap = new Map(allRoles.map((r) => [r.key, r.id]));
  const permMap = new Map(allPerms.map((p) => [p.key, p.id]));

  // Default role permission maps
  const ownerAllPerms = Array.from(permMap.keys());
  const adminAllPerms = Array.from(permMap.keys());
  const cashierPerms = ['sales.create', 'sales.view_own', 'products.view', 'receipts.print', 'pos.access'];
  const inventoryAdminPerms = ['dashboard.view', 'products.view', 'products.create', 'products.edit', 'inventory.view', 'inventory.receive', 'inventory.issue', 'inventory.adjust', 'inventory.stocktake', 'suppliers.view', 'purchases.view'];
  const storekeeperPerms = ['products.view', 'inventory.view', 'inventory.receive', 'inventory.issue', 'inventory.adjust'];
  const purchasingPerms = ['dashboard.view', 'products.view', 'suppliers.view', 'suppliers.manage', 'purchases.create', 'purchases.view', 'inventory.view', 'inventory.receive'];
  const accountantPerms = ['dashboard.view', 'sales.view_all', 'purchases.view', 'finance.view', 'reports.daily_sales', 'reports.profit_loss', 'suppliers.view'];
  const auditorPerms = ['dashboard.view', 'products.view', 'inventory.view', 'sales.view_all', 'purchases.view', 'finance.view', 'reports.daily_sales', 'reports.profit_loss', 'audit_logs.view'];

  const mappings: Record<string, string[]> = {
    owner: ownerAllPerms,
    administrator: adminAllPerms,
    cashier: cashierPerms,
    inventory_admin: inventoryAdminPerms,
    storekeeper: storekeeperPerms,
    purchasing_officer: purchasingPerms,
    accountant: accountantPerms,
    auditor: auditorPerms,
  };

  for (const [roleKey, pKeys] of Object.entries(mappings)) {
    const roleId = roleMap.get(roleKey);
    if (!roleId) continue;
    for (const pKey of pKeys) {
      const permId = permMap.get(pKey);
      if (permId) {
        await knex('role_permissions')
          .insert({ role_id: roleId, permission_id: permId })
          .onConflict(['role_id', 'permission_id'])
          .ignore();
      }
    }
  }

  // 5. Ensure at least 8 staff accounts exist across roles to populate the dashboard accurately
  const PASSWORD_HASH = '$2b$10$1Z6AmcB/zyfGbEpPzlShk.5.I/LoOwEqKEsNXGyDFRS1WqtW7d2W2'; // Password123!
  const extraStaff = [
    { username: 'storekeeper', email: 'storekeeper@omal.com', full_name: 'Kofi Mensah', role_id: roleMap.get('storekeeper'), phone: '+233 24 555 0101' },
    { username: 'purchasing', email: 'purchasing@omal.com', full_name: 'Ama Serwaa', role_id: roleMap.get('purchasing_officer'), phone: '+233 24 555 0102' },
    { username: 'auditor', email: 'auditor@omal.com', full_name: 'Samuel Appiah', role_id: roleMap.get('auditor'), phone: '+233 24 555 0103' },
  ];

  for (const s of extraStaff) {
    if (s.role_id) {
      const existing = await knex('users').where('email', s.email).first();
      if (!existing) {
        await knex('users').insert({
          username: s.username,
          email: s.email,
          password_hash: PASSWORD_HASH,
          full_name: s.full_name,
          role_id: s.role_id,
          phone: s.phone,
          is_active: true,
        });
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('otp_verifications');
}

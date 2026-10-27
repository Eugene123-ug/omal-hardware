/**
 * Seed Granular Permissions & Role Permissions Matrix
 * Phase 2 Security Architecture
 */

const PERMISSIONS = [
  // Products & Prices
  { name: 'products.view', module: 'products', description: 'View product catalog and specifications' },
  { name: 'products.create', module: 'products', description: 'Create new products in catalog' },
  { name: 'products.update', module: 'products', description: 'Update product information and metadata' },
  { name: 'products.delete', module: 'products', description: 'Delete products from catalog' },
  { name: 'products.cost_view', module: 'products', description: 'View cost price of products (Strictly Super Admin)' },
  { name: 'prices.view', module: 'products', description: 'View selling and wholesale prices' },
  { name: 'prices.update', module: 'products', description: 'Update selling or wholesale prices' },

  // Inventory & Stock
  { name: 'inventory.view', module: 'inventory', description: 'View stock quantities across locations' },
  { name: 'inventory.receive', module: 'inventory', description: 'Log stock inward and supplier receipts' },
  { name: 'inventory.adjust', module: 'inventory', description: 'Adjust stock quantities for damage or return' },
  { name: 'inventory.transfer', module: 'inventory', description: 'Transfer stock between showroom and warehouses' },
  { name: 'inventory.valuation', module: 'inventory', description: 'View total inventory monetary valuation' },
  { name: 'inventory.opening_stock', module: 'inventory', description: 'Enter or correct verified physical opening stock' },
  { name: 'inventory.stock_count', module: 'inventory', description: 'Initiate, count, and submit physical stock audit counts' },
  { name: 'inventory.stock_count_approve', module: 'inventory', description: 'Review and approve stock count variance adjustments' },
  { name: 'inventory.reserve', module: 'inventory', description: 'Place or release customer stock reservations' },

  // Sales & POS
  { name: 'sales.create', module: 'sales', description: 'Process point of sale orders and print receipts' },
  { name: 'sales.view_own', module: 'sales', description: 'View own completed sales and receipts' },
  { name: 'sales.view_all', module: 'sales', description: 'View sales of all staff members' },
  { name: 'sales.view_costs', module: 'sales', description: 'View COGS and profit margin on sales records' },
  { name: 'refunds.request', module: 'sales', description: 'Initiate a return or refund request' },
  { name: 'refunds.approve', module: 'sales', description: 'Authorize sales returns and cashier discounts > 2%' },

  // Customers & Debt
  { name: 'customers.view', module: 'customers', description: 'View customer directory and accounts' },
  { name: 'customers.create', module: 'customers', description: 'Register new customers' },
  { name: 'customers.edit', module: 'customers', description: 'Update customer contact and project address' },
  { name: 'customers.manage_credit', module: 'customers', description: 'Adjust credit limits and record payments' },

  // Suppliers & Procurement
  { name: 'suppliers.view', module: 'suppliers', description: 'View supplier directory and payables' },
  { name: 'suppliers.manage', module: 'suppliers', description: 'Create, update, and manage suppliers' },
  { name: 'purchasing.po_create', module: 'purchasing', description: 'Create and edit draft purchase orders' },
  { name: 'purchasing.po_approve', module: 'purchasing', description: 'Approve or reject purchase orders' },
  { name: 'purchasing.grn_create', module: 'purchasing', description: 'Process Goods Received Notes and delivery discrepancies' },
  { name: 'purchasing.invoice_manage', module: 'purchasing', description: 'Manage supplier bills, invoices, and payments' },

  // Finance & Cash Closing
  { name: 'finance.view', module: 'finance', description: 'View financial records and daily reconciliations' },
  { name: 'finance.cash_closing', module: 'finance', description: 'Submit or view daily cash drawer closing' },
  { name: 'finance.expenses', module: 'finance', description: 'Record and categorize operational expenses' },
  { name: 'finance.profit_view', module: 'finance', description: 'View gross and net company profit figures' },

  // Reports & Analytics
  { name: 'reports.view', module: 'reports', description: 'View operational reporting dashboards' },
  { name: 'reports.export', module: 'reports', description: 'Export report data to Excel, CSV, or PDF' },
  { name: 'reports.financial', module: 'reports', description: 'View P&L and comprehensive balance sheets' },
  { name: 'reports.staff', module: 'reports', description: 'View staff performance and discrepancy metrics' },

  // User Management
  { name: 'users.view', module: 'users', description: 'View staff accounts and profiles' },
  { name: 'users.manage', module: 'users', description: 'Create, edit, deactivate users and reset passwords' },

  // Security, Audit & Settings
  { name: 'audit.view', module: 'audit', description: 'View immutable system audit and login logs' },
  { name: 'audit.purge', module: 'audit', description: 'Purge old audit logs (Super Admin Only)' },
  { name: 'settings.manage', module: 'settings', description: 'Configure store profile, TIN, and thresholds' }
];

const ROLE_PERMISSIONS_MAP = {
  super_admin: PERMISSIONS.map(p => p.name), // Super Admin has all permissions
  admin: [
    'products.view', 'products.create', 'products.update',
    'prices.view', 'prices.update',
    'inventory.view', 'inventory.receive', 'inventory.adjust', 'inventory.transfer',
    'inventory.opening_stock', 'inventory.stock_count', 'inventory.stock_count_approve', 'inventory.reserve',
    'sales.create', 'sales.view_all',
    'refunds.request', 'refunds.approve',
    'customers.view', 'customers.create', 'customers.edit',
    'suppliers.view', 'suppliers.manage',
    'purchasing.po_create', 'purchasing.po_approve', 'purchasing.grn_create', 'purchasing.invoice_manage',
    'finance.view', 'finance.cash_closing', 'finance.expenses',
    'reports.view', 'reports.staff',
    'users.view', 'users.manage',
    'audit.view',
    'settings.manage'
  ],
  sales: [
    'products.view',
    'prices.view',
    'inventory.view',
    'sales.create', 'sales.view_own',
    'refunds.request',
    'customers.view', 'customers.create',
    'finance.cash_closing'
  ],
  accountant: [
    'products.view', 'prices.view',
    'sales.view_all',
    'customers.view', 'customers.manage_credit',
    'suppliers.view', 'purchasing.invoice_manage',
    'finance.view', 'finance.cash_closing', 'finance.expenses', 'finance.profit_view',
    'reports.view', 'reports.export', 'reports.financial'
  ]
};

exports.seed = async function(knex) {
  console.log('[Seed] Seeding granular permissions and role mappings...');

  // Upsert permissions
  for (const perm of PERMISSIONS) {
    const existing = await knex('permissions').where({ name: perm.name }).first();
    if (!existing) {
      await knex('permissions').insert(perm);
    }
  }

  // Get all permission id mappings
  const allPerms = await knex('permissions').select('id', 'name');
  const permMap = {};
  allPerms.forEach(p => { permMap[p.name] = p.id; });

  // Clear existing role permissions to ensure accurate seed
  await knex('role_permissions').del();

  const rolePermRows = [];
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS_MAP)) {
    for (const permName of perms) {
      if (permMap[permName]) {
        rolePermRows.push({
          role,
          permission_id: permMap[permName]
        });
      }
    }
  }

  if (rolePermRows.length > 0) {
    await knex('role_permissions').insert(rolePermRows);
  }

  console.log(`[Seed] Seeded ${PERMISSIONS.length} permissions and ${rolePermRows.length} role-permission mappings.`);
};

exports.PERMISSIONS = PERMISSIONS;
exports.ROLE_PERMISSIONS_MAP = ROLE_PERMISSIONS_MAP;

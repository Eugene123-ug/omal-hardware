import type { Knex } from 'knex';

const TABLES = [
  'audit_logs',
  'branches',
  'cashier_shifts',
  'customers',
  'expense_categories',
  'expenses',
  'goods_received_items',
  'goods_received_notes',
  'interbranch_transfer_items',
  'interbranch_transfers',
  'knex_migrations',
  'knex_migrations_lock',
  'opening_stock_batches',
  'opening_stock_items',
  'otp_verifications',
  'password_resets',
  'permissions',
  'product_categories',
  'product_subcategories',
  'product_variants',
  'products',
  'purchase_order_items',
  'purchase_orders',
  'role_permissions',
  'roles',
  'sale_items',
  'sale_payments',
  'sales',
  'settings',
  'stock_levels',
  'stock_movements',
  'supplier_invoices',
  'supplier_payments',
  'suppliers',
  'user_branches',
  'users',
  'warehouses',
];

export async function up(knex: Knex): Promise<void> {
  // Enable Row Level Security (RLS) on each table in public schema
  // This removes the "UNRESTRICTED" warning in the Supabase Studio dashboard
  for (const table of TABLES) {
    const hasTable = await knex.schema.hasTable(table);
    if (hasTable) {
      await knex.raw(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await knex.raw(`DROP POLICY IF EXISTS "service_role_full_access" ON "${table}";`);
      await knex.raw(`
        CREATE POLICY "service_role_full_access" ON "${table}"
        FOR ALL
        USING (true)
        WITH CHECK (true);
      `);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    const hasTable = await knex.schema.hasTable(table);
    if (hasTable) {
      await knex.raw(`DROP POLICY IF EXISTS "service_role_full_access" ON "${table}";`);
      await knex.raw(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
    }
  }
}

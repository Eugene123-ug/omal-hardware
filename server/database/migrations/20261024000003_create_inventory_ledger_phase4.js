/**
 * Phase 4 Migration: Inventory Ledger, Opening Stock, Stock Receipts, Stock Counts & Stock Calculations
 * Target Database: PostgreSQL 17
 */

exports.up = async function(knex) {
  // 1. ALTER WAREHOUSE_STOCK: Add reserved_quantity and non-negative check constraints
  await knex.schema.alterTable('warehouse_stock', (table) => {
    table.decimal('reserved_quantity', 12, 2).defaultTo(0).notNullable();
  });

  await knex.raw('ALTER TABLE warehouse_stock ADD CONSTRAINT chk_warehouse_stock_quantity_non_negative CHECK (quantity >= 0);');
  await knex.raw('ALTER TABLE warehouse_stock ADD CONSTRAINT chk_warehouse_stock_reserved_non_negative CHECK (reserved_quantity >= 0);');

  // 2. ALTER STOCK_MOVEMENTS: Expand into comprehensive inventory ledger
  await knex.schema.alterTable('stock_movements', (table) => {
    table.integer('variant_id').unsigned().references('id').inTable('product_variants').onDelete('SET NULL').nullable();
    table.string('unit', 50).defaultTo('pcs');
    table.decimal('total_cost', 12, 2).defaultTo(0);
    table.decimal('balance_after', 12, 2).nullable();
    table.string('reference_type', 50).nullable(); // OPENING_STOCK, PURCHASE_RECEIPT, SALE, CUSTOMER_RETURN, SUPPLIER_RETURN, DAMAGE, LOSS, COUNT_ADJUSTMENT, TRANSFER
    table.integer('reference_id').nullable();
    table.decimal('discrepancy_quantity', 12, 2).defaultTo(0);

    table.index(['variant_id']);
    table.index(['reference_type']);
    table.index(['reference_no']);
    table.index(['product_id', 'created_at']);
  });

  // 3. CREATE OPENING_STOCK_RECORDS TABLE (Task 1)
  await knex.schema.createTable('opening_stock_records', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE').notNullable();
    table.integer('variant_id').unsigned().references('id').inTable('product_variants').onDelete('SET NULL').nullable();
    table.string('warehouse_name', 100).notNullable();
    table.decimal('quantity', 12, 2).notNullable();
    table.string('unit', 50).notNullable();
    table.decimal('unit_cost', 12, 2).notNullable();
    table.decimal('total_valuation', 12, 2).notNullable();
    table.string('valuation_basis', 50).defaultTo('cost_price'); // cost_price, market_value
    table.date('opening_date').notNullable();
    table.text('notes').nullable();
    table.integer('created_by_id').unsigned().references('id').inTable('users').notNullable();
    table.integer('approved_by_id').unsigned().references('id').inTable('users').nullable();
    table.boolean('is_corrected').defaultTo(false).notNullable();
    table.text('correction_notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['product_id']);
    table.index(['warehouse_name']);
  });

  // Unique constraint preventing repeated opening stock without authorized correction
  await knex.raw('CREATE UNIQUE INDEX idx_opening_stock_unique ON opening_stock_records (product_id, COALESCE(variant_id, 0), warehouse_name) WHERE is_corrected = false;');

  // 4. CREATE STOCK_COUNTS & STOCK_COUNT_ITEMS TABLES (Task 5)
  await knex.schema.createTable('stock_counts', (table) => {
    table.increments('id').primary();
    table.string('count_number', 100).unique().notNullable(); // e.g. STC-20261024-0001
    table.string('warehouse_name', 100).notNullable();
    table.string('category', 100).nullable(); // 'All' or specific category
    table.string('status', 50).defaultTo('in_progress').notNullable(); // in_progress, submitted, approved, rejected
    table.text('notes').nullable();
    table.integer('counted_by_id').unsigned().references('id').inTable('users').notNullable();
    table.timestamp('submitted_at').nullable();
    table.integer('approved_by_id').unsigned().references('id').inTable('users').nullable();
    table.text('approval_notes').nullable();
    table.timestamp('approved_at').nullable();
    table.integer('total_items_counted').defaultTo(0).notNullable();
    table.decimal('total_variance_qty', 12, 2).defaultTo(0).notNullable();
    table.decimal('total_variance_cost', 12, 2).defaultTo(0).notNullable();
    table.timestamps(true, true);

    table.index(['warehouse_name']);
    table.index(['status']);
    table.index(['counted_by_id']);
  });

  await knex.schema.createTable('stock_count_items', (table) => {
    table.increments('id').primary();
    table.integer('stock_count_id').unsigned().references('id').inTable('stock_counts').onDelete('CASCADE').notNullable();
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE').notNullable();
    table.integer('variant_id').unsigned().references('id').inTable('product_variants').onDelete('SET NULL').nullable();
    table.string('warehouse_name', 100).notNullable();
    table.decimal('system_quantity', 12, 2).notNullable();
    table.decimal('counted_quantity', 12, 2).notNullable();
    table.decimal('variance_quantity', 12, 2).notNullable();
    table.decimal('unit_cost', 12, 2).notNullable();
    table.decimal('variance_cost', 12, 2).notNullable();
    table.text('discrepancy_reason').nullable();
    table.string('status', 50).defaultTo('pending').notNullable();

    table.index(['stock_count_id']);
    table.index(['product_id']);
  });

  // 5. ALTER GOODS_RECEIVED_NOTES (Task 2)
  await knex.schema.alterTable('goods_received_notes', (table) => {
    table.string('delivery_note_no', 100).nullable();
    table.text('discrepancy_notes').nullable();
    table.string('status', 50).defaultTo('completed').notNullable();
  });

  // 6. INSERT ADDITIONAL GRANULAR PERMISSIONS FOR PHASE 4
  const phase4Permissions = [
    { name: 'inventory.opening_stock', module: 'inventory', description: 'Enter or correct verified physical opening stock' },
    { name: 'inventory.stock_count', module: 'inventory', description: 'Initiate, count, and submit physical stock audit counts' },
    { name: 'inventory.stock_count_approve', module: 'inventory', description: 'Review and approve stock count variance adjustments' },
    { name: 'inventory.reserve', module: 'inventory', description: 'Place or release customer stock reservations' }
  ];

  for (const perm of phase4Permissions) {
    const existing = await knex('permissions').where({ name: perm.name }).first();
    if (!existing) {
      const [inserted] = await knex('permissions').insert(perm).returning('id');
      // Assign to Super Admin
      const superAdminRole = await knex('role_permissions').where({ role: 'super_admin' }).first();
      if (superAdminRole) {
        await knex('role_permissions').insert({ role: 'super_admin', permission_id: inserted.id });
      }
      // Assign appropriate perms to Admin
      if (perm.name !== 'inventory.stock_count_approve') {
        const adminRole = await knex('role_permissions').where({ role: 'admin' }).first();
        if (adminRole) {
          await knex('role_permissions').insert({ role: 'admin', permission_id: inserted.id });
        }
      }
    }
  }
};

exports.down = async function(knex) {
  // Drop permissions
  await knex('permissions').whereIn('name', [
    'inventory.opening_stock',
    'inventory.stock_count',
    'inventory.stock_count_approve',
    'inventory.reserve'
  ]).delete();

  await knex.schema.alterTable('goods_received_notes', (table) => {
    table.dropColumn('status');
    table.dropColumn('discrepancy_notes');
    table.dropColumn('delivery_note_no');
  });

  await knex.schema.dropTableIfExists('stock_count_items');
  await knex.schema.dropTableIfExists('stock_counts');
  await knex.schema.dropTableIfExists('opening_stock_records');

  await knex.schema.alterTable('stock_movements', (table) => {
    table.dropColumn('discrepancy_quantity');
    table.dropColumn('reference_id');
    table.dropColumn('reference_type');
    table.dropColumn('balance_after');
    table.dropColumn('total_cost');
    table.dropColumn('unit');
    table.dropColumn('variant_id');
  });

  await knex.raw('ALTER TABLE warehouse_stock DROP CONSTRAINT IF EXISTS chk_warehouse_stock_reserved_non_negative;');
  await knex.raw('ALTER TABLE warehouse_stock DROP CONSTRAINT IF EXISTS chk_warehouse_stock_quantity_non_negative;');

  await knex.schema.alterTable('warehouse_stock', (table) => {
    table.dropColumn('reserved_quantity');
  });
};

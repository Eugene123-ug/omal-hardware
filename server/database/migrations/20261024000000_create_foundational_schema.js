/**
 * Initial Schema Migration for OMAL Business ERP & POS
 * Target Database: PostgreSQL 17
 */

exports.up = async function(knex) {
  // 1. USERS
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('email', 255).unique().notNullable();
    table.string('password', 255).notNullable();
    table.enum('role', ['super_admin', 'admin', 'sales', 'accountant'], {
      useNative: true,
      enumName: 'user_role_enum'
    }).notNullable().defaultTo('sales');
    table.string('admin_pin', 10).nullable();
    table.string('phone', 50).nullable();
    table.string('status', 20).defaultTo('active');
    table.timestamps(true, true);
  });

  // 2. PERMISSIONS & ROLE PERMISSIONS
  await knex.schema.createTable('permissions', (table) => {
    table.increments('id').primary();
    table.string('name', 100).unique().notNullable();
    table.string('module', 50).notNullable();
    table.string('description', 255).nullable();
  });

  await knex.schema.createTable('role_permissions', (table) => {
    table.increments('id').primary();
    table.string('role', 50).notNullable();
    table.integer('permission_id').unsigned().references('id').inTable('permissions').onDelete('CASCADE');
    table.unique(['role', 'permission_id']);
  });

  // 3. PRODUCTS
  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('category', 100).notNullable(); // Tiles, Security Doors, Sanitary, Paints, Hardware
    table.string('sku', 100).unique().notNullable();
    table.string('barcode', 100).nullable();
    table.string('brand', 100).nullable();
    table.string('size_color', 255).nullable();
    table.string('unit', 50).defaultTo('pcs'); // box, pcs, bucket 20L, gallon, bag, bundle
    table.decimal('cost_price', 12, 2).notNullable(); // Hidden from sales staff
    table.decimal('selling_price', 12, 2).notNullable();
    table.decimal('wholesale_price', 12, 2).nullable();
    table.integer('min_stock_alert').defaultTo(10);
    table.string('warehouse_location', 100).defaultTo('Main Showroom');
    table.text('image_url').nullable();
    table.decimal('sqm_per_box', 8, 2).defaultTo(0);
    table.integer('pieces_per_box').defaultTo(0);
    table.timestamps(true, true);

    table.index(['category']);
    table.index(['sku']);
    table.index(['barcode']);
  });

  // 4. WAREHOUSE STOCK
  await knex.schema.createTable('warehouse_stock', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE');
    table.string('warehouse_name', 100).notNullable();
    table.decimal('quantity', 12, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);

    table.unique(['product_id', 'warehouse_name']);
  });

  // 5. STOCK MOVEMENTS (Audit Trail)
  await knex.schema.createTable('stock_movements', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE');
    table.string('movement_type', 50).notNullable(); // IN, OUT, ADJUSTMENT, TRANSFER
    table.decimal('quantity', 12, 2).notNullable();
    table.string('from_location', 100).nullable();
    table.string('to_location', 100).nullable();
    table.string('reference_no', 100).nullable();
    table.decimal('cost_price', 12, 2).nullable();
    table.text('reason').nullable();
    table.integer('authorized_by_id').unsigned().references('id').inTable('users').nullable();
    table.integer('created_by_id').unsigned().references('id').inTable('users').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['product_id']);
    table.index(['movement_type']);
  });

  // 6. CUSTOMERS
  await knex.schema.createTable('customers', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('phone', 50).notNullable();
    table.string('location', 255).nullable();
    table.decimal('credit_limit', 12, 2).defaultTo(0);
    table.decimal('current_balance', 12, 2).defaultTo(0);
    table.timestamps(true, true);

    table.index(['phone']);
  });

  // 7. SUPPLIERS
  await knex.schema.createTable('suppliers', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('phone', 50).notNullable();
    table.string('contact_person', 255).nullable();
    table.string('location', 255).nullable();
    table.decimal('balance_owed', 12, 2).defaultTo(0);
    table.timestamps(true, true);
  });

  // 8. PURCHASE ORDERS
  await knex.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary();
    table.string('po_number', 100).unique().notNullable();
    table.integer('supplier_id').unsigned().references('id').inTable('suppliers').nullable();
    table.string('status', 50).defaultTo('pending'); // pending, received_partial, received_full, cancelled
    table.decimal('total_amount', 12, 2).defaultTo(0);
    table.text('notes').nullable();
    table.integer('created_by_id').unsigned().references('id').inTable('users').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 9. GOODS RECEIVED NOTES (GRN)
  await knex.schema.createTable('goods_received_notes', (table) => {
    table.increments('id').primary();
    table.string('grn_number', 100).unique().notNullable();
    table.integer('po_id').unsigned().references('id').inTable('purchase_orders').nullable();
    table.integer('supplier_id').unsigned().references('id').inTable('suppliers').nullable();
    table.string('supplier_invoice_no', 100).nullable();
    table.string('warehouse_name', 100).notNullable();
    table.decimal('total_cost', 12, 2).notNullable();
    table.jsonb('items_json').notNullable();
    table.integer('received_by_id').unsigned().references('id').inTable('users').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 10. SALES (IMMUTABLE INVOICES)
  await knex.schema.createTable('sales', (table) => {
    table.increments('id').primary();
    table.string('receipt_no', 100).unique().notNullable(); // Sequential e.g. REC-20261024-0001
    table.integer('customer_id').unsigned().references('id').inTable('customers').nullable();
    table.string('customer_name', 255).defaultTo('Walk-in Customer');
    table.string('customer_phone', 50).nullable();
    table.integer('staff_id').unsigned().references('id').inTable('users').notNullable();
    table.string('warehouse_name', 100).defaultTo('Main Showroom');
    table.decimal('subtotal', 12, 2).notNullable();
    table.decimal('discount_percent', 5, 2).defaultTo(0);
    table.decimal('discount_amount', 12, 2).defaultTo(0);
    table.integer('discount_approved_by').unsigned().references('id').inTable('users').nullable();
    table.decimal('total_amount', 12, 2).notNullable();
    table.decimal('total_cost', 12, 2).notNullable(); // Hidden from sales staff
    table.string('payment_method', 50).notNullable(); // CASH, MOMO, BANK, CREDIT, SPLIT
    table.string('momo_reference', 100).nullable();
    table.string('momo_network', 50).nullable(); // MTN, TELECEL, AT
    table.decimal('cash_tendered', 12, 2).nullable();
    table.decimal('change_given', 12, 2).nullable();
    table.integer('is_offline_sync').defaultTo(0);
    table.string('offline_client_id', 100).nullable();
    table.string('status', 50).defaultTo('completed');
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['receipt_no']);
    table.index(['created_at']);
    table.index(['staff_id']);
  });

  // 11. SALE ITEMS
  await knex.schema.createTable('sale_items', (table) => {
    table.increments('id').primary();
    table.integer('sale_id').unsigned().references('id').inTable('sales').onDelete('CASCADE');
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE');
    table.string('product_name', 255).notNullable();
    table.string('sku', 100).notNullable();
    table.decimal('quantity', 12, 2).notNullable();
    table.string('unit', 50).notNullable();
    table.decimal('cost_price', 12, 2).notNullable();
    table.decimal('selling_price', 12, 2).notNullable();
    table.decimal('total_price', 12, 2).notNullable();
    table.decimal('sqm_coverage', 8, 2).defaultTo(0);
  });

  // 12. CUSTOMER PAYMENTS (DEBT CLEARANCE)
  await knex.schema.createTable('customer_payments', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('CASCADE');
    table.decimal('amount', 12, 2).notNullable();
    table.string('payment_method', 50).notNullable();
    table.string('reference_no', 100).nullable();
    table.string('receipt_no', 100).nullable();
    table.integer('received_by_id').unsigned().references('id').inTable('users').nullable();
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 13. EXPENSES
  await knex.schema.createTable('expenses', (table) => {
    table.increments('id').primary();
    table.string('category', 100).notNullable();
    table.decimal('amount', 12, 2).notNullable();
    table.text('description').notNullable();
    table.text('receipt_image').nullable();
    table.integer('paid_by_id').unsigned().references('id').inTable('users').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 14. DAILY CASH CLOSINGS
  await knex.schema.createTable('daily_cash_closings', (table) => {
    table.increments('id').primary();
    table.date('closing_date').notNullable();
    table.integer('staff_id').unsigned().references('id').inTable('users').notNullable();
    table.decimal('opening_cash', 12, 2).defaultTo(0);
    table.decimal('cash_sales', 12, 2).defaultTo(0);
    table.decimal('momo_sales', 12, 2).defaultTo(0);
    table.decimal('bank_sales', 12, 2).defaultTo(0);
    table.decimal('credit_sales', 12, 2).defaultTo(0);
    table.decimal('cash_expenses', 12, 2).defaultTo(0);
    table.decimal('expected_cash', 12, 2).notNullable();
    table.decimal('physical_cash', 12, 2).notNullable();
    table.decimal('discrepancy', 12, 2).notNullable();
    table.text('notes').nullable();
    table.string('status', 50).defaultTo('submitted');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 15. AUDIT LOGS
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').nullable();
    table.string('user_name', 255).notNullable();
    table.string('user_role', 50).notNullable();
    table.string('action', 100).notNullable();
    table.text('details').notNullable();
    table.string('ip_address', 50).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['action']);
    table.index(['created_at']);
  });

  // 16. PRICE CHANGE LOGS
  await knex.schema.createTable('price_change_logs', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE');
    table.string('product_name', 255).notNullable();
    table.decimal('old_cost_price', 12, 2).nullable();
    table.decimal('new_cost_price', 12, 2).nullable();
    table.decimal('old_selling_price', 12, 2).nullable();
    table.decimal('new_selling_price', 12, 2).nullable();
    table.decimal('old_wholesale_price', 12, 2).nullable();
    table.decimal('new_wholesale_price', 12, 2).nullable();
    table.integer('changed_by_id').unsigned().references('id').inTable('users').notNullable();
    table.integer('approved_by_id').unsigned().references('id').inTable('users').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 17. SETTINGS
  await knex.schema.createTable('settings', (table) => {
    table.string('key', 100).primary();
    table.text('value').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('price_change_logs');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('daily_cash_closings');
  await knex.schema.dropTableIfExists('expenses');
  await knex.schema.dropTableIfExists('customer_payments');
  await knex.schema.dropTableIfExists('sale_items');
  await knex.schema.dropTableIfExists('sales');
  await knex.schema.dropTableIfExists('goods_received_notes');
  await knex.schema.dropTableIfExists('purchase_orders');
  await knex.schema.dropTableIfExists('suppliers');
  await knex.schema.dropTableIfExists('customers');
  await knex.schema.dropTableIfExists('stock_movements');
  await knex.schema.dropTableIfExists('warehouse_stock');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('permissions');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS user_role_enum CASCADE');
};

/**
 * Phase 5 Migration: Suppliers, Purchase Orders, Goods Received Notes, Supplier Invoices & Payments
 * Target Database: PostgreSQL 17
 */

exports.up = async function(knex) {
  // 1. ALTER SUPPLIERS: Add contact, tax ID, payment terms, status, documents, bank details
  await knex.schema.alterTable('suppliers', (table) => {
    table.string('email', 255).nullable();
    table.string('tax_id', 100).nullable(); // TIN / Tax ID
    table.text('address').nullable();
    table.jsonb('products_supplied').nullable(); // ['Tiles', 'Security Doors', etc.]
    table.string('payment_terms', 50).defaultTo('COD'); // NET_30, COD, ADVANCE_50_DELIVERY_50, NET_15, NET_60
    table.string('status', 50).defaultTo('active'); // active, inactive, blacklisted
    table.jsonb('supporting_documents').nullable(); // [{ name, url, date }]
    table.jsonb('bank_details').nullable(); // { bank_name, account_number, account_name, branch, momo_number }

    table.index(['status']);
  });

  // 2. ALTER PURCHASE_ORDERS: Add warehouse, expected delivery, supplier ref, approval metadata, cancellation
  await knex.schema.alterTable('purchase_orders', (table) => {
    table.string('warehouse_name', 100).defaultTo('Main Showroom');
    table.date('expected_delivery_date').nullable();
    table.string('supplier_reference', 100).nullable();
    table.string('approval_status', 50).defaultTo('pending'); // pending, approved, rejected
    table.integer('approved_by_id').unsigned().references('id').inTable('users').nullable();
    table.timestamp('approved_at').nullable();
    table.text('approval_notes').nullable();
    table.integer('cancelled_by_id').unsigned().references('id').inTable('users').nullable();
    table.text('cancellation_reason').nullable();

    table.index(['status']);
    table.index(['approval_status']);
    table.index(['supplier_id']);
  });

  // 3. CREATE PURCHASE_ORDER_ITEMS: Structured line items with quantities, costs, and statuses
  await knex.schema.createTable('purchase_order_items', (table) => {
    table.increments('id').primary();
    table.integer('po_id').unsigned().references('id').inTable('purchase_orders').onDelete('CASCADE').notNullable();
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE').notNullable();
    table.integer('variant_id').unsigned().references('id').inTable('product_variants').onDelete('SET NULL').nullable();
    table.decimal('ordered_quantity', 12, 2).notNullable();
    table.decimal('received_quantity', 12, 2).defaultTo(0).notNullable();
    table.decimal('rejected_quantity', 12, 2).defaultTo(0).notNullable();
    table.string('unit', 50).defaultTo('pcs').notNullable();
    table.decimal('unit_cost', 12, 2).notNullable();
    table.decimal('total_cost', 12, 2).notNullable();
    table.date('expected_delivery_date').nullable();
    table.string('status', 50).defaultTo('pending').notNullable(); // pending, partial, completed, cancelled
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.index(['po_id']);
    table.index(['product_id']);
  });

  // 4. CREATE GRN_ITEMS: Goods received note itemized lines with received, rejected, damaged tracking
  await knex.schema.createTable('grn_items', (table) => {
    table.increments('id').primary();
    table.integer('grn_id').unsigned().references('id').inTable('goods_received_notes').onDelete('CASCADE').notNullable();
    table.integer('po_item_id').unsigned().references('id').inTable('purchase_order_items').onDelete('SET NULL').nullable();
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE').notNullable();
    table.integer('variant_id').unsigned().references('id').inTable('product_variants').onDelete('SET NULL').nullable();
    table.decimal('ordered_quantity', 12, 2).defaultTo(0).notNullable();
    table.decimal('received_quantity', 12, 2).notNullable(); // accepted sellable quantity added to stock
    table.decimal('rejected_quantity', 12, 2).defaultTo(0).notNullable(); // rejected, not added to sellable stock
    table.decimal('damaged_quantity', 12, 2).defaultTo(0).notNullable(); // damaged upon arrival, held in scrap
    table.string('unit', 50).defaultTo('pcs').notNullable();
    table.decimal('unit_cost', 12, 2).notNullable();
    table.decimal('total_cost', 12, 2).notNullable();
    table.text('discrepancy_reason').nullable();
    table.timestamps(true, true);

    table.index(['grn_id']);
    table.index(['product_id']);
  });

  // 5. CREATE SUPPLIER_INVOICES (Task 4)
  await knex.schema.createTable('supplier_invoices', (table) => {
    table.increments('id').primary();
    table.string('invoice_number', 100).notNullable();
    table.integer('supplier_id').unsigned().references('id').inTable('suppliers').onDelete('RESTRICT').notNullable();
    table.integer('po_id').unsigned().references('id').inTable('purchase_orders').onDelete('SET NULL').nullable();
    table.integer('grn_id').unsigned().references('id').inTable('goods_received_notes').onDelete('SET NULL').nullable();
    table.date('invoice_date').notNullable();
    table.date('due_date').nullable();
    table.decimal('subtotal', 12, 2).notNullable();
    table.decimal('tax_amount', 12, 2).defaultTo(0).notNullable();
    table.decimal('total_amount', 12, 2).notNullable();
    table.decimal('amount_paid', 12, 2).defaultTo(0).notNullable();
    table.decimal('balance_due', 12, 2).notNullable();
    table.string('status', 50).defaultTo('unpaid').notNullable(); // unpaid, partially_paid, paid, disputed
    table.text('notes').nullable();
    table.jsonb('supporting_documents').nullable();
    table.integer('created_by_id').unsigned().references('id').inTable('users').nullable();
    table.timestamps(true, true);

    table.unique(['supplier_id', 'invoice_number']);
    table.index(['supplier_id']);
    table.index(['status']);
    table.index(['due_date']);
  });

  // 6. CREATE SUPPLIER_PAYMENTS (Task 4)
  await knex.schema.createTable('supplier_payments', (table) => {
    table.increments('id').primary();
    table.string('payment_number', 100).unique().notNullable(); // e.g. SPAY-20261024-001
    table.integer('supplier_id').unsigned().references('id').inTable('suppliers').onDelete('RESTRICT').notNullable();
    table.integer('invoice_id').unsigned().references('id').inTable('supplier_invoices').onDelete('SET NULL').nullable();
    table.decimal('amount', 12, 2).notNullable();
    table.string('payment_method', 50).notNullable(); // BANK_TRANSFER, CASH, MOMO, CHEQUE
    table.string('reference_no', 100).nullable();
    table.date('payment_date').notNullable();
    table.string('bank_account_used', 100).nullable();
    table.text('notes').nullable();
    table.jsonb('supporting_documents').nullable();
    table.integer('recorded_by_id').unsigned().references('id').inTable('users').notNullable();
    table.timestamps(true, true);

    table.index(['supplier_id']);
    table.index(['invoice_id']);
    table.index(['payment_date']);
  });

  // 7. INSERT GRANULAR PERMISSIONS FOR PHASE 5
  const phase5Permissions = [
    { name: 'purchasing.po_create', module: 'purchasing', description: 'Create and edit draft purchase orders' },
    { name: 'purchasing.po_approve', module: 'purchasing', description: 'Approve or reject purchase orders' },
    { name: 'purchasing.grn_create', module: 'purchasing', description: 'Process Goods Received Notes and delivery discrepancies' },
    { name: 'purchasing.invoice_manage', module: 'purchasing', description: 'Manage supplier bills, invoices, and payments' }
  ];

  for (const perm of phase5Permissions) {
    const existing = await knex('permissions').where({ name: perm.name }).first();
    if (!existing) {
      const [inserted] = await knex('permissions').insert(perm).returning('id');
      // Assign to Super Admin
      const superAdminRole = await knex('role_permissions').where({ role: 'super_admin' }).first();
      if (superAdminRole) {
        await knex('role_permissions').insert({ role: 'super_admin', permission_id: inserted.id });
      }
      // Assign appropriate perms to Admin
      const adminRole = await knex('role_permissions').where({ role: 'admin' }).first();
      if (adminRole) {
        await knex('role_permissions').insert({ role: 'admin', permission_id: inserted.id });
      }
      // Assign invoice_manage to Accountant
      if (perm.name === 'purchasing.invoice_manage') {
        const accountantRole = await knex('role_permissions').where({ role: 'accountant' }).first();
        if (accountantRole) {
          await knex('role_permissions').insert({ role: 'accountant', permission_id: inserted.id });
        }
      }
    }
  }
};

exports.down = async function(knex) {
  // Drop permissions
  await knex('permissions').whereIn('name', [
    'purchasing.po_create',
    'purchasing.po_approve',
    'purchasing.grn_create',
    'purchasing.invoice_manage'
  ]).delete();

  await knex.schema.dropTableIfExists('supplier_payments');
  await knex.schema.dropTableIfExists('supplier_invoices');
  await knex.schema.dropTableIfExists('grn_items');
  await knex.schema.dropTableIfExists('purchase_order_items');

  await knex.schema.alterTable('purchase_orders', (table) => {
    table.dropColumn('cancellation_reason');
    table.dropColumn('cancelled_by_id');
    table.dropColumn('approval_notes');
    table.dropColumn('approved_at');
    table.dropColumn('approved_by_id');
    table.dropColumn('approval_status');
    table.dropColumn('supplier_reference');
    table.dropColumn('expected_delivery_date');
    table.dropColumn('warehouse_name');
  });

  await knex.schema.alterTable('suppliers', (table) => {
    table.dropColumn('bank_details');
    table.dropColumn('supporting_documents');
    table.dropColumn('status');
    table.dropColumn('payment_terms');
    table.dropColumn('products_supplied');
    table.dropColumn('address');
    table.dropColumn('tax_id');
    table.dropColumn('email');
  });
};

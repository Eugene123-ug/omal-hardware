/**
 * Phase 6 & 7: Point of Sale, Sales Transaction Management, Customer Management & Credit Control
 * Schema Migration
 */

exports.up = async function(knex) {
  // 1. Enhance CUSTOMERS table
  const hasCustomerCode = await knex.schema.hasColumn('customers', 'customer_code');
  if (!hasCustomerCode) {
    await knex.schema.alterTable('customers', (table) => {
      table.string('customer_code', 50).nullable().unique();
      table.string('email', 255).nullable();
      table.text('address').nullable();
      table.string('status', 50).defaultTo('active'); // active, suspended, blacklisted
      table.text('notes').nullable();
      table.index(['status']);
    });

    // Populate existing customer records with customer codes
    const existingCusts = await knex('customers').select('id');
    for (const c of existingCusts) {
      const code = `CUST-${String(c.id).padStart(4, '0')}`;
      await knex('customers').where({ id: c.id }).update({ customer_code: code });
    }
  }

  // 2. Enhance SALES table
  const hasPaymentStatus = await knex.schema.hasColumn('sales', 'payment_status');
  if (!hasPaymentStatus) {
    await knex.schema.alterTable('sales', (table) => {
      table.string('payment_status', 50).defaultTo('paid'); // paid, partial, unpaid, refunded, partially_refunded
      table.string('verification_status', 50).defaultTo('CASHIER_ENTERED'); // CASHIER_ENTERED, VERIFIED, PENDING_VERIFICATION
      table.decimal('tax_amount', 12, 2).defaultTo(0);
      table.date('credit_due_date').nullable();
      table.string('idempotency_key', 100).nullable().unique();
      table.index(['payment_status']);
    });
  }

  // 3. Enhance SALE_ITEMS table
  const hasVariantId = await knex.schema.hasColumn('sale_items', 'variant_id');
  if (!hasVariantId) {
    await knex.schema.alterTable('sale_items', (table) => {
      table.integer('variant_id').unsigned().references('id').inTable('product_variants').nullable();
      table.decimal('refunded_quantity', 12, 2).defaultTo(0);
    });
  }

  // 4. Create SALE_PAYMENTS table
  const hasSalePayments = await knex.schema.hasTable('sale_payments');
  if (!hasSalePayments) {
    await knex.schema.createTable('sale_payments', (table) => {
      table.increments('id').primary();
      table.integer('sale_id').unsigned().references('id').inTable('sales').onDelete('CASCADE').notNullable();
      table.string('payment_method', 50).notNullable(); // CASH, MOMO, BANK, CARD, CREDIT
      table.decimal('amount', 12, 2).notNullable();
      table.string('reference_no', 100).nullable();
      table.string('momo_network', 50).nullable();
      table.string('verification_status', 50).defaultTo('CASHIER_ENTERED'); // CASHIER_ENTERED, VERIFIED, PENDING_VERIFICATION
      table.boolean('is_verified').defaultTo(false);
      table.integer('verified_by_id').unsigned().references('id').inTable('users').nullable();
      table.timestamp('verified_at').nullable();
      table.integer('cashier_id').unsigned().references('id').inTable('users').notNullable();
      table.text('notes').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['sale_id']);
      table.index(['payment_method']);
      table.index(['verification_status']);
    });
  }

  // 5. Create REFUNDS table
  const hasRefunds = await knex.schema.hasTable('refunds');
  if (!hasRefunds) {
    await knex.schema.createTable('refunds', (table) => {
      table.increments('id').primary();
      table.string('refund_no', 100).unique().notNullable(); // e.g. REF-20261024-0001
      table.integer('sale_id').unsigned().references('id').inTable('sales').notNullable();
      table.string('receipt_no', 100).notNullable();
      table.integer('customer_id').unsigned().references('id').inTable('customers').nullable();
      table.integer('staff_id').unsigned().references('id').inTable('users').notNullable();
      table.integer('approved_by_id').unsigned().references('id').inTable('users').nullable();
      table.decimal('refund_amount', 12, 2).notNullable();
      table.string('refund_method', 50).notNullable(); // CASH, MOMO, STORE_CREDIT, CREDIT_REVERSAL
      table.text('reason').notNullable();
      table.string('status', 50).defaultTo('pending'); // pending, approved, rejected
      table.text('approval_notes').nullable();
      table.text('rejection_reason').nullable();
      table.timestamps(true, true);

      table.index(['refund_no']);
      table.index(['sale_id']);
      table.index(['status']);
    });
  }

  // 6. Create REFUND_ITEMS table
  const hasRefundItems = await knex.schema.hasTable('refund_items');
  if (!hasRefundItems) {
    await knex.schema.createTable('refund_items', (table) => {
      table.increments('id').primary();
      table.integer('refund_id').unsigned().references('id').inTable('refunds').onDelete('CASCADE').notNullable();
      table.integer('sale_item_id').unsigned().references('id').inTable('sale_items').notNullable();
      table.integer('product_id').unsigned().references('id').inTable('products').notNullable();
      table.integer('variant_id').unsigned().references('id').inTable('product_variants').nullable();
      table.decimal('quantity', 12, 2).notNullable();
      table.string('unit', 50).notNullable();
      table.decimal('unit_price', 12, 2).notNullable();
      table.decimal('total_refund', 12, 2).notNullable();
      table.string('condition', 50).defaultTo('RESELLABLE'); // RESELLABLE, DAMAGED
      table.string('warehouse_name', 100).defaultTo('Main Showroom');
      table.boolean('restocked').defaultTo(false);

      table.index(['refund_id']);
    });
  }

  // 7. Seed Granular Permissions for Phase 6 & Phase 7
  const newPermissions = [
    { name: 'credit_sales.create', module: 'sales', description: 'Create sales with credit payment terms' },
    { name: 'credit_sales.approve', module: 'sales', description: 'Authorize credit limit overrides and debt exceptions' },
    { name: 'refunds.view', module: 'sales', description: 'View return and refund transaction records' },
    { name: 'customers.manage_status', module: 'customers', description: 'Suspend or blacklist customer accounts' }
  ];

  for (const perm of newPermissions) {
    const existing = await knex('permissions').where({ name: perm.name }).first();
    if (!existing) {
      const [newPerm] = await knex('permissions').insert(perm).returning('*');
      // Assign to super_admin and admin
      await knex('role_permissions').insert([
        { role: 'super_admin', permission_id: newPerm.id },
        { role: 'admin', permission_id: newPerm.id }
      ]);
      if (perm.name === 'refunds.view') {
        await knex('role_permissions').insert({ role: 'accountant', permission_id: newPerm.id });
      }
    }
  }

  // Ensure admin role also has customers.manage_credit
  const manageCreditPerm = await knex('permissions').where({ name: 'customers.manage_credit' }).first();
  if (manageCreditPerm) {
    const adminHasCredit = await knex('role_permissions').where({ role: 'admin', permission_id: manageCreditPerm.id }).first();
    if (!adminHasCredit) {
      await knex('role_permissions').insert({ role: 'admin', permission_id: manageCreditPerm.id });
    }
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('refund_items');
  await knex.schema.dropTableIfExists('refunds');
  await knex.schema.dropTableIfExists('sale_payments');

  const hasVariantId = await knex.schema.hasColumn('sale_items', 'variant_id');
  if (hasVariantId) {
    await knex.schema.alterTable('sale_items', (table) => {
      table.dropColumn('refunded_quantity');
      table.dropColumn('variant_id');
    });
  }

  const hasPaymentStatus = await knex.schema.hasColumn('sales', 'payment_status');
  if (hasPaymentStatus) {
    await knex.schema.alterTable('sales', (table) => {
      table.dropColumn('idempotency_key');
      table.dropColumn('credit_due_date');
      table.dropColumn('tax_amount');
      table.dropColumn('verification_status');
      table.dropColumn('payment_status');
    });
  }

  const hasCustomerCode = await knex.schema.hasColumn('customers', 'customer_code');
  if (hasCustomerCode) {
    await knex.schema.alterTable('customers', (table) => {
      table.dropColumn('notes');
      table.dropColumn('status');
      table.dropColumn('address');
      table.dropColumn('email');
      table.dropColumn('customer_code');
    });
  }

  await knex('permissions').whereIn('name', [
    'credit_sales.create',
    'credit_sales.approve',
    'refunds.view',
    'customers.manage_status'
  ]).delete();
};

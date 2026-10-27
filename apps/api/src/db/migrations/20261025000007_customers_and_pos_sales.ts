import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Customers Table (Phase 7)
  await knex.schema.createTable('customers', (t) => {
    t.bigIncrements('id');
    t.string('name', 160).notNullable();
    t.string('customer_type', 30).notNullable().defaultTo('walk_in'); // walk_in, contractor, wholesale, corporate
    t.string('phone', 40);
    t.string('email', 254);
    t.text('address');
    t.decimal('credit_limit', 14, 2).notNullable().defaultTo(0);
    t.decimal('credit_balance', 14, 2).notNullable().defaultTo(0); // GH₵ owed
    t.string('credit_status', 20).notNullable().defaultTo('good'); // good, hold, suspended
    t.integer('credit_terms_days').notNullable().defaultTo(0);
    t.string('tax_number', 50);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['customer_type']);
    t.index(['credit_status']);
  });

  // Cashier Shifts (Phase 8 Task 3: Cashier shift management)
  await knex.schema.createTable('cashier_shifts', (t) => {
    t.bigIncrements('id');
    t.bigInteger('cashier_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.bigInteger('branch_id').notNullable().references('id').inTable('branches').onDelete('RESTRICT');
    t.bigInteger('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    t.timestamp('start_time', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('end_time', { useTz: true });
    t.decimal('opening_float', 14, 2).notNullable().defaultTo(0);
    t.decimal('closing_cash_declared', 14, 2);
    t.decimal('expected_cash', 14, 2).defaultTo(0);
    t.decimal('discrepancy', 14, 2).defaultTo(0);
    t.string('status', 20).notNullable().defaultTo('open'); // open, closed, reconciled
    t.bigInteger('reconciled_by').references('id').inTable('users').onDelete('RESTRICT');
    t.text('reconciliation_notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['cashier_id', 'status']);
  });

  // Sales Records (Phase 6: POS and Sales Transaction Management)
  await knex.schema.createTable('sales', (t) => {
    t.bigIncrements('id');
    t.string('sale_number', 60).notNullable().unique();
    t.string('receipt_number', 60).notNullable().unique();
    t.bigInteger('branch_id').notNullable().references('id').inTable('branches').onDelete('RESTRICT');
    t.bigInteger('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    t.bigInteger('cashier_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.bigInteger('customer_id').references('id').inTable('customers').onDelete('RESTRICT');
    t.bigInteger('shift_id').references('id').inTable('cashier_shifts').onDelete('RESTRICT');
    t.timestamp('sale_date', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.decimal('subtotal', 14, 2).notNullable().defaultTo(0);
    t.decimal('discount_amount', 14, 2).notNullable().defaultTo(0);
    t.decimal('tax_amount', 14, 2).notNullable().defaultTo(0);
    t.decimal('total_amount', 14, 2).notNullable().defaultTo(0);
    t.string('payment_status', 30).notNullable().defaultTo('paid'); // paid, partial, credit, refunded
    t.string('fulfillment_status', 30).notNullable().defaultTo('completed'); // completed, cancelled, refunded
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['branch_id', 'sale_date']);
    t.index(['cashier_id']);
    t.index(['receipt_number']);
  });

  // Sale Line Items
  await knex.schema.createTable('sale_items', (t) => {
    t.bigIncrements('id');
    t.bigInteger('sale_id').notNullable().references('id').inTable('sales').onDelete('CASCADE');
    t.bigInteger('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    t.bigInteger('variant_id').references('id').inTable('product_variants').onDelete('RESTRICT');
    t.decimal('quantity', 14, 3).notNullable();
    t.string('unit', 30).notNullable().defaultTo('pcs');
    t.decimal('unit_price', 14, 2).notNullable();
    t.decimal('unit_cost', 14, 4).notNullable();
    t.decimal('discount_amount', 14, 2).notNullable().defaultTo(0);
    t.decimal('line_total', 14, 2).notNullable();
    t.index(['sale_id']);
    t.index(['product_id']);
  });

  // Sale Payments (Supports Cash, MTN MoMo, Telecel Cash, Bank Transfer, Card, Credit)
  await knex.schema.createTable('sale_payments', (t) => {
    t.bigIncrements('id');
    t.bigInteger('sale_id').notNullable().references('id').inTable('sales').onDelete('CASCADE');
    t.string('payment_method', 40).notNullable(); // cash, momo_mtn, momo_telecel, bank_transfer, card, credit
    t.decimal('amount', 14, 2).notNullable();
    t.string('reference_number', 80);
    t.string('verification_status', 30).notNullable().defaultTo('recorded'); // recorded, verified, reconciled
    t.bigInteger('recorded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['sale_id']);
    t.index(['payment_method']);
  });

  await knex.raw(
    `create trigger customers_set_updated_at before update on customers for each row execute function omal_set_updated_at()`,
  );
  await knex.raw(
    `create trigger cashier_shifts_set_updated_at before update on cashier_shifts for each row execute function omal_set_updated_at()`,
  );
  await knex.raw(
    `create trigger sales_set_updated_at before update on sales for each row execute function omal_set_updated_at()`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sale_payments');
  await knex.schema.dropTableIfExists('sale_items');
  await knex.schema.dropTableIfExists('sales');
  await knex.schema.dropTableIfExists('cashier_shifts');
  await knex.schema.dropTableIfExists('customers');
}

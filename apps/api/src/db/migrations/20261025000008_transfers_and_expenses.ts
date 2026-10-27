import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Inter-branch transfers (Phase 9: Accra Showroom <-> Tema Depot)
  await knex.schema.createTable('interbranch_transfers', (t) => {
    t.bigIncrements('id');
    t.string('transfer_number', 60).notNullable().unique();
    t.bigInteger('source_branch_id').notNullable().references('id').inTable('branches').onDelete('RESTRICT');
    t.bigInteger('source_warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    t.bigInteger('dest_branch_id').notNullable().references('id').inTable('branches').onDelete('RESTRICT');
    t.bigInteger('dest_warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    t.string('status', 30).notNullable().defaultTo('requested'); // requested, approved, dispatched, in_transit, received, discrepant, cancelled
    t.timestamp('requested_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.bigInteger('requested_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('dispatched_at', { useTz: true });
    t.bigInteger('dispatched_by').references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('received_at', { useTz: true });
    t.bigInteger('received_by').references('id').inTable('users').onDelete('RESTRICT');
    t.string('driver_name', 100);
    t.string('vehicle_number', 40);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['source_branch_id']);
    t.index(['dest_branch_id']);
    t.index(['status']);
  });

  await knex.schema.createTable('interbranch_transfer_items', (t) => {
    t.bigIncrements('id');
    t.bigInteger('transfer_id').notNullable().references('id').inTable('interbranch_transfers').onDelete('CASCADE');
    t.bigInteger('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    t.bigInteger('variant_id').references('id').inTable('product_variants').onDelete('RESTRICT');
    t.decimal('quantity_requested', 14, 3).notNullable();
    t.decimal('quantity_dispatched', 14, 3).notNullable().defaultTo(0);
    t.decimal('quantity_received', 14, 3).notNullable().defaultTo(0);
    t.decimal('quantity_damaged', 14, 3).notNullable().defaultTo(0);
    t.string('unit', 30).notNullable().defaultTo('pcs');
    t.text('discrepancy_reason');
    t.index(['transfer_id']);
  });

  // Expense Categories (Phase 8 Task 2)
  await knex.schema.createTable('expense_categories', (t) => {
    t.bigIncrements('id');
    t.string('code', 40).notNullable().unique();
    t.string('name', 100).notNullable();
    t.text('description');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Expenses Table
  await knex.schema.createTable('expenses', (t) => {
    t.bigIncrements('id');
    t.string('expense_number', 60).notNullable().unique();
    t.bigInteger('branch_id').notNullable().references('id').inTable('branches').onDelete('RESTRICT');
    t.bigInteger('category_id').notNullable().references('id').inTable('expense_categories').onDelete('RESTRICT');
    t.decimal('amount', 14, 2).notNullable();
    t.date('expense_date').notNullable();
    t.text('description').notNullable();
    t.string('payment_method', 40).notNullable().defaultTo('cash'); // cash, momo_business, bank_transfer
    t.string('receipt_ref', 80);
    t.string('approval_status', 20).notNullable().defaultTo('pending'); // pending, approved, rejected
    t.bigInteger('recorded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.bigInteger('approved_by').references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('approved_at', { useTz: true });
    t.text('approval_notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['branch_id', 'expense_date']);
    t.index(['category_id']);
    t.index(['approval_status']);
  });

  await knex.raw(
    `create trigger interbranch_transfers_set_updated_at before update on interbranch_transfers for each row execute function omal_set_updated_at()`,
  );
  await knex.raw(
    `create trigger expenses_set_updated_at before update on expenses for each row execute function omal_set_updated_at()`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('expenses');
  await knex.schema.dropTableIfExists('expense_categories');
  await knex.schema.dropTableIfExists('interbranch_transfer_items');
  await knex.schema.dropTableIfExists('interbranch_transfers');
}

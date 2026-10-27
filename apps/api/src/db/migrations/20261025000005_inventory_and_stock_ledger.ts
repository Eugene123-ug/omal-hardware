import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Opening stock batches (Phase 4 Task 1: Controlled opening-stock workflow)
  await knex.schema.createTable('opening_stock_batches', (t) => {
    t.bigIncrements('id');
    t.string('batch_number', 50).notNullable().unique();
    t.bigInteger('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    t.string('status', 20).notNullable().defaultTo('draft'); // draft, approved, posted
    t.string('valuation_basis', 40).notNullable().defaultTo('actual_cost'); // actual_cost, replacement_cost
    t.bigInteger('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.bigInteger('approved_by').references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('approved_at', { useTz: true });
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('opening_stock_items', (t) => {
    t.bigIncrements('id');
    t.bigInteger('batch_id').notNullable().references('id').inTable('opening_stock_batches').onDelete('CASCADE');
    t.bigInteger('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    t.bigInteger('variant_id').references('id').inTable('product_variants').onDelete('RESTRICT');
    t.decimal('quantity', 14, 3).notNullable();
    t.string('unit', 30).notNullable().defaultTo('pcs');
    t.decimal('unit_cost', 14, 4).notNullable();
    t.decimal('total_cost', 14, 2).notNullable();
    t.string('storage_bin', 60);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Current stock level per warehouse & variant (Phase 4 Task 4)
  await knex.schema.createTable('stock_levels', (t) => {
    t.bigIncrements('id');
    t.bigInteger('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    t.bigInteger('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    t.bigInteger('variant_id').references('id').inTable('product_variants').onDelete('RESTRICT');
    t.decimal('quantity_on_hand', 14, 3).notNullable().defaultTo(0);
    t.decimal('quantity_reserved', 14, 3).notNullable().defaultTo(0);
    t.decimal('reorder_threshold', 14, 3).notNullable().defaultTo(5);
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['warehouse_id', 'product_id', 'variant_id']);
    t.index(['warehouse_id', 'product_id']);
  });
  // Database-level constraint strictly preventing negative physical stock!
  await knex.raw('alter table stock_levels add constraint stock_on_hand_non_negative check (quantity_on_hand >= 0)');
  await knex.raw('alter table stock_levels add constraint stock_reserved_non_negative check (quantity_reserved >= 0)');

  // Immutable Stock Movements Ledger (Phase 4 Task 3)
  await knex.schema.createTable('stock_movements', (t) => {
    t.bigIncrements('id');
    t.string('movement_type', 40).notNullable(); // stock_receipt, confirmed_sale, customer_return, supplier_return, damage_breakage, approved_loss, stock_count_adjustment, warehouse_transfer_in, warehouse_transfer_out, opening_stock
    t.bigInteger('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    t.bigInteger('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    t.bigInteger('variant_id').references('id').inTable('product_variants').onDelete('RESTRICT');
    t.decimal('quantity', 14, 3).notNullable(); // positive (in) or negative (out)
    t.decimal('unit_cost', 14, 4).notNullable().defaultTo(0);
    t.decimal('total_valuation', 14, 2).notNullable().defaultTo(0);
    t.string('source_transaction_type', 40); // opening_stock, purchase_order, grn, sale, transfer, adjustment
    t.string('source_transaction_id', 80);
    t.string('reference_number', 80);
    t.bigInteger('operator_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.bigInteger('approved_by').references('id').inTable('users').onDelete('RESTRICT');
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['warehouse_id', 'product_id']);
    t.index(['movement_type']);
    t.index(['created_at']);
    t.index(['source_transaction_type', 'source_transaction_id']);
  });

  await knex.raw(
    `create trigger opening_stock_batches_set_updated_at before update on opening_stock_batches for each row execute function omal_set_updated_at()`,
  );
  await knex.raw(
    `create trigger stock_levels_set_updated_at before update on stock_levels for each row execute function omal_set_updated_at()`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('stock_movements');
  await knex.schema.dropTableIfExists('stock_levels');
  await knex.schema.dropTableIfExists('opening_stock_items');
  await knex.schema.dropTableIfExists('opening_stock_batches');
}

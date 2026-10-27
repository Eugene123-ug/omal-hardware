import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Suppliers Table
  await knex.schema.createTable('suppliers', (t) => {
    t.bigIncrements('id');
    t.string('name', 160).notNullable();
    t.string('company_reg_no', 60);
    t.string('contact_person', 100);
    t.string('phone', 40);
    t.string('email', 254);
    t.text('address');
    t.string('payment_terms', 60).notNullable().defaultTo('net_30'); // cash_on_delivery, net_15, net_30, net_60
    t.jsonb('bank_details'); // sensitive payment info
    t.string('status', 20).notNullable().defaultTo('active'); // active, inactive, blacklisted
    t.decimal('current_balance', 14, 2).notNullable().defaultTo(0); // GH₵ owed
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Purchase Orders Table
  await knex.schema.createTable('purchase_orders', (t) => {
    t.bigIncrements('id');
    t.string('po_number', 50).notNullable().unique();
    t.bigInteger('supplier_id').notNullable().references('id').inTable('suppliers').onDelete('RESTRICT');
    t.bigInteger('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    t.string('status', 30).notNullable().defaultTo('draft'); // draft, pending_approval, approved, partially_received, completed, cancelled
    t.date('order_date').notNullable();
    t.date('expected_delivery_date');
    t.decimal('subtotal', 14, 2).notNullable().defaultTo(0);
    t.decimal('tax_amount', 14, 2).notNullable().defaultTo(0);
    t.decimal('total_amount', 14, 2).notNullable().defaultTo(0);
    t.bigInteger('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.bigInteger('approved_by').references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('approved_at', { useTz: true });
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['supplier_id']);
    t.index(['status']);
  });

  await knex.schema.createTable('purchase_order_items', (t) => {
    t.bigIncrements('id');
    t.bigInteger('po_id').notNullable().references('id').inTable('purchase_orders').onDelete('CASCADE');
    t.bigInteger('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    t.bigInteger('variant_id').references('id').inTable('product_variants').onDelete('RESTRICT');
    t.decimal('quantity_ordered', 14, 3).notNullable();
    t.decimal('quantity_received', 14, 3).notNullable().defaultTo(0);
    t.string('unit', 30).notNullable().defaultTo('pcs');
    t.decimal('unit_cost', 14, 4).notNullable();
    t.decimal('line_total', 14, 2).notNullable();
    t.index(['po_id']);
  });

  // Goods Received Notes (GRN)
  await knex.schema.createTable('goods_received_notes', (t) => {
    t.bigIncrements('id');
    t.string('grn_number', 50).notNullable().unique();
    t.bigInteger('po_id').references('id').inTable('purchase_orders').onDelete('RESTRICT');
    t.bigInteger('supplier_id').notNullable().references('id').inTable('suppliers').onDelete('RESTRICT');
    t.bigInteger('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    t.string('delivery_note_ref', 80);
    t.string('supplier_invoice_ref', 80);
    t.string('status', 20).notNullable().defaultTo('confirmed'); // draft, confirmed, discrepant
    t.bigInteger('received_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.text('notes');
    t.timestamp('received_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('goods_received_items', (t) => {
    t.bigIncrements('id');
    t.bigInteger('grn_id').notNullable().references('id').inTable('goods_received_notes').onDelete('CASCADE');
    t.bigInteger('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    t.bigInteger('variant_id').references('id').inTable('product_variants').onDelete('RESTRICT');
    t.decimal('quantity_received', 14, 3).notNullable();
    t.decimal('quantity_rejected', 14, 3).notNullable().defaultTo(0);
    t.decimal('unit_cost', 14, 4).notNullable();
    t.text('discrepancy_reason');
    t.index(['grn_id']);
  });

  // Supplier Invoices & Payments
  await knex.schema.createTable('supplier_invoices', (t) => {
    t.bigIncrements('id');
    t.string('invoice_number', 60).notNullable();
    t.bigInteger('supplier_id').notNullable().references('id').inTable('suppliers').onDelete('RESTRICT');
    t.bigInteger('po_id').references('id').inTable('purchase_orders').onDelete('RESTRICT');
    t.date('invoice_date').notNullable();
    t.date('due_date');
    t.decimal('total_amount', 14, 2).notNullable();
    t.decimal('amount_paid', 14, 2).notNullable().defaultTo(0);
    t.string('status', 20).notNullable().defaultTo('pending'); // pending, partial, paid
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('supplier_payments', (t) => {
    t.bigIncrements('id');
    t.string('payment_reference', 80).notNullable().unique();
    t.bigInteger('supplier_id').notNullable().references('id').inTable('suppliers').onDelete('RESTRICT');
    t.bigInteger('invoice_id').references('id').inTable('supplier_invoices').onDelete('RESTRICT');
    t.decimal('amount', 14, 2).notNullable();
    t.string('payment_method', 40).notNullable(); // bank_transfer, cheque, cash
    t.date('payment_date').notNullable();
    t.bigInteger('recorded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    `create trigger suppliers_set_updated_at before update on suppliers for each row execute function omal_set_updated_at()`,
  );
  await knex.raw(
    `create trigger purchase_orders_set_updated_at before update on purchase_orders for each row execute function omal_set_updated_at()`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('supplier_payments');
  await knex.schema.dropTableIfExists('supplier_invoices');
  await knex.schema.dropTableIfExists('goods_received_items');
  await knex.schema.dropTableIfExists('goods_received_notes');
  await knex.schema.dropTableIfExists('purchase_order_items');
  await knex.schema.dropTableIfExists('purchase_orders');
  await knex.schema.dropTableIfExists('suppliers');
}

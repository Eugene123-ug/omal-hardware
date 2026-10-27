import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Categories (Tiles, Security Doors, Sanitary Ware, Paints, General Hardware)
  await knex.schema.createTable('product_categories', (t) => {
    t.bigIncrements('id');
    t.string('code', 40).notNullable().unique();
    t.string('name', 100).notNullable();
    t.text('description');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('product_subcategories', (t) => {
    t.bigIncrements('id');
    t.bigInteger('category_id').notNullable().references('id').inTable('product_categories').onDelete('RESTRICT');
    t.string('code', 40).notNullable().unique();
    t.string('name', 100).notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['category_id']);
  });

  // Base Products
  await knex.schema.createTable('products', (t) => {
    t.bigIncrements('id');
    t.string('sku', 50).notNullable().unique();
    t.string('name', 160).notNullable();
    t.bigInteger('category_id').notNullable().references('id').inTable('product_categories').onDelete('RESTRICT');
    t.bigInteger('subcategory_id').references('id').inTable('product_subcategories').onDelete('RESTRICT');
    t.string('brand', 80);
    t.text('description');
    t.string('barcode', 64);
    t.string('base_unit', 30).notNullable().defaultTo('pcs'); // pcs, box, pallet, litre, m2
    t.decimal('cost_price', 14, 4).notNullable().defaultTo(0);
    t.decimal('selling_price', 14, 2).notNullable().defaultTo(0);
    t.decimal('wholesale_price', 14, 2);
    t.decimal('min_stock_alert', 14, 3).notNullable().defaultTo(10);
    t.string('storage_location', 80);
    t.string('status', 20).notNullable().defaultTo('active'); // active, discontinued
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['category_id']);
    t.index(['status']);
    t.index(['barcode']);
  });
  await knex.raw('create unique index products_sku_lower_unique on products (lower(sku))');
  await knex.raw(`alter table products add constraint products_status_check check (status in ('active','discontinued'))`);

  // Product Variants & Conversions (handles hardware attributes & packaging conversion)
  await knex.schema.createTable('product_variants', (t) => {
    t.bigIncrements('id');
    t.bigInteger('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    t.string('sku_variant', 60).notNullable().unique();
    t.string('name', 120).notNullable();
    t.string('barcode', 64);
    // Extensible JSONB attributes: size, colour, finish, thickness, handedness, volume, etc.
    t.jsonb('attributes').notNullable().defaultTo('{}');
    // Unit conversion metrics (e.g. coverage_sqm_per_box, units_per_box)
    t.decimal('conversion_ratio', 12, 4).defaultTo(1.0);
    t.string('conversion_unit', 30);
    t.decimal('cost_price', 14, 4);
    t.decimal('selling_price', 14, 2);
    t.decimal('wholesale_price', 14, 2);
    t.string('status', 20).notNullable().defaultTo('active');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['product_id']);
  });

  await knex.raw(
    `create trigger products_set_updated_at before update on products for each row execute function omal_set_updated_at()`,
  );
  await knex.raw(
    `create trigger product_variants_set_updated_at before update on product_variants for each row execute function omal_set_updated_at()`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('product_variants');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('product_subcategories');
  await knex.schema.dropTableIfExists('product_categories');
}

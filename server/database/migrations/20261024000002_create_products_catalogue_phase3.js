/**
 * Phase 3 Migration: Product Catalogue, Hardware Attributes, Units, Variants & Price Controls
 * Target Database: PostgreSQL 17
 */

exports.up = async function(knex) {
  // 1. ALTER PRODUCTS TABLE: Add subcategory, description, supplier_id, status, min_selling_price, attributes, conversions
  await knex.schema.alterTable('products', (table) => {
    table.string('subcategory', 100).nullable();
    table.text('description').nullable();
    table.integer('supplier_id').unsigned().references('id').inTable('suppliers').onDelete('SET NULL').nullable();
    table.string('status', 50).defaultTo('active').notNullable(); // active, discontinued
    table.decimal('min_selling_price', 12, 2).nullable(); // price floor protection
    table.jsonb('attributes').defaultTo('{}'); // hardware-specific attributes (tiles, doors, sanitary, paints, etc.)
    table.jsonb('conversions').defaultTo('{}'); // explicit unit conversion factors
    
    table.index(['subcategory']);
    table.index(['supplier_id']);
    table.index(['status']);
  });

  // GIN index on jsonb attributes for fast hardware attribute searches
  await knex.raw('CREATE INDEX idx_products_attributes_gin ON products USING gin (attributes);');

  // 2. CREATE PRODUCT VARIANTS TABLE
  await knex.schema.createTable('product_variants', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE').notNullable();
    table.string('variant_name', 255).notNullable();
    table.string('sku', 100).unique().notNullable();
    table.string('barcode', 100).nullable();
    table.decimal('cost_price', 12, 2).nullable();
    table.decimal('selling_price', 12, 2).nullable();
    table.decimal('wholesale_price', 12, 2).nullable();
    table.decimal('min_selling_price', 12, 2).nullable();
    table.jsonb('attributes').defaultTo('{}');
    table.string('status', 50).defaultTo('active').notNullable();
    table.timestamps(true, true);

    table.index(['product_id']);
    table.index(['sku']);
    table.index(['barcode']);
    table.index(['status']);
  });

  // GIN index on variant attributes
  await knex.raw('CREATE INDEX idx_product_variants_attributes_gin ON product_variants USING gin (attributes);');

  // 3. ALTER WAREHOUSE_STOCK TO SUPPORT VARIANTS
  await knex.schema.alterTable('warehouse_stock', (table) => {
    table.integer('variant_id').unsigned().references('id').inTable('product_variants').onDelete('CASCADE').nullable();
    table.index(['variant_id']);
  });

  // Drop old unique constraint and add new conditional index or constraint
  await knex.raw('ALTER TABLE warehouse_stock DROP CONSTRAINT IF EXISTS warehouse_stock_product_id_warehouse_name_unique;');
  await knex.raw('CREATE UNIQUE INDEX idx_warehouse_stock_unique ON warehouse_stock (product_id, COALESCE(variant_id, 0), warehouse_name);');

  // 4. ENHANCE PRICE_CHANGE_LOGS
  await knex.schema.alterTable('price_change_logs', (table) => {
    table.integer('variant_id').unsigned().references('id').inTable('product_variants').onDelete('CASCADE').nullable();
    table.text('reason').nullable();
    table.string('status', 50).defaultTo('approved').notNullable(); // approved, pending_approval, rejected
    table.boolean('requires_approval').defaultTo(false).notNullable();
    table.decimal('min_selling_price', 12, 2).nullable();
    table.decimal('change_percent', 6, 2).nullable();
    table.text('rejection_reason').nullable();

    table.index(['status']);
  });
};

exports.down = async function(knex) {
  // Rollback price_change_logs
  await knex.schema.alterTable('price_change_logs', (table) => {
    table.dropColumn('rejection_reason');
    table.dropColumn('change_percent');
    table.dropColumn('min_selling_price');
    table.dropColumn('requires_approval');
    table.dropColumn('status');
    table.dropColumn('reason');
    table.dropColumn('variant_id');
  });

  // Rollback warehouse_stock
  await knex.raw('DROP INDEX IF EXISTS idx_warehouse_stock_unique;');
  await knex.schema.alterTable('warehouse_stock', (table) => {
    table.dropColumn('variant_id');
  });
  await knex.raw('ALTER TABLE warehouse_stock ADD CONSTRAINT warehouse_stock_product_id_warehouse_name_unique UNIQUE (product_id, warehouse_name);');

  // Drop product_variants
  await knex.raw('DROP INDEX IF EXISTS idx_product_variants_attributes_gin;');
  await knex.schema.dropTableIfExists('product_variants');

  // Rollback products
  await knex.raw('DROP INDEX IF EXISTS idx_products_attributes_gin;');
  await knex.schema.alterTable('products', (table) => {
    table.dropColumn('conversions');
    table.dropColumn('attributes');
    table.dropColumn('min_selling_price');
    table.dropColumn('status');
    table.dropColumn('supplier_id');
    table.dropColumn('description');
    table.dropColumn('subcategory');
  });
};

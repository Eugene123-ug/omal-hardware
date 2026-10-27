import type { Knex } from 'knex';

/**
 * Migration: 20261027000014_single_company_wonark_standard.ts
 * Upgrades OMAL multi-branch system to WONARK COMPANY LIMITED single-company standard:
 * - Creates dedicated `business_settings` table (id=1) for dynamic global company profile
 * - Adds `quantity` directly to `products` and backfills from stock_levels
 * - Adds DB indexes for 100k+ high-load scalability
 * - Cleans up typos (e.g. "Security Dooe" -> "Security Doors")
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create business_settings table
  const hasSettings = await knex.schema.hasTable('business_settings');
  if (!hasSettings) {
    await knex.schema.createTable('business_settings', (t) => {
      t.bigInteger('id').primary().defaultTo(1);
      t.string('company_name', 200).notNullable().defaultTo('WONARK COMPANY LIMITED');
      t.text('logo_url');
      t.text('address').defaultTo('Accra Industrial Area, Greater Accra, Ghana');
      t.string('phone1', 50).defaultTo('+233 30 281 1200');
      t.string('phone2', 50).defaultTo('+233 24 455 6677');
      t.string('email', 100).defaultTo('info@wonark.com');
      t.string('tin', 50).defaultTo('C0001234567');
      t.string('website', 100).defaultTo('www.wonark.com');
      t.string('currency', 10).defaultTo('GHS');
      t.decimal('tax_rate', 5, 2).defaultTo(0);
      t.decimal('default_low_stock_threshold', 14, 3).defaultTo(10);
      t.text('receipt_footer').defaultTo('Thank you for your business!');
      t.text('terms_and_conditions').defaultTo('Goods sold in good condition are not returnable after 7 days.');
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  // Insert default business settings row if not present
  await knex.raw(`
    INSERT INTO business_settings (id, company_name, address, phone1, phone2, email, tin, website, currency, tax_rate, default_low_stock_threshold, receipt_footer)
    VALUES (
      1,
      'WONARK COMPANY LIMITED',
      'Accra Industrial Area, Greater Accra, Ghana',
      '+233 30 281 1200',
      '+233 24 455 6677',
      'info@wonark.com',
      'C0001234567',
      'www.wonark.com',
      'GHS',
      0,
      10,
      'Thank you for your business!'
    )
    ON CONFLICT (id) DO UPDATE SET
      company_name = COALESCE(business_settings.company_name, 'WONARK COMPANY LIMITED');
  `);

  // 2. Add quantity directly to products table
  const hasQuantity = await knex.schema.hasColumn('products', 'quantity');
  if (!hasQuantity) {
    await knex.schema.alterTable('products', (t) => {
      t.decimal('quantity', 14, 3).notNullable().defaultTo(0);
    });
  }

  // Backfill products.quantity from sum of stock_levels
  await knex.raw(`
    UPDATE products p
    SET quantity = COALESCE((
      SELECT SUM(sl.quantity_on_hand)
      FROM stock_levels sl
      WHERE sl.product_id = p.id
    ), 0);
  `);

  // 3. Add high-performance indexes for 100k+ scalability
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_prod_date ON stock_movements(product_id, created_at);
  `);

  // 4. Data sanitization: Fix "Security Dooe" typo
  await knex.raw(`
    UPDATE product_categories
    SET name = 'Security Doors'
    WHERE name ILIKE '%Security Doo%';

    UPDATE products
    SET name = REPLACE(name, 'Security Dooe', 'Security Door')
    WHERE name ILIKE '%Security Dooe%';
  `);

  // Fix staff email typo if present (samuel@gmail.com for JOHNSON NKETIA)
  await knex.raw(`
    UPDATE users
    SET email = 'johnson.nketia@wonark.com'
    WHERE full_name ILIKE '%JOHNSON NKETIA%' AND email ILIKE '%samuel@gmail.com%';
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasQuantity = await knex.schema.hasColumn('products', 'quantity');
  if (hasQuantity) {
    await knex.schema.alterTable('products', (t) => {
      t.dropColumn('quantity');
    });
  }
  await knex.schema.dropTableIfExists('business_settings');
}

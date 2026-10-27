const bcrypt = require('bcryptjs');

/**
 * Seed foundational development data for OMAL Business ERP
 * Target: PostgreSQL 17 Development Database
 */
exports.seed = async function(knex) {
  console.log('[Seed] Checking foundational development users, settings, and hardware catalog...');

  // 1. SEED DEFAULT SETTINGS
  const settingsCount = await knex('settings').count('key as count').first();
  if (parseInt(settingsCount.count) === 0) {
    await knex('settings').insert([
      { key: 'company_name', value: 'OMAL TILES & HARDWARE DEPOT' },
      { key: 'company_tin', value: 'C0028914567' },
      { key: 'company_phone', value: '+233 30 298 7654 / +233 24 456 7890' },
      { key: 'company_address', value: 'Plot 48 Spintex Road, Opposite Palace Mall, Accra, Ghana' },
      { key: 'receipt_footer', value: 'Thank you for your business! Goods once sold are not returnable after 48 hours. Valid GRA receipt.' },
      { key: 'currency_symbol', value: 'GHS' },
      { key: 'max_cashier_discount_pct', value: '2' },
      { key: 'auto_logout_mins', value: '15' },
      { key: 'warehouses', value: JSON.stringify(['Main Showroom', 'Warehouse B (Depot)']) }
    ]);
  }

  // 2. SEED USERS WITH BCRYPT HASHES
  const userCount = await knex('users').count('id as count').first();
  if (parseInt(userCount.count) === 0) {
    const salt = bcrypt.genSaltSync(10);
    const users = [
      {
        name: 'Alhaji Osei Mensah (Owner)',
        email: 'owner@omal.com',
        password: bcrypt.hashSync('owner123', salt),
        role: 'super_admin',
        admin_pin: '9999',
        phone: '+44 7911 123456',
        status: 'active'
      },
      {
        name: 'Kofi Boateng (IT / General Manager)',
        email: 'admin@omal.com',
        password: bcrypt.hashSync('admin123', salt),
        role: 'admin',
        admin_pin: '1234',
        phone: '+233 24 456 7890',
        status: 'active'
      },
      {
        name: 'Kwame Asante (Senior Cashier)',
        email: 'kwame@omal.com',
        password: bcrypt.hashSync('kwame123', salt),
        role: 'sales',
        admin_pin: null,
        phone: '+233 20 123 4567',
        status: 'active'
      },
      {
        name: 'Ama Serwaa (Sales Executive)',
        email: 'ama@omal.com',
        password: bcrypt.hashSync('ama123', salt),
        role: 'sales',
        admin_pin: null,
        phone: '+233 55 987 6543',
        status: 'active'
      },
      {
        name: 'Yaw Frimpong (Accountant)',
        email: 'accountant@omal.com',
        password: bcrypt.hashSync('acc123', salt),
        role: 'accountant',
        admin_pin: null,
        phone: '+233 27 555 4321',
        status: 'active'
      }
    ];
    await knex('users').insert(users);
  }

  // 3. SEED PRODUCTS
  const prodCount = await knex('products').count('id as count').first();
  if (parseInt(prodCount.count) === 0) {
  const products = [
    {
      name: 'Spanish Porcelain Floor Tile 60x60 White Polished',
      category: 'Tiles',
      sku: 'TL-SP-6060-WHT',
      barcode: '600101001',
      brand: 'Porcelanosa Spain',
      size_color: '60x60 cm / Super White Gloss',
      unit: 'box',
      cost_price: 135.00,
      selling_price: 195.00,
      wholesale_price: 180.00,
      min_stock_alert: 50,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 1.44,
      pieces_per_box: 4,
      image_url: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=400&auto=format&fit=crop&q=60'
    },
    {
      name: 'Italian Carrara Marble Look 60x120 Glazed Porcelain',
      category: 'Tiles',
      sku: 'TL-IT-6012-CAR',
      barcode: '600101002',
      brand: 'Marazzi Italy',
      size_color: '60x120 cm / Carrara Grey Vein',
      unit: 'box',
      cost_price: 240.00,
      selling_price: 340.00,
      wholesale_price: 315.00,
      min_stock_alert: 30,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 1.44,
      pieces_per_box: 2,
      image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&auto=format&fit=crop&q=60'
    },
    {
      name: 'Turkish Armoured Luxury Main Security Door (4ft Double Leaf)',
      category: 'Security Doors',
      sku: 'DR-TRK-4FT-ARM',
      barcode: '600201001',
      brand: 'Kale Kilit Turkey',
      size_color: '4ft (120x210 cm) / Walnut Bronze Steel',
      unit: 'pcs',
      cost_price: 3200.00,
      selling_price: 4500.00,
      wholesale_price: 4200.00,
      min_stock_alert: 5,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&auto=format&fit=crop&q=60'
    },
    {
      name: 'Turkish Single Leaf Security Entrance Door (3ft Heavy Duty)',
      category: 'Security Doors',
      sku: 'DR-TRK-3FT-SGL',
      barcode: '600201002',
      brand: 'Kale Kilit Turkey',
      size_color: '3ft (96x205 cm) / Dark Oak Heavy Gauge',
      unit: 'pcs',
      cost_price: 1800.00,
      selling_price: 2600.00,
      wholesale_price: 2400.00,
      min_stock_alert: 8,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400&auto=format&fit=crop&q=60'
    },
    {
      name: 'Rimless Dual-Flush Close-Coupled Ceramic W/C Toilet Suite',
      category: 'Sanitary',
      sku: 'SAN-WC-RIM-01',
      barcode: '600301001',
      brand: 'Cotto Luxury',
      size_color: 'Full Set with Soft Close Seat / Alpine White',
      unit: 'pcs',
      cost_price: 850.00,
      selling_price: 1350.00,
      wholesale_price: 1250.00,
      min_stock_alert: 12,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&auto=format&fit=crop&q=60'
    },
    {
      name: 'Coral Premium Acrylic Exterior Emulsion Paint (20 Litres)',
      category: 'Paints',
      sku: 'PNT-CRL-EXT-20L-WHT',
      barcode: '600401001',
      brand: 'Coral Paints Ghana',
      size_color: '20L Bucket / Brilliant White WeatherShield',
      unit: 'bucket 20L',
      cost_price: 520.00,
      selling_price: 720.00,
      wholesale_price: 680.00,
      min_stock_alert: 20,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&auto=format&fit=crop&q=60'
    },
    {
      name: 'Diamond Portland Cement 42.5R Grade (50kg Bag)',
      category: 'General Hardware',
      sku: 'HDW-CMT-50KG-425',
      barcode: '600501001',
      brand: 'Ghacem / Diamond Cement',
      size_color: '50kg Bag / High Strength',
      unit: 'bag',
      cost_price: 88.00,
      selling_price: 102.00,
      wholesale_price: 98.00,
      min_stock_alert: 100,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&auto=format&fit=crop&q=60'
    },
    {
      name: 'High-Tensile TMT Iron Steel Rebar 12mm x 12m (Single Rod)',
      category: 'General Hardware',
      sku: 'HDW-ROD-12MM-12M',
      barcode: '600501002',
      brand: 'B5 Plus Steel Ghana',
      size_color: '12mm Diameter x 12m Length',
      unit: 'pcs',
      cost_price: 68.00,
      selling_price: 85.00,
      wholesale_price: 80.00,
      min_stock_alert: 150,
      warehouse_location: 'Warehouse B (Depot)',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=400&auto=format&fit=crop&q=60'
    }
  ];

  const insertedProducts = await knex('products').insert(products).returning('*');

  // 4. SEED WAREHOUSE STOCKS
  const warehouseStocks = [];
  for (const prod of insertedProducts) {
    warehouseStocks.push(
      { product_id: prod.id, warehouse_name: 'Main Showroom', quantity: 50 },
      { product_id: prod.id, warehouse_name: 'Warehouse B (Depot)', quantity: 150 }
    );
  }
  await knex('warehouse_stock').insert(warehouseStocks);
  }

  // 5. SEED CUSTOMERS
  const custCount = await knex('customers').count('id as count').first();
  if (parseInt(custCount.count) === 0) {
    await knex('customers').insert([
      { name: 'Chief Contractor Emmanuel Darko', phone: '+233 24 999 1122', location: 'East Legon Hills, Accra', credit_limit: 25000.00, current_balance: 4800.00 },
      { name: 'Arch-Design Construction Ltd', phone: '+233 20 888 3344', location: 'Airport Residential Area', credit_limit: 50000.00, current_balance: 12400.00 },
      { name: 'Madam Faustina Osei', phone: '+233 55 777 5566', location: 'Kwashieman, Accra', credit_limit: 10000.00, current_balance: 1250.00 }
    ]);
  }

  // 6. SEED SUPPLIERS
  const suppCount = await knex('suppliers').count('id as count').first();
  if (parseInt(suppCount.count) === 0) {
    await knex('suppliers').insert([
      { name: 'Global Ceramics & Tiles Import Ltd', phone: '+233 30 222 1100', contact_person: 'Mr. Marco Rossi', location: 'Tema Industrial Area', balance_owed: 42000.00 },
      { name: 'Anatolia Steel & Security Doors TR', phone: '+90 212 555 1234', contact_person: 'Mehmet Yilmaz', location: 'Istanbul / Tema Port', balance_owed: 68000.00 },
      { name: 'Coral Paints West Africa Ltd', phone: '+233 30 281 0500', contact_person: 'Sales Desk', location: 'Graphic Road, Accra', balance_owed: 15600.00 }
    ]);
  }

  console.log('[Seed] Development data seeding completed successfully.');
};

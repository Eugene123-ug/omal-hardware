const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'omal_pos.db');
const db = new Database(dbPath);

// Enable foreign keys & WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    -- USERS & ROLES
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'sales', 'accountant')),
      admin_pin TEXT, -- for super_admin & admin authorization (e.g. discounts > 2%, price overrides)
      phone TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- PRODUCTS
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL, -- 'Tiles', 'Security Doors', 'Sanitary', 'Paints', 'General Hardware'
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT,
      brand TEXT,
      size_color TEXT,
      unit TEXT DEFAULT 'pcs', -- 'box', 'pcs', 'bucket 20L', 'gallon', 'bundle', 'bag'
      cost_price REAL NOT NULL, -- Strictly hidden from Sales Staff
      selling_price REAL NOT NULL,
      wholesale_price REAL,
      min_stock_alert INTEGER DEFAULT 10,
      warehouse_location TEXT DEFAULT 'Main Showroom',
      image_url TEXT,
      sqm_per_box REAL DEFAULT 0, -- For tiles: m2 coverage per box (e.g. 1.44 m2)
      pieces_per_box INTEGER DEFAULT 0, -- For tiles: pieces per box (e.g. 4 pcs)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- WAREHOUSE STOCK (Multi-location: Main Showroom & Warehouse B Depot)
    CREATE TABLE IF NOT EXISTS warehouse_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      warehouse_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      UNIQUE(product_id, warehouse_name)
    );

    -- STOCK MOVEMENTS AUDIT TRAIL
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      movement_type TEXT NOT NULL, -- 'IN' (purchase), 'OUT' (sale), 'ADJUSTMENT', 'TRANSFER'
      quantity REAL NOT NULL,
      from_location TEXT,
      to_location TEXT,
      reference_no TEXT,
      cost_price REAL,
      reason TEXT, -- 'Damage in transit', 'Return from client', 'Count correction', 'Sample'
      authorized_by_id INTEGER REFERENCES users(id),
      created_by_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- CUSTOMERS
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      location TEXT,
      credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0, -- Amount owed to business
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SUPPLIERS
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      contact_person TEXT,
      location TEXT,
      balance_owed REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- PURCHASE ORDERS
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      status TEXT DEFAULT 'pending', -- 'pending', 'received_full', 'cancelled'
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_by_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- GOODS RECEIVED NOTES (GRN)
    CREATE TABLE IF NOT EXISTS goods_received_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_number TEXT UNIQUE NOT NULL,
      po_id INTEGER REFERENCES purchase_orders(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      supplier_invoice_no TEXT,
      warehouse_name TEXT NOT NULL,
      total_cost REAL NOT NULL,
      items_json TEXT NOT NULL,
      received_by_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SALES (IMMUTABLE RECORD)
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL, -- e.g. REC-202610-0001 (Sequential, no gaps)
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT DEFAULT 'Walk-in Customer',
      customer_phone TEXT,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      warehouse_name TEXT DEFAULT 'Main Showroom',
      subtotal REAL NOT NULL,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_approved_by INTEGER REFERENCES users(id),
      total_amount REAL NOT NULL,
      total_cost REAL NOT NULL, -- Calculated for profit analysis, HIDDEN from cashier
      payment_method TEXT NOT NULL, -- 'CASH', 'MOMO', 'BANK', 'CREDIT', 'SPLIT'
      momo_reference TEXT,
      momo_network TEXT, -- 'MTN', 'TELECEL', 'AT'
      cash_tendered REAL,
      change_given REAL,
      is_offline_sync INTEGER DEFAULT 0,
      offline_client_id TEXT,
      status TEXT DEFAULT 'completed', -- 'completed', 'refunded' (Super Admin only)
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SALE ITEMS
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      total_price REAL NOT NULL,
      sqm_coverage REAL DEFAULT 0
    );

    -- CUSTOMER PAYMENTS (DEBT CLEARANCE)
    CREATE TABLE IF NOT EXISTS customer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL, -- 'CASH', 'MOMO', 'BANK'
      reference_no TEXT,
      receipt_no TEXT,
      received_by_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- EXPENSES
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL, -- 'Rent', 'Electricity (ECG)', 'Water', 'Salaries & Wages', 'Transport & Fuel', 'Offloading & Casual Labor', 'Generator Fuel & Maintenance', 'Office & Packaging', 'Miscellaneous'
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      receipt_image TEXT,
      paid_by_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- DAILY CASH CLOSING / REGISTER
    CREATE TABLE IF NOT EXISTS daily_cash_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      closing_date DATE NOT NULL,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      opening_cash REAL NOT NULL DEFAULT 0,
      cash_sales REAL NOT NULL DEFAULT 0,
      momo_sales REAL NOT NULL DEFAULT 0,
      bank_sales REAL NOT NULL DEFAULT 0,
      credit_sales REAL NOT NULL DEFAULT 0,
      cash_expenses REAL NOT NULL DEFAULT 0,
      expected_cash REAL NOT NULL, -- opening_cash + cash_sales - cash_expenses
      physical_cash REAL NOT NULL, -- Counted by staff
      discrepancy REAL NOT NULL, -- physical_cash - expected_cash (negative = shortage)
      notes TEXT,
      status TEXT DEFAULT 'submitted', -- 'submitted', 'reviewed'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SYSTEM AUDIT LOG (IMMUTABLE LOG OF EVERY ACTION)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL, -- 'LOGIN', 'SALE_CREATED', 'PRICE_CHANGED', 'STOCK_ADJUSTED', 'DISCOUNT_APPROVED', 'EXPENSE_RECORDED', 'CASH_CLOSING', 'DATA_DELETED'
      details TEXT NOT NULL,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- PRICE CHANGE LOGS
    CREATE TABLE IF NOT EXISTS price_change_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      old_cost_price REAL,
      new_cost_price REAL,
      old_selling_price REAL,
      new_selling_price REAL,
      old_wholesale_price REAL,
      new_wholesale_price REAL,
      changed_by_id INTEGER NOT NULL REFERENCES users(id),
      approved_by_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SETTINGS
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return; // already seeded

  console.log('Seeding initial system users, products, suppliers, customers...');

  // 1. SEED USERS
  // Super Admin (Remote Owner): owner@omal.com / owner123 (PIN: 9999)
  // Admin / IT Manager (Ghana): admin@omal.com / admin123 (PIN: 1234)
  // Cashier / Sales Staff: kwame@omal.com / kwame123
  // Cashier / Sales Staff: ama@omal.com / ama123
  // Accountant: accountant@omal.com / acc123

  const salt = bcrypt.genSaltSync(10);
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password, role, admin_pin, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'Alhaji Osei Mensah (Owner)',
    'owner@omal.com',
    bcrypt.hashSync('owner123', salt),
    'super_admin',
    '9999',
    '+44 7911 123456' // Remote (e.g. UK/US)
  );

  insertUser.run(
    'Kofi Boateng (IT / General Manager)',
    'admin@omal.com',
    bcrypt.hashSync('admin123', salt),
    'admin',
    '1234',
    '+233 24 456 7890'
  );

  insertUser.run(
    'Kwame Asante (Senior Cashier)',
    'kwame@omal.com',
    bcrypt.hashSync('kwame123', salt),
    'sales',
    null,
    '+233 20 123 4567'
  );

  insertUser.run(
    'Ama Serwaa (Sales Executive)',
    'ama@omal.com',
    bcrypt.hashSync('ama123', salt),
    'sales',
    null,
    '+233 55 987 6543'
  );

  insertUser.run(
    'Yaw Frimpong (Accountant)',
    'accountant@omal.com',
    bcrypt.hashSync('acc123', salt),
    'accountant',
    null,
    '+233 27 555 4321'
  );

  // 2. SEED DEFAULT SETTINGS
  const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  insertSetting.run('company_name', 'OMAL TILES & HARDWARE DEPOT');
  insertSetting.run('company_tin', 'C0028914567');
  insertSetting.run('company_phone', '+233 30 298 7654 / +233 24 456 7890');
  insertSetting.run('company_address', 'Plot 48 Spintex Road, Opposite Palace Mall, Accra, Ghana');
  insertSetting.run('receipt_footer', 'Thank you for your business! Goods once sold are not returnable after 48 hours. Valid GRA receipt.');
  insertSetting.run('currency_symbol', 'GHS');
  insertSetting.run('max_cashier_discount_pct', '2');
  insertSetting.run('auto_logout_mins', '15');
  insertSetting.run('warehouses', JSON.stringify(['Main Showroom', 'Warehouse B (Depot)']));

  // 3. SEED PRODUCTS ACROSS CATEGORIES
  // Categories: Tiles, Security Doors, Sanitary, Paints, General Hardware
  const sampleProducts = [
    // TILES
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
      sqm_per_box: 1.44, // 4 pcs of 60x60 = 1.44 sqm
      pieces_per_box: 4,
      image_url: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 180,
      stock_warehouse_b: 420
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
      sqm_per_box: 1.44, // 2 pcs of 60x120 = 1.44 sqm
      pieces_per_box: 2,
      image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 95,
      stock_warehouse_b: 250
    },
    {
      name: 'Rustic Exterior Anti-Slip Floor Tile 40x40 Matte',
      category: 'Tiles',
      sku: 'TL-EXT-4040-RST',
      barcode: '600101003',
      brand: 'Keda Ceramics',
      size_color: '40x40 cm / Terracotta Slate',
      unit: 'box',
      cost_price: 85.00,
      selling_price: 125.00,
      wholesale_price: 115.00,
      min_stock_alert: 40,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 1.60, // 10 pcs = 1.60 sqm
      pieces_per_box: 10,
      image_url: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 60,
      stock_warehouse_b: 150
    },
    {
      name: 'Subway Beveled Gloss Ceramic Wall Tile 10x30 White',
      category: 'Tiles',
      sku: 'TL-WL-1030-SUB',
      barcode: '600101004',
      brand: 'Cersanit',
      size_color: '10x30 cm / Pure White',
      unit: 'box',
      cost_price: 90.00,
      selling_price: 140.00,
      wholesale_price: 130.00,
      min_stock_alert: 25,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 1.00,
      pieces_per_box: 33,
      image_url: 'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 40,
      stock_warehouse_b: 110
    },

    // SECURITY DOORS
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
      image_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 8,
      stock_warehouse_b: 14
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
      image_url: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 12,
      stock_warehouse_b: 28
    },
    {
      name: 'High-Security Steel Bedroom Door with Multi-Lock System',
      category: 'Security Doors',
      sku: 'DR-STL-3FT-BDR',
      barcode: '600201003',
      brand: 'Wintech',
      size_color: '3ft (90x205 cm) / Cherry Wood Finish',
      unit: 'pcs',
      cost_price: 950.00,
      selling_price: 1450.00,
      wholesale_price: 1350.00,
      min_stock_alert: 10,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1588854337221-4cf9fa96059c?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 18,
      stock_warehouse_b: 40
    },

    // SANITARY WARE
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
      image_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 15,
      stock_warehouse_b: 35
    },
    {
      name: 'Modern Bathroom Vanity Cabinet 80cm with Ceramic Basin & Mirror',
      category: 'Sanitary',
      sku: 'SAN-VAN-80CM-GRY',
      barcode: '600301002',
      brand: 'Aquatec',
      size_color: '80x48 cm / Charcoal Grey Water-Resistant Plywood',
      unit: 'pcs',
      cost_price: 1600.00,
      selling_price: 2450.00,
      wholesale_price: 2300.00,
      min_stock_alert: 6,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 7,
      stock_warehouse_b: 12
    },
    {
      name: 'Thermostatic Rain Shower Column Set Brass Chrome',
      category: 'Sanitary',
      sku: 'SAN-SHW-RAIN-CHR',
      barcode: '600301003',
      brand: 'Grohe Style Germany',
      size_color: 'Adjustable Height / Polished Chrome & Square Head',
      unit: 'pcs',
      cost_price: 650.00,
      selling_price: 1050.00,
      wholesale_price: 950.00,
      min_stock_alert: 10,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 14,
      stock_warehouse_b: 30
    },

    // PAINTS
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
      image_url: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 25,
      stock_warehouse_b: 80
    },
    {
      name: 'Dulux Washable Silk Interior Emulsion (20 Litres)',
      category: 'Paints',
      sku: 'PNT-DLX-INT-20L-MAG',
      barcode: '600401002',
      brand: 'Dulux UK / Ghana',
      size_color: '20L Bucket / Soft Magnolia Washable',
      unit: 'bucket 20L',
      cost_price: 680.00,
      selling_price: 920.00,
      wholesale_price: 870.00,
      min_stock_alert: 15,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 18,
      stock_warehouse_b: 45
    },
    {
      name: 'Gloss Oil Paint High-Build for Metal & Wood (4 Litres)',
      category: 'Paints',
      sku: 'PNT-GLS-OIL-4L-BLK',
      barcode: '600401003',
      brand: 'Shield Paints',
      size_color: '4L Gallon / High Gloss Jet Black',
      unit: 'gallon',
      cost_price: 130.00,
      selling_price: 195.00,
      wholesale_price: 180.00,
      min_stock_alert: 20,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 30,
      stock_warehouse_b: 65
    },

    // GENERAL HARDWARE
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
      image_url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 120,
      stock_warehouse_b: 650
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
      image_url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 40,
      stock_warehouse_b: 480
    },
    {
      name: 'Tile Cement Adhesive Polymer Modified (25kg Bag)',
      category: 'General Hardware',
      sku: 'HDW-ADH-25KG-PLY',
      barcode: '600501003',
      brand: 'SikaCeram / Keda Bond',
      size_color: '25kg Heavy Duty Gray Bag',
      unit: 'bag',
      cost_price: 52.00,
      selling_price: 75.00,
      wholesale_price: 70.00,
      min_stock_alert: 60,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 85,
      stock_warehouse_b: 300
    },
    {
      name: 'PVC Drainage Soil Pipe 4-inch x 5.8m (Class C)',
      category: 'General Hardware',
      sku: 'HDW-PVC-4IN-58M',
      barcode: '600501004',
      brand: 'Interplast Ghana',
      size_color: '4 inch (110mm) x 5.8m / Golden Orange',
      unit: 'pcs',
      cost_price: 95.00,
      selling_price: 135.00,
      wholesale_price: 125.00,
      min_stock_alert: 30,
      warehouse_location: 'Main Showroom',
      sqm_per_box: 0,
      pieces_per_box: 1,
      image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&auto=format&fit=crop&q=60',
      stock_showroom: 22,
      stock_warehouse_b: 75
    }
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (
      name, category, sku, barcode, brand, size_color, unit,
      cost_price, selling_price, wholesale_price, min_stock_alert,
      warehouse_location, image_url, sqm_per_box, pieces_per_box
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertWarehouseStock = db.prepare(`
    INSERT INTO warehouse_stock (product_id, warehouse_name, quantity)
    VALUES (?, ?, ?)
  `);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      product_id, movement_type, quantity, from_location, to_location,
      reference_no, cost_price, reason, authorized_by_id, created_by_id
    ) VALUES (?, 'IN', ?, 'Supplier Direct', ?, 'INITIAL-OPENING-STOCK', ?, 'Opening balance', 1, 1)
  `);

  for (const p of sampleProducts) {
    const info = insertProduct.run(
      p.name, p.category, p.sku, p.barcode, p.brand, p.size_color, p.unit,
      p.cost_price, p.selling_price, p.wholesale_price, p.min_stock_alert,
      p.warehouse_location, p.image_url, p.sqm_per_box, p.pieces_per_box
    );
    const prodId = info.lastInsertRowid;

    // Insert into Main Showroom & Warehouse B
    insertWarehouseStock.run(prodId, 'Main Showroom', p.stock_showroom);
    insertWarehouseStock.run(prodId, 'Warehouse B (Depot)', p.stock_warehouse_b);

    // Initial stock movement record
    insertMovement.run(prodId, p.stock_showroom, 'Main Showroom', p.cost_price);
    insertMovement.run(prodId, p.stock_warehouse_b, 'Warehouse B (Depot)', p.cost_price);
  }

  // 4. SEED CUSTOMERS
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, location, credit_limit, current_balance)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertCustomer.run('Chief Contractor Emmanuel Darko', '+233 24 999 1122', 'East Legon Hills, Accra', 25000.00, 4800.00);
  insertCustomer.run('Arch-Design Construction Ltd', '+233 20 888 3344', 'Airport Residential Area', 50000.00, 12400.00);
  insertCustomer.run('Madam Faustina Osei', '+233 55 777 5566', 'Kwashieman, Accra', 10000.00, 1250.00);
  insertCustomer.run('Dr. Prince Kwakye (Personal Villa)', '+233 24 333 4455', 'Cantonments, Accra', 30000.00, 0.00);
  insertCustomer.run('Kasoa Estate Builders Co.', '+233 26 444 6677', 'Kasoa Millennium City', 40000.00, 18200.00);

  // 5. SEED SUPPLIERS
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (name, phone, contact_person, location, balance_owed)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertSupplier.run('Global Ceramics & Tiles Import Ltd', '+233 30 222 1100', 'Mr. Marco Rossi', 'Tema Harbour Heavy Industrial Area', 42000.00);
  insertSupplier.run('Anatolia Steel & Security Doors TR', '+90 212 555 1234', 'Mehmet Yilmaz', 'Istanbul, Turkey / Tema Freezones', 68000.00);
  insertSupplier.run('Coral Paints West Africa Ltd', '+233 30 281 0500', 'Sales Office', 'Plot 18 Graphic Road, Accra', 15600.00);
  insertSupplier.run('B5 Plus Steel & Hardware Manufacturing', '+233 30 330 3450', 'Sales Desk', 'Tema Industrial Area, Kpone', 85000.00);
  insertSupplier.run('Interplast Ghana Plumbing Systems', '+233 30 222 8423', 'Customer Service', 'Spintex Road, Accra', 9400.00);

  // 6. SEED SAMPLE RECENT SALES & AUDIT LOGS FOR DEMO & OWNER DASHBOARD
  const insertSale = db.prepare(`
    INSERT INTO sales (
      receipt_no, customer_id, customer_name, customer_phone, staff_id,
      warehouse_name, subtotal, discount_percent, discount_amount, discount_approved_by,
      total_amount, total_cost, payment_method, momo_reference, momo_network,
      cash_tendered, change_given, is_offline_sync, status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, 'Main Showroom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
  `);

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (
      sale_id, product_id, product_name, sku, quantity, unit, cost_price, selling_price, total_price, sqm_coverage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Today's demo sale 1 (Kwame - MoMo MTN)
  const today = new Date().toISOString();
  const s1 = insertSale.run(
    'REC-202610-0001',
    1,
    'Chief Contractor Emmanuel Darko',
    '+233 24 999 1122',
    3, // Kwame
    2950.00,
    0,
    0,
    null,
    2950.00,
    2025.00,
    'MOMO',
    'MTN-MOM-982341908',
    'MTN',
    2950.00,
    0,
    0,
    'Supplied to East Legon site',
    today
  );
  insertSaleItem.run(s1.lastInsertRowid, 1, 'Spanish Porcelain Floor Tile 60x60 White Polished', 'TL-SP-6060-WHT', 10, 'box', 135.00, 195.00, 1950.00, 14.4);
  insertSaleItem.run(s1.lastInsertRowid, 10, 'Tile Cement Adhesive Polymer Modified (25kg Bag)', 'HDW-ADH-25KG-PLY', 10, 'bag', 52.00, 75.00, 750.00, 0);
  insertSaleItem.run(s1.lastInsertRowid, 9, 'Gloss Oil Paint High-Build for Metal & Wood (4 Litres)', 'PNT-GLS-OIL-4L-BLK', 1, 'gallon', 130.00, 195.00, 195.00, 0);

  // Today's demo sale 2 (Ama - Cash)
  const s2 = insertSale.run(
    'REC-202610-0002',
    null,
    'Walk-in Customer (Kofi)',
    '+233 24 111 2233',
    4, // Ama
    4500.00,
    0,
    0,
    null,
    4500.00,
    3200.00,
    'CASH',
    null,
    null,
    5000.00,
    500.00,
    0,
    'Turkish door for master entrance',
    today
  );
  insertSaleItem.run(s2.lastInsertRowid, 5, 'Turkish Armoured Luxury Main Security Door (4ft Double Leaf)', 'DR-TRK-4FT-ARM', 1, 'pcs', 3200.00, 4500.00, 4500.00, 0);

  // 7. SEED SAMPLE EXPENSES (TODAY)
  const insertExpense = db.prepare(`
    INSERT INTO expenses (category, amount, description, receipt_image, paid_by_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertExpense.run('Offloading & Casual Labor', 250.00, 'Offloading 600 bags cement from Tema truck into Depot', null, 2, today);
  insertExpense.run('Electricity (ECG)', 480.00, 'ECG Prepaid power purchase meter #042918821', null, 2, today);
  insertExpense.run('Generator Fuel & Maintenance', 300.00, 'Diesel 20L for standby generator during dumsor outage', null, 3, today);

  // 8. SEED INITIAL AUDIT LOGS
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(1, 'Alhaji Osei Mensah', 'super_admin', 'SYSTEM_INITIALIZATION', 'OMAL Business POS & Stock ERP database initialized with Ghana hardware catalog', '102.176.65.12', today);
  insertAudit.run(2, 'Kofi Boateng', 'admin', 'STOCK_INWARD', 'Initial stock verified in Main Showroom and Warehouse B', '102.176.65.15', today);
  insertAudit.run(3, 'Kwame Asante', 'sales', 'LOGIN', 'Cashier logged in at Counter 1', '192.168.1.101', today);
  insertAudit.run(3, 'Kwame Asante', 'sales', 'SALE_CREATED', 'Completed sale REC-202610-0001 (GHS 2,950.00 via MTN MoMo)', '192.168.1.101', today);
  insertAudit.run(4, 'Ama Serwaa', 'sales', 'SALE_CREATED', 'Completed sale REC-202610-0002 (GHS 4,500.00 via CASH)', '192.168.1.102', today);

  console.log('Database initialization and seeding completed successfully!');
}

initDatabase();

module.exports = db;

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole, sanitizeProductForRole, logAudit } = require('../middleware/auth');

// GET PRODUCTS
router.get('/', authenticateToken, (req, res) => {
  const { category, search, low_stock, warehouse } = req.query;

  let query = `
    SELECT 
      p.*,
      COALESCE(SUM(ws.quantity), 0) as total_stock,
      COALESCE(GROUP_CONCAT(ws.warehouse_name || ':' || ws.quantity), '') as warehouse_breakdown
    FROM products p
    LEFT JOIN warehouse_stock ws ON p.id = ws.product_id
  `;

  let conditions = [];
  let params = [];

  if (category && category !== 'All') {
    conditions.push('p.category = ?');
    params.push(category);
  }

  if (search && search.trim()) {
    conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY p.id';

  if (low_stock === 'true') {
    query += ' HAVING total_stock <= p.min_stock_alert';
  }

  query += ' ORDER BY p.name ASC';

  const rows = db.prepare(query).all(...params);

  // Parse breakdown and sanitize cost_price for Sales Staff
  const sanitized = rows.map(item => {
    let breakdownObj = {};
    if (item.warehouse_breakdown) {
      item.warehouse_breakdown.split(',').forEach(part => {
        const [wName, qty] = part.split(':');
        if (wName) breakdownObj[wName] = parseFloat(qty) || 0;
      });
    }
    item.warehouses = breakdownObj;

    return sanitizeProductForRole(item, req.user.role);
  });

  res.json(sanitized);
});

// GET SINGLE PRODUCT
router.get('/:id', authenticateToken, (req, res) => {
  const product = db.prepare(`
    SELECT p.*, COALESCE(SUM(ws.quantity), 0) as total_stock
    FROM products p
    LEFT JOIN warehouse_stock ws ON p.id = ws.product_id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  const stocks = db.prepare('SELECT warehouse_name, quantity FROM warehouse_stock WHERE product_id = ?').all(req.params.id);
  product.warehouses = {};
  stocks.forEach(s => { product.warehouses[s.warehouse_name] = s.quantity; });

  res.json(sanitizeProductForRole(product, req.user.role));
});

// CREATE PRODUCT (Admin & Super Admin)
router.post('/', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const {
    name, category, sku, barcode, brand, size_color, unit,
    cost_price, selling_price, wholesale_price, min_stock_alert,
    warehouse_location, image_url, sqm_per_box, pieces_per_box,
    initial_stock_showroom, initial_stock_depot
  } = req.body;

  if (!name || !category || !sku || selling_price === undefined || cost_price === undefined) {
    return res.status(400).json({ error: 'Product name, category, SKU, cost price, and selling price are required' });
  }

  const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku.trim());
  if (existing) {
    return res.status(400).json({ error: `Product with SKU "${sku}" already exists` });
  }

  const insertStmt = db.prepare(`
    INSERT INTO products (
      name, category, sku, barcode, brand, size_color, unit,
      cost_price, selling_price, wholesale_price, min_stock_alert,
      warehouse_location, image_url, sqm_per_box, pieces_per_box
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = insertStmt.run(
    name, category, sku.trim(), barcode || sku.trim(), brand || 'OMAL', size_color || '', unit || 'pcs',
    parseFloat(cost_price) || 0, parseFloat(selling_price) || 0,
    wholesale_price ? parseFloat(wholesale_price) : null,
    parseInt(min_stock_alert) || 10,
    warehouse_location || 'Main Showroom',
    image_url || null,
    parseFloat(sqm_per_box) || 0,
    parseInt(pieces_per_box) || 0
  );

  const prodId = info.lastInsertRowid;

  // Insert initial stocks
  const showroomQty = parseFloat(initial_stock_showroom) || 0;
  const depotQty = parseFloat(initial_stock_depot) || 0;

  const insertStock = db.prepare('INSERT INTO warehouse_stock (product_id, warehouse_name, quantity) VALUES (?, ?, ?)');
  insertStock.run(prodId, 'Main Showroom', showroomQty);
  insertStock.run(prodId, 'Warehouse B (Depot)', depotQty);

  if (showroomQty > 0 || depotQty > 0) {
    const insertMove = db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, to_location, reference_no, cost_price, reason, created_by_id
      ) VALUES (?, 'IN', ?, ?, 'INITIAL-STOCK', ?, 'Initial stock on product creation', ?)
    `);
    if (showroomQty > 0) insertMove.run(prodId, showroomQty, 'Main Showroom', cost_price, req.user.id);
    if (depotQty > 0) insertMove.run(prodId, depotQty, 'Warehouse B (Depot)', cost_price, req.user.id);
  }

  logAudit(req.user.id, req.user.name, req.user.role, 'PRODUCT_CREATED', `Created product: ${name} (SKU: ${sku})`);

  res.json({ success: true, id: prodId, message: 'Product created successfully' });
});

// UPDATE PRODUCT (Admin & Super Admin)
router.put('/:id', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const prodId = req.params.id;
  const oldProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);

  if (!oldProduct) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const {
    name, category, sku, barcode, brand, size_color, unit,
    cost_price, selling_price, wholesale_price, min_stock_alert,
    warehouse_location, image_url, sqm_per_box, pieces_per_box
  } = req.body;

  // Track price changes in price_change_logs
  const newCost = cost_price !== undefined ? parseFloat(cost_price) : oldProduct.cost_price;
  const newSell = selling_price !== undefined ? parseFloat(selling_price) : oldProduct.selling_price;
  const newWholesale = wholesale_price !== undefined ? parseFloat(wholesale_price) : oldProduct.wholesale_price;

  if (newCost !== oldProduct.cost_price || newSell !== oldProduct.selling_price || newWholesale !== oldProduct.wholesale_price) {
    db.prepare(`
      INSERT INTO price_change_logs (
        product_id, product_name, old_cost_price, new_cost_price,
        old_selling_price, new_selling_price, old_wholesale_price, new_wholesale_price,
        changed_by_id, approved_by_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      prodId,
      oldProduct.name,
      oldProduct.cost_price,
      newCost,
      oldProduct.selling_price,
      newSell,
      oldProduct.wholesale_price,
      newWholesale,
      req.user.id,
      req.user.role === 'super_admin' ? req.user.id : null
    );

    logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PRICE_CHANGED',
      `Price changed for ${oldProduct.name}: Sell: GHS ${oldProduct.selling_price} -> GHS ${newSell}, Cost: GHS ${oldProduct.cost_price} -> GHS ${newCost}`
    );
  }

  db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      sku = COALESCE(?, sku),
      barcode = COALESCE(?, barcode),
      brand = COALESCE(?, brand),
      size_color = COALESCE(?, size_color),
      unit = COALESCE(?, unit),
      cost_price = COALESCE(?, cost_price),
      selling_price = COALESCE(?, selling_price),
      wholesale_price = COALESCE(?, wholesale_price),
      min_stock_alert = COALESCE(?, min_stock_alert),
      warehouse_location = COALESCE(?, warehouse_location),
      image_url = COALESCE(?, image_url),
      sqm_per_box = COALESCE(?, sqm_per_box),
      pieces_per_box = COALESCE(?, pieces_per_box),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name, category, sku, barcode, brand, size_color, unit,
    newCost, newSell, newWholesale, min_stock_alert,
    warehouse_location, image_url, sqm_per_box, pieces_per_box,
    prodId
  );

  res.json({ success: true, message: 'Product updated successfully' });
});

// DELETE PRODUCT (Super Admin ONLY!)
router.delete('/:id', authenticateToken, requireRole('super_admin'), (req, res) => {
  const prodId = req.params.id;
  const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(prodId);

  if (!prod) return res.status(404).json({ error: 'Product not found' });

  // Delete product (cascades to warehouse_stock, stock_movements, sale_items FKs)
  db.prepare('DELETE FROM products WHERE id = ?').run(prodId);

  logAudit(req.user.id, req.user.name, req.user.role, 'PRODUCT_DELETED', `Permanently deleted product: ${prod.name} (SKU: ${prod.sku})`);

  res.json({ success: true, message: 'Product deleted permanently by Super Admin' });
});

// BULK IMPORT PRODUCTS (Admin & Super Admin)
router.post('/bulk-import', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const { products } = req.body;

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'Array of products is required for import' });
  }

  let imported = 0;
  let skipped = 0;

  const insertProduct = db.prepare(`
    INSERT INTO products (
      name, category, sku, barcode, brand, size_color, unit,
      cost_price, selling_price, wholesale_price, min_stock_alert,
      warehouse_location, image_url, sqm_per_box, pieces_per_box
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStock = db.prepare('INSERT INTO warehouse_stock (product_id, warehouse_name, quantity) VALUES (?, ?, ?)');

  const importTransaction = db.transaction((items) => {
    for (const p of items) {
      if (!p.name || !p.sku) {
        skipped++;
        continue;
      }

      const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(p.sku.trim());
      if (existing) {
        skipped++;
        continue;
      }

      const info = insertProduct.run(
        p.name,
        p.category || 'General Hardware',
        p.sku.trim(),
        p.barcode || p.sku.trim(),
        p.brand || 'OMAL',
        p.size_color || '',
        p.unit || 'pcs',
        parseFloat(p.cost_price) || 0,
        parseFloat(p.selling_price) || 0,
        p.wholesale_price ? parseFloat(p.wholesale_price) : null,
        parseInt(p.min_stock_alert) || 10,
        p.warehouse_location || 'Main Showroom',
        p.image_url || null,
        parseFloat(p.sqm_per_box) || 0,
        parseInt(p.pieces_per_box) || 0
      );

      const prodId = info.lastInsertRowid;
      insertStock.run(prodId, 'Main Showroom', parseFloat(p.stock) || 0);
      insertStock.run(prodId, 'Warehouse B (Depot)', 0);
      imported++;
    }
  });

  try {
    importTransaction(products);
    logAudit(req.user.id, req.user.name, req.user.role, 'BULK_IMPORT', `Bulk imported ${imported} products (${skipped} skipped)`);
    res.json({ success: true, imported, skipped, message: `Successfully imported ${imported} products (${skipped} skipped)` });
  } catch (err) {
    res.status(500).json({ error: 'Bulk import failed: ' + err.message });
  }
});

// GET CATEGORIES WITH COUNTS
router.get('/meta/categories', authenticateToken, (req, res) => {
  const cats = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM products 
    GROUP BY category
    ORDER BY count DESC
  `).all();
  res.json(cats);
});

module.exports = router;

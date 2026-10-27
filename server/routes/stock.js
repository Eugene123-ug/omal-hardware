const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole, verifyAdminPin, logAudit } = require('../middleware/auth');

// GET STOCK MOVEMENTS / AUDIT HISTORY
router.get('/history', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const { product_id, limit = 100 } = req.query;

  let query = `
    SELECT sm.*, p.name as product_name, p.sku, u.name as created_by_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN users u ON sm.created_by_id = u.id
  `;

  let params = [];
  if (product_id) {
    query += ' WHERE sm.product_id = ?';
    params.push(product_id);
  }

  query += ' ORDER BY sm.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const history = db.prepare(query).all(...params);
  res.json(history);
});

// STOCK IN (PURCHASE / INWARD STOCK)
router.post('/inward', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const { product_id, quantity, warehouse_name, supplier_name, invoice_no, cost_price, notes } = req.body;

  const qty = parseFloat(quantity);
  if (!product_id || !qty || qty <= 0 || !warehouse_name) {
    return res.status(400).json({ error: 'Product ID, valid positive quantity, and warehouse are required' });
  }

  const product = db.prepare('SELECT name, cost_price FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const unitCost = cost_price !== undefined ? parseFloat(cost_price) : product.cost_price;

  const txn = db.transaction(() => {
    // Upsert warehouse stock
    const existingStock = db.prepare('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_name = ?').get(product_id, warehouse_name);

    if (existingStock) {
      db.prepare('UPDATE warehouse_stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_name = ?')
        .run(qty, product_id, warehouse_name);
    } else {
      db.prepare('INSERT INTO warehouse_stock (product_id, warehouse_name, quantity) VALUES (?, ?, ?)')
        .run(product_id, warehouse_name, qty);
    }

    // Update product cost_price if new cost provided
    if (cost_price !== undefined && cost_price > 0) {
      db.prepare('UPDATE products SET cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(unitCost, product_id);
    }

    // Log stock movement
    db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, to_location, reference_no, cost_price, reason, created_by_id
      ) VALUES (?, 'IN', ?, ?, ?, ?, ?, ?)
    `).run(
      product_id,
      qty,
      warehouse_name,
      invoice_no || `INWARD-${Date.now()}`,
      unitCost,
      `Supplier Inward: ${supplier_name || 'Direct'} (${notes || 'Received into stock'})`,
      req.user.id
    );
  });

  txn();

  logAudit(
    req.user.id,
    req.user.name,
    req.user.role,
    'STOCK_INWARD',
    `Added ${qty} units of "${product.name}" to ${warehouse_name}. Supplier: ${supplier_name || 'N/A'}`
  );

  res.json({ success: true, message: `Successfully added ${qty} units to ${warehouse_name}` });
});

// STOCK ADJUSTMENT (Damage, Breakage, Return, Count Correction) - REQUIRES ADMIN PIN
router.post('/adjust', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const { product_id, warehouse_name, adjustment_type, quantity, reason, admin_pin } = req.body;

  // Verify PIN
  const pinCheck = verifyAdminPin(admin_pin);
  if (!pinCheck.valid) {
    return res.status(403).json({ error: 'Admin PIN verification failed: ' + pinCheck.message });
  }

  const qty = parseFloat(quantity);
  if (!product_id || isNaN(qty) || qty === 0 || !warehouse_name || !reason) {
    return res.status(400).json({ error: 'Product ID, valid quantity, warehouse, and detailed reason are required' });
  }

  const product = db.prepare('SELECT name, cost_price FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const stockRow = db.prepare('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_name = ?').get(product_id, warehouse_name);
  const currentQty = stockRow ? stockRow.quantity : 0;

  let newQty = currentQty;
  let movementQty = 0;

  if (adjustment_type === 'SET_EXACT') {
    movementQty = qty - currentQty;
    newQty = qty;
  } else if (adjustment_type === 'DECREASE') {
    movementQty = -Math.abs(qty);
    newQty = currentQty - Math.abs(qty);
  } else if (adjustment_type === 'INCREASE') {
    movementQty = Math.abs(qty);
    newQty = currentQty + Math.abs(qty);
  } else {
    return res.status(400).json({ error: 'Invalid adjustment_type. Must be SET_EXACT, DECREASE, or INCREASE' });
  }

  if (newQty < 0) {
    return res.status(400).json({ error: `Cannot adjust stock below 0. Current stock is ${currentQty}` });
  }

  const txn = db.transaction(() => {
    if (stockRow) {
      db.prepare('UPDATE warehouse_stock SET quantity = ? WHERE product_id = ? AND warehouse_name = ?')
        .run(newQty, product_id, warehouse_name);
    } else {
      db.prepare('INSERT INTO warehouse_stock (product_id, warehouse_name, quantity) VALUES (?, ?, ?)')
        .run(product_id, warehouse_name, newQty);
    }

    db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, from_location, to_location,
        reference_no, cost_price, reason, authorized_by_id, created_by_id
      ) VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_id,
      movementQty,
      warehouse_name,
      warehouse_name,
      `ADJ-${Date.now()}`,
      product.cost_price,
      `Adjustment (${adjustment_type}): ${reason}. Previous: ${currentQty}, New: ${newQty}`,
      pinCheck.user.id,
      req.user.id
    );
  });

  txn();

  logAudit(
    req.user.id,
    req.user.name,
    req.user.role,
    'STOCK_ADJUSTED',
    `Adjusted stock for "${product.name}" in ${warehouse_name} from ${currentQty} to ${newQty}. Reason: ${reason}. Authorized by: ${pinCheck.user.name}`
  );

  res.json({ success: true, message: `Stock adjusted to ${newQty} units`, currentQty: newQty });
});

// STOCK TRANSFER (Warehouse A -> Warehouse B)
router.post('/transfer', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const { product_id, from_warehouse, to_warehouse, quantity, notes } = req.body;

  const qty = parseFloat(quantity);
  if (!product_id || !from_warehouse || !to_warehouse || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Product ID, source and destination warehouses, and valid quantity are required' });
  }

  if (from_warehouse === to_warehouse) {
    return res.status(400).json({ error: 'Source and destination warehouses cannot be the same' });
  }

  const product = db.prepare('SELECT name, cost_price FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const sourceStock = db.prepare('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_name = ?').get(product_id, from_warehouse);
  const currentSourceQty = sourceStock ? sourceStock.quantity : 0;

  if (currentSourceQty < qty) {
    return res.status(400).json({
      error: `Insufficient stock in ${from_warehouse}. Available: ${currentSourceQty}, Requested: ${qty}`
    });
  }

  const txn = db.transaction(() => {
    // Deduct from source
    db.prepare('UPDATE warehouse_stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_name = ?')
      .run(qty, product_id, from_warehouse);

    // Add to destination
    const destStock = db.prepare('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_name = ?').get(product_id, to_warehouse);
    if (destStock) {
      db.prepare('UPDATE warehouse_stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_name = ?')
        .run(qty, product_id, to_warehouse);
    } else {
      db.prepare('INSERT INTO warehouse_stock (product_id, warehouse_name, quantity) VALUES (?, ?, ?)')
        .run(product_id, to_warehouse, qty);
    }

    // Movement log
    db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, from_location, to_location,
        reference_no, cost_price, reason, created_by_id
      ) VALUES (?, 'TRANSFER', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_id,
      qty,
      from_warehouse,
      to_warehouse,
      `TRF-${Date.now()}`,
      product.cost_price,
      `Inter-warehouse transfer: ${notes || 'Stock redistribution'}`,
      req.user.id
    );
  });

  txn();

  logAudit(
    req.user.id,
    req.user.name,
    req.user.role,
    'STOCK_TRANSFER',
    `Transferred ${qty} units of "${product.name}" from ${from_warehouse} to ${to_warehouse}`
  );

  res.json({ success: true, message: `Successfully transferred ${qty} units to ${to_warehouse}` });
});

// STOCK VALUATION (Cost Value vs Selling Value) - Super Admin & Admin Only
router.get('/valuation', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';

  const rows = db.prepare(`
    SELECT 
      p.category,
      COUNT(DISTINCT p.id) as total_products,
      SUM(ws.quantity) as total_items_count,
      SUM(ws.quantity * p.cost_price) as total_cost_value,
      SUM(ws.quantity * p.selling_price) as total_selling_value
    FROM products p
    JOIN warehouse_stock ws ON p.id = ws.product_id
    GROUP BY p.category
  `).all();

  const totalCost = rows.reduce((acc, r) => acc + (r.total_cost_value || 0), 0);
  const totalSelling = rows.reduce((acc, r) => acc + (r.total_selling_value || 0), 0);
  const projectedGrossProfit = totalSelling - totalCost;

  res.json({
    categories: rows.map(r => ({
      category: r.category,
      products_count: r.total_products,
      units_count: r.total_items_count,
      cost_value: isSuperAdmin ? r.total_cost_value : undefined, // hidden if not super admin
      selling_value: r.total_selling_value,
      projected_margin: isSuperAdmin ? ((r.total_selling_value - r.total_cost_value) / r.total_selling_value * 100).toFixed(1) + '%' : undefined
    })),
    total_cost_valuation: isSuperAdmin ? totalCost : undefined,
    total_selling_valuation: totalSelling,
    projected_gross_profit: isSuperAdmin ? projectedGrossProfit : undefined,
    projected_profit_margin_pct: isSuperAdmin && totalSelling > 0 ? ((projectedGrossProfit / totalSelling) * 100).toFixed(1) : undefined
  });
});

// DEAD STOCK (Products with zero sales in the last 60 days)
router.get('/dead-stock', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const deadItems = db.prepare(`
    SELECT 
      p.id, p.name, p.category, p.sku, p.cost_price, p.selling_price, p.image_url,
      COALESCE(SUM(ws.quantity), 0) as current_stock,
      (COALESCE(SUM(ws.quantity), 0) * p.cost_price) as tied_up_cost
    FROM products p
    LEFT JOIN warehouse_stock ws ON p.id = ws.product_id
    WHERE p.id NOT IN (
      SELECT DISTINCT si.product_id 
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= ?
    )
    GROUP BY p.id
    HAVING current_stock > 0
    ORDER BY tied_up_cost DESC
  `).all(sixtyDaysAgo);

  const sanitized = deadItems.map(item => {
    if (req.user.role === 'sales') {
      delete item.cost_price;
      delete item.tied_up_cost;
    }
    return item;
  });

  res.json(sanitized);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole, logAudit } = require('../middleware/auth');

// LIST SUPPLIERS
router.get('/', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
  res.json(suppliers);
});

// CREATE SUPPLIER
router.post('/', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const { name, phone, contact_person, location, balance_owed } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Supplier name and phone are required' });
  }

  const info = db.prepare(`
    INSERT INTO suppliers (name, phone, contact_person, location, balance_owed)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), phone.trim(), contact_person || '', location || '', parseFloat(balance_owed) || 0);

  logAudit(req.user.id, req.user.name, req.user.role, 'SUPPLIER_CREATED', `Added supplier: ${name}`);

  res.json({ success: true, id: info.lastInsertRowid, message: 'Supplier added successfully' });
});

// LIST PURCHASE ORDERS
router.get('/purchase-orders', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const pos = db.prepare(`
    SELECT po.*, s.name as supplier_name, u.name as created_by_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON po.created_by_id = u.id
    ORDER BY po.id DESC
  `).all();
  res.json(pos);
});

// CREATE PURCHASE ORDER
router.post('/purchase-orders', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const { supplier_id, total_amount, notes, items } = req.body;

  const poNumber = `PO-${Date.now()}`;

  const info = db.prepare(`
    INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, notes, created_by_id)
    VALUES (?, ?, 'pending', ?, ?, ?)
  `).run(poNumber, supplier_id, parseFloat(total_amount) || 0, notes || (items ? JSON.stringify(items) : ''), req.user.id);

  logAudit(req.user.id, req.user.name, req.user.role, 'PO_CREATED', `Created Purchase Order ${poNumber} for GHS ${total_amount}`);

  res.json({ success: true, id: info.lastInsertRowid, po_number: poNumber, message: 'Purchase Order created' });
});

// CREATE GOODS RECEIVED NOTE (GRN - RECEIVE GOODS INTO STOCK)
router.post('/grn', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const { po_id, supplier_id, supplier_invoice_no, warehouse_name = 'Main Showroom', items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items list is required for GRN' });
  }

  const grnNumber = `GRN-${Date.now()}`;
  let totalCost = 0;

  const grnTxn = db.transaction(() => {
    // 1. Process items and increase warehouse stock
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.cost_price) || 0;
      totalCost += qty * cost;

      if (qty > 0 && item.product_id) {
        // Update warehouse stock
        const stockRow = db.prepare('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_name = ?')
          .get(item.product_id, warehouse_name);

        if (stockRow) {
          db.prepare('UPDATE warehouse_stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_name = ?')
            .run(qty, item.product_id, warehouse_name);
        } else {
          db.prepare('INSERT INTO warehouse_stock (product_id, warehouse_name, quantity) VALUES (?, ?, ?)')
            .run(item.product_id, warehouse_name, qty);
        }

        // Update product cost if provided
        if (cost > 0) {
          db.prepare('UPDATE products SET cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(cost, item.product_id);
        }

        // Stock movement
        db.prepare(`
          INSERT INTO stock_movements (
            product_id, movement_type, quantity, to_location, reference_no, cost_price, reason, created_by_id
          ) VALUES (?, 'IN', ?, ?, ?, ?, 'GRN Receipt', ?)
        `).run(item.product_id, qty, warehouse_name, grnNumber, cost, req.user.id);
      }
    }

    // 2. Insert GRN record
    db.prepare(`
      INSERT INTO goods_received_notes (
        grn_number, po_id, supplier_id, supplier_invoice_no, warehouse_name, total_cost, items_json, received_by_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      grnNumber,
      po_id || null,
      supplier_id || null,
      supplier_invoice_no || '',
      warehouse_name,
      totalCost,
      JSON.stringify(items),
      req.user.id
    );

    // 3. Update PO status if attached
    if (po_id) {
      db.prepare("UPDATE purchase_orders SET status = 'received_full' WHERE id = ?").run(po_id);
    }

    // 4. Update supplier payable balance if supplier provided
    if (supplier_id) {
      db.prepare('UPDATE suppliers SET balance_owed = balance_owed + ? WHERE id = ?').run(totalCost, supplier_id);
    }
  });

  grnTxn();

  logAudit(
    req.user.id,
    req.user.name,
    req.user.role,
    'GRN_CREATED',
    `Created Goods Received Note ${grnNumber} for GHS ${totalCost.toFixed(2)} in ${warehouse_name}`
  );

  res.json({
    success: true,
    grn_number: grnNumber,
    total_cost: totalCost,
    message: `GRN created and stock updated in ${warehouse_name}`
  });
});

// LIST GRNs
router.get('/grn', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const grns = db.prepare(`
    SELECT g.*, s.name as supplier_name, u.name as received_by_name
    FROM goods_received_notes g
    LEFT JOIN suppliers s ON g.supplier_id = s.id
    LEFT JOIN users u ON g.received_by_id = u.id
    ORDER BY g.id DESC
  `).all();
  res.json(grns);
});

module.exports = router;

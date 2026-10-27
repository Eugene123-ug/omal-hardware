const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole, verifyAdminPin, logAudit } = require('../middleware/auth');

// Helper to generate the next sequential receipt number (no gaps)
function getNextReceiptNumber() {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // e.g. 20261024
  const prefix = `REC-${todayStr}-`;

  const lastSale = db.prepare(`
    SELECT receipt_no FROM sales 
    WHERE receipt_no LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`);

  let nextSeq = 1;
  if (lastSale && lastSale.receipt_no) {
    const parts = lastSale.receipt_no.split('-');
    const lastNum = parseInt(parts[2]);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// CREATE NEW SALE (POS Checkout)
router.post('/', authenticateToken, (req, res) => {
  const {
    items, // array of { product_id, quantity, unit_price, sqm_coverage }
    customer_id,
    customer_name,
    customer_phone,
    warehouse_name = 'Main Showroom',
    discount_percent = 0,
    admin_pin, // required if discount_percent > 2%
    payment_method, // 'CASH', 'MOMO', 'BANK', 'CREDIT'
    momo_network,
    momo_reference,
    cash_tendered,
    notes,
    offline_client_id
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty. Please add products.' });
  }

  if (!payment_method) {
    return res.status(400).json({ error: 'Please select a payment method (Cash, MoMo, Bank, or Credit).' });
  }

  // Check discount limit: If > 2%, Admin PIN is mandatory
  const discPct = parseFloat(discount_percent) || 0;
  let approverUser = null;
  if (discPct > 2) {
    const pinCheck = verifyAdminPin(admin_pin);
    if (!pinCheck.valid) {
      return res.status(403).json({ error: `Discount of ${discPct}% exceeds 2% cashier limit. Supervisor approval required: ` + pinCheck.message });
    }
    approverUser = pinCheck.user;
  }

  // Credit sale validation
  let customer = null;
  if (payment_method === 'CREDIT') {
    if (!customer_id) {
      return res.status(400).json({ error: 'Credit sales require selecting a registered customer.' });
    }
    customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'Selected customer not found in records.' });
    }
  }

  // Verify stock & calculate totals
  let subtotal = 0;
  let totalCost = 0;
  const processedItems = [];

  for (const item of items) {
    const qty = parseFloat(item.quantity);
    if (!qty || qty <= 0) {
      return res.status(400).json({ error: `Invalid quantity for item ID ${item.product_id}` });
    }

    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (!prod) {
      return res.status(404).json({ error: `Product with ID ${item.product_id} no longer exists.` });
    }

    // Check available stock in warehouse
    const stockRow = db.prepare('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_name = ?')
      .get(item.product_id, warehouse_name);
    const available = stockRow ? stockRow.quantity : 0;

    if (available < qty) {
      return res.status(400).json({
        error: `Insufficient stock for "${prod.name}" in ${warehouse_name}. Available: ${available}, Requested: ${qty}`
      });
    }

    // Rule: Cannot sell below cost price
    const unitPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : prod.selling_price);
    const discountedUnitPrice = unitPrice * (1 - (discPct / 100));

    if (discountedUnitPrice < prod.cost_price) {
      return res.status(400).json({
        error: `Security Rule Violation: Selling price (GHS ${discountedUnitPrice.toFixed(2)}) for "${prod.name}" cannot be below cost price (GHS ${prod.cost_price.toFixed(2)}).`
      });
    }

    const itemTotal = unitPrice * qty;
    const itemCostTotal = prod.cost_price * qty;

    subtotal += itemTotal;
    totalCost += itemCostTotal;

    processedItems.push({
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku,
      quantity: qty,
      unit: prod.unit,
      cost_price: prod.cost_price,
      selling_price: unitPrice,
      total_price: itemTotal,
      sqm_coverage: parseFloat(item.sqm_coverage) || (prod.sqm_per_box ? prod.sqm_per_box * qty : 0)
    });
  }

  const discountAmount = subtotal * (discPct / 100);
  const totalAmount = subtotal - discountAmount;

  // Credit limit check
  if (payment_method === 'CREDIT' && customer) {
    if (customer.current_balance + totalAmount > customer.credit_limit) {
      return res.status(400).json({
        error: `Credit limit exceeded! Customer credit limit is GHS ${customer.credit_limit.toFixed(2)}. Current debt: GHS ${customer.current_balance.toFixed(2)}. This sale: GHS ${totalAmount.toFixed(2)}.`
      });
    }
  }

  // Calculate change if cash
  const tendered = parseFloat(cash_tendered) || totalAmount;
  const changeGiven = payment_method === 'CASH' && tendered > totalAmount ? tendered - totalAmount : 0;

  // Check for offline duplicate
  if (offline_client_id) {
    const existingOffline = db.prepare('SELECT id, receipt_no FROM sales WHERE offline_client_id = ?').get(offline_client_id);
    if (existingOffline) {
      return res.json({ success: true, duplicate: true, receipt_no: existingOffline.receipt_no, sale_id: existingOffline.id });
    }
  }

  const receiptNo = getNextReceiptNumber();

  // Execute database transaction
  let saleId = null;
  const saleTxn = db.transaction(() => {
    // 1. Insert sale record
    const insertSale = db.prepare(`
      INSERT INTO sales (
        receipt_no, customer_id, customer_name, customer_phone, staff_id,
        warehouse_name, subtotal, discount_percent, discount_amount, discount_approved_by,
        total_amount, total_cost, payment_method, momo_reference, momo_network,
        cash_tendered, change_given, is_offline_sync, offline_client_id, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
    `);

    const result = insertSale.run(
      receiptNo,
      customer_id || null,
      customer_name || (customer ? customer.name : 'Walk-in Customer'),
      customer_phone || (customer ? customer.phone : null),
      req.user.id,
      warehouse_name,
      subtotal,
      discPct,
      discountAmount,
      approverUser ? approverUser.id : null,
      totalAmount,
      totalCost,
      payment_method,
      momo_reference || null,
      momo_network || null,
      tendered,
      changeGiven,
      offline_client_id ? 1 : 0,
      offline_client_id || null,
      notes || null
    );

    saleId = result.lastInsertRowid;

    // 2. Insert items and decrement warehouse stock
    const insertItem = db.prepare(`
      INSERT INTO sale_items (
        sale_id, product_id, product_name, sku, quantity, unit,
        cost_price, selling_price, total_price, sqm_coverage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const deductStock = db.prepare(`
      UPDATE warehouse_stock SET quantity = quantity - ? 
      WHERE product_id = ? AND warehouse_name = ?
    `);

    const logMove = db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, from_location, reference_no, cost_price, reason, created_by_id
      ) VALUES (?, 'OUT', ?, ?, ?, ?, 'POS Sale', ?)
    `);

    for (const item of processedItems) {
      insertItem.run(
        saleId, item.product_id, item.product_name, item.sku,
        item.quantity, item.unit, item.cost_price, item.selling_price,
        item.total_price, item.sqm_coverage
      );

      deductStock.run(item.quantity, item.product_id, warehouse_name);
      logMove.run(item.product_id, -item.quantity, warehouse_name, receiptNo, item.cost_price, req.user.id);
    }

    // 3. Update customer balance if credit sale
    if (payment_method === 'CREDIT' && customer_id) {
      db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ?')
        .run(totalAmount, customer_id);
    }
  });

  saleTxn();

  // Audit log
  logAudit(
    req.user.id,
    req.user.name,
    req.user.role,
    'SALE_CREATED',
    `Completed sale ${receiptNo} for GHS ${totalAmount.toFixed(2)} (${payment_method}) by ${req.user.name}`
  );

  res.json({
    success: true,
    sale_id: saleId,
    receipt_no: receiptNo,
    total_amount: totalAmount,
    change_given: changeGiven,
    message: 'Sale completed successfully'
  });
});

// BATCH SYNC OFFLINE SALES (When internet reconnects)
router.post('/sync-offline', authenticateToken, (req, res) => {
  const { sales } = req.body;

  if (!Array.isArray(sales) || sales.length === 0) {
    return res.status(400).json({ error: 'No offline sales provided for sync' });
  }

  const results = [];

  for (const saleData of sales) {
    try {
      // Check duplicate
      if (saleData.offline_client_id) {
        const existing = db.prepare('SELECT id, receipt_no FROM sales WHERE offline_client_id = ?').get(saleData.offline_client_id);
        if (existing) {
          results.push({ offline_id: saleData.offline_client_id, status: 'already_synced', receipt_no: existing.receipt_no });
          continue;
        }
      }

      const receiptNo = getNextReceiptNumber();
      let totalCost = 0;
      let subtotal = 0;

      for (const item of saleData.items) {
        const prod = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(item.product_id);
        const cost = prod ? prod.cost_price : 0;
        totalCost += cost * item.quantity;
        subtotal += item.unit_price * item.quantity;
      }

      const discPct = parseFloat(saleData.discount_percent) || 0;
      const discountAmount = subtotal * (discPct / 100);
      const totalAmount = subtotal - discountAmount;

      const syncTxn = db.transaction(() => {
        const insertSale = db.prepare(`
          INSERT INTO sales (
            receipt_no, customer_id, customer_name, customer_phone, staff_id,
            warehouse_name, subtotal, discount_percent, discount_amount,
            total_amount, total_cost, payment_method, momo_reference, momo_network,
            is_offline_sync, offline_client_id, status, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'completed', ?, ?)
        `);

        const res = insertSale.run(
          receiptNo,
          saleData.customer_id || null,
          saleData.customer_name || 'Walk-in Customer',
          saleData.customer_phone || null,
          req.user.id,
          saleData.warehouse_name || 'Main Showroom',
          subtotal,
          discPct,
          discountAmount,
          totalAmount,
          totalCost,
          saleData.payment_method || 'CASH',
          saleData.momo_reference || null,
          saleData.momo_network || null,
          saleData.offline_client_id || null,
          saleData.notes || 'Offline synced sale',
          saleData.timestamp || new Date().toISOString()
        );

        const newSaleId = res.lastInsertRowid;

        const insertItem = db.prepare(`
          INSERT INTO sale_items (
            sale_id, product_id, product_name, sku, quantity, unit,
            cost_price, selling_price, total_price, sqm_coverage
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const deductStock = db.prepare(`
          UPDATE warehouse_stock SET quantity = quantity - ? 
          WHERE product_id = ? AND warehouse_name = ?
        `);

        for (const item of saleData.items) {
          const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
          const cost = prod ? prod.cost_price : 0;
          insertItem.run(
            newSaleId, item.product_id, item.product_name, item.sku,
            item.quantity, item.unit || 'pcs', cost, item.unit_price,
            item.unit_price * item.quantity, item.sqm_coverage || 0
          );
          deductStock.run(item.quantity, item.product_id, saleData.warehouse_name || 'Main Showroom');
        }
      });

      syncTxn();
      results.push({ offline_id: saleData.offline_client_id, status: 'synced', receipt_no: receiptNo });
    } catch (e) {
      results.push({ offline_id: saleData.offline_client_id, status: 'error', error: e.message });
    }
  }

  logAudit(
    req.user.id,
    req.user.name,
    req.user.role,
    'OFFLINE_SYNC',
    `Synchronized ${results.filter(r => r.status === 'synced').length} offline sales successfully`
  );

  res.json({ success: true, results });
});

// GET RECEIPT DETAILS (For Printing)
router.get('/receipt/:idOrNo', authenticateToken, (req, res) => {
  const param = req.params.idOrNo;
  let sale = null;

  if (isNaN(param)) {
    sale = db.prepare('SELECT s.*, u.name as staff_name FROM sales s JOIN users u ON s.staff_id = u.id WHERE s.receipt_no = ?').get(param);
  } else {
    sale = db.prepare('SELECT s.*, u.name as staff_name FROM sales s JOIN users u ON s.staff_id = u.id WHERE s.id = ?').get(param);
  }

  if (!sale) return res.status(404).json({ error: 'Receipt not found' });

  // Cashier security rule: Cannot see past sales of others or company profit
  if (req.user.role === 'sales') {
    delete sale.total_cost;
    // Sales staff can only print receipts they generated or today's receipts
  }

  const items = db.prepare(`
    SELECT id, product_id, product_name, sku, quantity, unit, selling_price, total_price, sqm_coverage
    FROM sale_items WHERE sale_id = ?
  `).all(sale.id);

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });

  res.json({
    sale,
    items,
    store_info: {
      name: settings.company_name || 'OMAL TILES & HARDWARE DEPOT',
      tin: settings.company_tin || 'C0028914567',
      phone: settings.company_phone || '+233 24 456 7890',
      address: settings.company_address || 'Spintex Road, Accra, Ghana',
      footer: settings.receipt_footer || 'Thank you for your business! Goods once sold are not returnable after 48 hours.'
    }
  });
});

// GET TODAY'S SALES FOR LOGGED IN CASHIER (Sales staff can ONLY see their own sales today)
router.get('/my-today', authenticateToken, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const sales = db.prepare(`
    SELECT s.id, s.receipt_no, s.customer_name, s.total_amount, s.payment_method, s.created_at
    FROM sales s
    WHERE s.staff_id = ? AND DATE(s.created_at) = DATE(?)
    ORDER BY s.id DESC
  `).all(req.user.id, today);

  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total_sales_count,
      COALESCE(SUM(total_amount), 0) as total_sales_value,
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_total,
      COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_total,
      COALESCE(SUM(CASE WHEN payment_method = 'BANK' THEN total_amount ELSE 0 END), 0) as bank_total,
      COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_total
    FROM sales
    WHERE staff_id = ? AND DATE(created_at) = DATE(?)
  `).get(req.user.id, today);

  res.json({ sales, summary });
});

// LIST SALES (For Admin & Super Admin & Accountant)
router.get('/', authenticateToken, (req, res) => {
  // Sales staff can only access their own sales
  let query = `
    SELECT 
      s.id, s.receipt_no, s.customer_name, s.customer_phone,
      s.subtotal, s.discount_percent, s.discount_amount, s.total_amount,
      s.payment_method, s.momo_network, s.momo_reference, s.status, s.created_at,
      u.name as staff_name
  `;

  if (req.user.role === 'super_admin') {
    query += ', s.total_cost, (s.total_amount - s.total_cost) as profit ';
  }

  query += `
    FROM sales s
    JOIN users u ON s.staff_id = u.id
  `;

  let conditions = [];
  let params = [];

  if (req.user.role === 'sales') {
    conditions.push('s.staff_id = ?');
    params.push(req.user.id);
  }

  const { start_date, end_date, staff_id, payment_method, search } = req.query;

  if (start_date) {
    conditions.push('DATE(s.created_at) >= DATE(?)');
    params.push(start_date);
  }
  if (end_date) {
    conditions.push('DATE(s.created_at) <= DATE(?)');
    params.push(end_date);
  }
  if (staff_id && req.user.role !== 'sales') {
    conditions.push('s.staff_id = ?');
    params.push(staff_id);
  }
  if (payment_method) {
    conditions.push('s.payment_method = ?');
    params.push(payment_method);
  }
  if (search) {
    conditions.push('(s.receipt_no LIKE ? OR s.customer_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY s.id DESC LIMIT 200';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

module.exports = router;

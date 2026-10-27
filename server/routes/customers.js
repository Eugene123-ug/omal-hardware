const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole, logAudit } = require('../middleware/auth');

// LIST CUSTOMERS
router.get('/', authenticateToken, (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM customers';
  let params = [];

  if (search && search.trim()) {
    query += ' WHERE name LIKE ? OR phone LIKE ? OR location LIKE ?';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY name ASC';
  const customers = db.prepare(query).all(...params);
  res.json(customers);
});

// GET SINGLE CUSTOMER WITH STATEMENT (LEDGER)
router.get('/:id/statement', authenticateToken, (req, res) => {
  const customerId = req.params.id;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);

  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // Get sales transactions
  const sales = db.prepare(`
    SELECT id, receipt_no, total_amount, payment_method, created_at, 'SALE' as type
    FROM sales
    WHERE customer_id = ?
    ORDER BY created_at ASC
  `).all(customerId);

  // Get credit repayments
  const payments = db.prepare(`
    SELECT id, receipt_no, amount, payment_method, reference_no, notes, created_at, 'PAYMENT' as type
    FROM customer_payments
    WHERE customer_id = ?
    ORDER BY created_at ASC
  `).all(customerId);

  // Combine and sort chronologically
  const statement = [...sales, ...payments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Calculate running balance
  let runningBalance = 0;
  const statementWithBalance = statement.map(item => {
    if (item.type === 'SALE') {
      if (item.payment_method === 'CREDIT') {
        runningBalance += item.total_amount;
      }
    } else if (item.type === 'PAYMENT') {
      runningBalance -= item.amount;
    }
    return {
      ...item,
      running_balance: runningBalance
    };
  });

  res.json({
    customer,
    statement: statementWithBalance,
    total_sales: sales.reduce((acc, s) => acc + s.total_amount, 0),
    total_paid: payments.reduce((acc, p) => acc + p.amount, 0),
    current_debt: customer.current_balance
  });
});

// CREATE CUSTOMER
router.post('/', authenticateToken, (req, res) => {
  const { name, phone, location, credit_limit } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required' });
  }

  const info = db.prepare(`
    INSERT INTO customers (name, phone, location, credit_limit, current_balance)
    VALUES (?, ?, ?, ?, 0)
  `).run(name.trim(), phone.trim(), location || '', parseFloat(credit_limit) || 0);

  logAudit(req.user.id, req.user.name, req.user.role, 'CUSTOMER_CREATED', `Added customer: ${name} (${phone})`);

  res.json({ success: true, id: info.lastInsertRowid, message: 'Customer registered successfully' });
});

// UPDATE CUSTOMER
router.put('/:id', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const { name, phone, location, credit_limit } = req.body;
  const customerId = req.params.id;

  db.prepare(`
    UPDATE customers SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      location = COALESCE(?, location),
      credit_limit = COALESCE(?, credit_limit)
    WHERE id = ?
  `).run(name, phone, location, credit_limit !== undefined ? parseFloat(credit_limit) : null, customerId);

  res.json({ success: true, message: 'Customer updated successfully' });
});

// RECORD CREDIT REPAYMENT (CUSTOMER PART OR FULL DEBT PAYMENT)
router.post('/credit-payment', authenticateToken, (req, res) => {
  const { customer_id, amount, payment_method, reference_no, notes } = req.body;

  const paymentAmount = parseFloat(amount);
  if (!customer_id || !paymentAmount || paymentAmount <= 0 || !payment_method) {
    return res.status(400).json({ error: 'Customer ID, valid payment amount, and payment method are required' });
  }

  const customer = db.prepare('SELECT name, current_balance FROM customers WHERE id = ?').get(customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const receiptNo = `PAY-${Date.now()}`;

  const txn = db.transaction(() => {
    // Record payment
    db.prepare(`
      INSERT INTO customer_payments (customer_id, amount, payment_method, reference_no, receipt_no, received_by_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(customer_id, paymentAmount, payment_method, reference_no || null, receiptNo, req.user.id, notes || 'Debt repayment');

    // Reduce customer balance
    db.prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?')
      .run(paymentAmount, customer_id);
  });

  txn();

  const newBalance = customer.current_balance - paymentAmount;

  logAudit(
    req.user.id,
    req.user.name,
    req.user.role,
    'CUSTOMER_PAYMENT',
    `Received payment of GHS ${paymentAmount.toFixed(2)} from ${customer.name} via ${payment_method}. Remaining debt: GHS ${newBalance.toFixed(2)}`
  );

  res.json({
    success: true,
    receipt_no: receiptNo,
    amount_paid: paymentAmount,
    new_balance: newBalance,
    message: `Payment of GHS ${paymentAmount.toFixed(2)} recorded successfully`
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole, logAudit } = require('../middleware/auth');

// GET TODAY'S CASH SUMMARY FOR REGISTER CLOSING
router.get('/cash-register/today', authenticateToken, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const staffId = req.user.role === 'sales' ? req.user.id : (req.query.staff_id || req.user.id);

  // Sales by payment method today for this staff (or all staff if admin/owner)
  let salesQuery = `
    SELECT 
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'BANK' THEN total_amount ELSE 0 END), 0) as bank_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_sales,
      COALESCE(SUM(total_amount), 0) as total_sales,
      COUNT(*) as transactions_count
    FROM sales
    WHERE DATE(created_at) = DATE(?)
  `;

  let params = [today];
  if (req.user.role === 'sales') {
    salesQuery += ' AND staff_id = ?';
    params.push(staffId);
  }

  const salesData = db.prepare(salesQuery).get(...params);

  // Expenses paid in cash today
  const expenseData = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as expense_count
    FROM expenses
    WHERE DATE(created_at) = DATE(?)
  `).get(today);

  // Check if closing already submitted today
  const existingClosing = db.prepare(`
    SELECT dcc.*, u.name as staff_name
    FROM daily_cash_closings dcc
    JOIN users u ON dcc.staff_id = u.id
    WHERE DATE(dcc.closing_date) = DATE(?) AND dcc.staff_id = ?
  `).get(today, staffId);

  // Default opening cash (e.g. 500 GHS float or 0)
  const openingCash = 500.00;
  const cashSales = salesData.cash_sales;
  const cashExpenses = req.user.role === 'sales' ? 0 : expenseData.total_expenses; // cashiers generally don't pay expenses unless authorized
  const expectedCash = openingCash + cashSales - cashExpenses;

  res.json({
    date: today,
    opening_cash: openingCash,
    cash_sales: salesData.cash_sales,
    momo_sales: salesData.momo_sales,
    bank_sales: salesData.bank_sales,
    credit_sales: salesData.credit_sales,
    total_sales: salesData.total_sales,
    cash_expenses: cashExpenses,
    expected_cash: expectedCash,
    existing_closing: existingClosing || null
  });
});

// SUBMIT DAILY CASH CLOSING
router.post('/cash-register/close', authenticateToken, (req, res) => {
  const { opening_cash, physical_cash, notes } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  const staffId = req.user.id;

  const physical = parseFloat(physical_cash);
  if (isNaN(physical) || physical < 0) {
    return res.status(400).json({ error: 'Please enter a valid counted physical cash amount' });
  }

  const openCash = parseFloat(opening_cash) || 0;

  // Calculate actual cash sales today
  const salesData = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'BANK' THEN total_amount ELSE 0 END), 0) as bank_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_sales
    FROM sales
    WHERE DATE(created_at) = DATE(?) AND staff_id = ?
  `).get(today, staffId);

  const cashExpenses = 0; // staff level
  const expectedCash = openCash + salesData.cash_sales - cashExpenses;
  const discrepancy = physical - expectedCash; // negative = shortage, positive = excess

  // Check if already closed today
  const existing = db.prepare(`
    SELECT id FROM daily_cash_closings 
    WHERE DATE(closing_date) = DATE(?) AND staff_id = ?
  `).get(today, staffId);

  let closingId;
  if (existing) {
    db.prepare(`
      UPDATE daily_cash_closings SET
        opening_cash = ?, cash_sales = ?, momo_sales = ?, bank_sales = ?, credit_sales = ?,
        cash_expenses = ?, expected_cash = ?, physical_cash = ?, discrepancy = ?,
        notes = ?, created_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      openCash, salesData.cash_sales, salesData.momo_sales, salesData.bank_sales, salesData.credit_sales,
      cashExpenses, expectedCash, physical, discrepancy, notes || '', existing.id
    );
    closingId = existing.id;
  } else {
    const info = db.prepare(`
      INSERT INTO daily_cash_closings (
        closing_date, staff_id, opening_cash, cash_sales, momo_sales, bank_sales, credit_sales,
        cash_expenses, expected_cash, physical_cash, discrepancy, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      today, staffId, openCash, salesData.cash_sales, salesData.momo_sales, salesData.bank_sales, salesData.credit_sales,
      cashExpenses, expectedCash, physical, discrepancy, notes || ''
    );
    closingId = info.lastInsertRowid;
  }

  // Audit log with special flag if shortage
  const statusNote = discrepancy < 0
    ? `SHORTAGE ALERT: GHS ${Math.abs(discrepancy).toFixed(2)} shortage recorded by ${req.user.name}`
    : discrepancy > 0
    ? `EXCESS: GHS ${discrepancy.toFixed(2)} excess recorded by ${req.user.name}`
    : `BALANCED: Exactly GHS 0.00 discrepancy`;

  logAudit(
    req.user.id,
    req.user.name,
    req.user.role,
    'CASH_CLOSING',
    `Daily cash closing submitted. Expected: GHS ${expectedCash.toFixed(2)}, Declared: GHS ${physical.toFixed(2)}, Diff: GHS ${discrepancy.toFixed(2)}. ${statusNote}`
  );

  res.json({
    success: true,
    closing_id: closingId,
    expected_cash: expectedCash,
    physical_cash: physical,
    discrepancy,
    has_shortage: discrepancy < 0,
    shortage_amount: discrepancy < 0 ? Math.abs(discrepancy) : 0,
    message: discrepancy === 0
      ? 'Cash closing balanced perfectly!'
      : discrepancy < 0
      ? `Cash closing submitted with a SHORTAGE of GHS ${Math.abs(discrepancy).toFixed(2)}. Super Admin notified.`
      : `Cash closing submitted with an EXCESS of GHS ${discrepancy.toFixed(2)}.`
  });
});

// LIST CASH CLOSING HISTORY (Super Admin & Admin & Accountant)
router.get('/cash-register/history', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const closings = db.prepare(`
    SELECT dcc.*, u.name as staff_name, u.role as staff_role
    FROM daily_cash_closings dcc
    JOIN users u ON dcc.staff_id = u.id
    ORDER BY dcc.closing_date DESC, dcc.id DESC
    LIMIT 60
  `).all();
  res.json(closings);
});

// LIST EXPENSES
router.get('/expenses', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const { start_date, end_date, category } = req.query;

  let query = `
    SELECT e.*, u.name as paid_by_name
    FROM expenses e
    JOIN users u ON e.paid_by_id = u.id
  `;

  let conditions = [];
  let params = [];

  if (start_date) {
    conditions.push('DATE(e.created_at) >= DATE(?)');
    params.push(start_date);
  }
  if (end_date) {
    conditions.push('DATE(e.created_at) <= DATE(?)');
    params.push(end_date);
  }
  if (category && category !== 'All') {
    conditions.push('e.category = ?');
    params.push(category);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY e.id DESC';

  const expenses = db.prepare(query).all(...params);
  res.json(expenses);
});

// RECORD EXPENSE
router.post('/expenses', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const { category, amount, description, receipt_image } = req.body;

  const expAmount = parseFloat(amount);
  if (!category || !expAmount || expAmount <= 0 || !description) {
    return res.status(400).json({ error: 'Category, valid amount, and description are required' });
  }

  const info = db.prepare(`
    INSERT INTO expenses (category, amount, description, receipt_image, paid_by_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(category, expAmount, description.trim(), receipt_image || null, req.user.id);

  logAudit(
    req.user.id,
    req.user.name,
    req.user.role,
    'EXPENSE_RECORDED',
    `Recorded expense [${category}]: GHS ${expAmount.toFixed(2)} - ${description}`
  );

  res.json({ success: true, id: info.lastInsertRowid, message: 'Expense recorded successfully' });
});

// DELETE EXPENSE (SUPER ADMIN ONLY!)
router.delete('/expenses/:id', authenticateToken, requireRole('super_admin'), (req, res) => {
  const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Expense not found' });

  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);

  logAudit(req.user.id, req.user.name, req.user.role, 'EXPENSE_DELETED', `Deleted expense: GHS ${exp.amount} (${exp.category})`);

  res.json({ success: true, message: 'Expense deleted permanently by Super Admin' });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// DASHBOARD OVERVIEW STATS (For Super Admin & Admin)
router.get('/dashboard', authenticateToken, requireRole('super_admin', 'admin', 'accountant'), (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const today = new Date().toISOString().slice(0, 10);

  // 1. Today's sales & profit
  const todayStats = db.prepare(`
    SELECT 
      COUNT(*) as transactions_today,
      COALESCE(SUM(total_amount), 0) as sales_today,
      COALESCE(SUM(total_cost), 0) as cost_today,
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_today,
      COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_today,
      COALESCE(SUM(CASE WHEN payment_method = 'BANK' THEN total_amount ELSE 0 END), 0) as bank_today,
      COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_today
    FROM sales
    WHERE DATE(created_at) = DATE(?)
  `).get(today);

  // 2. Today's expenses
  const todayExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as expenses_today
    FROM expenses
    WHERE DATE(created_at) = DATE(?)
  `).get(today).expenses_today;

  const grossProfitToday = todayStats.sales_today - todayStats.cost_today;
  const netProfitToday = grossProfitToday - todayExpenses;

  // 3. Low stock count and top items
  const lowStockItems = db.prepare(`
    SELECT 
      p.id, p.name, p.category, p.sku, p.unit, p.min_stock_alert, p.image_url,
      COALESCE(SUM(ws.quantity), 0) as current_stock
    FROM products p
    LEFT JOIN warehouse_stock ws ON p.id = ws.product_id
    GROUP BY p.id
    HAVING current_stock <= p.min_stock_alert
    ORDER BY current_stock ASC
    LIMIT 10
  `).all();

  // 4. Top selling products this month
  const topSelling = db.prepare(`
    SELECT 
      si.product_name, si.sku,
      SUM(si.quantity) as total_qty_sold,
      SUM(si.total_price) as total_revenue
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.created_at >= date('now', 'start of month')
    GROUP BY si.product_id
    ORDER BY total_revenue DESC
    LIMIT 5
  `).all();

  // 5. Total credit owed by customers
  const totalCreditOwed = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as total FROM customers').get().total;

  // 6. Recent live sales (Last 10 sales with staff name)
  const recentSales = db.prepare(`
    SELECT s.id, s.receipt_no, s.customer_name, s.total_amount, s.payment_method, s.created_at, u.name as staff_name
    FROM sales s
    JOIN users u ON s.staff_id = u.id
    ORDER BY s.id DESC
    LIMIT 8
  `).all();

  // 7. Latest cash closing alert
  const latestClosing = db.prepare(`
    SELECT dcc.*, u.name as staff_name
    FROM daily_cash_closings dcc
    JOIN users u ON dcc.staff_id = u.id
    ORDER BY dcc.id DESC
    LIMIT 1
  `).get();

  res.json({
    today: {
      sales: todayStats.sales_today,
      transactions: todayStats.transactions_today,
      cash: todayStats.cash_today,
      momo: todayStats.momo_today,
      bank: todayStats.bank_today,
      credit: todayStats.credit_today,
      expenses: todayExpenses,
      gross_profit: isSuperAdmin ? grossProfitToday : undefined,
      net_profit: isSuperAdmin ? netProfitToday : undefined,
      profit_margin: isSuperAdmin && todayStats.sales_today > 0 ? ((netProfitToday / todayStats.sales_today) * 100).toFixed(1) + '%' : undefined
    },
    low_stock_count: lowStockItems.length,
    low_stock_items: lowStockItems,
    top_selling: topSelling,
    credit_owed: totalCreditOwed,
    recent_sales: recentSales,
    cash_alert: latestClosing && latestClosing.discrepancy !== 0 ? {
      date: latestClosing.closing_date,
      staff_name: latestClosing.staff_name,
      expected: latestClosing.expected_cash,
      physical: latestClosing.physical_cash,
      discrepancy: latestClosing.discrepancy,
      has_shortage: latestClosing.discrepancy < 0
    } : null
  });
});

// MORNING OWNER REPORT (What happened yesterday / overnight)
router.get('/morning-summary', authenticateToken, requireRole('super_admin'), (req, res) => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const yesterdaySales = db.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(SUM(total_cost), 0) as total_cogs
    FROM sales
    WHERE DATE(created_at) = DATE(?)
  `).get(yesterday);

  const yesterdayExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE DATE(created_at) = DATE(?)
  `).get(yesterday).total;

  const gross = yesterdaySales.total_revenue - yesterdaySales.total_cogs;
  const net = gross - yesterdayExpenses;

  // Closings yesterday
  const closings = db.prepare(`
    SELECT dcc.*, u.name as staff_name
    FROM daily_cash_closings dcc
    JOIN users u ON dcc.staff_id = u.id
    WHERE DATE(closing_date) = DATE(?)
  `).all(yesterday);

  // Low stock
  const lowStockCount = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT p.id, COALESCE(SUM(ws.quantity), 0) as stock
      FROM products p
      LEFT JOIN warehouse_stock ws ON p.id = ws.product_id
      GROUP BY p.id
      HAVING stock <= p.min_stock_alert
    )
  `).get().count;

  res.json({
    date: yesterday,
    yesterday_revenue: yesterdaySales.total_revenue,
    yesterday_transactions: yesterdaySales.count,
    yesterday_expenses: yesterdayExpenses,
    yesterday_net_profit: net,
    low_stock_count: lowStockCount,
    closings: closings.map(c => ({
      staff: c.staff_name,
      expected: c.expected_cash,
      physical: c.physical_cash,
      discrepancy: c.discrepancy
    }))
  });
});

// PROFIT & LOSS REPORT (Daily / Weekly / Monthly / Yearly)
router.get('/profit-loss', authenticateToken, requireRole('super_admin'), (req, res) => {
  const { period = 'monthly', year = new Date().getFullYear() } = req.query;

  let groupByFormat = '%Y-%m';
  if (period === 'daily') groupByFormat = '%Y-%m-%d';
  if (period === 'yearly') groupByFormat = '%Y';

  // Sales and COGS
  const salesRows = db.prepare(`
    SELECT 
      strftime('${groupByFormat}', created_at) as time_key,
      COUNT(*) as total_orders,
      SUM(total_amount) as total_sales,
      SUM(total_cost) as total_cogs
    FROM sales
    WHERE strftime('%Y', created_at) = ?
    GROUP BY time_key
    ORDER BY time_key ASC
  `).all(String(year));

  // Expenses
  const expRows = db.prepare(`
    SELECT 
      strftime('${groupByFormat}', created_at) as time_key,
      SUM(amount) as total_expenses
    FROM expenses
    WHERE strftime('%Y', created_at) = ?
    GROUP BY time_key
  `).all(String(year));

  const expMap = {};
  expRows.forEach(e => { expMap[e.time_key] = e.total_expenses; });

  const breakdown = salesRows.map(s => {
    const expenses = expMap[s.time_key] || 0;
    const grossProfit = s.total_sales - s.total_cogs;
    const netProfit = grossProfit - expenses;
    const margin = s.total_sales > 0 ? ((netProfit / s.total_sales) * 100).toFixed(1) : 0;

    return {
      period: s.time_key,
      orders: s.total_orders,
      sales: s.total_sales,
      cost_of_goods: s.total_cogs,
      gross_profit: grossProfit,
      expenses,
      net_profit: netProfit,
      margin_pct: margin
    };
  });

  const grandTotalSales = breakdown.reduce((a, b) => a + b.sales, 0);
  const grandTotalCost = breakdown.reduce((a, b) => a + b.cost_of_goods, 0);
  const grandTotalExp = breakdown.reduce((a, b) => a + b.expenses, 0);
  const grandNetProfit = grandTotalSales - grandTotalCost - grandTotalExp;

  res.json({
    period,
    year,
    breakdown,
    summary: {
      total_sales: grandTotalSales,
      total_cogs: grandTotalCost,
      total_expenses: grandTotalExp,
      net_profit: grandNetProfit,
      net_margin_pct: grandTotalSales > 0 ? ((grandNetProfit / grandTotalSales) * 100).toFixed(1) : 0
    }
  });
});

// STAFF PERFORMANCE REPORT
router.get('/staff-performance', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const { start_date, end_date } = req.query;

  let query = `
    SELECT 
      u.id as staff_id,
      u.name as staff_name,
      u.role as staff_role,
      COUNT(s.id) as total_sales_count,
      COALESCE(SUM(s.total_amount), 0) as total_revenue,
      COALESCE(SUM(s.discount_amount), 0) as total_discounts_given,
      COALESCE(AVG(s.discount_percent), 0) as avg_discount_pct
    FROM users u
    LEFT JOIN sales s ON u.id = s.staff_id
  `;

  let conditions = [];
  let params = [];

  if (start_date) {
    conditions.push('DATE(s.created_at) >= DATE(?)');
    params.push(start_date);
  }
  if (end_date) {
    conditions.push('DATE(s.created_at) <= DATE(?)');
    params.push(end_date);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` GROUP BY u.id ORDER BY total_revenue DESC`;

  const staffStats = db.prepare(query).all(...params);

  // Also query cash closing shortages per staff
  const shortages = db.prepare(`
    SELECT staff_id, COUNT(*) as closing_count, SUM(CASE WHEN discrepancy < 0 THEN discrepancy ELSE 0 END) as total_shortage
    FROM daily_cash_closings
    GROUP BY staff_id
  `).all();

  const shortageMap = {};
  shortages.forEach(sh => { shortageMap[sh.staff_id] = Math.abs(sh.total_shortage || 0); });

  const enriched = staffStats.map(st => ({
    ...st,
    total_cash_shortages: shortageMap[st.staff_id] || 0
  }));

  res.json(enriched);
});

module.exports = router;

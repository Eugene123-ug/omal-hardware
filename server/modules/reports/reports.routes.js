const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse, parsePagination } = require('../../common/response');
const { authenticateToken, requirePermission, requireRole, logAudit } = require('../../middleware/auth');
const { checkUserPermission } = require('../../utils/security');

/**
 * GET /api/v1/reports/dashboard
 * Standard operational overview with role-based masking of profit figures
 */
router.get('/dashboard', authenticateToken, requirePermission('reports.view'), async (req, res, next) => {
  try {
    const canViewProfit = await checkUserPermission(req.user, 'finance.profit_view');
    const today = new Date().toISOString().slice(0, 10);

    const [todaySales, todayExpenses, lowStock, topSelling, creditOwed, recentSales, latestClosing] = await Promise.all([
      db('sales')
        .whereRaw('DATE(created_at) = DATE(?)', [today])
        .select(
          db.raw('COUNT(*) as transactions_today'),
          db.raw('COALESCE(SUM(total_amount), 0) as sales_today'),
          db.raw('COALESCE(SUM(total_cost), 0) as cost_today'),
          db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_today"),
          db.raw("COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_today"),
          db.raw("COALESCE(SUM(CASE WHEN payment_method = 'BANK' THEN total_amount ELSE 0 END), 0) as bank_today"),
          db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_today")
        )
        .first(),

      db('expenses')
        .whereRaw('DATE(expense_date) = DATE(?)', [today])
        .where('approval_status', 'approved')
        .sum('amount as total')
        .first(),

      db('products as p')
        .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
        .where('p.status', 'active')
        .groupBy('p.id')
        .havingRaw('COALESCE(SUM(ws.quantity), 0) <= p.min_stock_alert')
        .select(
          'p.id', 'p.name', 'p.category', 'p.sku', 'p.unit', 'p.min_stock_alert', 'p.image_url',
          db.raw('COALESCE(SUM(ws.quantity), 0) as current_stock')
        )
        .orderBy('current_stock', 'asc')
        .limit(10),

      db('sale_items as si')
        .join('sales as s', 'si.sale_id', 's.id')
        .whereRaw("s.created_at >= date_trunc('month', CURRENT_DATE)")
        .groupBy('si.product_id', 'si.product_name', 'si.sku')
        .select(
          'si.product_name', 'si.sku',
          db.raw('SUM(si.quantity) as total_qty_sold'),
          db.raw('SUM(si.total_price) as total_revenue')
        )
        .orderBy('total_revenue', 'desc')
        .limit(5),

      db('customers').sum('current_balance as total').first(),

      db('sales as s')
        .join('users as u', 's.staff_id', 'u.id')
        .select('s.id', 's.receipt_no', 's.customer_name', 's.total_amount', 's.payment_method', 's.created_at', 'u.name as staff_name')
        .orderBy('s.id', 'desc')
        .limit(8),

      db('daily_cash_closings as dcc')
        .join('users as u', 'dcc.staff_id', 'u.id')
        .select('dcc.*', 'u.name as staff_name')
        .orderBy('dcc.id', 'desc')
        .first()
    ]);

    const salesTotal = parseFloat(todaySales?.sales_today) || 0;
    const costTotal = parseFloat(todaySales?.cost_today) || 0;
    const expTotal = parseFloat(todayExpenses?.total) || 0;
    const gross = salesTotal - costTotal;
    const net = gross - expTotal;

    return ApiResponse.success(res, {
      today: {
        sales: salesTotal,
        transactions: parseInt(todaySales?.transactions_today) || 0,
        cash: parseFloat(todaySales?.cash_today) || 0,
        momo: parseFloat(todaySales?.momo_today) || 0,
        bank: parseFloat(todaySales?.bank_today) || 0,
        credit: parseFloat(todaySales?.credit_today) || 0,
        expenses: expTotal,
        gross_profit: canViewProfit ? gross : undefined,
        net_profit: canViewProfit ? net : undefined,
        profit_margin: canViewProfit && salesTotal > 0 ? ((net / salesTotal) * 100).toFixed(1) + '%' : undefined
      },
      low_stock_count: lowStock.length,
      low_stock_items: lowStock.map(l => ({ ...l, current_stock: parseFloat(l.current_stock) })),
      top_selling: topSelling.map(t => ({ ...t, total_revenue: parseFloat(t.total_revenue) })),
      credit_owed: parseFloat(creditOwed?.total) || 0,
      recent_sales: recentSales.map(r => ({ ...r, total_amount: parseFloat(r.total_amount) })),
      cash_alert: latestClosing && parseFloat(latestClosing.discrepancy) !== 0 ? {
        date: latestClosing.closing_date,
        staff_name: latestClosing.staff_name,
        expected: parseFloat(latestClosing.expected_cash),
        physical: parseFloat(latestClosing.physical_cash),
        discrepancy: parseFloat(latestClosing.discrepancy),
        has_shortage: parseFloat(latestClosing.discrepancy) < 0
      } : null
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reports/owner-dashboard
 * Dedicated executive command center for Remote Owner (Outside Ghana)
 * Tracks all stock valuation at cost, total profit, all money, remote approval requests, and MoM/YoY growth.
 */
router.get('/owner-dashboard', authenticateToken, requirePermission('finance.profit_view'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1. All Money / Liquid Assets (Cash in open drawers + Bank balances + MoMo revenue)
    const openShifts = await db('daily_cash_closings')
      .where('shift_status', 'open')
      .sum('expected_cash as total')
      .first();
    const activeCashInDrawers = parseFloat(openShifts?.total) || 0;

    const [monthSales, monthExpenses, totalStockVal, receivables, payables, pendingApprovalsCount] = await Promise.all([
      db('sales')
        .whereRaw("created_at >= date_trunc('month', CURRENT_DATE)")
        .select(
          db.raw('COALESCE(SUM(total_amount), 0) as month_revenue'),
          db.raw('COALESCE(SUM(total_cost), 0) as month_cogs'),
          db.raw('COUNT(id) as month_orders')
        )
        .first(),

      db('expenses')
        .whereRaw("expense_date >= date_trunc('month', CURRENT_DATE)")
        .where('approval_status', 'approved')
        .sum('amount as total')
        .first(),

      db('products as p')
        .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
        .where('p.status', 'active')
        .select(
          db.raw('COALESCE(SUM(ws.quantity * p.cost_price), 0) as val_at_cost'),
          db.raw('COALESCE(SUM(ws.quantity * p.selling_price), 0) as val_at_retail')
        )
        .first(),

      db('customers').sum('current_balance as total').first(),
      db('supplier_invoices').whereIn('status', ['unpaid', 'partially_paid']).sum('balance_due as total').first(),
      db('approval_requests').where('status', 'pending').count('id as count').first()
    ]);

    // 2. Growth Comparison: MoM (This Month vs Previous Month)
    const prevMonthSales = await db('sales')
      .whereRaw("created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')")
      .whereRaw("created_at < date_trunc('month', CURRENT_DATE)")
      .select(
        db.raw('COALESCE(SUM(total_amount), 0) as prev_month_revenue'),
        db.raw('COALESCE(SUM(total_cost), 0) as prev_month_cogs')
      )
      .first();

    const currentRev = parseFloat(monthSales?.month_revenue) || 0;
    const currentCogs = parseFloat(monthSales?.month_cogs) || 0;
    const currentExp = parseFloat(monthExpenses?.total) || 0;
    const currentNetProfit = currentRev - currentCogs - currentExp;

    const prevRev = parseFloat(prevMonthSales?.prev_month_revenue) || 0;
    const prevCogs = parseFloat(prevMonthSales?.prev_month_cogs) || 0;
    const prevGrossProfit = prevRev - prevCogs;

    const momRevenueGrowth = prevRev > 0 ? (((currentRev - prevRev) / prevRev) * 100).toFixed(2) : '100.00';

    // 3. Slow-moving products (stock > 0 but 0 sales in past 30 days)
    const slowMoving = await db('products as p')
      .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
      .leftJoin(
        db('sale_items as si')
          .join('sales as s', 'si.sale_id', 's.id')
          .whereRaw("s.created_at >= NOW() - INTERVAL '30 days'")
          .select('si.product_id')
          .distinct()
          .as('recent_s'),
        'p.id',
        'recent_s.product_id'
      )
      .where('p.status', 'active')
      .whereNull('recent_s.product_id')
      .groupBy('p.id')
      .havingRaw('COALESCE(SUM(ws.quantity), 0) > 0')
      .select(
        'p.id',
        'p.name as product_name',
        'p.category',
        'p.sku',
        'p.cost_price',
        db.raw('COALESCE(SUM(ws.quantity), 0) as stock_quantity'),
        db.raw('COALESCE(SUM(ws.quantity * p.cost_price), 0) as tied_capital')
      )
      .orderBy('tied_capital', 'desc')
      .limit(5);

    // 4. Pending Approval Requests for Remote Decision
    const pendingApprovals = await db('approval_requests as ar')
      .join('users as u', 'ar.requester_id', 'u.id')
      .where('ar.status', 'pending')
      .select('ar.*', 'u.name as requester_name')
      .orderBy('ar.id', 'desc')
      .limit(10);

    return ApiResponse.success(res, {
      executive_summary: {
        current_month_revenue: currentRev,
        current_month_cogs: currentCogs,
        current_month_expenses: currentExp,
        current_month_net_profit: currentNetProfit,
        mom_revenue_growth_percent: momRevenueGrowth,
        net_profit_margin_percent: currentRev > 0 ? ((currentNetProfit / currentRev) * 100).toFixed(2) : '0.00'
      },
      asset_and_debt_position: {
        cash_in_drawers: activeCashInDrawers,
        stock_value_at_cost: parseFloat(totalStockVal?.val_at_cost) || 0,
        stock_value_at_retail: parseFloat(totalStockVal?.val_at_retail) || 0,
        customer_debtors_owed: parseFloat(receivables?.total) || 0,
        supplier_creditors_liability: parseFloat(payables?.total) || 0,
        net_working_capital: (parseFloat(totalStockVal?.val_at_cost) || 0) + (parseFloat(receivables?.total) || 0) - (parseFloat(payables?.total) || 0)
      },
      remote_actions: {
        pending_approvals_count: parseInt(pendingApprovalsCount?.count) || 0,
        pending_approvals: pendingApprovals
      },
      slow_moving_stock: slowMoving.map(s => ({
        ...s,
        stock_quantity: parseFloat(s.stock_quantity),
        cost_price: parseFloat(s.cost_price),
        tied_capital: parseFloat(s.tied_capital)
      }))
    }, 'Remote Owner executive dashboard loaded');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reports/sales/printable
 * Clean itemized sales report formatted for A4 printing and thermal receipt auditing
 */
router.get('/sales/printable', authenticateToken, requirePermission('reports.view'), async (req, res, next) => {
  try {
    const { start_date, end_date, staff_id, payment_method, category } = req.query;

    let query = db('sales as s')
      .join('users as u', 's.staff_id', 'u.id')
      .leftJoin('customers as c', 's.customer_id', 'c.id');

    if (start_date) query = query.whereRaw('DATE(s.created_at) >= DATE(?)', [start_date]);
    if (end_date) query = query.whereRaw('DATE(s.created_at) <= DATE(?)', [end_date]);
    if (staff_id) query = query.where('s.staff_id', staff_id);
    if (payment_method && payment_method !== 'All') query = query.where('s.payment_method', payment_method.toUpperCase());

    const salesList = await query.select(
      's.id', 's.receipt_no', 's.customer_name', 's.customer_phone',
      's.subtotal', 's.discount_amount', 's.total_amount', 's.payment_method',
      's.payment_status', 's.created_at', 'u.name as cashier_name'
    ).orderBy('s.id', 'desc').limit(200);

    const saleIds = salesList.map(s => s.id);
    let itemsMap = {};
    if (saleIds.length > 0) {
      const items = await db('sale_items')
        .whereIn('sale_id', saleIds)
        .select('sale_id', 'product_name', 'sku', 'unit', 'quantity', 'selling_price as unit_price', 'total_price');
      items.forEach(it => {
        if (!itemsMap[it.sale_id]) itemsMap[it.sale_id] = [];
        itemsMap[it.sale_id].push(it);
      });
    }

    const salesWithItems = salesList.map(s => ({
      ...s,
      subtotal: parseFloat(s.subtotal),
      discount_amount: parseFloat(s.discount_amount),
      total_amount: parseFloat(s.total_amount),
      items: itemsMap[s.id] || []
    }));

    const totalRevenue = salesWithItems.reduce((acc, s) => acc + s.total_amount, 0);
    const totalDiscounts = salesWithItems.reduce((acc, s) => acc + s.discount_amount, 0);

    return ApiResponse.success(res, {
      filter: { start_date, end_date, staff_id, payment_method },
      summary: {
        total_invoices: salesWithItems.length,
        total_revenue: totalRevenue,
        total_discounts: totalDiscounts
      },
      sales: salesWithItems
    }, 'Printable sales report generated');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reports/staff-activity
 * Detailed employee accountability audit report
 */
router.get('/staff-activity', authenticateToken, requirePermission('reports.staff'), async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    let staffQuery = db('users').select('id', 'name', 'email', 'role', 'job_title', 'staff_code', 'employment_status');

    const staffList = await staffQuery;

    const results = [];
    for (const staff of staffList) {
      let salesQ = db('sales').where('staff_id', staff.id);
      let closingsQ = db('daily_cash_closings').where('staff_id', staff.id);
      let loginsQ = db('login_history').where('user_id', staff.id);

      if (start_date) {
        salesQ = salesQ.whereRaw('DATE(created_at) >= DATE(?)', [start_date]);
        closingsQ = closingsQ.whereRaw('DATE(closing_date) >= DATE(?)', [start_date]);
        loginsQ = loginsQ.whereRaw('DATE(created_at) >= DATE(?)', [start_date]);
      }
      if (end_date) {
        salesQ = salesQ.whereRaw('DATE(created_at) <= DATE(?)', [end_date]);
        closingsQ = closingsQ.whereRaw('DATE(closing_date) <= DATE(?)', [end_date]);
        loginsQ = loginsQ.whereRaw('DATE(created_at) <= DATE(?)', [end_date]);
      }

      const [salesStats, shortages, loginStats] = await Promise.all([
        salesQ.select(
          db.raw('COUNT(id) as sales_count'),
          db.raw('COALESCE(SUM(total_amount), 0) as total_revenue'),
          db.raw('COALESCE(SUM(discount_amount), 0) as total_discounts')
        ).first(),

        closingsQ.select(
          db.raw('COUNT(id) as shifts_closed'),
          db.raw('COALESCE(SUM(CASE WHEN discrepancy < 0 THEN discrepancy ELSE 0 END), 0) as total_shortages')
        ).first(),

        loginsQ.count('id as login_count').first()
      ]);

      results.push({
        staff_id: staff.id,
        staff_code: staff.staff_code || `EMP-${staff.id}`,
        name: staff.name,
        role: staff.role,
        job_title: staff.job_title || staff.role,
        employment_status: staff.employment_status || 'active',
        logins_count: parseInt(loginStats?.login_count) || 0,
        sales_count: parseInt(salesStats?.sales_count) || 0,
        total_revenue: parseFloat(salesStats?.total_revenue) || 0,
        total_discounts_granted: parseFloat(salesStats?.total_discounts) || 0,
        shifts_closed: parseInt(shortages?.shifts_closed) || 0,
        net_cash_shortages: Math.abs(parseFloat(shortages?.total_shortages) || 0)
      });
    }

    return ApiResponse.success(res, results, 'Staff activity report generated');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reports/inventory/analytics
 * Comprehensive inventory valuation, shrinkage, and reorder metrics
 */
router.get('/inventory/analytics', authenticateToken, requirePermission('reports.view'), async (req, res, next) => {
  try {
    const [summary, categoryBreakdown, reorderAlerts, writeOffs] = await Promise.all([
      db('products as p')
        .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
        .where('p.status', 'active')
        .select(
          db.raw('COUNT(DISTINCT p.id) as total_sku_count'),
          db.raw('COALESCE(SUM(ws.quantity), 0) as total_physical_units'),
          db.raw('COALESCE(SUM(ws.quantity * p.cost_price), 0) as total_valuation_cost'),
          db.raw('COALESCE(SUM(ws.quantity * p.selling_price), 0) as total_valuation_retail')
        )
        .first(),

      db('products as p')
        .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
        .where('p.status', 'active')
        .groupBy('p.category')
        .select(
          'p.category',
          db.raw('COUNT(DISTINCT p.id) as sku_count'),
          db.raw('COALESCE(SUM(ws.quantity), 0) as total_units'),
          db.raw('COALESCE(SUM(ws.quantity * p.cost_price), 0) as valuation_at_cost')
        )
        .orderBy('valuation_at_cost', 'desc'),

      db('products as p')
        .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
        .where('p.status', 'active')
        .groupBy('p.id')
        .havingRaw('COALESCE(SUM(ws.quantity), 0) <= p.min_stock_alert')
        .select(
          'p.id', 'p.name as product_name', 'p.sku', 'p.category', 'p.unit',
          'p.min_stock_alert as min_stock', 'p.cost_price',
          db.raw('COALESCE(SUM(ws.quantity), 0) as stock_quantity')
        )
        .orderBy('stock_quantity', 'asc')
        .limit(20),

      db('stock_movements as sm')
        .join('products as p', 'sm.product_id', 'p.id')
        .whereIn('sm.movement_type', ['DAMAGE', 'LOSS'])
        .whereRaw("sm.created_at >= date_trunc('month', CURRENT_DATE)")
        .select(
          db.raw('COUNT(sm.id) as write_off_incidents'),
          db.raw('COALESCE(SUM(sm.quantity), 0) as total_units_lost'),
          db.raw('COALESCE(SUM(sm.quantity * p.cost_price), 0) as total_loss_value')
        )
        .first()
    ]);

    return ApiResponse.success(res, {
      total_products: parseInt(summary?.total_sku_count) || 0,
      total_units_on_hand: parseFloat(summary?.total_physical_units) || 0,
      inventory_valuation: {
        at_cost: parseFloat(summary?.total_valuation_cost) || 0,
        at_retail: parseFloat(summary?.total_valuation_retail) || 0,
        unrealized_gross_profit: (parseFloat(summary?.total_valuation_retail) || 0) - (parseFloat(summary?.total_valuation_cost) || 0)
      },
      category_breakdown: categoryBreakdown.map(c => ({
        category: c.category,
        sku_count: parseInt(c.sku_count),
        total_units: parseFloat(c.total_units),
        valuation_at_cost: parseFloat(c.valuation_at_cost)
      })),
      reorder_alerts: reorderAlerts.map(r => ({
        ...r,
        stock_quantity: parseFloat(r.stock_quantity),
        min_stock: parseFloat(r.min_stock),
        cost_price: parseFloat(r.cost_price)
      })),
      shrinkage_and_loss_this_month: {
        incident_count: parseInt(writeOffs?.write_off_incidents) || 0,
        units_lost: parseFloat(writeOffs?.total_units_lost) || 0,
        financial_loss: parseFloat(writeOffs?.total_loss_value) || 0
      }
    }, 'Inventory analytics report loaded');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reports/profit-loss
 * P&L Breakdown (Restricted to Owner & Super Admin)
 */
router.get('/profit-loss', authenticateToken, requirePermission('finance.profit_view'), async (req, res, next) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear() } = req.query;

    let timeFormat = 'YYYY-MM';
    if (period === 'daily') timeFormat = 'YYYY-MM-DD';
    if (period === 'yearly') timeFormat = 'YYYY';

    const [salesRows, expRows] = await Promise.all([
      db('sales')
        .whereRaw("TO_CHAR(created_at, 'YYYY') = ?", [String(year)])
        .groupByRaw(`TO_CHAR(created_at, '${timeFormat}')`)
        .select(
          db.raw(`TO_CHAR(created_at, '${timeFormat}') as time_key`),
          db.raw('COUNT(*) as total_orders'),
          db.raw('SUM(total_amount) as total_sales'),
          db.raw('SUM(total_cost) as total_cogs')
        )
        .orderBy('time_key', 'asc'),

      db('expenses')
        .where('approval_status', 'approved')
        .whereRaw("TO_CHAR(expense_date, 'YYYY') = ?", [String(year)])
        .groupByRaw(`TO_CHAR(expense_date, '${timeFormat}')`)
        .select(
          db.raw(`TO_CHAR(expense_date, '${timeFormat}') as time_key`),
          db.raw('SUM(amount) as total_expenses')
        )
    ]);

    const expMap = {};
    expRows.forEach(e => { expMap[e.time_key] = parseFloat(e.total_expenses); });

    const breakdown = salesRows.map(s => {
      const sales = parseFloat(s.total_sales) || 0;
      const cogs = parseFloat(s.total_cogs) || 0;
      const expenses = expMap[s.time_key] || 0;
      const gross = sales - cogs;
      const net = gross - expenses;
      const margin = sales > 0 ? ((net / sales) * 100).toFixed(1) : '0.0';

      return {
        period: s.time_key,
        orders: parseInt(s.total_orders),
        sales,
        cost_of_goods: cogs,
        gross_profit: gross,
        expenses,
        net_profit: net,
        margin_pct: margin
      };
    });

    const grandSales = breakdown.reduce((a, b) => a + b.sales, 0);
    const grandCogs = breakdown.reduce((a, b) => a + b.cost_of_goods, 0);
    const grandExp = breakdown.reduce((a, b) => a + b.expenses, 0);
    const grandNet = grandSales - grandCogs - grandExp;

    return ApiResponse.success(res, {
      period,
      year: parseInt(year),
      breakdown,
      summary: {
        total_sales: grandSales,
        total_cogs: grandCogs,
        total_expenses: grandExp,
        net_profit: grandNet,
        net_margin_pct: grandSales > 0 ? ((grandNet / grandSales) * 100).toFixed(1) : '0.0'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reports/export
 * JSON export of records
 */
router.get('/export', authenticateToken, requirePermission('reports.export'), async (req, res, next) => {
  try {
    const { type = 'sales', start_date, end_date } = req.query;

    if (type === 'profit_loss' || type === 'financial') {
      const canViewProfit = await checkUserPermission(req.user, 'finance.profit_view');
      if (!canViewProfit) {
        return ApiResponse.error(res, 'Permission denied: Profit and loss export requires financial authority.', 403, 'FORBIDDEN');
      }
    }

    let exportData = [];
    if (type === 'sales') {
      let q = db('sales as s').join('users as u', 's.staff_id', 'u.id');
      if (start_date) q = q.whereRaw('DATE(s.created_at) >= DATE(?)', [start_date]);
      if (end_date) q = q.whereRaw('DATE(s.created_at) <= DATE(?)', [end_date]);

      const selectCols = [
        's.receipt_no', 's.created_at', 's.customer_name', 's.payment_method',
        's.total_amount', 'u.name as cashier_name'
      ];

      const canViewCosts = await checkUserPermission(req.user, 'sales.view_costs');
      if (canViewCosts) {
        selectCols.push('s.total_cost');
      }

      exportData = await q.select(selectCols).orderBy('s.id', 'desc').limit(1000);
    } else if (type === 'inventory') {
      exportData = await db('products as p')
        .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
        .where('p.status', 'active')
        .groupBy('p.id')
        .select(
          'p.sku',
          'p.name as product_name',
          'p.category',
          'p.unit',
          db.raw('COALESCE(SUM(ws.quantity), 0) as stock_quantity'),
          'p.min_stock_alert as min_stock',
          'p.selling_price'
        )
        .orderBy('p.name', 'asc');
    }

    await logAudit(req.user.id, req.user.name, req.user.role, 'REPORT_EXPORTED', `Exported ${type} report (${exportData.length} records)`);

    return ApiResponse.success(res, {
      report_type: type,
      row_count: exportData.length,
      data: exportData
    }, 'Report export generated');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reports/export/csv
 * Standard CSV download endpoint
 */
router.get('/export/csv', authenticateToken, requirePermission('reports.export'), async (req, res, next) => {
  try {
    const { type = 'sales', start_date, end_date } = req.query;

    let rows = [];
    let headers = [];

    if (type === 'sales') {
      let q = db('sales as s').join('users as u', 's.staff_id', 'u.id');
      if (start_date) q = q.whereRaw('DATE(s.created_at) >= DATE(?)', [start_date]);
      if (end_date) q = q.whereRaw('DATE(s.created_at) <= DATE(?)', [end_date]);

      rows = await q.select('s.receipt_no', 's.created_at', 's.customer_name', 's.payment_method', 's.total_amount', 'u.name as cashier_name').orderBy('s.id', 'desc');
      headers = ['Receipt No', 'Date', 'Customer', 'Payment Method', 'Total Amount (GHc)', 'Cashier'];
    } else if (type === 'inventory') {
      rows = await db('products as p')
        .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
        .where('p.status', 'active')
        .groupBy('p.id')
        .select(
          'p.sku',
          'p.name as product_name',
          'p.category',
          'p.unit',
          db.raw('COALESCE(SUM(ws.quantity), 0) as stock_quantity'),
          'p.selling_price'
        )
        .orderBy('p.name', 'asc');
      headers = ['SKU', 'Product Name', 'Category', 'Unit', 'Stock On Hand', 'Selling Price (GHc)'];
    }

    const csvLines = [headers.join(',')];
    for (const r of rows) {
      const vals = Object.values(r).map(v => `"${String(v || '').replace(/"/g, '""')}"`);
      csvLines.push(vals.join(','));
    }

    const csvContent = csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse } = require('../../common/response');
const { authenticateToken, requirePermission } = require('../../middleware/auth');

// GET /api/v1/notifications/alerts
router.get('/alerts', authenticateToken, async (req, res, next) => {
  try {
    const [lowStock, recentDiscrepancies, recentSales] = await Promise.all([
      db('products as p')
        .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
        .groupBy('p.id')
        .havingRaw('COALESCE(SUM(ws.quantity), 0) <= p.min_stock_alert')
        .select('p.id', 'p.name', 'p.sku', 'p.min_stock_alert', db.raw('COALESCE(SUM(ws.quantity), 0) as current_stock'))
        .limit(10),

      db('daily_cash_closings as dcc')
        .join('users as u', 'dcc.staff_id', 'u.id')
        .where('dcc.discrepancy', '<', 0)
        .select('dcc.*', 'u.name as staff_name')
        .orderBy('dcc.id', 'desc')
        .limit(5),

      db('sales as s')
        .join('users as u', 's.staff_id', 'u.id')
        .select('s.id', 's.receipt_no', 's.customer_name', 's.total_amount', 's.payment_method', 's.created_at', 'u.name as staff_name')
        .orderBy('s.id', 'desc')
        .limit(10)
    ]);

    return ApiResponse.success(res, {
      low_stock_alerts: lowStock.map(i => ({
        type: 'LOW_STOCK',
        title: `Low Stock: ${i.name}`,
        message: `Current stock (${parseFloat(i.current_stock)}) is below alert threshold (${i.min_stock_alert})`,
        data: i
      })),
      discrepancy_alerts: recentDiscrepancies.map(d => ({
        type: 'CASH_DISCREPANCY',
        title: `Cash Shortage: ${d.staff_name}`,
        message: `Declared GH₵ ${parseFloat(d.physical_cash).toFixed(2)}, expected GH₵ ${parseFloat(d.expected_cash).toFixed(2)} (Shortage: GH₵ ${Math.abs(parseFloat(d.discrepancy)).toFixed(2)})`,
        data: d
      })),
      recent_sales: recentSales
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/notifications/security (Suspicious Login & Security Alerts - Task 1 & 2)
router.get('/security', authenticateToken, requirePermission('audit.view'), async (req, res, next) => {
  try {
    const alerts = await db('security_notifications as sn')
      .leftJoin('users as u', 'sn.user_id', 'u.id')
      .select('sn.*', 'u.name as user_name', 'u.email as user_email')
      .orderBy('sn.id', 'desc')
      .limit(50);

    return ApiResponse.success(res, alerts, 'Security notifications retrieved');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

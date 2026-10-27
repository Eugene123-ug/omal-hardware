const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse } = require('../../common/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');

/**
 * GET /api/v1/security/alerts
 * Automated threat and anomaly detection engine
 * Scans login attempts, cash shortages, discounts, refunds, and sensitive movements
 */
router.get('/alerts', authenticateToken, requireRole('super_admin', 'admin'), async (req, res, next) => {
  try {
    const alerts = [];

    // 1. Account Lockouts & Repeated Failed Logins
    const lockedUsers = await db('users')
      .where('locked_until', '>', new Date())
      .orWhere('failed_login_attempts', '>=', 3)
      .select('id', 'name', 'email', 'role', 'failed_login_attempts', 'locked_until');

    for (const u of lockedUsers) {
      alerts.push({
        id: `lockout-${u.id}`,
        category: 'AUTHENTICATION_THREAT',
        severity: u.locked_until && new Date(u.locked_until) > new Date() ? 'HIGH' : 'MEDIUM',
        title: `Repeated Failed Logins / Account Locked: ${u.name}`,
        details: `Account ${u.email} (${u.role}) has ${u.failed_login_attempts} failed login attempts. Locked until: ${u.locked_until || 'N/A'}.`,
        timestamp: new Date().toISOString()
      });
    }

    // 2. Cash Discrepancies (Shortages > GH₵ 20)
    const recentShortages = await db('daily_cash_closings as dcc')
      .join('users as u', 'dcc.staff_id', 'u.id')
      .where('dcc.discrepancy', '<', -20)
      .select('dcc.id', 'dcc.closing_date', 'dcc.discrepancy', 'dcc.explanation', 'u.name as staff_name')
      .orderBy('dcc.id', 'desc')
      .limit(10);

    for (const s of recentShortages) {
      alerts.push({
        id: `shortage-${s.id}`,
        category: 'CASH_SHORTAGE',
        severity: Math.abs(parseFloat(s.discrepancy)) > 100 ? 'HIGH' : 'MEDIUM',
        title: `Cash Register Shortage of GH₵ ${Math.abs(parseFloat(s.discrepancy)).toFixed(2)}`,
        details: `Cashier ${s.staff_name} closed shift #${s.id} on ${s.closing_date} with a deficit. Explanation: "${s.explanation || 'None provided'}"`,
        timestamp: s.closing_date
      });
    }

    // 3. High Discounts (Discounts > 2% on sales)
    const highDiscounts = await db('sales as s')
      .join('users as u', 's.staff_id', 'u.id')
      .leftJoin('users as app', 's.discount_approved_by', 'app.id')
      .where('s.discount_percent', '>', 2.0)
      .select('s.id', 's.receipt_no', 's.discount_percent', 's.discount_amount', 's.total_amount', 'u.name as cashier_name', 'app.name as approved_by_name', 's.created_at')
      .orderBy('s.id', 'desc')
      .limit(10);

    for (const d of highDiscounts) {
      alerts.push({
        id: `discount-${d.id}`,
        category: 'HIGH_DISCOUNT',
        severity: parseFloat(d.discount_percent) > 5.0 ? 'HIGH' : 'LOW',
        title: `High Discount Applied: ${d.discount_percent}% (GH₵ ${parseFloat(d.discount_amount).toFixed(2)})`,
        details: `Invoice ${d.receipt_no} by ${d.cashier_name}. Approved by: ${d.approved_by_name || 'System Override'}.`,
        timestamp: d.created_at
      });
    }

    // 4. Large Refunds (> GH₵ 200)
    const largeRefunds = await db('refunds as r')
      .join('sales as s', 'r.sale_id', 's.id')
      .join('users as u', 'r.staff_id', 'u.id')
      .where('r.refund_amount', '>', 200)
      .select('r.id', 'r.refund_no', 'r.refund_amount', 'r.reason', 's.receipt_no', 'u.name as staff_name', 'r.created_at')
      .orderBy('r.id', 'desc')
      .limit(10);

    for (const r of largeRefunds) {
      alerts.push({
        id: `refund-${r.id}`,
        category: 'LARGE_REFUND',
        severity: 'MEDIUM',
        title: `Large Refund Processed: GH₵ ${parseFloat(r.refund_amount).toFixed(2)}`,
        details: `Refund ${r.refund_no} against ${r.receipt_no} by ${r.staff_name}. Reason: ${r.reason}`,
        timestamp: r.created_at
      });
    }

    // 5. Stock Loss / Damage adjustments in last 14 days
    const stockLosses = await db('stock_movements as sm')
      .join('products as p', 'sm.product_id', 'p.id')
      .leftJoin('users as u', 'sm.created_by_id', 'u.id')
      .whereIn('sm.movement_type', ['DAMAGE', 'LOSS'])
      .whereRaw('sm.created_at >= NOW() - INTERVAL \'14 days\'')
      .select('sm.id', 'p.name as product_name', 'sm.movement_type', 'sm.quantity', 'sm.reason as notes', 'u.name as staff_name', 'sm.created_at')
      .orderBy('sm.id', 'desc')
      .limit(10);

    for (const sl of stockLosses) {
      alerts.push({
        id: `stock-loss-${sl.id}`,
        category: 'STOCK_SHRINKAGE',
        severity: 'MEDIUM',
        title: `Inventory Write-Off: ${sl.quantity} units of "${sl.product_name}" (${sl.movement_type})`,
        details: `Logged by ${sl.staff_name || 'System'}. Reason: ${sl.notes || 'No notes'}`,
        timestamp: sl.created_at
      });
    }

    return ApiResponse.success(res, {
      total_alerts: alerts.length,
      high_severity_count: alerts.filter(a => a.severity === 'HIGH').length,
      alerts
    }, 'Security alerts and operational anomaly scan completed');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

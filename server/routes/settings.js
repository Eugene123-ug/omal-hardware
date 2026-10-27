const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { ApiResponse } = require('../common/response');
const { authenticateToken, requireRole, requirePermission, logAudit } = require('../middleware/auth');

// GET /api/settings
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const rows = await db('settings').select('*');
    const settingsObj = {};
    rows.forEach(r => { settingsObj[r.key] = r.value; });
    return ApiResponse.success(res, settingsObj);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings (Admin & Super Admin)
router.put('/', authenticateToken, requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const settingsData = req.body;

    await db.transaction(async (trx) => {
      for (const [k, v] of Object.entries(settingsData)) {
        const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
        await trx.raw(
          `INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [k, valStr]
        );
      }
    });

    await logAudit(req.user.id, req.user.name, req.user.role, 'SETTINGS_UPDATED', 'Updated store configuration settings');

    return ApiResponse.success(res, null, 'Settings saved successfully');
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/backup/export-json (Super Admin Only)
router.get('/backup/export-json', authenticateToken, requireRole('super_admin'), async (req, res, next) => {
  try {
    const tables = [
      'users', 'permissions', 'role_permissions', 'products', 'warehouse_stock',
      'stock_movements', 'customers', 'suppliers', 'purchase_orders',
      'goods_received_notes', 'sales', 'sale_items', 'customer_payments',
      'expenses', 'daily_cash_closings', 'audit_logs', 'price_change_logs', 'settings'
    ];

    const dump = {
      exported_at: new Date().toISOString(),
      exported_by: req.user.name,
      version: '1.0.0',
      database: 'PostgreSQL',
      data: {}
    };

    for (const t of tables) {
      dump.data[t] = await db(t).select('*');
    }

    await logAudit(req.user.id, req.user.name, req.user.role, 'DATA_EXPORT', 'Full PostgreSQL JSON backup exported for cloud sync');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=omal_pg_backup_${Date.now()}.json`);
    res.send(JSON.stringify(dump, null, 2));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

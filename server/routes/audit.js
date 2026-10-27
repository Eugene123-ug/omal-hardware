const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { ApiResponse, parsePagination } = require('../common/response');
const { authenticateToken, requireRole, requirePermission, logAudit } = require('../middleware/auth');

// GET /api/v1/audit/logs
router.get('/logs', authenticateToken, requirePermission('audit.view'), async (req, res, next) => {
  try {
    const { action, user_id, affected_table, start_date, end_date } = req.query;
    const { page, limit, offset } = parsePagination(req.query, 100);

    let query = db('audit_logs');
    if (action && action !== 'All') {
      query = query.where({ action });
    }
    if (user_id) {
      query = query.where({ user_id: parseInt(user_id) });
    }
    if (affected_table) {
      query = query.where({ affected_table });
    }
    if (start_date) {
      query = query.whereRaw('DATE(created_at) >= DATE(?)', [start_date]);
    }
    if (end_date) {
      query = query.whereRaw('DATE(created_at) <= DATE(?)', [end_date]);
    }

    const [totalRes, logs] = await Promise.all([
      query.clone().count('id as total').first(),
      query.clone().orderBy('id', 'desc').limit(limit).offset(offset)
    ]);

    return ApiResponse.paginated(res, logs, parseInt(totalRes.total), page, limit, 'Audit logs retrieved');
  } catch (err) {
    next(err);
  }
});

// Protect Immutability: Block individual audit log update or deletion
router.put('/logs/:id', authenticateToken, async (req, res) => {
  return ApiResponse.error(res, 'Audit trail integrity violation: Audit records are strictly append-only and immutable.', 403, 'FORBIDDEN_AUDIT_MODIFICATION');
});

router.delete('/logs/:id', authenticateToken, async (req, res) => {
  return ApiResponse.error(res, 'Audit trail integrity violation: Individual audit records cannot be deleted.', 403, 'FORBIDDEN_AUDIT_DELETION');
});

// GET /api/v1/audit/price-changes
router.get('/price-changes', authenticateToken, requirePermission('audit.view'), async (req, res, next) => {
  try {
    const changes = await db('price_change_logs as pcl')
      .leftJoin('users as u', 'pcl.changed_by_id', 'u.id')
      .leftJoin('users as app', 'pcl.approved_by_id', 'app.id')
      .select('pcl.*', 'u.name as changed_by_name', 'app.name as approved_by_name')
      .orderBy('pcl.id', 'desc')
      .limit(100);

    return ApiResponse.success(res, changes);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/audit/receipt-integrity-check (Unbroken Sequence Gap Checker)
router.get('/receipt-integrity-check', authenticateToken, requireRole('super_admin'), async (req, res, next) => {
  try {
    const sales = await db('sales').select('id', 'receipt_no', 'total_amount', 'created_at').orderBy('id', 'asc');

    const missingNumbers = [];
    let prevNumber = null;
    let prevDate = null;

    for (const s of sales) {
      if (s.receipt_no && s.receipt_no.startsWith('REC-')) {
        const parts = s.receipt_no.split('-');
        if (parts.length === 3) {
          const datePart = parts[1];
          const numPart = parseInt(parts[2]);

          if (prevDate === datePart && prevNumber !== null) {
            if (numPart > prevNumber + 1) {
              for (let missing = prevNumber + 1; missing < numPart; missing++) {
                missingNumbers.push(`REC-${datePart}-${String(missing).padStart(4, '0')}`);
              }
            }
          }
          prevDate = datePart;
          prevNumber = numPart;
        }
      }
    }

    return ApiResponse.success(res, {
      total_sales_checked: sales.length,
      intact: missingNumbers.length === 0,
      missing_receipt_gaps: missingNumbers,
      status: missingNumbers.length === 0 ? 'All receipts sequential without gaps' : 'ALERT: Gaps detected in receipt sequence!'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/audit/logs/purge (Super Admin Only with explicit permission)
router.delete('/logs/purge', authenticateToken, requireRole('super_admin'), requirePermission('audit.purge'), async (req, res, next) => {
  try {
    const { older_than_days = 90 } = req.body;
    const cutoffDate = new Date(Date.now() - older_than_days * 24 * 60 * 60 * 1000);

    const deletedCount = await db('audit_logs').where('created_at', '<', cutoffDate).del();

    await logAudit(req.user.id, req.user.name, req.user.role, 'LOGS_PURGED', `Purged ${deletedCount} audit log records older than ${older_than_days} days`);

    return ApiResponse.success(res, { purged_count: deletedCount }, `Purged ${deletedCount} audit log records`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

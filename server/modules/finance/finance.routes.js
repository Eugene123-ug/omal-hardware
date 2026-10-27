const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../../database/db');
const { ApiResponse, parsePagination } = require('../../common/response');
const { authenticateToken, requirePermission, logAudit } = require('../../middleware/auth');

// Configurable expense approval limit (GH₵ 500.00)
const EXPENSE_APPROVAL_THRESHOLD = 500.00;

// ==========================================
// 1. CASHIER SHIFT MANAGEMENT
// ==========================================

/**
 * GET /api/v1/finance/shifts/current
 * Returns the active open shift for the current cashier (or specified staff member)
 */
router.get('/shifts/current', authenticateToken, requirePermission('finance.cash_closing'), async (req, res, next) => {
  try {
    const staffId = req.user.role === 'sales' ? req.user.id : (req.query.staff_id || req.user.id);
    const today = new Date().toISOString().slice(0, 10);

    // Find any open shift for this user
    let shift = await db('daily_cash_closings as dcc')
      .join('users as u', 'dcc.staff_id', 'u.id')
      .where('dcc.staff_id', staffId)
      .where('dcc.shift_status', 'open')
      .select('dcc.*', 'u.name as staff_name', 'u.role as staff_role')
      .first();

    if (!shift) {
      return ApiResponse.success(res, {
        has_active_shift: false,
        shift: null,
        message: 'No open shift found. Please open a shift with an initial cash float.'
      });
    }

    const openedAt = shift.opened_at || shift.created_at;

    // Calculate cash sales recorded during this shift
    const cashSalesRes = await db('sales')
      .where('staff_id', staffId)
      .where('created_at', '>=', openedAt)
      .where('payment_method', 'CASH')
      .sum('total_amount as total')
      .first();
    const cashSales = parseFloat(cashSalesRes?.total) || 0;

    // Calculate MoMo, Bank, Credit sales during this shift
    const otherSalesRes = await db('sales')
      .where('staff_id', staffId)
      .where('created_at', '>=', openedAt)
      .select(
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_sales"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'BANK' THEN total_amount ELSE 0 END), 0) as bank_sales"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_sales"),
        db.raw("COALESCE(SUM(total_amount), 0) as total_sales")
      ).first();

    // Calculate cash collections (debt payments collected in cash during this shift)
    const collectionsRes = await db('customer_payments')
      .where('received_by_id', staffId)
      .where('created_at', '>=', openedAt)
      .where('payment_method', 'CASH')
      .sum('amount as total')
      .first();
    const cashCollections = parseFloat(collectionsRes?.total) || 0;

    // Calculate intra-shift cash movements
    const movements = await db('cash_movements as cm')
      .leftJoin('users as u', 'cm.authorized_by_id', 'u.id')
      .where('cm.closing_id', shift.id)
      .select('cm.*', 'u.name as authorized_by_name')
      .orderBy('cm.id', 'asc');

    let floatIn = 0;
    let cashDrops = 0;
    let payOuts = 0;

    for (const m of movements) {
      const amt = parseFloat(m.amount) || 0;
      if (m.movement_type === 'FLOAT_IN' && m.reason !== 'Initial Shift Opening Float') floatIn += amt;
      else if (m.movement_type === 'CASH_DROP') cashDrops += amt;
      else if (m.movement_type === 'PAY_OUT') payOuts += amt;
    }

    // Cash refunds issued during shift
    const refundsRes = await db('refunds')
      .where('staff_id', staffId)
      .where('created_at', '>=', openedAt)
      .sum('refund_amount as total')
      .first();
    const cashRefunds = parseFloat(refundsRes?.total) || 0;

    const openingCash = parseFloat(shift.opening_cash) || 0;
    // Expected Cash Formula:
    // Expected Cash = Opening Float + Cash Sales + Cash Collections + Float In - Cash Refunds - Cash Drops - Pay Outs
    const expectedCash = openingCash + cashSales + cashCollections + floatIn - cashRefunds - cashDrops - payOuts;

    return ApiResponse.success(res, {
      has_active_shift: true,
      shift: {
        ...shift,
        opening_cash: openingCash,
        cash_sales: cashSales,
        momo_sales: parseFloat(otherSalesRes?.momo_sales) || 0,
        bank_sales: parseFloat(otherSalesRes?.bank_sales) || 0,
        credit_sales: parseFloat(otherSalesRes?.credit_sales) || 0,
        total_sales: parseFloat(otherSalesRes?.total_sales) || 0,
        cash_collections: cashCollections,
        cash_refunds: cashRefunds,
        float_in: floatIn,
        cash_drops: cashDrops + payOuts,
        expected_cash: expectedCash,
        movements
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/finance/shifts/open
 * Opens a cashier shift with a declared opening cash float
 */
router.post('/shifts/open', authenticateToken, requirePermission('finance.cash_closing'), async (req, res, next) => {
  try {
    const { opening_cash = 0, notes = '' } = req.body;
    const floatAmount = parseFloat(opening_cash) || 0;
    const staffId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    if (floatAmount < 0) {
      return ApiResponse.error(res, 'Opening cash float cannot be negative.', 400, 'BAD_REQUEST');
    }

    // Check if staff already has an open shift
    const existingOpen = await db('daily_cash_closings')
      .where({ staff_id: staffId, shift_status: 'open' })
      .first();

    if (existingOpen) {
      return ApiResponse.error(
        res,
        `You already have an active open shift (Shift #${existingOpen.id}). Close it before opening a new shift.`,
        409,
        'SHIFT_ALREADY_OPEN'
      );
    }

    const [newShift] = await db('daily_cash_closings').insert({
      closing_date: today,
      staff_id: staffId,
      shift_status: 'open',
      opening_cash: floatAmount,
      cash_sales: 0,
      momo_sales: 0,
      bank_sales: 0,
      credit_sales: 0,
      cash_refunds: 0,
      cash_collections: 0,
      cash_drops: 0,
      expected_cash: floatAmount,
      physical_cash: 0,
      discrepancy: 0,
      opened_at: new Date(),
      notes: notes.trim()
    }).returning('*');

    // Record opening float movement
    if (floatAmount > 0) {
      await db('cash_movements').insert({
        closing_id: newShift.id,
        staff_id: staffId,
        authorized_by_id: req.user.id,
        movement_type: 'FLOAT_IN',
        amount: floatAmount,
        reason: 'Initial Shift Opening Float'
      });
    }

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'SHIFT_OPENED',
      `Opened shift #${newShift.id} with opening float of GH₵ ${floatAmount.toFixed(2)}`
    );

    return ApiResponse.success(res, newShift, `Shift opened successfully with GH₵ ${floatAmount.toFixed(2)} float`, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/finance/shifts/movement
 * Records an authorized intra-shift cash movement (FLOAT_IN, CASH_DROP, PAY_OUT)
 */
router.post('/shifts/movement', authenticateToken, requirePermission('finance.cash_closing'), async (req, res, next) => {
  try {
    const { shift_id, movement_type, amount, reason, supervisor_pin } = req.body;
    const moveAmount = parseFloat(amount);

    if (!shift_id || !movement_type || isNaN(moveAmount) || moveAmount <= 0 || !reason) {
      return ApiResponse.error(res, 'Valid shift_id, movement_type, amount (> 0), and reason are required', 400, 'BAD_REQUEST');
    }

    if (!['FLOAT_IN', 'CASH_DROP', 'PAY_OUT'].includes(movement_type)) {
      return ApiResponse.error(res, 'Invalid movement_type. Allowed: FLOAT_IN, CASH_DROP, PAY_OUT', 400, 'BAD_REQUEST');
    }

    const shift = await db('daily_cash_closings').where({ id: shift_id, shift_status: 'open' }).first();
    if (!shift) {
      return ApiResponse.error(res, 'Active open shift not found for this ID', 404, 'NOT_FOUND');
    }

    // Verify supervisor authorization for cash drops or petty payouts if logged by cashier
    let authorizedById = req.user.id;
    if (req.user.role === 'sales') {
      if (!supervisor_pin) {
        return ApiResponse.error(res, 'Supervisor or Admin PIN required to authorize cash drops or petty pay-outs.', 403, 'SUPERVISOR_PIN_REQUIRED');
      }
      const supervisor = await db('users')
        .whereIn('role', ['super_admin', 'admin'])
        .where({ admin_pin: supervisor_pin.trim(), status: 'active' })
        .first();
      if (!supervisor) {
        return ApiResponse.error(res, 'Invalid supervisor PIN for cash movement authorization.', 403, 'INVALID_SUPERVISOR_PIN');
      }
      authorizedById = supervisor.id;
    }

    const [movement] = await db('cash_movements').insert({
      closing_id: shift.id,
      staff_id: req.user.id,
      authorized_by_id: authorizedById,
      movement_type,
      amount: moveAmount,
      reason: reason.trim()
    }).returning('*');

    // Update shift cash_drops field if drop or payout
    if (movement_type === 'CASH_DROP' || movement_type === 'PAY_OUT') {
      await db('daily_cash_closings')
        .where({ id: shift.id })
        .increment('cash_drops', moveAmount);
    }

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'CASH_MOVEMENT',
      `${movement_type} of GH₵ ${moveAmount.toFixed(2)} on shift #${shift.id}: ${reason}`
    );

    return ApiResponse.success(res, movement, `Cash movement ${movement_type} of GH₵ ${moveAmount.toFixed(2)} recorded`, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/finance/cash-register/close
 * Closes the active shift, calculates expected vs physical cash, enforces explanation if discrepancy exists
 */
router.post('/cash-register/close', authenticateToken, requirePermission('finance.cash_closing'), async (req, res, next) => {
  try {
    const { shift_id, physical_cash, notes = '', explanation = '' } = req.body;
    const physical = parseFloat(physical_cash);

    if (isNaN(physical) || physical < 0) {
      return ApiResponse.error(res, 'Valid non-negative physical cash amount required', 400, 'BAD_REQUEST');
    }

    const staffId = req.user.id;
    let shiftQuery = db('daily_cash_closings').where({ staff_id: staffId, shift_status: 'open' });
    if (shift_id) {
      shiftQuery = db('daily_cash_closings').where({ id: shift_id });
    }
    const shift = await shiftQuery.first();

    if (!shift) {
      return ApiResponse.error(res, 'No active open shift found to close.', 404, 'NOT_FOUND');
    }

    const openedAt = shift.opened_at || shift.created_at;

    // Calculate sales during shift
    const salesData = await db('sales')
      .where('staff_id', shift.staff_id)
      .where('created_at', '>=', openedAt)
      .select(
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_sales"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'BANK' THEN total_amount ELSE 0 END), 0) as bank_sales"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_sales")
      ).first();

    // Cash collections during shift
    const collectionsRes = await db('customer_payments')
      .where('received_by_id', shift.staff_id)
      .where('created_at', '>=', openedAt)
      .where('payment_method', 'CASH')
      .sum('amount as total')
      .first();
    const cashCollections = parseFloat(collectionsRes?.total) || 0;

    // Intra-shift movements
    const movements = await db('cash_movements').where('closing_id', shift.id);
    let floatIn = 0;
    let cashDrops = 0;
    for (const m of movements) {
      const amt = parseFloat(m.amount) || 0;
      if (m.movement_type === 'FLOAT_IN') floatIn += amt;
      else if (m.movement_type === 'CASH_DROP' || m.movement_type === 'PAY_OUT') cashDrops += amt;
    }

    // Cash refunds
    const refundsRes = await db('refunds')
      .where('staff_id', shift.staff_id)
      .where('created_at', '>=', openedAt)
      .sum('refund_amount as total')
      .first();
    const cashRefunds = parseFloat(refundsRes?.total) || 0;

    const openCash = parseFloat(shift.opening_cash) || 0;
    const cashSales = parseFloat(salesData.cash_sales) || 0;

    // Expected Cash Calculation:
    // Expected Cash = Opening Float + Cash Sales + Cash Collections - Cash Refunds - Cash Drops
    const expectedCash = openCash + cashSales + cashCollections - cashRefunds - cashDrops;
    const discrepancy = physical - expectedCash;

    // Requirement: Cash shortage or surplus requires explanation
    if (Math.abs(discrepancy) >= 1.00 && (!explanation || !explanation.trim())) {
      return ApiResponse.error(
        res,
        `Cash discrepancy of GH₵ ${discrepancy.toFixed(2)} detected. An explanation is mandatory to submit closing.`,
        400,
        'DISCREPANCY_EXPLANATION_REQUIRED'
      );
    }

    await db('daily_cash_closings').where({ id: shift.id }).update({
      shift_status: 'closed',
      closed_at: new Date(),
      cash_sales: cashSales,
      momo_sales: parseFloat(salesData.momo_sales) || 0,
      bank_sales: parseFloat(salesData.bank_sales) || 0,
      credit_sales: parseFloat(salesData.credit_sales) || 0,
      cash_collections: cashCollections,
      cash_refunds: cashRefunds,
      cash_drops: cashDrops,
      expected_cash: expectedCash,
      physical_cash: physical,
      discrepancy,
      explanation: explanation ? explanation.trim() : null,
      notes: notes ? notes.trim() : ''
    });

    const isShortage = discrepancy < -0.01;
    const isSurplus = discrepancy > 0.01;
    const logDetails = isShortage
      ? `SHORTAGE ALERT: Expected GH₵ ${expectedCash.toFixed(2)}, Declared GH₵ ${physical.toFixed(2)} (Deficit: GH₵ ${Math.abs(discrepancy).toFixed(2)}). Explanation: "${explanation}"`
      : isSurplus
      ? `SURPLUS NOTE: Expected GH₵ ${expectedCash.toFixed(2)}, Declared GH₵ ${physical.toFixed(2)} (Excess: GH₵ ${discrepancy.toFixed(2)}). Explanation: "${explanation}"`
      : `Shift #${shift.id} balanced: Expected GH₵ ${expectedCash.toFixed(2)}, Declared GH₵ ${physical.toFixed(2)}.`;

    await logAudit(req.user.id, req.user.name, req.user.role, 'CASH_CLOSING', logDetails);

    return ApiResponse.success(res, {
      shift_id: shift.id,
      opening_cash: openCash,
      cash_sales: cashSales,
      cash_collections: cashCollections,
      cash_refunds: cashRefunds,
      cash_drops: cashDrops,
      expected_cash: expectedCash,
      physical_cash: physical,
      discrepancy,
      has_shortage: isShortage,
      has_surplus: isSurplus,
      explanation
    }, isShortage ? `Shift closed with SHORTAGE of GH₵ ${Math.abs(discrepancy).toFixed(2)}` : 'Shift closed successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/finance/shifts/:id/reconcile
 * Authorised supervisor or accountant marks a closed shift as reconciled
 */
router.post('/shifts/:id/reconcile', authenticateToken, requirePermission('finance.reconcile'), async (req, res, next) => {
  try {
    const shiftId = parseInt(req.params.id);
    const { notes } = req.body;

    const shift = await db('daily_cash_closings').where({ id: shiftId }).first();
    if (!shift) {
      return ApiResponse.error(res, 'Shift record not found', 404, 'NOT_FOUND');
    }

    if (shift.shift_status !== 'closed') {
      return ApiResponse.error(res, 'Only closed shifts can be reconciled', 400, 'BAD_REQUEST');
    }

    await db('daily_cash_closings').where({ id: shiftId }).update({
      shift_status: 'reconciled',
      reconciled_by_id: req.user.id,
      notes: notes ? `${shift.notes || ''} [Reconciled: ${notes}]` : shift.notes
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'SHIFT_RECONCILED',
      `Reconciled shift #${shiftId} for staff ID ${shift.staff_id}`
    );

    return ApiResponse.success(res, { shift_id: shiftId, shift_status: 'reconciled' }, 'Shift reconciled successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/finance/cash-register/history
 * Lists historical shift closures with filters
 */
router.get('/cash-register/history', authenticateToken, requirePermission('finance.view'), async (req, res, next) => {
  try {
    const { start_date, end_date, staff_id, shift_status } = req.query;
    let query = db('daily_cash_closings as dcc')
      .join('users as u', 'dcc.staff_id', 'u.id')
      .leftJoin('users as rec', 'dcc.reconciled_by_id', 'rec.id')
      .select('dcc.*', 'u.name as staff_name', 'u.role as staff_role', 'rec.name as reconciled_by_name');

    if (start_date) query = query.whereRaw('DATE(dcc.closing_date) >= DATE(?)', [start_date]);
    if (end_date) query = query.whereRaw('DATE(dcc.closing_date) <= DATE(?)', [end_date]);
    if (staff_id) query = query.where('dcc.staff_id', staff_id);
    if (shift_status) query = query.where('dcc.shift_status', shift_status);

    const closings = await query.orderBy('dcc.id', 'desc').limit(100);
    return ApiResponse.success(res, closings);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/finance/cash-register/today
 * Backward-compatible endpoint for today's summary
 */
router.get('/cash-register/today', authenticateToken, requirePermission('finance.cash_closing'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const staffId = req.user.role === 'sales' ? req.user.id : (req.query.staff_id || req.user.id);

    let salesQuery = db('sales').whereRaw('DATE(created_at) = DATE(?)', [today]);
    if (req.user.role === 'sales') {
      salesQuery = salesQuery.where({ staff_id: staffId });
    }

    const salesData = await salesQuery.select(
      db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales"),
      db.raw("COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_sales"),
      db.raw("COALESCE(SUM(CASE WHEN payment_method = 'BANK' THEN total_amount ELSE 0 END), 0) as bank_sales"),
      db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_sales"),
      db.raw('COALESCE(SUM(total_amount), 0) as total_sales')
    ).first();

    const existingClosing = await db('daily_cash_closings as dcc')
      .join('users as u', 'dcc.staff_id', 'u.id')
      .whereRaw('DATE(dcc.closing_date) = DATE(?)', [today])
      .where('dcc.staff_id', staffId)
      .select('dcc.*', 'u.name as staff_name')
      .first();

    const openingCash = existingClosing ? parseFloat(existingClosing.opening_cash) : 500.00;
    const cashSales = parseFloat(salesData.cash_sales) || 0;
    const expectedCash = openingCash + cashSales;

    return ApiResponse.success(res, {
      date: today,
      opening_cash: openingCash,
      cash_sales: cashSales,
      momo_sales: parseFloat(salesData.momo_sales) || 0,
      bank_sales: parseFloat(salesData.bank_sales) || 0,
      credit_sales: parseFloat(salesData.credit_sales) || 0,
      total_sales: parseFloat(salesData.total_sales) || 0,
      cash_expenses: 0,
      expected_cash: expectedCash,
      existing_closing: existingClosing || null
    });
  } catch (err) {
    next(err);
  }
});


// ==========================================
// 2. MULTI-CHANNEL PAYMENT LEDGER & RECONCILIATION
// ==========================================

/**
 * GET /api/v1/finance/payments
 * Unified multi-channel payment transaction records (POS sales, credit collections, supplier payments)
 */
router.get('/payments', authenticateToken, requirePermission('finance.view'), async (req, res, next) => {
  try {
    const { payment_method, verification_status, start_date, end_date, search } = req.query;

    let query = db('sale_payments as sp')
      .join('sales as s', 'sp.sale_id', 's.id')
      .leftJoin('users as rec', 'sp.recorded_by_id', 'rec.id')
      .leftJoin('users as ver', 'sp.verified_by_id', 'ver.id')
      .select(
        'sp.id',
        'sp.sale_id',
        's.receipt_no',
        'sp.payment_method',
        'sp.amount',
        'sp.reference_no',
        'sp.momo_network',
        'sp.verification_status',
        'sp.is_verified',
        'sp.created_at',
        'rec.name as recorded_by_name',
        'ver.name as verified_by_name',
        'sp.verified_at'
      );

    if (payment_method && payment_method !== 'All') {
      query = query.where('sp.payment_method', payment_method.toUpperCase());
    }
    if (verification_status && verification_status !== 'All') {
      query = query.where('sp.verification_status', verification_status);
    }
    if (start_date) {
      query = query.whereRaw('DATE(sp.created_at) >= DATE(?)', [start_date]);
    }
    if (end_date) {
      query = query.whereRaw('DATE(sp.created_at) <= DATE(?)', [end_date]);
    }
    if (search) {
      query = query.where(builder => {
        builder.whereILike('sp.reference_no', `%${search.trim()}%`)
          .orWhereILike('s.receipt_no', `%${search.trim()}%`);
      });
    }

    const payments = await query.orderBy('sp.id', 'desc').limit(200);

    return ApiResponse.success(res, payments, 'Payment transactions retrieved');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/finance/payments/:id/verify
 * Reconciles and verifies a payment with bank/momo provider statement
 */
router.post('/payments/:id/verify', authenticateToken, requirePermission('finance.reconcile'), async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id);
    const { notes } = req.body;

    const payment = await db('sale_payments').where({ id: paymentId }).first();
    if (!payment) {
      return ApiResponse.error(res, 'Payment record not found', 404, 'NOT_FOUND');
    }

    const [updated] = await db('sale_payments')
      .where({ id: paymentId })
      .update({
        verification_status: 'VERIFIED',
        is_verified: true,
        verified_by_id: req.user.id,
        verified_at: new Date()
      })
      .returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PAYMENT_VERIFIED',
      `Verified ${payment.payment_method} payment of GH₵ ${parseFloat(payment.amount).toFixed(2)} (Ref: ${payment.reference_no || 'N/A'})`
    );

    return ApiResponse.success(res, updated, 'Payment verified against statement');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/finance/bank-reconciliations
 * Retrieves bank reconciliation statements
 */
router.get('/bank-reconciliations', authenticateToken, requirePermission('finance.reconcile'), async (req, res, next) => {
  try {
    const recons = await db('bank_reconciliations as br')
      .join('users as u', 'br.reconciled_by_id', 'u.id')
      .select('br.*', 'u.name as reconciled_by_name')
      .orderBy('br.statement_date', 'desc')
      .limit(50);

    return ApiResponse.success(res, recons);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/finance/bank-reconciliations
 * Records bank account statement reconciliation against system ledger
 */
router.post('/bank-reconciliations', authenticateToken, requirePermission('finance.reconcile'), async (req, res, next) => {
  try {
    const { account_name, statement_date, statement_balance, book_balance, notes } = req.body;

    const stmtBal = parseFloat(statement_balance);
    const bkBal = parseFloat(book_balance);

    if (!account_name || !statement_date || isNaN(stmtBal) || isNaN(bkBal)) {
      return ApiResponse.error(res, 'account_name, statement_date, statement_balance, and book_balance are required', 400, 'BAD_REQUEST');
    }

    const diff = stmtBal - bkBal;
    const status = Math.abs(diff) < 0.01 ? 'reconciled' : 'discrepancy';

    const [recon] = await db('bank_reconciliations').insert({
      account_name: account_name.trim(),
      statement_date,
      statement_balance: stmtBal,
      book_balance: bkBal,
      unreconciled_difference: diff,
      reconciled_by_id: req.user.id,
      status,
      notes: notes || null
    }).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'BANK_RECONCILIATION',
      `Bank reconciliation for "${account_name}": Statement GH₵ ${stmtBal.toFixed(2)}, Book GH₵ ${bkBal.toFixed(2)}, Diff GH₵ ${diff.toFixed(2)}`
    );

    return ApiResponse.success(res, recon, 'Bank reconciliation record saved', 201);
  } catch (err) {
    next(err);
  }
});


// ==========================================
// 3. OPERATIONAL EXPENSES & APPROVAL LIMITS
// ==========================================

/**
 * GET /api/v1/finance/expenses
 * Filter expenses by category, approval status, date range
 */
router.get('/expenses', authenticateToken, requirePermission('finance.expenses'), async (req, res, next) => {
  try {
    const { category, approval_status, start_date, end_date } = req.query;
    let query = db('expenses as e')
      .leftJoin('users as u', 'e.paid_by_id', 'u.id')
      .leftJoin('users as app', 'e.approved_by_id', 'app.id')
      .select('e.*', 'u.name as paid_by_name', 'app.name as approved_by_name');

    if (category && category !== 'All') query = query.where('e.category', category);
    if (approval_status && approval_status !== 'All') query = query.where('e.approval_status', approval_status);
    if (start_date) query = query.whereRaw('DATE(e.expense_date) >= DATE(?)', [start_date]);
    if (end_date) query = query.whereRaw('DATE(e.expense_date) <= DATE(?)', [end_date]);

    const expenses = await query.orderBy('e.id', 'desc');
    return ApiResponse.success(res, expenses);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/finance/expenses
 * Create expense. If amount > GH₵ 500.00, automatically sets approval_status to 'pending'
 * and queues in centralized approval_requests.
 */
router.post('/expenses', authenticateToken, requirePermission('finance.expenses'), async (req, res, next) => {
  try {
    const {
      category, amount, description, receipt_image,
      payment_method = 'CASH', reference_no, expense_date, supporting_document_url
    } = req.body;
    const expAmount = parseFloat(amount);

    if (!category || !expAmount || expAmount <= 0 || !description) {
      return ApiResponse.error(res, 'Category, valid amount (> 0), and description are required', 400, 'BAD_REQUEST');
    }

    // Determine approval status based on configurable limit
    const requiresApproval = expAmount > EXPENSE_APPROVAL_THRESHOLD;
    const approvalStatus = requiresApproval ? 'pending' : 'approved';
    const approvedById = requiresApproval ? null : req.user.id;
    const approvedAt = requiresApproval ? null : new Date();

    const [created] = await db('expenses').insert({
      category: category.trim(),
      amount: expAmount,
      description: description.trim(),
      receipt_image: receipt_image || null,
      paid_by_id: req.user.id,
      approval_status: approvalStatus,
      approved_by_id: approvedById,
      approved_at: approvedAt,
      payment_method: payment_method.toUpperCase(),
      reference_no: reference_no || null,
      expense_date: expense_date || new Date().toISOString().slice(0, 10),
      supporting_document_url: supporting_document_url || null
    }).returning('*');

    // If requires approval, enqueue in approval_requests queue
    if (requiresApproval) {
      await db('approval_requests').insert({
        request_type: 'EXPENSE',
        reference_id: created.id,
        reference_table: 'expenses',
        amount: expAmount,
        reason: `Expense approval required: [${category}] GH₵ ${expAmount.toFixed(2)} - ${description}`,
        requester_id: req.user.id,
        status: 'pending',
        metadata: JSON.stringify({ category, payment_method, expense_date: created.expense_date })
      });
    }

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'EXPENSE_RECORDED',
      `Expense [${category}]: GH₵ ${expAmount.toFixed(2)} (${approvalStatus}) - ${description}`
    );

    return ApiResponse.success(
      res,
      created,
      requiresApproval
        ? `Expense exceeds GH₵ ${EXPENSE_APPROVAL_THRESHOLD.toFixed(2)} limit. Queued for supervisor approval.`
        : 'Expense recorded and approved successfully',
      201
    );
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/finance/expenses/:id/approve
 * Approves an expense. Enforces SEPARATION OF DUTIES: Users cannot approve their own expenses.
 */
router.post('/expenses/:id/approve', authenticateToken, requirePermission('finance.approve_expense'), async (req, res, next) => {
  try {
    const expenseId = parseInt(req.params.id);
    const expense = await db('expenses').where({ id: expenseId }).first();

    if (!expense) {
      return ApiResponse.error(res, 'Expense not found', 404, 'NOT_FOUND');
    }

    if (expense.approval_status === 'approved') {
      return ApiResponse.error(res, 'Expense is already approved', 400, 'ALREADY_APPROVED');
    }

    // Separation of Duties: Requester/Payer cannot approve their own expense
    if (req.user.id === expense.paid_by_id) {
      return ApiResponse.error(
        res,
        'Separation of duties violation: You cannot approve an expense that you recorded yourself.',
        403,
        'FORBIDDEN_SELF_APPROVAL'
      );
    }

    const [updated] = await db('expenses')
      .where({ id: expenseId })
      .update({
        approval_status: 'approved',
        approved_by_id: req.user.id,
        approved_at: new Date(),
        rejection_reason: null,
        updated_at: new Date()
      })
      .returning('*');

    // Update approval_requests table
    await db('approval_requests')
      .where({ reference_id: expenseId, reference_table: 'expenses' })
      .update({
        status: 'approved',
        approver_id: req.user.id,
        decided_at: new Date(),
        decision_notes: 'Approved via expense management'
      });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'EXPENSE_APPROVED',
      `Approved expense #${expenseId} (${expense.category} - GH₵ ${parseFloat(expense.amount).toFixed(2)})`
    );

    return ApiResponse.success(res, updated, 'Expense approved successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/finance/expenses/:id/reject
 * Rejects an expense with reason. Enforces SEPARATION OF DUTIES.
 */
router.post('/expenses/:id/reject', authenticateToken, requirePermission('finance.approve_expense'), async (req, res, next) => {
  try {
    const expenseId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return ApiResponse.error(res, 'A rejection reason is mandatory', 400, 'REASON_REQUIRED');
    }

    const expense = await db('expenses').where({ id: expenseId }).first();
    if (!expense) {
      return ApiResponse.error(res, 'Expense not found', 404, 'NOT_FOUND');
    }

    // Separation of Duties
    if (req.user.id === expense.paid_by_id) {
      return ApiResponse.error(
        res,
        'Separation of duties violation: You cannot reject/approve an expense that you recorded.',
        403,
        'FORBIDDEN_SELF_APPROVAL'
      );
    }

    const [updated] = await db('expenses')
      .where({ id: expenseId })
      .update({
        approval_status: 'rejected',
        approved_by_id: req.user.id,
        approved_at: new Date(),
        rejection_reason: reason.trim(),
        updated_at: new Date()
      })
      .returning('*');

    // Update approval_requests table
    await db('approval_requests')
      .where({ reference_id: expenseId, reference_table: 'expenses' })
      .update({
        status: 'rejected',
        approver_id: req.user.id,
        decided_at: new Date(),
        decision_notes: reason.trim()
      });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'EXPENSE_REJECTED',
      `Rejected expense #${expenseId} (${expense.category} - GH₵ ${parseFloat(expense.amount).toFixed(2)}): ${reason}`
    );

    return ApiResponse.success(res, updated, 'Expense rejected');
  } catch (err) {
    next(err);
  }
});


// ==========================================
// 4. FINANCIAL STATEMENTS & ACCURATE CALCULATIONS
// ==========================================

/**
 * GET /api/v1/finance/summary
 * Computes Revenue, Cost of Goods Sold (COGS), Gross Profit, Operating Expenses (OPEX),
 * Net Operating Profit, Accounts Receivable (Customer Debts), Accounts Payable (Supplier Liabilities).
 * Strictly protected: Cashiers cannot view company financial profit figures.
 */
router.get('/summary', authenticateToken, requirePermission('finance.view'), async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    let salesQuery = db('sales');
    const getExpensesQuery = () => {
      let eq = db('expenses').where('approval_status', 'approved');
      if (start_date) eq = eq.whereRaw('DATE(expense_date) >= DATE(?)', [start_date]);
      if (end_date) eq = eq.whereRaw('DATE(expense_date) <= DATE(?)', [end_date]);
      return eq;
    };

    if (start_date) {
      salesQuery = salesQuery.whereRaw('DATE(created_at) >= DATE(?)', [start_date]);
    }
    if (end_date) {
      salesQuery = salesQuery.whereRaw('DATE(created_at) <= DATE(?)', [end_date]);
    }

    // 1. Sales Revenue & Cost of Goods Sold
    const salesSummary = await salesQuery.select(
      db.raw('COALESCE(SUM(subtotal), 0) as gross_revenue'),
      db.raw('COALESCE(SUM(discount_amount), 0) as total_discounts'),
      db.raw('COALESCE(SUM(total_amount), 0) as net_revenue'),
      db.raw('COALESCE(SUM(total_cost), 0) as total_cogs'),
      db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_revenue"),
      db.raw("COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_revenue"),
      db.raw("COALESCE(SUM(CASE WHEN payment_method = 'BANK' THEN total_amount ELSE 0 END), 0) as bank_revenue"),
      db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_revenue"),
      db.raw('COUNT(id) as total_invoices')
    ).first();

    // 2. Approved Operational Expenses (OPEX)
    const expenseSummary = await getExpensesQuery().select(
      db.raw('COALESCE(SUM(amount), 0) as total_opex'),
      db.raw('COUNT(id) as expense_count')
    ).first();

    // Breakdown by Expense Category
    const categoryBreakdown = await getExpensesQuery()
      .select('category', db.raw('SUM(amount) as amount'), db.raw('COUNT(id) as count'))
      .groupBy('category')
      .orderBy('amount', 'desc');

    // 3. Accounts Receivable (Customer Debts)
    const arRes = await db('customers')
      .sum('current_balance as total_ar')
      .first();
    const accountsReceivable = parseFloat(arRes?.total_ar) || 0;

    // 4. Accounts Payable (Supplier Liabilities)
    const apRes = await db('supplier_invoices')
      .whereIn('status', ['unpaid', 'partially_paid'])
      .sum('balance_due as total_ap')
      .first();
    const accountsPayable = parseFloat(apRes?.total_ap) || 0;

    // 5. Total Stock Valuation at Cost
    const stockValRes = await db('products as p')
      .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
      .where('p.status', 'active')
      .select(db.raw('COALESCE(SUM(ws.quantity * p.cost_price), 0) as total_stock_value'))
      .first();
    const totalStockValue = parseFloat(stockValRes?.total_stock_value) || 0;

    const netRevenue = parseFloat(salesSummary.net_revenue) || 0;
    const cogs = parseFloat(salesSummary.total_cogs) || 0;
    const grossProfit = netRevenue - cogs;
    const grossMarginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    const totalOpex = parseFloat(expenseSummary.total_opex) || 0;
    const netOperatingProfit = grossProfit - totalOpex;
    const netMarginPercent = netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;

    return ApiResponse.success(res, {
      period: {
        start_date: start_date || 'Beginning of time',
        end_date: end_date || 'Present'
      },
      revenue: {
        gross_sales: parseFloat(salesSummary.gross_revenue) || 0,
        discounts: parseFloat(salesSummary.total_discounts) || 0,
        net_revenue: netRevenue,
        invoices_count: parseInt(salesSummary.total_invoices) || 0,
        by_channel: {
          cash: parseFloat(salesSummary.cash_revenue) || 0,
          momo: parseFloat(salesSummary.momo_revenue) || 0,
          bank: parseFloat(salesSummary.bank_revenue) || 0,
          credit: parseFloat(salesSummary.credit_revenue) || 0
        }
      },
      cost_of_goods_sold: cogs,
      gross_profit: grossProfit,
      gross_margin_percent: parseFloat(grossMarginPercent.toFixed(2)),
      operating_expenses: {
        total_opex: totalOpex,
        expense_count: parseInt(expenseSummary.expense_count) || 0,
        breakdown_by_category: (categoryBreakdown || []).map(c => ({
          category: c.category,
          amount: parseFloat(c.amount) || 0,
          count: parseInt(c.count) || 0
        }))
      },
      net_operating_profit: netOperatingProfit,
      net_margin_percent: parseFloat(netMarginPercent.toFixed(2)),
      working_capital: {
        accounts_receivable: accountsReceivable,
        accounts_payable: accountsPayable,
        inventory_valuation_at_cost: totalStockValue
      }
    }, 'Financial period summary calculated successfully');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

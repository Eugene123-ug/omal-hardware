const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse, parsePagination } = require('../../common/response');
const { validateBody } = require('../../middleware/validate');
const { authenticateToken, requirePermission, logAudit } = require('../../middleware/auth');
const { checkUserPermission } = require('../../utils/security');
const {
  customerSchema,
  updateCustomerSchema,
  customerStatusSchema,
  customerPaymentSchema
} = require('./customers.validation');

// Helper to generate sequential customer code: CUST-0001, CUST-0002...
async function getNextCustomerCode(trx) {
  const records = await (trx || db)('customers')
    .where('customer_code', 'like', 'CUST-%')
    .select('customer_code');

  let maxSeq = 0;
  for (const r of records) {
    if (r.customer_code) {
      const match = r.customer_code.match(/^CUST-(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > maxSeq) maxSeq = val;
      }
    }
  }

  return `CUST-${String(maxSeq + 1).padStart(4, '0')}`;
}

// ============================================================================
// TASK 5: REPORTS (Static routes declared before /:id)
// ============================================================================

// GET /api/v1/customers/reports/balances
router.get('/reports/balances', authenticateToken, requirePermission('customers.view'), async (req, res, next) => {
  try {
    const customers = await db('customers')
      .select(
        'id', 'customer_code', 'name', 'phone', 'location',
        'credit_limit', 'current_balance', 'status',
        db.raw('(credit_limit - current_balance) as available_credit')
      )
      .orderBy('current_balance', 'desc');

    const totalDebt = customers.reduce((acc, c) => acc + (parseFloat(c.current_balance) || 0), 0);
    const totalCreditLimit = customers.reduce((acc, c) => acc + (parseFloat(c.credit_limit) || 0), 0);

    return ApiResponse.success(res, {
      summary: {
        total_customers: customers.length,
        total_debt_owed: parseFloat(totalDebt.toFixed(2)),
        total_credit_limit: parseFloat(totalCreditLimit.toFixed(2)),
        overall_utilization_percent: totalCreditLimit > 0 ? parseFloat(((totalDebt / totalCreditLimit) * 100).toFixed(2)) : 0
      },
      customers
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/reports/overdue
router.get('/reports/overdue', authenticateToken, requirePermission('customers.view'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const overdueSales = await db('sales as s')
      .join('customers as c', 's.customer_id', 'c.id')
      .where('s.payment_method', 'CREDIT')
      .whereIn('s.payment_status', ['unpaid', 'partial'])
      .where('s.credit_due_date', '<', today)
      .select(
        's.id as sale_id',
        's.receipt_no',
        's.total_amount',
        's.credit_due_date',
        's.created_at as sale_date',
        'c.id as customer_id',
        'c.customer_code',
        'c.name as customer_name',
        'c.phone as customer_phone',
        'c.current_balance',
        db.raw(`(?::date - s.credit_due_date::date) as days_overdue`, [today])
      )
      .orderBy('days_overdue', 'desc');

    return ApiResponse.success(res, overdueSales);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/reports/aging
router.get('/reports/aging', authenticateToken, requirePermission('customers.view'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const customersWithDebt = await db('customers')
      .where('current_balance', '>', 0)
      .select('id', 'customer_code', 'name', 'phone', 'credit_limit', 'current_balance')
      .orderBy('current_balance', 'desc');

    const agingBuckets = {
      current: 0,     // 0 - 30 days
      bucket_31_60: 0, // 31 - 60 days
      bucket_61_90: 0, // 61 - 90 days
      bucket_90_plus: 0 // 91+ days
    };

    const customerBreakdowns = [];

    for (const cust of customersWithDebt) {
      const creditSales = await db('sales')
        .where({ customer_id: cust.id, payment_method: 'CREDIT' })
        .whereIn('payment_status', ['unpaid', 'partial'])
        .select('id', 'receipt_no', 'total_amount', 'created_at', 'credit_due_date');

      let cCurrent = 0;
      let c31_60 = 0;
      let c61_90 = 0;
      let c90Plus = 0;

      for (const sale of creditSales) {
        const saleDate = new Date(sale.created_at);
        const diffDays = Math.floor((new Date(today) - saleDate) / (1000 * 60 * 60 * 24));
        const amount = parseFloat(sale.total_amount) || 0;

        if (diffDays <= 30) {
          cCurrent += amount;
          agingBuckets.current += amount;
        } else if (diffDays <= 60) {
          c31_60 += amount;
          agingBuckets.bucket_31_60 += amount;
        } else if (diffDays <= 90) {
          c61_90 += amount;
          agingBuckets.bucket_61_90 += amount;
        } else {
          c90Plus += amount;
          agingBuckets.bucket_90_plus += amount;
        }
      }

      customerBreakdowns.push({
        ...cust,
        current: parseFloat(cCurrent.toFixed(2)),
        days_31_60: parseFloat(c31_60.toFixed(2)),
        days_61_90: parseFloat(c61_90.toFixed(2)),
        days_90_plus: parseFloat(c90Plus.toFixed(2)),
        total_balance: parseFloat(cust.current_balance)
      });
    }

    return ApiResponse.success(res, {
      aging_totals: {
        current: parseFloat(agingBuckets.current.toFixed(2)),
        days_31_60: parseFloat(agingBuckets.bucket_31_60.toFixed(2)),
        days_61_90: parseFloat(agingBuckets.bucket_61_90.toFixed(2)),
        days_90_plus: parseFloat(agingBuckets.bucket_90_plus.toFixed(2)),
        total_aged_debt: parseFloat((agingBuckets.current + agingBuckets.bucket_31_60 + agingBuckets.bucket_61_90 + agingBuckets.bucket_90_plus).toFixed(2))
      },
      customers: customerBreakdowns
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/reports/credit-sales
router.get('/reports/credit-sales', authenticateToken, requirePermission('customers.view'), async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    let query = db('sales as s')
      .join('customers as c', 's.customer_id', 'c.id')
      .join('users as u', 's.staff_id', 'u.id')
      .where('s.payment_method', 'CREDIT')
      .select(
        's.id', 's.receipt_no', 's.total_amount', 's.payment_status',
        's.credit_due_date', 's.created_at',
        'c.id as customer_id', 'c.customer_code', 'c.name as customer_name', 'c.phone as customer_phone',
        'u.name as cashier_name'
      )
      .orderBy('s.created_at', 'desc');

    if (start_date) query = query.whereRaw('DATE(s.created_at) >= DATE(?)', [start_date]);
    if (end_date) query = query.whereRaw('DATE(s.created_at) <= DATE(?)', [end_date]);

    const sales = await query;
    return ApiResponse.success(res, sales);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/reports/collections
router.get('/reports/collections', authenticateToken, requirePermission('customers.view'), async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    let query = db('customer_payments as cp')
      .join('customers as c', 'cp.customer_id', 'c.id')
      .leftJoin('users as u', 'cp.received_by_id', 'u.id')
      .select(
        'cp.id', 'cp.receipt_no', 'cp.amount', 'cp.payment_method',
        'cp.reference_no', 'cp.notes', 'cp.created_at',
        'c.id as customer_id', 'c.customer_code', 'c.name as customer_name', 'c.phone as customer_phone',
        'u.name as received_by_name'
      )
      .orderBy('cp.created_at', 'desc');

    if (start_date) query = query.whereRaw('DATE(cp.created_at) >= DATE(?)', [start_date]);
    if (end_date) query = query.whereRaw('DATE(cp.created_at) <= DATE(?)', [end_date]);

    const payments = await query;
    const totalCollected = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

    return ApiResponse.success(res, {
      total_collected: parseFloat(totalCollected.toFixed(2)),
      collections: payments
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 4: COLLECTIONS & DEBT PAYMENTS
// ============================================================================

// POST /api/v1/customers/payments (or /credit-payment)
router.post(['/payments', '/credit-payment'], authenticateToken, requirePermission('customers.manage_credit'), validateBody(customerPaymentSchema), async (req, res, next) => {
  try {
    const { customer_id, amount, payment_method = 'CASH', reference_no, bank_account_used, notes, payment_date } = req.body;
    const paymentAmount = parseFloat(amount);

    const customer = await db('customers').where({ id: customer_id }).first();
    if (!customer) {
      return ApiResponse.error(res, 'Customer not found', 404, 'NOT_FOUND');
    }

    if (customer.status === 'blacklisted') {
      return ApiResponse.error(res, `Customer "${customer.name}" is blacklisted. Debt collection must be reviewed by management.`, 400, 'CUSTOMER_BLACKLISTED');
    }

    const receiptNo = `PAY-${Date.now().toString().slice(-6)}`;
    let newBalance;

    await db.transaction(async (trx) => {
      await trx('customer_payments').insert({
        customer_id,
        amount: paymentAmount,
        payment_method,
        reference_no: reference_no || null,
        receipt_no: receiptNo,
        received_by_id: req.user.id,
        notes: notes || `Debt collection payment (${payment_method})`,
        created_at: payment_date ? new Date(payment_date) : new Date()
      });

      const updated = await trx('customers')
        .where({ id: customer_id })
        .decrement('current_balance', paymentAmount)
        .returning('*');

      newBalance = parseFloat(updated[0]?.current_balance || 0);

      // Reconcile oldest unpaid credit sales
      const unpaidSales = await trx('sales')
        .where({ customer_id, payment_method: 'CREDIT' })
        .whereIn('payment_status', ['unpaid', 'partial'])
        .orderBy('created_at', 'asc');

      let remainingPayment = paymentAmount;
      for (const sale of unpaidSales) {
        if (remainingPayment <= 0) break;
        const saleTotal = parseFloat(sale.total_amount);
        if (remainingPayment >= saleTotal) {
          await trx('sales').where({ id: sale.id }).update({ payment_status: 'paid' });
          remainingPayment -= saleTotal;
        } else {
          await trx('sales').where({ id: sale.id }).update({ payment_status: 'partial' });
          remainingPayment = 0;
        }
      }
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'CUSTOMER_PAYMENT_COLLECTED',
      `Collected debt payment of GH₵ ${paymentAmount.toFixed(2)} (${payment_method}) from ${customer.name}. New Balance: GH₵ ${newBalance.toFixed(2)}`
    );

    return ApiResponse.success(res, {
      receipt_no: receiptNo,
      amount_paid: paymentAmount,
      previous_balance: parseFloat(customer.current_balance),
      new_balance: newBalance,
      customer_name: customer.name
    }, 'Debt collection payment recorded successfully', 201);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 1: CUSTOMER PROFILES (CRUD)
// ============================================================================

// GET /api/v1/customers
router.get('/', authenticateToken, requirePermission('customers.view'), async (req, res, next) => {
  try {
    const { search, status, has_debt } = req.query;
    const { page, limit, offset } = parsePagination(req.query, 50);

    let query = db('customers');

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.where(b => {
        b.whereILike('name', term)
          .orWhereILike('phone', term)
          .orWhereILike('customer_code', term)
          .orWhereILike('location', term);
      });
    }

    if (status && status !== 'all') {
      query = query.where({ status });
    }

    if (has_debt === 'true') {
      query = query.where('current_balance', '>', 0);
    }

    const [totalRes, customers] = await Promise.all([
      query.clone().count('id as total').first(),
      query.clone()
        .select(
          'id', 'customer_code', 'name', 'phone', 'email', 'location',
          'address', 'credit_limit', 'current_balance', 'status', 'notes',
          'created_at', 'updated_at',
          db.raw('(credit_limit - current_balance) as available_credit')
        )
        .orderBy('name', 'asc')
        .limit(limit)
        .offset(offset)
    ]);

    return ApiResponse.paginated(res, customers, parseInt(totalRes.total), page, limit, 'Customers retrieved');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/customers (Register Customer)
router.post('/', authenticateToken, requirePermission('customers.create'), validateBody(customerSchema), async (req, res, next) => {
  try {
    const { name, phone, email, location, address, credit_limit = 0, status = 'active', notes } = req.body;

    const customerCode = await getNextCustomerCode();

    const [newCustomer] = await db('customers').insert({
      customer_code: customerCode,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      location: location ? location.trim() : null,
      address: address ? address.trim() : null,
      credit_limit: parseFloat(credit_limit) || 0,
      current_balance: 0,
      status,
      notes: notes || null
    }).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'CUSTOMER_CREATED',
      `Registered customer ${newCustomer.name} (Code: ${customerCode}, Phone: ${phone}, Credit Limit: GH₵ ${credit_limit})`
    );

    return ApiResponse.success(res, newCustomer, 'Customer registered successfully', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/:id
router.get('/:id', authenticateToken, requirePermission('customers.view'), async (req, res, next) => {
  if (req.params.id && isNaN(parseInt(req.params.id))) return next();
  try {
    const customer = await db('customers').where({ id: req.params.id }).first();
    if (!customer) {
      return ApiResponse.error(res, 'Customer not found', 404, 'NOT_FOUND');
    }

    const availableCredit = (parseFloat(customer.credit_limit) || 0) - (parseFloat(customer.current_balance) || 0);

    return ApiResponse.success(res, {
      ...customer,
      available_credit: parseFloat(availableCredit.toFixed(2))
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/customers/:id
router.put('/:id', authenticateToken, requirePermission('customers.edit'), validateBody(updateCustomerSchema), async (req, res, next) => {
  if (req.params.id && isNaN(parseInt(req.params.id))) return next();
  try {
    const existing = await db('customers').where({ id: req.params.id }).first();
    if (!existing) {
      return ApiResponse.error(res, 'Customer not found', 404, 'NOT_FOUND');
    }

    const { name, phone, email, location, address, credit_limit, status, notes } = req.body;

    // Security Check: Modifying credit limit requires customers.manage_credit or Super Admin
    if (credit_limit !== undefined && parseFloat(credit_limit) !== parseFloat(existing.credit_limit)) {
      const canManageCredit = await checkUserPermission(req.user, 'customers.manage_credit');
      if (!canManageCredit && req.user.role !== 'super_admin') {
        return ApiResponse.error(
          res,
          'Permission denied: Only authorised credit managers can adjust customer credit limits.',
          403,
          'CANNOT_MODIFY_CREDIT_LIMIT'
        );
      }
    }

    const [updated] = await db('customers').where({ id: req.params.id }).update({
      name: name ? name.trim() : existing.name,
      phone: phone ? phone.trim() : existing.phone,
      email: email !== undefined ? (email ? email.trim() : null) : existing.email,
      location: location !== undefined ? location : existing.location,
      address: address !== undefined ? address : existing.address,
      credit_limit: credit_limit !== undefined ? parseFloat(credit_limit) : existing.credit_limit,
      status: status || existing.status,
      notes: notes !== undefined ? notes : existing.notes,
      updated_at: new Date()
    }).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'CUSTOMER_UPDATED',
      `Updated profile for customer "${updated.name}" (Credit Limit: GH₵ ${updated.credit_limit})`
    );

    return ApiResponse.success(res, updated, 'Customer profile updated successfully');
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/customers/:id/status
router.put('/:id/status', authenticateToken, requirePermission('customers.manage_status'), validateBody(customerStatusSchema), async (req, res, next) => {
  if (req.params.id && isNaN(parseInt(req.params.id))) return next();
  try {
    const customer = await db('customers').where({ id: req.params.id }).first();
    if (!customer) {
      return ApiResponse.error(res, 'Customer not found', 404, 'NOT_FOUND');
    }

    const { status, reason } = req.body;

    const [updated] = await db('customers').where({ id: customer.id }).update({
      status,
      notes: customer.notes ? `${customer.notes} | Status changed to ${status}: ${reason}` : `Status changed to ${status}: ${reason}`,
      updated_at: new Date()
    }).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'CUSTOMER_STATUS_CHANGED',
      `Changed customer "${customer.name}" status from ${customer.status} to ${status}. Reason: ${reason}`
    );

    return ApiResponse.success(res, updated, `Customer status updated to ${status}`);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 2: CUSTOMER STATEMENTS
// ============================================================================

// GET /api/v1/customers/:id/statement
router.get('/:id/statement', authenticateToken, requirePermission('customers.view'), async (req, res, next) => {
  if (req.params.id && isNaN(parseInt(req.params.id))) return next();
  try {
    const customerId = parseInt(req.params.id);
    const customer = await db('customers').where({ id: customerId }).first();

    if (!customer) {
      return ApiResponse.error(res, 'Customer not found', 404, 'NOT_FOUND');
    }

    const { start_date, end_date, export_format } = req.query;

    let salesQuery = db('sales')
      .where({ customer_id: customerId })
      .select(
        'id', 'receipt_no', 'total_amount', 'payment_method', 'payment_status',
        'credit_due_date', 'created_at', db.raw("'INVOICE' as type")
      );

    let paymentsQuery = db('customer_payments')
      .where({ customer_id: customerId })
      .select(
        'id', 'receipt_no', 'amount', 'payment_method', 'reference_no',
        'notes', 'created_at', db.raw("'PAYMENT' as type")
      );

    let refundsQuery = db('refunds')
      .where({ customer_id: customerId, status: 'approved' })
      .select(
        'id', 'refund_no as receipt_no', 'refund_amount as amount',
        'refund_method as payment_method', 'reason as notes',
        'created_at', db.raw("'REFUND' as type")
      );

    if (start_date) {
      salesQuery = salesQuery.whereRaw('DATE(created_at) >= DATE(?)', [start_date]);
      paymentsQuery = paymentsQuery.whereRaw('DATE(created_at) >= DATE(?)', [start_date]);
      refundsQuery = refundsQuery.whereRaw('DATE(created_at) >= DATE(?)', [start_date]);
    }

    if (end_date) {
      salesQuery = salesQuery.whereRaw('DATE(created_at) <= DATE(?)', [end_date]);
      paymentsQuery = paymentsQuery.whereRaw('DATE(created_at) <= DATE(?)', [end_date]);
      refundsQuery = refundsQuery.whereRaw('DATE(created_at) <= DATE(?)', [end_date]);
    }

    const [sales, payments, refunds] = await Promise.all([
      salesQuery,
      paymentsQuery,
      refundsQuery
    ]);

    const combined = [
      ...sales.map(s => ({
        id: s.id,
        date: s.created_at,
        type: s.payment_method === 'CREDIT' ? 'CREDIT_SALE' : 'CASH_SALE',
        reference: s.receipt_no,
        description: `POS Sale Receipt ${s.receipt_no}`,
        debit: s.payment_method === 'CREDIT' ? parseFloat(s.total_amount) : 0,
        credit: 0,
        due_date: s.credit_due_date
      })),
      ...payments.map(p => ({
        id: p.id,
        date: p.created_at,
        type: 'PAYMENT',
        reference: p.receipt_no,
        description: `Debt Payment (${p.payment_method}${p.reference_no ? ` - ${p.reference_no}` : ''})`,
        debit: 0,
        credit: parseFloat(p.amount)
      })),
      ...refunds.map(r => ({
        id: r.id,
        date: r.created_at,
        type: 'REFUND_CREDIT',
        reference: r.receipt_no,
        description: `Approved Return / Credit Note (${r.notes || 'Goods returned'})`,
        debit: 0,
        credit: parseFloat(r.amount)
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let running = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const ledger = combined.map(item => {
      totalDebit += item.debit;
      totalCredit += item.credit;
      running += (item.debit - item.credit);
      return {
        ...item,
        running_balance: parseFloat(running.toFixed(2))
      };
    });

    const statementResult = {
      customer: {
        id: customer.id,
        code: customer.customer_code,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        location: customer.location,
        credit_limit: parseFloat(customer.credit_limit),
        current_balance: parseFloat(customer.current_balance),
        status: customer.status
      },
      period: {
        start_date: start_date || 'Beginning of account',
        end_date: end_date || new Date().toISOString().split('T')[0]
      },
      summary: {
        total_credit_purchases: parseFloat(totalDebit.toFixed(2)),
        total_payments_credited: parseFloat(totalCredit.toFixed(2)),
        closing_balance_due: parseFloat(running.toFixed(2)),
        reconciled_with_db: Math.abs(parseFloat(customer.current_balance) - running) < 0.05
      },
      transactions: ledger
    };

    if (export_format === 'csv') {
      let csv = 'Date,Type,Reference,Description,Debit (GH₵),Credit (GH₵),Running Balance (GH₵)\n';
      ledger.forEach(row => {
        csv += `"${new Date(row.date).toISOString().slice(0, 10)}","${row.type}","${row.reference}","${row.description}",${row.debit},${row.credit},${row.running_balance}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=statement-${customer.customer_code}.csv`);
      return res.status(200).send(csv);
    }

    return ApiResponse.success(res, statementResult, 'Customer statement compiled successfully');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/connection';
import { BadRequestError, ForbiddenError } from '../../common/errors';
import { authenticate, requirePermission, requireRole } from '../../middleware/auth';

export const financeRouter = Router();

// Financial Summary & Reconciliation
financeRouter.get('/summary', authenticate, requirePermission('finance.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const { branchId, startDate, endDate } = req.query;

    let salesQuery = db('sales').where('fulfillment_status', 'completed');
    let expensesQuery = db('expenses');

    if (branchId) {
      salesQuery = salesQuery.andWhere('branch_id', Number(branchId));
      expensesQuery = expensesQuery.andWhere('branch_id', Number(branchId));
    }
    if (startDate) {
      salesQuery = salesQuery.andWhere('sale_date', '>=', new Date(String(startDate)));
      expensesQuery = expensesQuery.andWhere('expense_date', '>=', new Date(String(startDate)));
    }
    if (endDate) {
      salesQuery = salesQuery.andWhere('sale_date', '<=', new Date(String(endDate)));
      expensesQuery = expensesQuery.andWhere('expense_date', '<=', new Date(String(endDate)));
    }

    const [salesAgg] = await salesQuery.sum({
      totalSales: 'total_amount',
      totalDiscounts: 'discount_amount',
      totalTax: 'tax_amount',
    });

    const [expensesAgg] = await expensesQuery.sum({
      totalExpenses: 'amount',
    });

    // Breakdown by payment method
    let paymentBreakdownQuery = db('sale_payments')
      .join('sales', 'sales.id', 'sale_payments.sale_id')
      .where('sales.fulfillment_status', 'completed')
      .groupBy('sale_payments.payment_method')
      .select('sale_payments.payment_method')
      .sum('sale_payments.amount as total_amount');

    if (branchId) {
      paymentBreakdownQuery = paymentBreakdownQuery.andWhere('sales.branch_id', Number(branchId));
    }

    const paymentBreakdown = await paymentBreakdownQuery;

    const totalRevenue = Number(salesAgg?.totalSales || 0);
    const totalExpenses = Number(expensesAgg?.totalExpenses || 0);
    const netCashFlow = totalRevenue - totalExpenses;

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalExpenses,
        netCashFlow,
        discountsGiven: Number(salesAgg?.totalDiscounts || 0),
        taxCollected: Number(salesAgg?.totalTax || 0),
        paymentsByMethod: paymentBreakdown.map((p: any) => ({
          method: p.payment_method,
          amount: Number(p.total_amount),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// List Expenses
financeRouter.get('/expenses', authenticate, requirePermission('finance.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const { branchId, categoryId, status } = req.query;

    let query = db('expenses')
      .join('branches', 'branches.id', 'expenses.branch_id')
      .join('expense_categories', 'expense_categories.id', 'expenses.category_id')
      .join('users as recorders', 'recorders.id', 'expenses.recorded_by')
      .leftJoin('users as approvers', 'approvers.id', 'expenses.approved_by')
      .select(
        'expenses.*',
        'branches.name as branch_name',
        'expense_categories.name as category_name',
        'expense_categories.code as category_code',
        'recorders.full_name as recorded_by_name',
        'approvers.full_name as approved_by_name',
      );

    if (branchId) query = query.where('expenses.branch_id', Number(branchId));
    if (categoryId) query = query.where('expenses.category_id', Number(categoryId));
    if (status) query = query.where('expenses.approval_status', String(status));

    const expenses = await query.orderBy('expenses.expense_date', 'desc');

    res.json({
      success: true,
      data: expenses.map((e: any) => ({
        ...e,
        amount: Number(e.amount),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Expense Categories
const STANDARD_EXPENSE_CATEGORIES = [
  { code: 'RENT', name: 'Rent & Facility', description: 'Store & warehouse leasing' },
  { code: 'SAL', name: 'Salaries & Wages', description: 'Staff salaries and daily wages' },
  { code: 'UTIL', name: 'Utilities', description: 'Electricity, water, internet & waste' },
  { code: 'LOG', name: 'Logistics & Transport', description: 'Fuel, haulage and delivery' },
  { code: 'MKT', name: 'Marketing & Ads', description: 'Signage, flyers and social promotions' },
  { code: 'MAINT', name: 'Maintenance & Repairs', description: 'Store, generator and tool repairs' },
  { code: 'GEN', name: 'General Operating', description: 'Office supplies and miscellaneous' },
];

financeRouter.get('/categories', authenticate, async (_req, res, next) => {
  try {
    const db = getDb();
    let categories = await db('expense_categories').where('is_active', true).orderBy('name', 'asc');
    
    // Auto-seed default categories if empty
    if (categories.length === 0) {
      for (const cat of STANDARD_EXPENSE_CATEGORIES) {
        await db('expense_categories').insert({ ...cat, is_active: true }).onConflict('code').ignore();
      }
      categories = await db('expense_categories').where('is_active', true).orderBy('name', 'asc');
    }

    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

// Add Expense Category
financeRouter.post('/categories', authenticate, async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    if (!name || typeof name !== 'string') {
      throw new BadRequestError('Category name is required');
    }
    const catCode = (code || name.replace(/[^A-Za-z0-9]/g, '_')).toUpperCase().slice(0, 30);
    const db = getDb();

    const [newCat] = await db('expense_categories')
      .insert({
        code: catCode,
        name: name.trim(),
        description: description || null,
        is_active: true,
      })
      .returning('*');

    res.status(201).json({ success: true, data: newCat });
  } catch (err) {
    next(err);
  }
});

// Record Expense
const recordExpenseSchema = z.object({
  branchId: z.number().int().default(1),
  categoryId: z.number().int(),
  amount: z.number().positive('Amount must be positive'),
  expenseDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
  description: z.string().min(1, 'Description is required'),
  paymentMethod: z.string().default('cash'),
  receiptRef: z.string().optional(),
});

financeRouter.post('/expenses', authenticate, requirePermission('finance.view', 'finance.manage', 'reports.view'), async (req, res, next) => {
  try {
    const parsed = recordExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid expense payload', parsed.error.issues);
    }

    const { branchId, categoryId, amount, expenseDate, description, paymentMethod, receiptRef } = parsed.data;
    const db = getDb();

    const expenseNumber = `EXP-${Date.now().toString().slice(-6)}`;
    const roleNormalized = (req.user!.role || '').toLowerCase();
    const autoApprove = ['owner', 'administrator', 'admin', 'manager'].includes(roleNormalized);

    const [expense] = await db('expenses')
      .insert({
        expense_number: expenseNumber,
        branch_id: branchId,
        category_id: categoryId,
        amount,
        expense_date: new Date(expenseDate),
        description,
        payment_method: paymentMethod,
        receipt_ref: receiptRef || null,
        approval_status: autoApprove ? 'approved' : 'pending',
        recorded_by: req.user!.id,
        approved_by: autoApprove ? req.user!.id : null,
        approved_at: autoApprove ? new Date() : null,
      })
      .returning('*');

    await db('audit_logs').insert({
      action: 'finance.record_expense',
      actor_user_id: req.user!.id,
      actor_label: req.user!.fullName,
      entity_type: 'expense',
      entity_id: String(expense.id),
      result: 'success',
    });

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
});

// Approve Expense
financeRouter.put('/expenses/:id/approve', authenticate, async (req, res, next) => {
  try {
    const expenseId = Number(req.params.id);
    const { status, notes } = req.body;
    const db = getDb();

    if (!['owner', 'administrator', 'accountant'].includes(req.user!.role)) {
      throw new ForbiddenError('Only owner, administrator or accountant can approve expenses');
    }

    const expense = await db('expenses').where('id', expenseId).first();
    if (!expense) {
      throw new BadRequestError('Expense not found');
    }

    if (expense.recorded_by === req.user!.id && req.user!.role === 'accountant') {
      throw new ForbiddenError('Users cannot approve their own restricted expenses');
    }

    const [updated] = await db('expenses')
      .where('id', expenseId)
      .update({
        approval_status: status || 'approved',
        approved_by: req.user!.id,
        approved_at: new Date(),
        approval_notes: notes || null,
        updated_at: new Date(),
      })
      .returning('*');

    await db('audit_logs').insert({
      action: `finance.expense_${status}`,
      actor_user_id: req.user!.id,
      actor_label: req.user!.fullName,
      entity_type: 'expense',
      entity_id: String(expenseId),
      result: 'success',
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Delete Expense (Restricted strictly to Administrator & IT Manager)
financeRouter.delete('/expenses/:id', authenticate, requireRole('administrator', 'owner'), async (req, res, next) => {
  try {
    const expenseId = Number(req.params.id);
    const db = getDb();

    const expense = await db('expenses').where('id', expenseId).first();
    if (!expense) {
      throw new BadRequestError('Expense not found');
    }

    await db('expenses').where('id', expenseId).delete();

    await db('audit_logs').insert({
      action: 'finance.delete_expense',
      actor_user_id: req.user!.id,
      actor_label: req.user!.username,
      entity_type: 'expense',
      entity_id: String(expenseId),
      result: 'success',
      metadata: JSON.stringify({ expenseNumber: expense.expense_number, amount: expense.amount }),
    });

    res.json({ success: true, message: 'Expense record successfully deleted.' });
  } catch (err) {
    next(err);
  }
});

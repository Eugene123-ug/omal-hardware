import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/connection';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { authenticate } from '../../middleware/auth';

export const customersRouter = Router();

// List Customers
customersRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const { search, type } = req.query;

    let query = db('customers').where('is_active', true);
    if (type) query = query.andWhere('customer_type', String(type));
    if (search) {
      const term = `%${String(search).toLowerCase()}%`;
      query = query.where((q: any) => {
        q.whereRaw('lower(name) like ?', [term]).orWhere('phone', 'like', term);
      });
    }

    const customers = await query.orderBy('name', 'asc');

    res.json({
      success: true,
      data: customers.map((c: any) => ({
        ...c,
        credit_limit: Number(c.credit_limit),
        credit_balance: Number(c.credit_balance),
        available_credit: Math.max(0, Number(c.credit_limit) - Number(c.credit_balance)),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Create Customer
const createCustomerSchema = z.object({
  name: z.string().min(2),
  customerType: z.enum(['walk_in', 'contractor', 'wholesale', 'corporate']).default('walk_in'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
  creditTermsDays: z.number().int().min(0).default(0),
  taxNumber: z.string().optional(),
});

customersRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid customer payload', parsed.error.issues);
    }

    const data = parsed.data;
    const db = getDb();

    const [customer] = await db('customers')
      .insert({
        name: data.name,
        customer_type: data.customerType,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        credit_limit: data.creditLimit,
        credit_balance: 0,
        credit_status: 'good',
        credit_terms_days: data.creditTermsDays,
        tax_number: data.taxNumber || null,
      })
      .returning('*');

    await db('audit_logs').insert({
      action: 'customers.create',
      actor_user_id: req.user!.id,
      actor_label: req.user!.fullName,
      entity_type: 'customer',
      entity_id: String(customer.id),
      result: 'success',
    });

    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

// Record Customer Debt Repayment
customersRouter.post('/:id/payment', authenticate, async (req, res, next) => {
  try {
    const customerId = Number(req.params.id);
    const { amount, paymentMethod = 'cash', referenceNumber, notes } = req.body;

    if (!amount || amount <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    const db = getDb();
    await db.transaction(async (trx: any) => {
      const customer = await trx('customers').where('id', customerId).forUpdate().first();
      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      const currentBalance = Number(customer.credit_balance);
      const newBalance = Math.max(0, currentBalance - amount);

      await trx('customers')
        .where('id', customerId)
        .update({
          credit_balance: newBalance,
          updated_at: new Date(),
        });

      await trx('audit_logs').insert({
        action: 'customers.debt_repayment',
        actor_user_id: req.user!.id,
        actor_label: req.user!.fullName,
        entity_type: 'customer',
        entity_id: String(customerId),
        after_data: JSON.stringify({
          amountPaid: amount,
          paymentMethod,
          previousBalance: currentBalance,
          newBalance,
          referenceNumber,
          notes,
        }),
        result: 'success',
      });
    });

    res.json({ success: true, message: 'Debt payment recorded successfully' });
  } catch (err) {
    next(err);
  }
});

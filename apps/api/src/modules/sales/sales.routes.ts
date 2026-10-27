import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/connection';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { authenticate, requirePermission, requireRole } from '../../middleware/auth';

export const salesRouter = Router();

const confirmSaleSchema = z.object({
  branchId: z.number().int().default(1),
  warehouseId: z.number().int().default(1),
  customerId: z.number().int().optional(),
  shiftId: z.number().int().optional(),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  amountTendered: z.number().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        variantId: z.number().int().optional(),
        quantity: z.number().positive('Quantity must be greater than zero'),
        unit: z.string().default('pcs'),
        unitPrice: z.number().positive('Unit price must be positive'),
        discountAmount: z.number().min(0).default(0),
      }),
    )
    .min(1, 'Sale must contain at least one line item'),
  payments: z
    .array(
      z.object({
        paymentMethod: z.enum(['cash', 'momo_mtn', 'momo_telecel', 'bank_transfer', 'card', 'credit']),
        amount: z.number().positive('Payment amount must be positive'),
        referenceNumber: z.string().optional(),
      }),
    )
    .optional(),
});

salesRouter.post('/', authenticate, requirePermission('sales.create'), async (req, res, next) => {
  try {
    const rawBody = { ...req.body };
    if (!rawBody.branchId) rawBody.branchId = 1;
    if (!rawBody.warehouseId) rawBody.warehouseId = 1;

    // Normalize items unit and discountAmount if omitted
    if (Array.isArray(rawBody.items)) {
      rawBody.items = rawBody.items.map((it: any) => ({
        ...it,
        unit: it.unit || 'pcs',
        discountAmount: Number(it.discountAmount || 0),
        unitPrice: Number(it.unitPrice || it.price || 0),
        quantity: Number(it.quantity || it.qty || 1),
      }));
    }

    // Auto-synthesize payments array if paymentMethod is provided at top-level
    if (!rawBody.payments || !Array.isArray(rawBody.payments) || rawBody.payments.length === 0) {
      const pm = (rawBody.paymentMethod || 'cash').toLowerCase();
      const validPm = ['cash', 'momo_mtn', 'momo_telecel', 'bank_transfer', 'card', 'credit'].includes(pm)
        ? pm
        : 'cash';

      const calculatedTotal = Array.isArray(rawBody.items)
        ? rawBody.items.reduce((s: number, i: any) => s + (Number(i.quantity) * Number(i.unitPrice)), 0)
        : 0;

      const amt = Number(rawBody.amountTendered) > 0 ? Number(rawBody.amountTendered) : calculatedTotal;
      rawBody.payments = [{
        paymentMethod: validPm,
        amount: amt > 0 ? amt : 0.01,
      }];
    }

    const parsed = confirmSaleSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestError('Invalid sales transaction payload', parsed.error.issues);
    }

    const {
      branchId,
      warehouseId,
      customerId,
      shiftId,
      discountAmount,
      taxAmount,
      notes,
      items,
    } = parsed.data;

    let payments = parsed.data.payments || [];

    const db = getDb();
    const cashierId = req.user!.id;

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => {
      const line = item.quantity * item.unitPrice - (item.discountAmount || 0);
      return sum + line;
    }, 0);

    const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount);
    
    // Auto-adjust single payment if exact total was omitted or defaulted
    const firstPayment = payments[0];
    if (payments.length === 1 && firstPayment && Math.abs(firstPayment.amount - totalAmount) > 0.05 && firstPayment.paymentMethod !== 'credit') {
      firstPayment.amount = totalAmount;
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    // If not credit, check payment matches total
    const isCredit = payments.some((p) => p.paymentMethod === 'credit');
    if (!isCredit && Math.abs(totalPaid - totalAmount) > 0.05) {
      throw new BadRequestError(
        `Payment mismatch: total sale is GH₵ ${totalAmount.toFixed(2)}, but payments sum to GH₵ ${totalPaid.toFixed(2)}`,
      );
    }

    // Execute atomic sale confirmation transaction
    const result = await db.transaction(async (trx: any) => {
      // 1. Verify and lock stock for each item
      const itemCosts: { productId: number; unitCost: number }[] = [];

      for (const item of items) {
        let stockQuery = trx('stock_levels')
          .where({
            warehouse_id: warehouseId,
            product_id: item.productId,
          });

        if (item.variantId) {
          stockQuery = stockQuery.andWhere('variant_id', item.variantId);
        }

        let stockRow = await stockQuery.forUpdate().first();

        if (!stockRow) {
          // Initialize stock row if first time encountered
          const [createdStock] = await trx('stock_levels')
            .insert({
              warehouse_id: warehouseId,
              product_id: item.productId,
              variant_id: item.variantId || null,
              quantity_on_hand: 0,
              quantity_reserved: 0,
              reorder_threshold: 5,
            })
            .returning('*');
          stockRow = createdStock;
        }

        const onHand = Number(stockRow.quantity_on_hand);
        const reserved = Number(stockRow.quantity_reserved);
        const available = onHand - reserved;

        const product = await trx('products').where('id', item.productId).first();
        const prodName = product ? product.name : `Product #${item.productId}`;

        if (available < item.quantity) {
          throw new BadRequestError(
            `Insufficient stock for '${prodName}'. Available on hand: ${available}, Requested: ${item.quantity}. Please purchase or restock inventory first.`,
          );
        }
        // Single source of truth: Last purchase order item unit cost
        const lastPo = await trx('purchase_order_items')
          .join('purchase_orders', 'purchase_orders.id', 'purchase_order_items.po_id')
          .where('purchase_order_items.product_id', item.productId)
          .orderBy('purchase_orders.created_at', 'desc')
          .select('purchase_order_items.unit_cost')
          .first();

        const unitCost = lastPo && Number(lastPo.unit_cost) > 0
          ? Number(lastPo.unit_cost)
          : Number(product?.cost_price || 0);

        itemCosts.push({ productId: item.productId, unitCost });

        // Deduct stock safely
        await trx('stock_levels')
          .where('id', stockRow.id)
          .update({
            quantity_on_hand: onHand - item.quantity,
            updated_at: new Date(),
          });
      }

      // 2. If credit sale, verify customer credit limit
      if (isCredit) {
        if (!customerId) {
          throw new BadRequestError('Customer selection is required for credit sales');
        }
        const customer = await trx('customers').where('id', customerId).forUpdate().first();
        if (!customer) {
          throw new NotFoundError('Selected customer not found');
        }
        if (customer.credit_status !== 'good') {
          throw new BadRequestError(`Customer credit account is ${customer.credit_status}`);
        }
        const creditPayment = payments.find((p) => p.paymentMethod === 'credit');
        const creditAmount = creditPayment ? creditPayment.amount : totalAmount;
        const currentBalance = Number(customer.credit_balance);
        const creditLimit = Number(customer.credit_limit);

        if (currentBalance + creditAmount > creditLimit) {
          throw new BadRequestError(
            `Credit limit exceeded: Available credit is GH₵ ${(creditLimit - currentBalance).toFixed(2)}, requested credit is GH₵ ${creditAmount.toFixed(2)}`,
          );
        }

        // Update customer balance
        await trx('customers')
          .where('id', customerId)
          .update({
            credit_balance: currentBalance + creditAmount,
            updated_at: new Date(),
          });
      }

      // 3. Generate Unique Sale and Receipt Identifiers
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const saleNumber = `SAL-${dateStr}-${randSuffix}`;
      const receiptNumber = `REC-${dateStr}-${randSuffix}`;

      // 4. Create Sale Header
      const [sale] = await trx('sales')
        .insert({
          sale_number: saleNumber,
          receipt_number: receiptNumber,
          branch_id: branchId,
          warehouse_id: warehouseId,
          cashier_id: cashierId,
          customer_id: customerId || null,
          shift_id: shiftId || null,
          subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          payment_status: isCredit ? 'credit' : 'paid',
          fulfillment_status: 'completed',
          notes: notes || null,
        })
        .returning('*');

      const saleId = sale.id;

      // 5. Create Sale Items & Stock Movement Ledger Entries
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const unitCost = itemCosts[i]?.unitCost || 0;
        const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);

        await trx('sale_items').insert({
          sale_id: saleId,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          unit_cost: unitCost,
          discount_amount: item.discountAmount || 0,
          line_total: lineTotal,
        });

        // Record stock movement
        await trx('stock_movements').insert({
          movement_type: 'confirmed_sale',
          warehouse_id: warehouseId,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity: -item.quantity,
          unit_cost: unitCost,
          total_valuation: item.quantity * unitCost,
          source_transaction_type: 'sale',
          source_transaction_id: String(saleId),
          reference_number: receiptNumber,
          operator_id: cashierId,
          notes: `POS Sale Receipt #${receiptNumber}`,
        });
      }

      // 6. Create Payment Records
      for (const p of payments) {
        await trx('sale_payments').insert({
          sale_id: saleId,
          payment_method: p.paymentMethod,
          amount: p.amount,
          reference_number: p.referenceNumber || null,
          verification_status: p.paymentMethod === 'cash' ? 'verified' : 'recorded',
          recorded_by: cashierId,
        });
      }

      // 7. Write Immutable Audit Log
      await trx('audit_logs').insert({
        action: 'sales.confirm_sale',
        actor_user_id: cashierId,
        actor_label: `${req.user!.fullName} (Cashier)`,
        entity_type: 'sale',
        entity_id: String(saleId),
        branch_id: branchId,
        after_data: JSON.stringify({
          saleNumber,
          receiptNumber,
          totalAmount,
          paymentMethods: payments.map((p) => p.paymentMethod),
        }),
        result: 'success',
      });

      return {
        saleId,
        saleNumber,
        receiptNumber,
        totalAmount,
        subtotal,
        discountAmount,
        taxAmount,
        paymentStatus: isCredit ? 'credit' : 'paid',
        itemsCount: items.length,
      };
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Sale confirmed and stock deducted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// List Sales
salesRouter.get('/', authenticate, requirePermission('sales.view_all'), async (req, res, next) => {
  try {
    const db = getDb();
    const { branchId, date, limit = 50 } = req.query;

    let query = db('sales')
      .join('branches', 'branches.id', 'sales.branch_id')
      .join('users as cashiers', 'cashiers.id', 'sales.cashier_id')
      .leftJoin('customers', 'customers.id', 'sales.customer_id')
      .select(
        'sales.*',
        'branches.name as branch_name',
        'branches.code as branch_code',
        'cashiers.full_name as cashier_name',
        'customers.name as customer_name',
      );

    if (branchId) {
      query = query.where('sales.branch_id', Number(branchId));
    }
    if (date) {
      query = query.whereRaw('date(sales.sale_date) = ?', [String(date)]);
    }

    const sales = await query.orderBy('sales.sale_date', 'desc').limit(Number(limit));

    const saleIds = sales.map((s: any) => s.id);
    const payments = await db('sale_payments').whereIn('sale_id', saleIds);

    const result = sales.map((s: any) => ({
      ...s,
      subtotal: Number(s.subtotal),
      discount_amount: Number(s.discount_amount),
      tax_amount: Number(s.tax_amount),
      total_amount: Number(s.total_amount),
      payments: payments
        .filter((p: any) => Number(p.sale_id) === Number(s.id))
        .map((p: any) => ({
          ...p,
          amount: Number(p.amount),
        })),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Shift management
salesRouter.get('/shifts/current', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const cashierId = req.user!.id;

    const shift = await db('cashier_shifts')
      .where({ cashier_id: cashierId, status: 'open' })
      .orderBy('start_time', 'desc')
      .first();

    if (!shift) {
      return res.json({ success: true, data: null });
    }

    const shiftSales = await db('sales')
      .join('sale_payments', 'sale_payments.sale_id', 'sales.id')
      .where('sales.shift_id', shift.id)
      .andWhere('sale_payments.payment_method', 'cash')
      .sum('sale_payments.amount as total_cash');

    const totalCash = Number(shiftSales[0]?.total_cash || 0);
    const expectedCash = Number(shift.opening_float) + totalCash;

    res.json({
      success: true,
      data: {
        ...shift,
        opening_float: Number(shift.opening_float),
        cash_sales: totalCash,
        expected_cash: expectedCash,
      },
    });
  } catch (err) {
    next(err);
  }
});

salesRouter.post('/shifts/open', authenticate, async (req, res, next) => {
  try {
    const { branchId, warehouseId, openingFloat = 0 } = req.body;
    const db = getDb();
    const cashierId = req.user!.id;

    const existing = await db('cashier_shifts')
      .where({ cashier_id: cashierId, status: 'open' })
      .first();

    if (existing) {
      throw new BadRequestError('You already have an active open cashier shift');
    }

    const [shift] = await db('cashier_shifts')
      .insert({
        cashier_id: cashierId,
        branch_id: branchId,
        warehouse_id: warehouseId,
        opening_float: openingFloat,
        status: 'open',
      })
      .returning('*');

    res.status(201).json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
});

salesRouter.post('/shifts/close', authenticate, async (req, res, next) => {
  try {
    const { shiftId, closingCashDeclared, notes } = req.body;
    const db = getDb();

    const shift = await db('cashier_shifts').where('id', shiftId).first();
    if (!shift || shift.status !== 'open') {
      throw new BadRequestError('Valid open shift not found');
    }

    const shiftSales = await db('sales')
      .join('sale_payments', 'sale_payments.sale_id', 'sales.id')
      .where('sales.shift_id', shift.id)
      .andWhere('sale_payments.payment_method', 'cash')
      .sum('sale_payments.amount as total_cash');

    const totalCashSales = Number(shiftSales[0]?.total_cash || 0);
    const expectedCash = Number(shift.opening_float) + totalCashSales;
    const discrepancy = Number(closingCashDeclared) - expectedCash;

    const [closed] = await db('cashier_shifts')
      .where('id', shiftId)
      .update({
        closing_cash_declared: closingCashDeclared,
        expected_cash: expectedCash,
        discrepancy,
        status: 'closed',
        end_time: new Date(),
        reconciliation_notes: notes || null,
        updated_at: new Date(),
      })
      .returning('*');

    res.json({
      success: true,
      data: {
        ...closed,
        discrepancy,
        isBalanced: Math.abs(discrepancy) < 0.01,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Void / Delete Sale Transaction (Restricted strictly to Administrator & IT Manager)
salesRouter.delete('/:id', authenticate, requireRole('administrator', 'owner'), async (req, res, next) => {
  try {
    const saleId = Number(req.params.id);
    const db = getDb();

    const sale = await db('sales').where('id', saleId).first();
    if (!sale) {
      throw new NotFoundError('Sale transaction not found');
    }

    const items = await db('sale_items').where('sale_id', saleId);

    await db.transaction(async (trx) => {
      // 1. Re-credit inventory for each item
      for (const item of items) {
        await trx('stock_levels')
          .where({
            warehouse_id: sale.warehouse_id || 1,
            product_id: item.product_id,
          })
          .increment('quantity_on_hand', Number(item.quantity));

        // Compensating stock movement
        await trx('stock_movements').insert({
          movement_type: 'customer_return',
          warehouse_id: sale.warehouse_id || 1,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_valuation: Number(item.quantity) * Number(item.unit_cost),
          source_transaction_type: 'void_sale',
          source_transaction_id: String(saleId),
          reference_number: `VOID-${sale.receipt_number}`,
          operator_id: req.user!.id,
          notes: `Sale #${sale.receipt_number} voided/deleted by Admin`,
        });
      }

      // 2. Delete child records
      await trx('sale_payments').where('sale_id', saleId).delete();
      await trx('sale_items').where('sale_id', saleId).delete();
      await trx('sales').where('id', saleId).delete();

      // 3. Audit log
      await trx('audit_logs').insert({
        action: 'sales.delete_void',
        actor_user_id: req.user!.id,
        actor_label: req.user!.username,
        entity_type: 'sale',
        entity_id: String(saleId),
        result: 'success',
        metadata: JSON.stringify({ receiptNumber: sale.receipt_number, amount: sale.total_amount }),
      });
    });

    res.json({
      success: true,
      message: `Sale #${sale.receipt_number} successfully deleted and inventory restored.`,
    });
  } catch (err) {
    next(err);
  }
});

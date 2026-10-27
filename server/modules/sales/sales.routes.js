const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse, parsePagination } = require('../../common/response');
const { validateBody } = require('../../middleware/validate');
const {
  createSaleSchema,
  refundRequestSchema,
  refundApproveSchema,
  paymentVerifySchema
} = require('./sales.validation');
const {
  authenticateToken,
  requireRole,
  requirePermission,
  verifyAdminPin,
  logAudit
} = require('../../middleware/auth');
const { checkUserPermission } = require('../../utils/security');

// Helper to generate sequential receipt number: REC-YYYYMMDD-0001
async function getNextReceiptNumber(trx) {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `REC-${todayStr}-`;

  if (trx) {
    const lockId = parseInt(todayStr.slice(2)); // e.g. 261025
    await trx.raw('SELECT pg_advisory_xact_lock(?)', [lockId]);
  }

  const lastSale = await (trx || db)('sales')
    .where('receipt_no', 'like', `${prefix}%`)
    .orderBy('id', 'desc')
    .select('receipt_no')
    .first();

  let nextSeq = 1;
  if (lastSale && lastSale.receipt_no) {
    const parts = lastSale.receipt_no.split('-');
    const lastNum = parseInt(parts[2]);
    if (!isNaN(lastNum)) nextSeq = lastNum + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// Helper to generate sequential refund number: REF-YYYYMMDD-0001
async function getNextRefundNumber(trx) {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `REF-${todayStr}-`;

  if (trx) {
    const lockId = parseInt(todayStr.slice(2)) + 500000;
    await trx.raw('SELECT pg_advisory_xact_lock(?)', [lockId]);
  }

  const lastRefund = await (trx || db)('refunds')
    .where('refund_no', 'like', `${prefix}%`)
    .orderBy('id', 'desc')
    .select('refund_no')
    .first();

  let nextSeq = 1;
  if (lastRefund && lastRefund.refund_no) {
    const parts = lastRefund.refund_no.split('-');
    const lastNum = parseInt(parts[2]);
    if (!isNaN(lastNum)) nextSeq = lastNum + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// ============================================================================
// TASK 5: REFUNDS, RETURNS & REVERSALS (Static routes first)
// ============================================================================

// GET /api/v1/sales/refunds (List returns & refunds)
router.get('/refunds', authenticateToken, requirePermission('refunds.view'), async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    let query = db('refunds as r')
      .join('users as u', 'r.staff_id', 'u.id')
      .leftJoin('users as au', 'r.approved_by_id', 'au.id')
      .leftJoin('customers as c', 'r.customer_id', 'c.id');

    if (status) query = query.where('r.status', status);
    if (search) {
      query = query.where(b => {
        b.whereILike('r.refund_no', `%${search}%`)
          .orWhereILike('r.receipt_no', `%${search}%`)
          .orWhereILike('c.name', `%${search}%`);
      });
    }

    const [countRes, rows] = await Promise.all([
      query.clone().count('r.id as total').first(),
      query.clone()
        .select(
          'r.*',
          'u.name as staff_name',
          'au.name as approved_by_name',
          'c.name as customer_name'
        )
        .orderBy('r.id', 'desc')
        .limit(limit)
        .offset(offset)
    ]);

    return ApiResponse.paginated(res, rows, parseInt(countRes.total), page, limit, 'Refunds retrieved');
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sales/refunds/:id
router.get('/refunds/:id', authenticateToken, requirePermission('refunds.view'), async (req, res, next) => {
  try {
    const refund = await db('refunds as r')
      .join('users as u', 'r.staff_id', 'u.id')
      .leftJoin('users as au', 'r.approved_by_id', 'au.id')
      .leftJoin('customers as c', 'r.customer_id', 'c.id')
      .where('r.id', req.params.id)
      .select('r.*', 'u.name as staff_name', 'au.name as approved_by_name', 'c.name as customer_name')
      .first();

    if (!refund) {
      return ApiResponse.error(res, 'Refund record not found', 404, 'NOT_FOUND');
    }

    const items = await db('refund_items as ri')
      .join('products as p', 'ri.product_id', 'p.id')
      .where('ri.refund_id', refund.id)
      .select('ri.*', 'p.name as product_name', 'p.sku');

    return ApiResponse.success(res, { ...refund, items });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/sales/refunds (Request a return / refund)
router.post('/refunds', authenticateToken, requirePermission('refunds.request'), validateBody(refundRequestSchema), async (req, res, next) => {
  try {
    const { sale_id, items, refund_method = 'CASH', reason, warehouse_name = 'Main Showroom' } = req.body;

    const sale = await db('sales').where({ id: sale_id }).first();
    if (!sale) {
      return ApiResponse.error(res, 'Original sale invoice not found', 404, 'NOT_FOUND');
    }

    if (sale.payment_status === 'refunded') {
      return ApiResponse.error(res, 'This sale has already been fully refunded', 400, 'ALREADY_REFUNDED');
    }

    const refundNo = await getNextRefundNumber();
    let totalRefundAmount = 0;
    const itemsToInsert = [];

    for (const item of items) {
      const saleItem = await db('sale_items').where({ id: item.sale_item_id, sale_id }).first();
      if (!saleItem) {
        return ApiResponse.error(res, `Sale line item #${item.sale_item_id} not found in receipt ${sale.receipt_no}`, 404, 'SALE_ITEM_NOT_FOUND');
      }

      const previouslyRefunded = parseFloat(saleItem.refunded_quantity || 0);
      const originalQty = parseFloat(saleItem.quantity);
      const remainingEligible = originalQty - previouslyRefunded;

      if (item.quantity > remainingEligible) {
        return ApiResponse.error(
          res,
          `Return quantity (${item.quantity}) exceeds remaining eligible quantity (${remainingEligible}) for product "${saleItem.product_name}"`,
          400,
          'EXCESS_RETURN_QUANTITY'
        );
      }

      const unitPrice = parseFloat(saleItem.selling_price);
      const lineRefund = parseFloat((unitPrice * item.quantity).toFixed(2));
      totalRefundAmount += lineRefund;

      itemsToInsert.push({
        sale_item_id: saleItem.id,
        product_id: saleItem.product_id,
        variant_id: saleItem.variant_id || null,
        quantity: item.quantity,
        unit: saleItem.unit,
        unit_price: unitPrice,
        total_refund: lineRefund,
        condition: item.condition || 'RESELLABLE',
        warehouse_name,
        restocked: false
      });
    }

    let refundId;
    await db.transaction(async (trx) => {
      const [newRefund] = await trx('refunds').insert({
        refund_no: refundNo,
        sale_id: sale.id,
        receipt_no: sale.receipt_no,
        customer_id: sale.customer_id || null,
        staff_id: req.user.id,
        refund_amount: parseFloat(totalRefundAmount.toFixed(2)),
        refund_method,
        reason,
        status: 'pending'
      }).returning('id');

      refundId = newRefund.id;

      const itemsWithRefundId = itemsToInsert.map(it => ({ ...it, refund_id: refundId }));
      await trx('refund_items').insert(itemsWithRefundId);
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'REFUND_REQUESTED',
      `Initiated return request ${refundNo} for receipt ${sale.receipt_no} (Amount: GH₵ ${totalRefundAmount.toFixed(2)}, Reason: ${reason})`
    );

    return ApiResponse.success(res, {
      refund_id: refundId,
      refund_no: refundNo,
      refund_amount: totalRefundAmount,
      status: 'pending'
    }, 'Refund request submitted for supervisor authorization. (Stock is not altered until approved)', 201);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/sales/refunds/:id/approve (Authorise return & restock)
router.post('/refunds/:id/approve', authenticateToken, requirePermission('refunds.approve'), validateBody(refundApproveSchema), async (req, res, next) => {
  try {
    const refund = await db('refunds').where({ id: req.params.id }).first();
    if (!refund) {
      return ApiResponse.error(res, 'Refund record not found', 404, 'NOT_FOUND');
    }

    if (refund.status !== 'pending') {
      return ApiResponse.error(res, `Cannot process refund in status "${refund.status}"`, 400, 'BAD_REQUEST');
    }

    const { status, approval_notes, admin_pin } = req.body;

    if (status === 'rejected') {
      await db('refunds').where({ id: refund.id }).update({
        status: 'rejected',
        approved_by_id: req.user.id,
        rejection_reason: approval_notes || 'Return rejected by supervisor',
        updated_at: new Date()
      });

      await logAudit(
        req.user.id,
        req.user.name,
        req.user.role,
        'REFUND_REJECTED',
        `Rejected refund request ${refund.refund_no} for receipt ${refund.receipt_no}`
      );

      return ApiResponse.success(res, null, 'Refund request rejected');
    }

    // High value refund check: If refund >= GH₵ 1,000, verify Admin PIN if user is not Super Admin
    if (parseFloat(refund.refund_amount) >= 1000 && req.user.role !== 'super_admin') {
      if (!admin_pin) {
        return ApiResponse.error(
          res,
          'High-value refund authorization requires Admin PIN verification.',
          403,
          'ADMIN_PIN_REQUIRED'
        );
      }
      const pinCheck = await verifyAdminPin(admin_pin);
      if (!pinCheck.valid) {
        return ApiResponse.error(res, `Admin PIN invalid: ${pinCheck.message}`, 403, 'INVALID_PIN');
      }
    }

    const refundItems = await db('refund_items').where({ refund_id: refund.id });
    const originalSale = await db('sales').where({ id: refund.sale_id }).first();

    await db.transaction(async (trx) => {
      for (const item of refundItems) {
        const prod = await trx('products').where({ id: item.product_id }).first();
        const costPrice = parseFloat(prod.cost_price || 0);

        if (item.condition === 'RESELLABLE') {
          // Increment sellable stock in warehouse
          let stockQuery = trx('warehouse_stock')
            .where({ product_id: item.product_id, warehouse_name: item.warehouse_name });
          if (item.variant_id) stockQuery = stockQuery.where({ variant_id: item.variant_id });
          else stockQuery = stockQuery.whereNull('variant_id');

          const stockRow = await stockQuery.forUpdate().first();
          let newQty = parseFloat(item.quantity);

          if (stockRow) {
            newQty += parseFloat(stockRow.quantity);
            await trx('warehouse_stock').where({ id: stockRow.id }).update({
              quantity: newQty,
              updated_at: new Date()
            });
          } else {
            await trx('warehouse_stock').insert({
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              warehouse_name: item.warehouse_name,
              quantity: newQty,
              reserved_quantity: 0
            });
          }

          // Record CUSTOMER_RETURN in immutable stock ledger
          await trx('stock_movements').insert({
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            movement_type: 'CUSTOMER_RETURN',
            quantity: item.quantity,
            unit: item.unit,
            from_location: 'CUSTOMER',
            to_location: item.warehouse_name,
            reference_type: 'REFUND',
            reference_id: refund.id,
            reference_no: refund.refund_no,
            cost_price: costPrice,
            total_cost: costPrice * parseFloat(item.quantity),
            balance_after: newQty,
            reason: `Approved Customer Return ${refund.refund_no} (Resellable)`,
            created_by_id: req.user.id
          });
        } else {
          // DAMAGED: Do NOT add to sellable warehouse stock! Record DAMAGE in ledger
          await trx('stock_movements').insert({
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            movement_type: 'DAMAGE',
            quantity: 0, // 0 to sellable stock
            discrepancy_quantity: item.quantity,
            unit: item.unit,
            from_location: 'CUSTOMER',
            to_location: 'SCRAP_HOLD',
            reference_type: 'REFUND',
            reference_id: refund.id,
            reference_no: refund.refund_no,
            cost_price: costPrice,
            total_cost: costPrice * parseFloat(item.quantity),
            balance_after: 0,
            reason: `Damaged return held in scrap: ${refund.reason}`,
            created_by_id: req.user.id
          });
        }

        // Increment refunded_quantity on sale_items
        await trx('sale_items').where({ id: item.sale_item_id }).increment('refunded_quantity', item.quantity);
        await trx('refund_items').where({ id: item.id }).update({ restocked: item.condition === 'RESELLABLE' });
      }

      // If original sale was credit or refund method is credit reversal, decrement customer balance
      if (originalSale.payment_method === 'CREDIT' || refund.refund_method === 'CREDIT_REVERSAL') {
        if (originalSale.customer_id) {
          await trx('customers')
            .where({ id: originalSale.customer_id })
            .decrement('current_balance', parseFloat(refund.refund_amount));
        }
      }

      // Determine new payment_status of original sale
      const allSaleItems = await trx('sale_items').where({ sale_id: originalSale.id });
      const fullyRefunded = allSaleItems.every(si => parseFloat(si.refunded_quantity || 0) >= parseFloat(si.quantity));

      await trx('sales').where({ id: originalSale.id }).update({
        payment_status: fullyRefunded ? 'refunded' : 'partially_refunded'
      });

      // Update refund status
      await trx('refunds').where({ id: refund.id }).update({
        status: 'approved',
        approved_by_id: req.user.id,
        approval_notes: approval_notes || 'Formally authorised and restocked',
        updated_at: new Date()
      });
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'REFUND_APPROVED',
      `Authorised return ${refund.refund_no} for receipt ${refund.receipt_no} (Amount: GH₵ ${parseFloat(refund.refund_amount).toFixed(2)})`
    );

    return ApiResponse.success(res, {
      refund_id: refund.id,
      refund_no: refund.refund_no,
      status: 'approved'
    }, 'Refund approved and inventory stock movement recorded.');
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 3: PAYMENT VERIFICATION (Independent verification)
// ============================================================================

// POST /api/v1/sales/payments/:paymentId/verify
router.post('/payments/:paymentId/verify', authenticateToken, requirePermission('finance.view'), validateBody(paymentVerifySchema), async (req, res, next) => {
  try {
    const payment = await db('sale_payments').where({ id: req.params.paymentId }).first();
    if (!payment) {
      return ApiResponse.error(res, 'Payment record not found', 404, 'NOT_FOUND');
    }

    const { verification_status, notes } = req.body;

    const [updated] = await db('sale_payments').where({ id: payment.id }).update({
      verification_status,
      is_verified: verification_status === 'VERIFIED',
      verified_by_id: req.user.id,
      verified_at: new Date(),
      notes: notes ? `${payment.notes || ''} | Verification: ${notes}` : payment.notes
    }).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PAYMENT_VERIFIED',
      `Payment #${payment.id} for sale #${payment.sale_id} (${payment.payment_method} GH₵ ${payment.amount}) verified as ${verification_status}`
    );

    return ApiResponse.success(res, updated, `Payment status updated to ${verification_status}`);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 1 & 2: POS CHECKOUT & SALE CONFIRMATION
// ============================================================================

// POST /api/v1/sales (POS Checkout)
router.post('/', authenticateToken, requirePermission('sales.create'), validateBody(createSaleSchema), async (req, res, next) => {
  try {
    const {
      items, customer_id, customer_name, customer_phone,
      warehouse_name = 'Main Showroom', discount_percent = 0,
      admin_pin, payment_method, payments, momo_network, momo_reference,
      cash_tendered, credit_due_date, notes, offline_client_id, idempotency_key
    } = req.body;

    // Idempotency check (prevent duplicate sales from network retry or double click)
    if (idempotency_key) {
      const existingSale = await db('sales').where({ idempotency_key }).first();
      if (existingSale) {
        return ApiResponse.success(res, {
          sale_id: existingSale.id,
          receipt_no: existingSale.receipt_no,
          total_amount: parseFloat(existingSale.total_amount),
          is_duplicate_replay: true
        }, 'Existing sale returned (idempotency match). Stock was not double deducted.', 200);
      }
    }

    // Check discount limit: If > 2%, Admin PIN / supervisor code is mandatory
    let approverUser = null;
    if (discount_percent > 2) {
      if (!admin_pin) {
        return ApiResponse.error(
          res,
          `Cashier discount limit is 2%. A discount of ${discount_percent}% requires Admin PIN authorization.`,
          403,
          'SUPERVISOR_APPROVAL_REQUIRED'
        );
      }
      const pinCheck = await verifyAdminPin(admin_pin);
      if (!pinCheck.valid) {
        return ApiResponse.error(
          res,
          `Supervisor authorization failed: ${pinCheck.message}`,
          403,
          'INVALID_PIN'
        );
      }
      approverUser = pinCheck.user;
    }

    // Customer & Credit Checks
    let customer = null;
    if (customer_id) {
      customer = await db('customers').where({ id: customer_id }).first();
      if (!customer) {
        return ApiResponse.error(res, 'Customer not found in records', 404, 'NOT_FOUND');
      }
      if (customer.status === 'blacklisted') {
        return ApiResponse.error(res, `Cannot complete sale: Customer "${customer.name}" is blacklisted`, 400, 'CUSTOMER_BLACKLISTED');
      }
      if (customer.status === 'suspended') {
        return ApiResponse.error(res, `Cannot complete sale: Customer "${customer.name}" is suspended`, 400, 'CUSTOMER_SUSPENDED');
      }
    }

    const isCreditSale = payment_method === 'CREDIT' || (Array.isArray(payments) && payments.some(p => p.payment_method === 'CREDIT'));
    if (isCreditSale) {
      // Permission check: requires credit_sales.create or customers.manage_credit, or valid admin_pin
      const canCreateCredit = await checkUserPermission(req.user, 'credit_sales.create') || await checkUserPermission(req.user, 'customers.manage_credit');
      
      let creditPinValid = false;
      if (!canCreateCredit && admin_pin) {
        const pinCheck = await verifyAdminPin(admin_pin);
        if (pinCheck.valid) {
          creditPinValid = true;
          approverUser = pinCheck.user;
        }
      }

      if (!canCreateCredit && !creditPinValid && req.user.role !== 'super_admin') {
        return ApiResponse.error(
          res,
          'Permission denied: You do not have permission to issue credit sales without supervisor PIN.',
          403,
          'CREDIT_SALES_RESTRICTED'
        );
      }

      if (!customer) {
        return ApiResponse.error(res, 'Credit sales require selecting a registered customer account', 400, 'CUSTOMER_REQUIRED_FOR_CREDIT');
      }
    }

    // Calculate line items, stock validation, and COGS
    let subtotal = 0;
    let totalCost = 0;
    const processedItems = [];

    for (const item of items) {
      const prod = await db('products').where({ id: item.product_id }).first();
      if (!prod) {
        return ApiResponse.error(res, `Product #${item.product_id} not found`, 404, 'NOT_FOUND');
      }

      if (prod.status === 'discontinued') {
        return ApiResponse.error(res, `Product "${prod.name}" (${prod.sku}) is discontinued and cannot be sold.`, 400, 'DISCONTINUED_PRODUCT');
      }

      // Check variant if applicable
      let variant = null;
      if (item.variant_id) {
        variant = await db('product_variants').where({ id: item.variant_id, product_id: prod.id }).first();
        if (!variant) {
          return ApiResponse.error(res, `Product variant #${item.variant_id} not found for "${prod.name}"`, 404, 'VARIANT_NOT_FOUND');
        }
      }

      // Concurrency: Check available stock
      let stockQuery = db('warehouse_stock').where({ product_id: item.product_id, warehouse_name });
      if (item.variant_id) stockQuery = stockQuery.where({ variant_id: item.variant_id });
      else stockQuery = stockQuery.whereNull('variant_id');

      const stockRow = await stockQuery.first();
      const currentStock = stockRow ? parseFloat(stockRow.quantity) : 0;
      const reserved = stockRow ? parseFloat(stockRow.reserved_quantity || 0) : 0;
      const available = currentStock - reserved;

      if (available < item.quantity) {
        return ApiResponse.error(
          res,
          `Insufficient stock for "${prod.name}" in ${warehouse_name}. Available: ${available}, Requested: ${item.quantity}`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      // Price floor validation
      const basePrice = item.unit_price !== undefined
        ? parseFloat(item.unit_price)
        : (variant ? parseFloat(variant.selling_price) : parseFloat(prod.selling_price));

      const discountedUnit = basePrice * (1 - (discount_percent / 100));
      const costPrice = variant && variant.cost_price ? parseFloat(variant.cost_price) : parseFloat(prod.cost_price || 0);
      const minFloor = variant && variant.min_selling_price ? parseFloat(variant.min_selling_price) : (prod.min_selling_price ? parseFloat(prod.min_selling_price) : 0);

      if (discountedUnit < costPrice) {
        return ApiResponse.error(
          res,
          `Selling price (GH₵ ${discountedUnit.toFixed(2)}) for "${prod.name}" cannot be below cost price (GH₵ ${costPrice.toFixed(2)})`,
          400,
          'BELOW_COST_FORBIDDEN'
        );
      }

      if (minFloor > 0 && discountedUnit < minFloor) {
        return ApiResponse.error(
          res,
          `Selling price (GH₵ ${discountedUnit.toFixed(2)}) for "${prod.name}" cannot be below minimum floor price (GH₵ ${minFloor.toFixed(2)})`,
          400,
          'BELOW_MINIMUM_PRICE_FORBIDDEN'
        );
      }

      const itemTotal = basePrice * item.quantity;
      const itemCostTotal = costPrice * item.quantity;

      subtotal += itemTotal;
      totalCost += itemCostTotal;

      processedItems.push({
        product_id: prod.id,
        variant_id: item.variant_id || null,
        product_name: prod.name,
        sku: variant ? variant.sku : prod.sku,
        quantity: item.quantity,
        unit: item.unit || prod.unit || 'pcs',
        cost_price: costPrice,
        selling_price: basePrice,
        total_price: itemTotal,
        sqm_coverage: item.sqm_coverage || 0
      });
    }

    const discountAmount = parseFloat((subtotal * (discount_percent / 100)).toFixed(2));
    const totalAmount = parseFloat((subtotal - discountAmount).toFixed(2));

    // Credit Limit Verification (Phase 7 Task 3)
    if (isCreditSale && customer) {
      const currentDebt = parseFloat(customer.current_balance) || 0;
      const creditLimit = parseFloat(customer.credit_limit) || 0;

      // Calculate credit portion of this sale
      let creditPortion = totalAmount;
      if (Array.isArray(payments)) {
        const cp = payments.find(p => p.payment_method === 'CREDIT');
        if (cp) creditPortion = parseFloat(cp.amount);
      }

      if (currentDebt + creditPortion > creditLimit) {
        // Exceeded: Check if Super Admin or Admin PIN override is provided
        if (req.user.role !== 'super_admin') {
          if (!admin_pin) {
            return ApiResponse.error(
              res,
              `Credit limit exceeded! Limit: GH₵ ${creditLimit.toFixed(2)}, Current Debt: GH₵ ${currentDebt.toFixed(2)}, Sale: GH₵ ${creditPortion.toFixed(2)}. Super Admin or Admin PIN approval required.`,
              400,
              'CREDIT_LIMIT_EXCEEDED'
            );
          }
          const pinCheck = await verifyAdminPin(admin_pin);
          if (!pinCheck.valid) {
            return ApiResponse.error(res, `Admin PIN invalid for credit override: ${pinCheck.message}`, 403, 'INVALID_PIN');
          }
        }
      }
    }

    const tendered = cash_tendered !== undefined ? parseFloat(cash_tendered) : totalAmount;
    const changeGiven = (payment_method === 'CASH' && tendered > totalAmount) ? parseFloat((tendered - totalAmount).toFixed(2)) : 0;

    let saleId;
    let receiptNo;

    await db.transaction(async (trx) => {
      receiptNo = await getNextReceiptNumber(trx);

      const [newSale] = await trx('sales').insert({
        receipt_no: receiptNo,
        customer_id: customer ? customer.id : null,
        customer_name: customer ? customer.name : (customer_name || 'Walk-in Customer'),
        customer_phone: customer ? customer.phone : (customer_phone || null),
        staff_id: req.user.id,
        warehouse_name,
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount_percent,
        discount_amount: discountAmount,
        discount_approved_by: approverUser ? approverUser.id : null,
        total_amount: totalAmount,
        total_cost: parseFloat(totalCost.toFixed(2)),
        payment_method,
        payment_status: isCreditSale ? 'unpaid' : 'paid',
        verification_status: 'CASHIER_ENTERED',
        momo_reference: momo_reference || null,
        momo_network: momo_network || null,
        cash_tendered: tendered,
        change_given: changeGiven,
        credit_due_date: credit_due_date ? new Date(credit_due_date) : null,
        is_offline_sync: offline_client_id ? 1 : 0,
        offline_client_id: offline_client_id || null,
        idempotency_key: idempotency_key || null,
        status: 'completed',
        notes: notes || null
      }).returning('id');

      saleId = newSale.id;

      // Insert sale items and deduct stock
      for (const item of processedItems) {
        let stockQuery = trx('warehouse_stock')
          .where({ product_id: item.product_id, warehouse_name });
        if (item.variant_id) stockQuery = stockQuery.where({ variant_id: item.variant_id });
        else stockQuery = stockQuery.whereNull('variant_id');

        const stockRow = await stockQuery.forUpdate().first();
        const currentStock = stockRow ? parseFloat(stockRow.quantity) : 0;
        const reserved = stockRow ? parseFloat(stockRow.reserved_quantity || 0) : 0;
        const available = currentStock - reserved;

        if (available < item.quantity) {
          const err = new Error(`Insufficient stock for "${item.product_name}" in ${warehouse_name}. Available: ${available}, Requested: ${item.quantity}`);
          err.statusCode = 400;
          err.type = 'INSUFFICIENT_STOCK';
          throw err;
        }

        const newQty = currentStock - item.quantity;
        await trx('warehouse_stock').where({ id: stockRow.id }).update({
          quantity: newQty,
          updated_at: new Date()
        });

        await trx('sale_items').insert({
          sale_id: saleId,
          ...item
        });

        await trx('stock_movements').insert({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          movement_type: 'SALE',
          quantity: -item.quantity,
          unit: item.unit || 'pcs',
          from_location: warehouse_name,
          to_location: 'CUSTOMER',
          reference_type: 'SALE',
          reference_id: saleId,
          reference_no: receiptNo,
          cost_price: item.cost_price,
          total_cost: parseFloat((item.cost_price * item.quantity).toFixed(2)),
          balance_after: newQty,
          reason: `POS Sale Receipt ${receiptNo}`,
          created_by_id: req.user.id
        });
      }

      // Record payments in sale_payments table (Task 3)
      if (Array.isArray(payments) && payments.length > 0) {
        for (const p of payments) {
          await trx('sale_payments').insert({
            sale_id: saleId,
            payment_method: p.payment_method,
            amount: parseFloat(p.amount),
            reference_no: p.reference_no || null,
            momo_network: p.momo_network || null,
            verification_status: 'CASHIER_ENTERED',
            is_verified: false,
            cashier_id: req.user.id,
            notes: p.notes || null
          });
        }
      } else {
        await trx('sale_payments').insert({
          sale_id: saleId,
          payment_method,
          amount: totalAmount,
          reference_no: momo_reference || null,
          momo_network: momo_network || null,
          verification_status: 'CASHIER_ENTERED',
          is_verified: false,
          cashier_id: req.user.id,
          notes: notes || null
        });
      }

      // If credit sale, update customer debt balance (Phase 7 Task 3)
      if (isCreditSale && customer) {
        let creditPortion = totalAmount;
        if (Array.isArray(payments)) {
          const cp = payments.find(p => p.payment_method === 'CREDIT');
          if (cp) creditPortion = parseFloat(cp.amount);
        }
        await trx('customers').where({ id: customer.id }).increment('current_balance', creditPortion);
      }
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'SALE_CREATED',
      `Confirmed POS sale ${receiptNo} for GH₵ ${totalAmount.toFixed(2)} (${payment_method})`
    );

    return ApiResponse.success(res, {
      sale_id: saleId,
      receipt_no: receiptNo,
      total_amount: totalAmount,
      change_given: changeGiven,
      payment_method
    }, 'Sale completed successfully', 201);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 4 & 6: RECEIPTS & RECORD-LEVEL ACCESS CONTROL
// ============================================================================

// GET /api/v1/sales/receipt/:idOrNo
router.get('/receipt/:idOrNo', authenticateToken, async (req, res, next) => {
  try {
    const param = req.params.idOrNo;
    let query = db('sales as s')
      .join('users as u', 's.staff_id', 'u.id')
      .leftJoin('customers as c', 's.customer_id', 'c.id')
      .select(
        's.*',
        'u.name as staff_name',
        'c.customer_code',
        'c.current_balance as customer_current_balance'
      );

    if (isNaN(param)) {
      query = query.where('s.receipt_no', param);
    } else {
      query = query.where('s.id', parseInt(param));
    }

    const sale = await query.first();
    if (!sale) {
      return ApiResponse.error(res, 'Receipt not found', 404, 'NOT_FOUND');
    }

    // Permission & Record-Level Restriction:
    // Cashier (sales.view_own only) CANNOT view another cashier's receipt!
    const canViewAll = await checkUserPermission(req.user, 'sales.view_all');
    const canViewOwn = await checkUserPermission(req.user, 'sales.view_own');

    if (!canViewAll && !canViewOwn) {
      return ApiResponse.error(res, 'Permission denied: Cannot view sales records.', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    if (!canViewAll && sale.staff_id !== req.user.id) {
      return ApiResponse.error(
        res,
        'Access denied: You are restricted to viewing only your own transactions.',
        403,
        'FORBIDDEN_RECORD_ACCESS'
      );
    }

    const [items, payments] = await Promise.all([
      db('sale_items').where({ sale_id: sale.id }),
      db('sale_payments').where({ sale_id: sale.id })
    ]);

    // Anti-theft: Cost prices and profit are strictly masked unless possessing sales.view_costs
    const canViewCosts = await checkUserPermission(req.user, 'sales.view_costs');
    if (!canViewCosts) {
      delete sale.total_cost;
      delete sale.profit;
      items.forEach(it => { delete it.cost_price; });
    }

    const settingsRows = await db('settings').select('*');
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    return ApiResponse.success(res, {
      sale,
      items,
      payments,
      store_info: {
        name: settings.company_name || 'OMAL TILES & HARDWARE DEPOT',
        tin: settings.company_tin || 'C0028914567',
        phone: settings.company_phone || '+233 24 456 7890',
        email: settings.company_email || 'info@omalhardware.com',
        address: settings.company_address || 'Plot 48 Spintex Road, Accra, Ghana',
        footer: settings.receipt_footer || 'Thank you for your business. Quality Turkish Doors, Tiles & Hardware.'
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sales/my-today (Cashier personal summary)
router.get('/my-today', authenticateToken, requirePermission('sales.view_own'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const sales = await db('sales')
      .where({ staff_id: req.user.id })
      .whereRaw('DATE(created_at) = DATE(?)', [today])
      .orderBy('id', 'desc');

    const canViewCosts = await checkUserPermission(req.user, 'sales.view_costs');
    if (!canViewCosts) {
      sales.forEach(s => { delete s.total_cost; });
    }

    const summary = await db('sales')
      .where({ staff_id: req.user.id })
      .whereRaw('DATE(created_at) = DATE(?)', [today])
      .select(
        db.raw('COUNT(*) as total_sales_count'),
        db.raw('COALESCE(SUM(total_amount), 0) as total_sales_value'),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_total"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'MOMO' THEN total_amount ELSE 0 END), 0) as momo_total"),
        db.raw("COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END), 0) as credit_total")
      )
      .first();

    return ApiResponse.success(res, { sales, summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sales (List sales records with pagination and permission control)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { start_date, end_date, staff_id, payment_method, customer_id, search } = req.query;

    const canViewAll = await checkUserPermission(req.user, 'sales.view_all');
    const canViewOwn = await checkUserPermission(req.user, 'sales.view_own');

    if (!canViewAll && !canViewOwn) {
      return ApiResponse.error(res, 'Permission denied: Cannot view sales records.', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    let query = db('sales as s').join('users as u', 's.staff_id', 'u.id');

    // Record-Level Restriction: Cashier only sees their own sales
    if (!canViewAll) {
      query = query.where('s.staff_id', req.user.id);
    } else if (staff_id) {
      query = query.where('s.staff_id', parseInt(staff_id));
    }

    if (customer_id) query = query.where('s.customer_id', parseInt(customer_id));
    if (start_date) query = query.whereRaw('DATE(s.created_at) >= DATE(?)', [start_date]);
    if (end_date) query = query.whereRaw('DATE(s.created_at) <= DATE(?)', [end_date]);
    if (payment_method) query = query.where('s.payment_method', payment_method);
    if (search) {
      query = query.where(b => {
        b.whereILike('s.receipt_no', `%${search}%`)
          .orWhereILike('s.customer_name', `%${search}%`);
      });
    }

    const countRes = await query.clone().count('s.id as total').first();

    const selectFields = [
      's.id', 's.receipt_no', 's.customer_id', 's.customer_name', 's.customer_phone',
      's.subtotal', 's.discount_percent', 's.discount_amount', 's.total_amount',
      's.payment_method', 's.payment_status', 's.momo_network', 's.momo_reference',
      's.status', 's.created_at', 'u.name as staff_name'
    ];

    const canViewCosts = await checkUserPermission(req.user, 'sales.view_costs');
    if (canViewCosts) {
      selectFields.push('s.total_cost', db.raw('(s.total_amount - s.total_cost) as profit'));
    }

    const rows = await query.clone().select(selectFields).orderBy('s.id', 'desc').limit(limit).offset(offset);

    return ApiResponse.paginated(res, rows, parseInt(countRes.total), page, limit, 'Sales records retrieved');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

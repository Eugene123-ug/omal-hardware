const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse, parsePagination } = require('../../common/response');
const { validateBody } = require('../../middleware/validate');
const {
  supplierSchema,
  purchaseOrderSchema,
  updatePOSchema,
  approvePOSchema,
  grnSchema,
  supplierInvoiceSchema,
  supplierPaymentSchema
} = require('./purchasing.validation');
const {
  authenticateToken,
  requirePermission,
  verifyAdminPin,
  logAudit
} = require('../../middleware/auth');
const { checkUserPermission } = require('../../utils/security');

// Helper to calculate Weighted Average Cost (AVCO)
function calculateWeightedAverageCost(currentQty, currentCost, receivedQty, newCost) {
  const totalQty = currentQty + receivedQty;
  if (totalQty <= 0) return newCost || currentCost || 0;
  const totalValue = (currentQty * (currentCost || 0)) + (receivedQty * newCost);
  return parseFloat((totalValue / totalQty).toFixed(2));
}

// Helper to sanitize supplier for unauthorized roles
async function sanitizeSupplierForUser(supplier, user) {
  const canViewFinancials = await checkUserPermission(user, 'suppliers.manage') ||
    await checkUserPermission(user, 'finance.view') ||
    user.role === 'super_admin' || user.role === 'admin';

  const copy = { ...supplier };
  if (!canViewFinancials) {
    delete copy.bank_details;
    delete copy.balance_owed;
    delete copy.payment_terms;
  }
  return copy;
}

// ============================================================================
// TASK 1: SUPPLIER MANAGEMENT
// ============================================================================

// GET /api/v1/purchasing/suppliers (or /api/v1/suppliers)
router.get(['/suppliers', '/'], authenticateToken, requirePermission('suppliers.view'), async (req, res, next) => {
  try {
    const { status, search, product_category } = req.query;

    let query = db('suppliers');

    if (status) query = query.where({ status });
    if (search) {
      query = query.where(builder => {
        builder.whereILike('name', `%${search}%`)
          .orWhereILike('phone', `%${search}%`)
          .orWhereILike('contact_person', `%${search}%`)
          .orWhereILike('tax_id', `%${search}%`);
      });
    }

    const suppliers = await query.orderBy('name', 'asc');

    let filtered = suppliers;
    if (product_category && product_category !== 'All') {
      filtered = suppliers.filter(s => {
        const prods = Array.isArray(s.products_supplied) ? s.products_supplied : [];
        return prods.some(p => p.toLowerCase().includes(product_category.toLowerCase()));
      });
    }

    const sanitized = await Promise.all(filtered.map(s => sanitizeSupplierForUser(s, req.user)));
    return ApiResponse.success(res, sanitized);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchasing/suppliers/:id (or /api/v1/suppliers/:id)
router.get(['/suppliers/:id', '/:id'], authenticateToken, requirePermission('suppliers.view'), async (req, res, next) => {
  if (req.params.id && isNaN(parseInt(req.params.id))) return next();
  try {
    const supplier = await db('suppliers').where({ id: req.params.id }).first();
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404, 'NOT_FOUND');
    }

    // 4 Distinct Financial Valuation Metrics (Task 4)
    // 1. Ordered Value (Approved / Committed POs)
    const poStats = await db('purchase_orders')
      .where({ supplier_id: supplier.id })
      .whereIn('status', ['approved', 'partially_received', 'completed'])
      .sum('total_amount as ordered_value')
      .count('id as total_pos')
      .first();

    // 2. Received Value (GRNs)
    const grnStats = await db('goods_received_notes')
      .where({ supplier_id: supplier.id })
      .sum('total_cost as received_value')
      .count('id as total_grns')
      .first();

    // 3. Invoiced Value (Supplier Invoices)
    const invoiceStats = await db('supplier_invoices')
      .where({ supplier_id: supplier.id })
      .sum('total_amount as invoiced_value')
      .sum('amount_paid as invoice_paid_value')
      .sum('balance_due as invoice_balance_due')
      .first();

    // 4. Amount Paid (Disbursed Payments)
    const paymentStats = await db('supplier_payments')
      .where({ supplier_id: supplier.id })
      .sum('amount as total_paid')
      .first();

    const orderedValue = parseFloat(poStats?.ordered_value || 0);
    const receivedValue = parseFloat(grnStats?.received_value || 0);
    const invoicedValue = parseFloat(invoiceStats?.invoiced_value || 0);
    const amountPaid = parseFloat(paymentStats?.total_paid || 0);
    const reconciledBalance = invoicedValue > 0 ? (invoicedValue - amountPaid) : parseFloat(supplier.balance_owed || 0);

    const sanitized = await sanitizeSupplierForUser(supplier, req.user);

    return ApiResponse.success(res, {
      ...sanitized,
      financial_metrics: {
        ordered_value: orderedValue,
        received_value: receivedValue,
        invoiced_value: invoicedValue,
        amount_paid: amountPaid,
        outstanding_balance: reconciledBalance
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchasing/suppliers (or /api/v1/suppliers)
router.post(['/suppliers', '/'], authenticateToken, requirePermission('suppliers.manage'), validateBody(supplierSchema), async (req, res, next) => {
  try {
    const {
      name,
      phone,
      email,
      contact_person,
      location,
      address,
      tax_id,
      products_supplied,
      payment_terms = 'COD',
      status = 'active',
      supporting_documents = [],
      bank_details,
      balance_owed = 0
    } = req.body;

    const [newSupplier] = await db('suppliers').insert({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      contact_person: contact_person ? contact_person.trim() : null,
      location: location ? location.trim() : null,
      address: address ? address.trim() : null,
      tax_id: tax_id ? tax_id.trim() : null,
      products_supplied: JSON.stringify(products_supplied || []),
      payment_terms,
      status,
      supporting_documents: JSON.stringify(supporting_documents || []),
      bank_details: bank_details ? JSON.stringify(bank_details) : null,
      balance_owed: parseFloat(balance_owed) || 0
    }).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'SUPPLIER_CREATED',
      `Registered supplier "${newSupplier.name}" (TIN: ${tax_id || 'N/A'}, Terms: ${payment_terms})`
    );

    return ApiResponse.success(res, newSupplier, 'Supplier profile created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/purchasing/suppliers/:id (or /api/v1/suppliers/:id)
router.put(['/suppliers/:id', '/:id'], authenticateToken, requirePermission('suppliers.manage'), validateBody(supplierSchema), async (req, res, next) => {
  if (req.params.id && isNaN(parseInt(req.params.id))) return next();
  try {
    const existing = await db('suppliers').where({ id: req.params.id }).first();
    if (!existing) {
      return ApiResponse.error(res, 'Supplier not found', 404, 'NOT_FOUND');
    }

    const {
      name,
      phone,
      email,
      contact_person,
      location,
      address,
      tax_id,
      products_supplied,
      payment_terms,
      status,
      supporting_documents,
      bank_details,
      balance_owed
    } = req.body;

    const [updated] = await db('suppliers').where({ id: req.params.id }).update({
      name: name ? name.trim() : existing.name,
      phone: phone ? phone.trim() : existing.phone,
      email: email !== undefined ? (email ? email.trim() : null) : existing.email,
      contact_person: contact_person !== undefined ? contact_person : existing.contact_person,
      location: location !== undefined ? location : existing.location,
      address: address !== undefined ? address : existing.address,
      tax_id: tax_id !== undefined ? tax_id : existing.tax_id,
      products_supplied: products_supplied !== undefined ? JSON.stringify(products_supplied) : existing.products_supplied,
      payment_terms: payment_terms || existing.payment_terms,
      status: status || existing.status,
      supporting_documents: supporting_documents !== undefined ? JSON.stringify(supporting_documents) : existing.supporting_documents,
      bank_details: bank_details !== undefined ? JSON.stringify(bank_details) : existing.bank_details,
      balance_owed: balance_owed !== undefined ? parseFloat(balance_owed) : existing.balance_owed,
      updated_at: new Date()
    }).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'SUPPLIER_UPDATED',
      `Updated supplier profile "${updated.name}"`
    );

    return ApiResponse.success(res, updated, 'Supplier profile updated successfully');
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/purchasing/suppliers/:id/status (or /api/v1/suppliers/:id/status)
router.put(['/suppliers/:id/status', '/:id/status'], authenticateToken, requirePermission('suppliers.manage'), async (req, res, next) => {
  if (req.params.id && isNaN(parseInt(req.params.id))) return next();
  try {
    const { status, reason } = req.body;
    if (!['active', 'inactive', 'blacklisted'].includes(status)) {
      return ApiResponse.error(res, 'Invalid status. Must be active, inactive, or blacklisted', 400, 'BAD_REQUEST');
    }

    const [updated] = await db('suppliers').where({ id: req.params.id }).update({
      status,
      updated_at: new Date()
    }).returning('*');

    if (!updated) return ApiResponse.error(res, 'Supplier not found', 404, 'NOT_FOUND');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'SUPPLIER_STATUS_CHANGED',
      `Changed supplier "${updated.name}" status to ${status}. Reason: ${reason || 'N/A'}`
    );

    return ApiResponse.success(res, updated, `Supplier status updated to ${status}`);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 2: PURCHASE ORDERS & APPROVAL RULES
// ============================================================================

// GET /api/v1/purchasing/purchase-orders (Filterable PO List)
router.get('/purchase-orders', authenticateToken, requirePermission('inventory.receive'), async (req, res, next) => {
  try {
    const { status, supplier_id, search } = req.query;

    let query = db('purchase_orders as po')
      .leftJoin('suppliers as s', 'po.supplier_id', 's.id')
      .leftJoin('users as u', 'po.created_by_id', 'u.id')
      .leftJoin('users as au', 'po.approved_by_id', 'au.id');

    if (status && status !== 'All') query = query.where('po.status', status);
    if (supplier_id) query = query.where('po.supplier_id', parseInt(supplier_id));
    if (search) {
      query = query.where(builder => {
        builder.whereILike('po.po_number', `%${search}%`)
          .orWhereILike('s.name', `%${search}%`)
          .orWhereILike('po.supplier_reference', `%${search}%`);
      });
    }

    const pos = await query.select(
      'po.*',
      's.name as supplier_name',
      's.phone as supplier_phone',
      'u.name as created_by_name',
      'au.name as approved_by_name'
    ).orderBy('po.id', 'desc');

    return ApiResponse.success(res, pos);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchasing/purchase-orders/:id (PO Details with Line Items)
router.get('/purchase-orders/:id', authenticateToken, requirePermission('inventory.receive'), async (req, res, next) => {
  try {
    const po = await db('purchase_orders as po')
      .leftJoin('suppliers as s', 'po.supplier_id', 's.id')
      .leftJoin('users as u', 'po.created_by_id', 'u.id')
      .leftJoin('users as au', 'po.approved_by_id', 'au.id')
      .where('po.id', req.params.id)
      .select(
        'po.*',
        's.name as supplier_name',
        's.phone as supplier_phone',
        's.contact_person as supplier_contact',
        's.payment_terms as supplier_payment_terms',
        'u.name as created_by_name',
        'au.name as approved_by_name'
      )
      .first();

    if (!po) return ApiResponse.error(res, 'Purchase order not found', 404, 'NOT_FOUND');

    const items = await db('purchase_order_items as poi')
      .join('products as p', 'poi.product_id', 'p.id')
      .leftJoin('product_variants as pv', 'poi.variant_id', 'pv.id')
      .where('poi.po_id', po.id)
      .select(
        'poi.*',
        'p.name as product_name',
        'p.sku as product_sku',
        'p.category',
        'pv.variant_name',
        'pv.sku as variant_sku',
        db.raw('(poi.ordered_quantity - poi.received_quantity) as remaining_quantity')
      );

    return ApiResponse.success(res, { ...po, items });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchasing/purchase-orders (Create Draft PO)
// Acceptance Criteria: "A purchase order does not itself increase stock."
router.post('/purchase-orders', authenticateToken, requirePermission('inventory.receive'), validateBody(purchaseOrderSchema), async (req, res, next) => {
  try {
    const {
      supplier_id,
      warehouse_name = 'Main Showroom',
      expected_delivery_date,
      supplier_reference,
      notes,
      items,
      status: requestedStatus
    } = req.body;

    const supplier = await db('suppliers').where({ id: supplier_id }).first();
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404, 'NOT_FOUND');
    }

    if (supplier.status === 'blacklisted') {
      return ApiResponse.error(res, `Cannot create PO: Supplier "${supplier.name}" is blacklisted`, 400, 'SUPPLIER_BLACKLISTED');
    }

    const isLegacyPayload = items.some(item => item.quantity !== undefined && item.ordered_quantity === undefined);
    const initialStatus = requestedStatus || (isLegacyPayload ? 'pending' : 'draft');

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    let totalPoAmount = 0;
    const poItemsToInsert = [];

    for (const item of items) {
      const prod = await db('products').where({ id: item.product_id }).first();
      if (!prod) {
        return ApiResponse.error(res, `Product ID #${item.product_id} not found`, 404, 'PRODUCT_NOT_FOUND');
      }

      const qty = parseFloat(item.ordered_quantity ?? item.quantity);
      const unitCost = parseFloat(item.unit_cost ?? item.cost_price ?? 0);
      const lineTotal = parseFloat((qty * unitCost).toFixed(2));
      totalPoAmount += lineTotal;

      poItemsToInsert.push({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        ordered_quantity: qty,
        received_quantity: 0,
        rejected_quantity: 0,
        unit: item.unit || prod.unit || 'pcs',
        unit_cost: unitCost,
        total_cost: lineTotal,
        expected_delivery_date: expected_delivery_date || null,
        status: 'pending',
        notes: item.notes || null
      });
    }

    let poId;
    await db.transaction(async (trx) => {
      const [newPo] = await trx('purchase_orders').insert({
        po_number: poNumber,
        supplier_id,
        warehouse_name,
        expected_delivery_date: expected_delivery_date || null,
        supplier_reference: supplier_reference || '',
        status: initialStatus,
        approval_status: initialStatus === 'pending' ? 'approved' : 'pending',
        total_amount: parseFloat(totalPoAmount.toFixed(2)),
        notes: notes || '',
        created_by_id: req.user.id
      }).returning('id');

      poId = newPo.id;

      const itemsWithPoId = poItemsToInsert.map(i => ({ ...i, po_id: poId }));
      await trx('purchase_order_items').insert(itemsWithPoId);
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PO_DRAFT_CREATED',
      `Created draft purchase order ${poNumber} for supplier "${supplier.name}" (Total: GH₵ ${totalPoAmount.toFixed(2)})`
    );

    return ApiResponse.success(res, {
      id: poId,
      po_number: poNumber,
      total_amount: totalPoAmount,
      status: initialStatus
    }, 'Purchase order created successfully. (Stock is not altered by PO creation)', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/purchasing/purchase-orders/:id (Update Draft PO)
router.put('/purchase-orders/:id', authenticateToken, requirePermission('inventory.receive'), validateBody(updatePOSchema), async (req, res, next) => {
  try {
    const po = await db('purchase_orders').where({ id: req.params.id }).first();
    if (!po) return ApiResponse.error(res, 'Purchase order not found', 404, 'NOT_FOUND');

    if (po.status !== 'draft' && po.status !== 'pending_approval') {
      return ApiResponse.error(res, `Cannot modify purchase order in status "${po.status}". Only draft or pending orders can be updated.`, 400, 'CANNOT_EDIT_LOCKED_PO');
    }

    const {
      supplier_id,
      warehouse_name,
      expected_delivery_date,
      supplier_reference,
      notes,
      items
    } = req.body;

    await db.transaction(async (trx) => {
      let totalPoAmount = parseFloat(po.total_amount);

      if (items && Array.isArray(items) && items.length > 0) {
        await trx('purchase_order_items').where({ po_id: po.id }).delete();
        totalPoAmount = 0;

        const newItems = items.map(item => {
          const qty = parseFloat(item.ordered_quantity ?? item.quantity);
          const unitCost = parseFloat(item.unit_cost ?? item.cost_price ?? 0);
          const lineTotal = parseFloat((qty * unitCost).toFixed(2));
          totalPoAmount += lineTotal;

          return {
            po_id: po.id,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            ordered_quantity: qty,
            received_quantity: 0,
            rejected_quantity: 0,
            unit: item.unit || 'pcs',
            unit_cost: unitCost,
            total_cost: lineTotal,
            expected_delivery_date: expected_delivery_date || po.expected_delivery_date,
            status: 'pending',
            notes: item.notes || null
          };
        });

        await trx('purchase_order_items').insert(newItems);
      }

      await trx('purchase_orders').where({ id: po.id }).update({
        supplier_id: supplier_id || po.supplier_id,
        warehouse_name: warehouse_name || po.warehouse_name,
        expected_delivery_date: expected_delivery_date !== undefined ? expected_delivery_date : po.expected_delivery_date,
        supplier_reference: supplier_reference !== undefined ? supplier_reference : po.supplier_reference,
        notes: notes !== undefined ? notes : po.notes,
        total_amount: parseFloat(totalPoAmount.toFixed(2))
      });
    });

    await logAudit(req.user.id, req.user.name, req.user.role, 'PO_UPDATED', `Updated purchase order ${po.po_number}`);

    return ApiResponse.success(res, null, 'Purchase order updated successfully');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchasing/purchase-orders/:id/submit (Submit Draft for Approval)
router.post('/purchase-orders/:id/submit', authenticateToken, requirePermission('inventory.receive'), async (req, res, next) => {
  try {
    const po = await db('purchase_orders').where({ id: req.params.id }).first();
    if (!po) return ApiResponse.error(res, 'Purchase order not found', 404, 'NOT_FOUND');

    if (po.status !== 'draft') {
      return ApiResponse.error(res, `Cannot submit order: Current status is "${po.status}"`, 400, 'BAD_REQUEST');
    }

    await db('purchase_orders').where({ id: po.id }).update({
      status: 'pending_approval',
      approval_status: 'pending'
    });

    await logAudit(req.user.id, req.user.name, req.user.role, 'PO_SUBMITTED', `Submitted purchase order ${po.po_number} for authorization`);

    return ApiResponse.success(res, null, 'Purchase order submitted for manager approval');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchasing/purchase-orders/:id/approve (Authorise or Reject PO)
router.post('/purchase-orders/:id/approve', authenticateToken, requirePermission('inventory.receive'), validateBody(approvePOSchema), async (req, res, next) => {
  try {
    const po = await db('purchase_orders').where({ id: req.params.id }).first();
    if (!po) return ApiResponse.error(res, 'Purchase order not found', 404, 'NOT_FOUND');

    if (po.status !== 'draft' && po.status !== 'pending_approval') {
      return ApiResponse.error(res, `Cannot approve order: Current status is "${po.status}"`, 400, 'BAD_REQUEST');
    }

    const { status, approval_notes, admin_pin } = req.body;

    // Check approval authorization threshold: Orders > GH₵ 10,000 require Super Admin or Admin PIN verification
    const highValueThreshold = 10000;
    if (parseFloat(po.total_amount) >= highValueThreshold && req.user.role !== 'super_admin') {
      if (!admin_pin) {
        return ApiResponse.error(
          res,
          `High-value purchase orders (>= GH₵ ${highValueThreshold}) require Super Admin authorization or Admin PIN verification.`,
          403,
          'SUPER_ADMIN_APPROVAL_REQUIRED'
        );
      }
      const pinCheck = await verifyAdminPin(admin_pin);
      if (!pinCheck.valid) {
        return ApiResponse.error(res, `Admin PIN invalid: ${pinCheck.message}`, 403, 'INVALID_PIN');
      }
    }

    if (status === 'approved') {
      await db('purchase_orders').where({ id: po.id }).update({
        status: 'approved',
        approval_status: 'approved',
        approved_by_id: req.user.id,
        approved_at: new Date(),
        approval_notes: approval_notes || 'Formally authorised'
      });

      await logAudit(
        req.user.id,
        req.user.name,
        req.user.role,
        'PO_APPROVED',
        `Approved purchase order ${po.po_number} (Value: GH₵ ${parseFloat(po.total_amount).toFixed(2)})`
      );

      return ApiResponse.success(res, null, 'Purchase order formally approved. Deliveries can now be received.');
    } else {
      await db('purchase_orders').where({ id: po.id }).update({
        status: 'cancelled',
        approval_status: 'rejected',
        approval_notes: approval_notes || 'Rejected by manager'
      });

      await logAudit(
        req.user.id,
        req.user.name,
        req.user.role,
        'PO_REJECTED',
        `Rejected purchase order ${po.po_number}. Reason: ${approval_notes || 'N/A'}`
      );

      return ApiResponse.success(res, null, 'Purchase order rejected and cancelled.');
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchasing/purchase-orders/:id/cancel (Cancel PO)
router.post('/purchase-orders/:id/cancel', authenticateToken, requirePermission('inventory.receive'), async (req, res, next) => {
  try {
    const po = await db('purchase_orders').where({ id: req.params.id }).first();
    if (!po) return ApiResponse.error(res, 'Purchase order not found', 404, 'NOT_FOUND');

    if (po.status === 'completed' || po.status === 'cancelled') {
      return ApiResponse.error(res, `Cannot cancel order with status "${po.status}"`, 400, 'BAD_REQUEST');
    }

    const { cancellation_reason } = req.body;

    await db('purchase_orders').where({ id: po.id }).update({
      status: 'cancelled',
      cancelled_by_id: req.user.id,
      cancellation_reason: cancellation_reason || 'Cancelled by operator'
    });

    await db('purchase_order_items').where({ po_id: po.id }).update({ status: 'cancelled' });

    await logAudit(req.user.id, req.user.name, req.user.role, 'PO_CANCELLED', `Cancelled purchase order ${po.po_number}`);

    return ApiResponse.success(res, null, 'Purchase order cancelled');
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 3: GOODS RECEIVED NOTES (GRN) & CONFIRMED DELIVERIES
// ============================================================================

// GET /api/v1/purchasing/grn (List GRNs)
router.get('/grn', authenticateToken, requirePermission('inventory.receive'), async (req, res, next) => {
  try {
    const { supplier_id, search } = req.query;

    let query = db('goods_received_notes as g')
      .leftJoin('purchase_orders as po', 'g.po_id', 'po.id')
      .leftJoin('suppliers as s', 'g.supplier_id', 's.id')
      .leftJoin('users as u', 'g.received_by_id', 'u.id');

    if (supplier_id) query = query.where('g.supplier_id', parseInt(supplier_id));
    if (search) {
      query = query.where(builder => {
        builder.whereILike('g.grn_number', `%${search}%`)
          .orWhereILike('g.delivery_note_no', `%${search}%`)
          .orWhereILike('g.supplier_invoice_no', `%${search}%`)
          .orWhereILike('s.name', `%${search}%`);
      });
    }

    const grns = await query.select(
      'g.*',
      'po.po_number',
      's.name as supplier_name',
      'u.name as received_by_name'
    ).orderBy('g.id', 'desc');

    return ApiResponse.success(res, grns);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchasing/grn/:id (GRN Details with Itemized Discrepancies)
router.get('/grn/:id', authenticateToken, requirePermission('inventory.receive'), async (req, res, next) => {
  try {
    const grn = await db('goods_received_notes as g')
      .leftJoin('purchase_orders as po', 'g.po_id', 'po.id')
      .leftJoin('suppliers as s', 'g.supplier_id', 's.id')
      .leftJoin('users as u', 'g.received_by_id', 'u.id')
      .where('g.id', req.params.id)
      .select(
        'g.*',
        'po.po_number',
        's.name as supplier_name',
        'u.name as received_by_name'
      )
      .first();

    if (!grn) return ApiResponse.error(res, 'Goods Received Note not found', 404, 'NOT_FOUND');

    const items = await db('grn_items as gi')
      .join('products as p', 'gi.product_id', 'p.id')
      .leftJoin('product_variants as pv', 'gi.variant_id', 'pv.id')
      .where('gi.grn_id', grn.id)
      .select(
        'gi.*',
        'p.name as product_name',
        'p.sku as product_sku',
        'p.category',
        'pv.variant_name'
      );

    return ApiResponse.success(res, { ...grn, items });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchasing/grn (Process Inward Delivery against PO)
// Acceptance Criteria:
// 1. Confirmed receipts increase stock exactly once.
// 2. Reject duplicate receipts.
// 3. Update stock ONLY for confirmed received quantities (rejected/damaged are logged, not added to sellable stock).
router.post('/grn', authenticateToken, requirePermission('inventory.receive'), validateBody(grnSchema), async (req, res, next) => {
  try {
    const {
      po_id,
      supplier_id,
      supplier_invoice_no,
      delivery_note_no,
      warehouse_name = 'Main Showroom',
      notes,
      items
    } = req.body;

    let targetPo = null;
    if (po_id) {
      targetPo = await db('purchase_orders').where({ id: po_id }).first();
      if (!targetPo) return ApiResponse.error(res, `Purchase Order #${po_id} not found`, 404, 'NOT_FOUND');

      // Acceptance Criteria: Deliveries only against approved orders
      if (targetPo.status !== 'approved' && targetPo.status !== 'partially_received') {
        return ApiResponse.error(
          res,
          `Cannot receive deliveries against PO #${targetPo.po_number}. Status is "${targetPo.status}". Only approved orders accept receipts.`,
          400,
          'PO_NOT_APPROVED'
        );
      }
    }

    // Idempotency: Prevent duplicate delivery processing
    if (delivery_note_no && po_id) {
      const existingDuplicate = await db('goods_received_notes')
        .where({ po_id, delivery_note_no })
        .first();
      if (existingDuplicate) {
        return ApiResponse.error(
          res,
          `Duplicate receipt prevented: Delivery Note "${delivery_note_no}" has already been processed under GRN #${existingDuplicate.grn_number}`,
          409,
          'DUPLICATE_RECEIPT_PREVENTED'
        );
      }
    }

    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;
    let totalReceivedValue = 0;
    const discrepanciesRecorded = [];
    let grnId;

    await db.transaction(async (trx) => {
      // 1. Create Goods Received Note header
      const [newGrn] = await trx('goods_received_notes').insert({
        grn_number: grnNumber,
        po_id: po_id || null,
        supplier_id: supplier_id || (targetPo ? targetPo.supplier_id : null),
        supplier_invoice_no: supplier_invoice_no || '',
        delivery_note_no: delivery_note_no || '',
        warehouse_name,
        total_cost: 0, // updated after item processing
        items_json: JSON.stringify(items),
        status: 'completed',
        received_by_id: req.user.id
      }).returning('id');

      grnId = newGrn.id;

      // 2. Process each item
      for (const item of items) {
        const prod = await trx('products').where({ id: item.product_id }).first();
        if (!prod) throw new Error(`Product #${item.product_id} not found`);

        const receivedQty = parseFloat(item.received_quantity); // undamaged sellable
        const rejectedQty = parseFloat(item.rejected_quantity || 0); // rejected back
        const damagedQty = parseFloat(item.damaged_quantity || 0); // damaged on arrival
        const orderedQty = parseFloat(item.ordered_quantity || receivedQty);
        const unitCost = parseFloat(item.unit_cost);
        const lineTotal = parseFloat((receivedQty * unitCost).toFixed(2));
        totalReceivedValue += lineTotal;

        const discrepancyQty = orderedQty - (receivedQty + rejectedQty + damagedQty);
        if (discrepancyQty !== 0 || rejectedQty > 0 || damagedQty > 0 || item.discrepancy_reason) {
          discrepanciesRecorded.push({
            product_id: item.product_id,
            product_name: prod.name,
            sku: prod.sku,
            ordered: orderedQty,
            received: receivedQty,
            rejected: rejectedQty,
            damaged: damagedQty,
            discrepancy: discrepancyQty,
            reason: item.discrepancy_reason || (discrepancyQty > 0 ? `Short delivered by ${discrepancyQty}` : 'Damaged / rejected units noted')
          });
        }

        // Save into grn_items
        await trx('grn_items').insert({
          grn_id: grnId,
          po_item_id: item.po_item_id || null,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          ordered_quantity: orderedQty,
          received_quantity: receivedQty,
          rejected_quantity: rejectedQty,
          damaged_quantity: damagedQty,
          unit: item.unit || prod.unit || 'pcs',
          unit_cost: unitCost,
          total_cost: lineTotal,
          discrepancy_reason: item.discrepancy_reason || null
        });

        // 3. Update stock ONLY for confirmed accepted received quantities
        if (receivedQty > 0) {
          let stockQuery = trx('warehouse_stock').where({ product_id: item.product_id, warehouse_name });
          if (item.variant_id) {
            stockQuery = stockQuery.where({ variant_id: item.variant_id });
          } else {
            stockQuery = stockQuery.whereNull('variant_id');
          }

          const stockRow = await stockQuery.forUpdate().first();
          const currentQty = stockRow ? parseFloat(stockRow.quantity) : 0;
          const newQty = currentQty + receivedQty;

          // Update AVCO cost price
          const currentCost = parseFloat(prod.cost_price || 0);
          const avcoCost = calculateWeightedAverageCost(currentQty, currentCost, receivedQty, unitCost);

          await trx('products').where({ id: item.product_id }).update({
            cost_price: avcoCost,
            updated_at: new Date()
          });

          if (stockRow) {
            await trx('warehouse_stock').where({ id: stockRow.id }).update({
              quantity: newQty,
              updated_at: new Date()
            });
          } else {
            await trx('warehouse_stock').insert({
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              warehouse_name,
              quantity: newQty,
              reserved_quantity: 0
            });
          }

          // Write to immutable stock movement ledger
          await trx('stock_movements').insert({
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            movement_type: 'PURCHASE_RECEIPT',
            quantity: receivedQty,
            unit: item.unit || prod.unit || 'pcs',
            from_location: targetPo ? `PO #${targetPo.po_number}` : 'Supplier Delivery',
            to_location: warehouse_name,
            reference_type: 'PURCHASE_RECEIPT',
            reference_id: grnId,
            reference_no: delivery_note_no || supplier_invoice_no || grnNumber,
            cost_price: unitCost,
            total_cost: lineTotal,
            balance_after: newQty,
            discrepancy_quantity: discrepancyQty,
            reason: `GRN delivery receipt: ${grnNumber} (PO: ${targetPo ? targetPo.po_number : 'Direct'})`,
            created_by_id: req.user.id
          });
        }

        // If goods arrived damaged, log quarantine DAMAGE movement (not added to sellable stock)
        if (damagedQty > 0) {
          await trx('stock_movements').insert({
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            movement_type: 'DAMAGE',
            quantity: -damagedQty,
            unit: item.unit || prod.unit || 'pcs',
            from_location: 'SUPPLIER_DELIVERY',
            to_location: 'DAMAGED_SCRAP',
            reference_type: 'PURCHASE_RECEIPT',
            reference_id: grnId,
            reference_no: grnNumber,
            cost_price: unitCost,
            total_cost: damagedQty * unitCost,
            reason: `Damaged upon arrival: ${item.discrepancy_reason || 'Carrier transit breakage'}`,
            created_by_id: req.user.id
          });
        }

        // 4. Update PO Item received progress if linked
        if (po_id) {
          let poItemQuery = trx('purchase_order_items').where({ po_id, product_id: item.product_id });
          if (item.variant_id) {
            poItemQuery = poItemQuery.where({ variant_id: item.variant_id });
          } else {
            poItemQuery = poItemQuery.whereNull('variant_id');
          }
          if (item.po_item_id) {
            poItemQuery = trx('purchase_order_items').where({ id: item.po_item_id });
          }

          const poItem = await poItemQuery.first();
          if (poItem) {
            const updatedReceivedQty = parseFloat(poItem.received_quantity) + receivedQty;
            const updatedRejectedQty = parseFloat(poItem.rejected_quantity) + rejectedQty + damagedQty;
            const isCompleted = updatedReceivedQty >= parseFloat(poItem.ordered_quantity);

            await trx('purchase_order_items').where({ id: poItem.id }).update({
              received_quantity: updatedReceivedQty,
              rejected_quantity: updatedRejectedQty,
              status: isCompleted ? 'completed' : 'partial',
              updated_at: new Date()
            });
          }
        }
      }

      // Update GRN total cost and discrepancy notes
      await trx('goods_received_notes').where({ id: grnId }).update({
        total_cost: parseFloat(totalReceivedValue.toFixed(2)),
        discrepancy_notes: discrepanciesRecorded.length > 0 ? JSON.stringify(discrepanciesRecorded) : null
      });

      // 5. Update PO overall status (partially_received vs completed)
      if (po_id) {
        const remainingItems = await trx('purchase_order_items')
          .where({ po_id })
          .whereRaw('received_quantity < ordered_quantity');

        const newPoStatus = remainingItems.length === 0 ? 'completed' : 'partially_received';
        await trx('purchase_orders').where({ id: po_id }).update({ status: newPoStatus });
      }

      // 6. Automatically update supplier payable balance with received value
      const targetSupplierId = supplier_id || (targetPo ? targetPo.supplier_id : null);
      if (targetSupplierId) {
        await trx('suppliers').where({ id: targetSupplierId }).increment('balance_owed', totalReceivedValue);
      }
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'GRN_PROCESSED',
      `Processed Goods Received Note ${grnNumber} for ${items.length} items. Total Received Value: GH₵ ${totalReceivedValue.toFixed(2)}`
    );

    return ApiResponse.success(res, {
      id: grnId,
      grn_number: grnNumber,
      total_received_value: totalReceivedValue,
      discrepancies: discrepanciesRecorded
    }, 'Confirmed deliveries received and stock ledger updated', 201);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 4: SUPPLIER INVOICES, PAYMENTS & RECONCILED BALANCES
// ============================================================================

// GET /api/v1/purchasing/invoices (List Invoices)
router.get('/invoices', authenticateToken, requirePermission('suppliers.view'), async (req, res, next) => {
  try {
    const { supplier_id, status } = req.query;

    let query = db('supplier_invoices as si')
      .join('suppliers as s', 'si.supplier_id', 's.id')
      .leftJoin('purchase_orders as po', 'si.po_id', 'po.id')
      .leftJoin('users as u', 'si.created_by_id', 'u.id');

    if (supplier_id) query = query.where('si.supplier_id', parseInt(supplier_id));
    if (status && status !== 'All') query = query.where('si.status', status);

    const invoices = await query.select(
      'si.*',
      's.name as supplier_name',
      'po.po_number',
      'u.name as created_by_name'
    ).orderBy('si.id', 'desc');

    return ApiResponse.success(res, invoices);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchasing/invoices (Register Supplier Invoice / Bill)
router.post('/invoices', authenticateToken, requirePermission('suppliers.manage'), validateBody(supplierInvoiceSchema), async (req, res, next) => {
  try {
    const {
      invoice_number,
      supplier_id,
      po_id,
      grn_id,
      invoice_date,
      due_date,
      subtotal,
      tax_amount = 0,
      total_amount,
      notes,
      supporting_documents = []
    } = req.body;

    const supplier = await db('suppliers').where({ id: supplier_id }).first();
    if (!supplier) return ApiResponse.error(res, 'Supplier not found', 404, 'NOT_FOUND');

    // Check duplicate invoice number for this supplier
    const duplicate = await db('supplier_invoices')
      .where({ supplier_id, invoice_number: invoice_number.trim() })
      .first();
    if (duplicate) {
      return ApiResponse.error(
        res,
        `Invoice number "${invoice_number}" already exists for supplier "${supplier.name}"`,
        409,
        'DUPLICATE_INVOICE'
      );
    }

    const total = parseFloat(total_amount);

    const [invoice] = await db('supplier_invoices').insert({
      invoice_number: invoice_number.trim(),
      supplier_id,
      po_id: po_id || null,
      grn_id: grn_id || null,
      invoice_date,
      due_date: due_date || null,
      subtotal: parseFloat(subtotal),
      tax_amount: parseFloat(tax_amount),
      total_amount: total,
      amount_paid: 0,
      balance_due: total,
      status: 'unpaid',
      notes: notes || '',
      supporting_documents: JSON.stringify(supporting_documents || []),
      created_by_id: req.user.id
    }).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'SUPPLIER_INVOICE_RECORDED',
      `Registered supplier invoice ${invoice.invoice_number} for "${supplier.name}" (Amount: GH₵ ${total.toFixed(2)})`
    );

    return ApiResponse.success(res, invoice, 'Supplier invoice registered successfully', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchasing/payments (List Payments)
router.get('/payments', authenticateToken, requirePermission('suppliers.view'), async (req, res, next) => {
  try {
    const { supplier_id, start_date, end_date } = req.query;

    let query = db('supplier_payments as sp')
      .join('suppliers as s', 'sp.supplier_id', 's.id')
      .leftJoin('supplier_invoices as si', 'sp.invoice_id', 'si.id')
      .leftJoin('users as u', 'sp.recorded_by_id', 'u.id');

    if (supplier_id) query = query.where('sp.supplier_id', parseInt(supplier_id));
    if (start_date) query = query.where('sp.payment_date', '>=', start_date);
    if (end_date) query = query.where('sp.payment_date', '<=', end_date);

    const payments = await query.select(
      'sp.*',
      's.name as supplier_name',
      'si.invoice_number',
      'u.name as recorded_by_name'
    ).orderBy('sp.id', 'desc');

    return ApiResponse.success(res, payments);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchasing/payments (Record Supplier Payment & Reconcile Balances)
// Acceptance Criteria: "Supplier balances reconcile with invoices and recorded payments."
router.post('/payments', authenticateToken, requirePermission('suppliers.manage'), validateBody(supplierPaymentSchema), async (req, res, next) => {
  try {
    const {
      supplier_id,
      invoice_id,
      amount,
      payment_method,
      reference_no,
      payment_date,
      bank_account_used,
      notes,
      supporting_documents = []
    } = req.body;

    const supplier = await db('suppliers').where({ id: supplier_id }).first();
    if (!supplier) return ApiResponse.error(res, 'Supplier not found', 404, 'NOT_FOUND');

    const paymentAmount = parseFloat(amount);
    const paymentNumber = `SPAY-${Date.now().toString().slice(-6)}`;
    let targetInvoice = null;

    if (invoice_id) {
      targetInvoice = await db('supplier_invoices').where({ id: invoice_id, supplier_id }).first();
      if (!targetInvoice) {
        return ApiResponse.error(res, `Invoice #${invoice_id} not found for this supplier`, 404, 'NOT_FOUND');
      }
    }

    let paymentRecord;
    await db.transaction(async (trx) => {
      // 1. Record payment transaction
      [paymentRecord] = await trx('supplier_payments').insert({
        payment_number: paymentNumber,
        supplier_id,
        invoice_id: invoice_id || null,
        amount: paymentAmount,
        payment_method,
        reference_no: reference_no || '',
        payment_date,
        bank_account_used: bank_account_used || null,
        notes: notes || '',
        supporting_documents: JSON.stringify(supporting_documents || []),
        recorded_by_id: req.user.id
      }).returning('*');

      // 2. Decrement supplier balance owed
      await trx('suppliers').where({ id: supplier_id }).decrement('balance_owed', paymentAmount);

      // 3. Reconcile linked invoice if applicable
      if (targetInvoice) {
        const currentPaid = parseFloat(targetInvoice.amount_paid);
        const newPaid = currentPaid + paymentAmount;
        const total = parseFloat(targetInvoice.total_amount);
        const newBalanceDue = Math.max(0, total - newPaid);
        const newStatus = newBalanceDue <= 0 ? 'paid' : 'partially_paid';

        await trx('supplier_invoices').where({ id: targetInvoice.id }).update({
          amount_paid: newPaid,
          balance_due: newBalanceDue,
          status: newStatus,
          updated_at: new Date()
        });
      }
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'SUPPLIER_PAYMENT_RECORDED',
      `Paid GH₵ ${paymentAmount.toFixed(2)} to supplier "${supplier.name}" (${payment_method}, Ref: ${reference_no || 'N/A'})`
    );

    return ApiResponse.success(res, paymentRecord, 'Supplier payment recorded and balances reconciled', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchasing/supplier-statement/:id (Full Statement of Account)
router.get('/supplier-statement/:id', authenticateToken, requirePermission('suppliers.view'), async (req, res, next) => {
  try {
    const supplier = await db('suppliers').where({ id: req.params.id }).first();
    if (!supplier) return ApiResponse.error(res, 'Supplier not found', 404, 'NOT_FOUND');

    const [pos, grns, invoices, payments] = await Promise.all([
      db('purchase_orders').where({ supplier_id: supplier.id }).orderBy('created_at', 'asc'),
      db('goods_received_notes').where({ supplier_id: supplier.id }).orderBy('created_at', 'asc'),
      db('supplier_invoices').where({ supplier_id: supplier.id }).orderBy('invoice_date', 'asc'),
      db('supplier_payments').where({ supplier_id: supplier.id }).orderBy('payment_date', 'asc')
    ]);

    const orderedTotal = pos.filter(p => ['approved', 'partially_received', 'completed'].includes(p.status)).reduce((acc, p) => acc + parseFloat(p.total_amount || 0), 0);
    const receivedTotal = grns.reduce((acc, g) => acc + parseFloat(g.total_cost || 0), 0);
    const invoicedTotal = invoices.reduce((acc, i) => acc + parseFloat(i.total_amount || 0), 0);
    const paidTotal = payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);

    const rawBalance = invoicedTotal > 0 ? (invoicedTotal - paidTotal) : parseFloat(supplier.balance_owed || 0);

    return ApiResponse.success(res, {
      supplier: await sanitizeSupplierForUser(supplier, req.user),
      summary: {
        ordered_value: parseFloat(orderedTotal.toFixed(2)),
        received_value: parseFloat(receivedTotal.toFixed(2)),
        invoiced_value: parseFloat(invoicedTotal.toFixed(2)),
        amount_paid: parseFloat(paidTotal.toFixed(2)),
        outstanding_balance: parseFloat(rawBalance.toFixed(2))
      },
      purchase_orders: pos,
      goods_received_notes: grns,
      invoices,
      payments
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 5: COMPREHENSIVE PURCHASING & SUPPLIER REPORTS
// ============================================================================

// GET /api/v1/purchasing/reports/history (Purchasing History Report)
router.get('/reports/history', authenticateToken, requirePermission('suppliers.view'), async (req, res, next) => {
  try {
    const { supplier_id, start_date, end_date } = req.query;

    let query = db('purchase_orders as po')
      .join('suppliers as s', 'po.supplier_id', 's.id')
      .leftJoin('users as u', 'po.created_by_id', 'u.id')
      .leftJoin('users as au', 'po.approved_by_id', 'au.id');

    if (supplier_id) query = query.where('po.supplier_id', parseInt(supplier_id));
    if (start_date) query = query.where('po.created_at', '>=', new Date(start_date));
    if (end_date) query = query.where('po.created_at', '<=', new Date(end_date));

    const records = await query.select(
      'po.*',
      's.name as supplier_name',
      'u.name as created_by_name',
      'au.name as approved_by_name'
    ).orderBy('po.created_at', 'desc');

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
    const sanitized = records.map(r => {
      if (!canViewCost) {
        delete r.total_amount;
      }
      return r;
    });

    return ApiResponse.success(res, sanitized);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchasing/reports/supplier-balances (Supplier Balances & Aging Report)
router.get('/reports/supplier-balances', authenticateToken, requirePermission('suppliers.view'), async (req, res, next) => {
  try {
    const suppliers = await db('suppliers').orderBy('name', 'asc');

    const balances = await Promise.all(suppliers.map(async (s) => {
      const invoiceAgg = await db('supplier_invoices')
        .where({ supplier_id: s.id })
        .sum('total_amount as invoiced')
        .sum('amount_paid as paid')
        .sum('balance_due as balance')
        .first();

      const invoiced = parseFloat(invoiceAgg?.invoiced || 0);
      const paid = parseFloat(invoiceAgg?.paid || 0);
      const balance = invoiced > 0 ? (invoiced - paid) : parseFloat(s.balance_owed || 0);

      return {
        supplier_id: s.id,
        supplier_name: s.name,
        phone: s.phone,
        payment_terms: s.payment_terms,
        status: s.status,
        invoiced_value: invoiced,
        amount_paid: paid,
        balance_owed: parseFloat(balance.toFixed(2))
      };
    }));

    return ApiResponse.success(res, balances);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchasing/reports/outstanding-pos (Pending & Partially Received Orders)
router.get('/reports/outstanding-pos', authenticateToken, requirePermission('inventory.receive'), async (req, res, next) => {
  try {
    const pos = await db('purchase_orders as po')
      .join('suppliers as s', 'po.supplier_id', 's.id')
      .whereIn('po.status', ['approved', 'partially_received'])
      .select(
        'po.*',
        's.name as supplier_name',
        's.phone as supplier_phone'
      )
      .orderBy('po.expected_delivery_date', 'asc');

    const posWithRemaining = await Promise.all(pos.map(async (p) => {
      const unreceivedItems = await db('purchase_order_items as poi')
        .join('products as pr', 'poi.product_id', 'pr.id')
        .where('poi.po_id', p.id)
        .whereRaw('poi.received_quantity < poi.ordered_quantity')
        .select(
          'poi.*',
          'pr.name as product_name',
          'pr.sku as product_sku',
          db.raw('(poi.ordered_quantity - poi.received_quantity) as remaining_quantity')
        );

      return {
        ...p,
        unreceived_items_count: unreceivedItems.length,
        items: unreceivedItems
      };
    }));

    return ApiResponse.success(res, posWithRemaining);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchasing/reports/delivery-discrepancies (Discrepancy Audit Log)
router.get('/reports/delivery-discrepancies', authenticateToken, requirePermission('inventory.receive'), async (req, res, next) => {
  try {
    const items = await db('grn_items as gi')
      .join('goods_received_notes as g', 'gi.grn_id', 'g.id')
      .join('products as p', 'gi.product_id', 'p.id')
      .leftJoin('suppliers as s', 'g.supplier_id', 's.id')
      .where(function() {
        this.whereRaw('gi.ordered_quantity <> (gi.received_quantity + gi.rejected_quantity + gi.damaged_quantity)')
          .orWhere('gi.rejected_quantity', '>', 0)
          .orWhere('gi.damaged_quantity', '>', 0)
          .orWhereNotNull('gi.discrepancy_reason');
      })
      .select(
        'gi.*',
        'g.grn_number',
        'g.delivery_note_no',
        'g.supplier_invoice_no',
        'g.created_at as receipt_date',
        's.name as supplier_name',
        'p.name as product_name',
        'p.sku as product_sku'
      )
      .orderBy('g.id', 'desc');

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
    const sanitized = items.map(item => {
      if (!canViewCost) {
        delete item.unit_cost;
        delete item.total_cost;
      }
      return item;
    });

    return ApiResponse.success(res, sanitized);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchasing/reports/price-comparisons (Supplier Price Comparisons Across Products)
router.get('/reports/price-comparisons', authenticateToken, requirePermission('products.cost_view'), async (req, res, next) => {
  try {
    const products = await db('products').where({ status: 'active' }).select('id', 'name', 'sku', 'category', 'unit', 'cost_price');

    const comparisons = await Promise.all(products.map(async (p) => {
      // Find all suppliers that have delivered this product or quoted on PO
      const supplierHistory = await db('grn_items as gi')
        .join('goods_received_notes as g', 'gi.grn_id', 'g.id')
        .join('suppliers as s', 'g.supplier_id', 's.id')
        .where('gi.product_id', p.id)
        .groupBy('s.id', 's.name')
        .select(
          's.id as supplier_id',
          's.name as supplier_name',
          db.raw('MIN(gi.unit_cost) as lowest_price'),
          db.raw('MAX(gi.unit_cost) as highest_price'),
          db.raw('AVG(gi.unit_cost) as average_price'),
          db.raw('COUNT(gi.id) as delivery_count')
        );

      return {
        product_id: p.id,
        product_name: p.name,
        sku: p.sku,
        category: p.category,
        unit: p.unit,
        current_avco_cost: parseFloat(p.cost_price || 0),
        suppliers_history: supplierHistory.map(sh => ({
          supplier_id: sh.supplier_id,
          supplier_name: sh.supplier_name,
          lowest_price: parseFloat(sh.lowest_price),
          highest_price: parseFloat(sh.highest_price),
          average_price: parseFloat(parseFloat(sh.average_price).toFixed(2)),
          delivery_count: parseInt(sh.delivery_count)
        }))
      };
    }));

    return ApiResponse.success(res, comparisons);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

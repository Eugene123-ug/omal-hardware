const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse, parsePagination } = require('../../common/response');
const { validateBody } = require('../../middleware/validate');
const {
  inwardSchema,
  adjustSchema,
  transferSchema,
  openingStockSchema,
  stockReceiptSchema,
  customerReturnSchema,
  supplierReturnSchema,
  damageLossSchema,
  reservationSchema,
  createStockCountSchema,
  updateCountItemsSchema,
  approveStockCountSchema
} = require('./inventory.validation');
const {
  authenticateToken,
  requireRole,
  requirePermission,
  verifyAdminPin,
  logAudit,
  sanitizeProductForRole
} = require('../../middleware/auth');
const { checkUserPermission } = require('../../utils/security');

// Helper to calculate Weighted Average Cost (AVCO)
function calculateWeightedAverageCost(currentQty, currentCost, receivedQty, newCost) {
  const totalQty = currentQty + receivedQty;
  if (totalQty <= 0) return newCost || currentCost || 0;
  const totalValue = (currentQty * (currentCost || 0)) + (receivedQty * newCost);
  return parseFloat((totalValue / totalQty).toFixed(2));
}

// ============================================================================
// TASK 1: OPENING STOCK WORKFLOW
// ============================================================================

// GET /api/v1/inventory/opening-stock
router.get('/opening-stock', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const records = await db('opening_stock_records as osr')
      .join('products as p', 'osr.product_id', 'p.id')
      .leftJoin('product_variants as pv', 'osr.variant_id', 'pv.id')
      .leftJoin('users as u', 'osr.created_by_id', 'u.id')
      .leftJoin('users as au', 'osr.approved_by_id', 'au.id')
      .select(
        'osr.*',
        'p.name as product_name',
        'p.sku as product_sku',
        'p.category',
        'pv.variant_name',
        'pv.sku as variant_sku',
        'u.name as created_by_name',
        'au.name as approved_by_name'
      )
      .orderBy('osr.id', 'desc');

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
    const sanitized = records.map(r => {
      if (!canViewCost) {
        delete r.unit_cost;
        delete r.total_valuation;
      }
      return r;
    });

    return ApiResponse.success(res, sanitized);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/opening-stock
router.post('/opening-stock', authenticateToken, requirePermission('inventory.receive'), validateBody(openingStockSchema), async (req, res, next) => {
  try {
    const {
      product_id,
      variant_id,
      warehouse_name,
      quantity,
      unit,
      unit_cost,
      valuation_basis = 'cost_price',
      opening_date = new Date().toISOString().slice(0, 10),
      notes,
      is_correction = false,
      correction_notes,
      admin_pin
    } = req.body;

    const product = await db('products').where({ id: product_id }).first();
    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');
    }

    // Check if opening stock already exists for this product / variant / location
    let checkQuery = db('opening_stock_records')
      .where({ product_id, warehouse_name, is_corrected: false });
    if (variant_id) {
      checkQuery = checkQuery.where({ variant_id });
    } else {
      checkQuery = checkQuery.whereNull('variant_id');
    }

    const existingOpeningStock = await checkQuery.first();

    if (existingOpeningStock && !is_correction) {
      return ApiResponse.error(
        res,
        `Opening stock for "${product.name}" in ${warehouse_name} has already been verified and locked. Repeated entries are prevented without an authorised correction process.`,
        409,
        'OPENING_STOCK_ALREADY_EXISTS'
      );
    }

    let approvedById = req.user.id;
    if (is_correction) {
      if (req.user.role !== 'super_admin') {
        const pinCheck = await verifyAdminPin(admin_pin);
        if (!pinCheck.valid) {
          return ApiResponse.error(res, `Opening stock correction requires Super Admin authorization: ${pinCheck.message}`, 403, 'SUPERVISOR_APPROVAL_REQUIRED');
        }
        approvedById = pinCheck.user.id;
      }
    }

    const totalValuation = parseFloat((quantity * unit_cost).toFixed(2));
    let openingRecord;

    await db.transaction(async (trx) => {
      // If this is an authorized correction, mark the previous record as corrected
      if (existingOpeningStock && is_correction) {
        await trx('opening_stock_records')
          .where({ id: existingOpeningStock.id })
          .update({
            is_corrected: true,
            correction_notes: correction_notes || `Corrected by ${req.user.name} on ${new Date().toISOString()}`
          });
      }

      // Upsert warehouse_stock
      let stockQuery = trx('warehouse_stock').where({ product_id, warehouse_name });
      if (variant_id) {
        stockQuery = stockQuery.where({ variant_id });
      } else {
        stockQuery = stockQuery.whereNull('variant_id');
      }

      const stockRow = await stockQuery.forUpdate().first();
      let balanceAfter = quantity;

      if (stockRow) {
        if (is_correction && existingOpeningStock) {
          const delta = quantity - parseFloat(existingOpeningStock.quantity);
          const newQty = Math.max(0, parseFloat(stockRow.quantity) + delta);
          await trx('warehouse_stock').where({ id: stockRow.id }).update({ quantity: newQty, updated_at: new Date() });
          balanceAfter = newQty;
        } else {
          await trx('warehouse_stock').where({ id: stockRow.id }).update({ quantity, updated_at: new Date() });
        }
      } else {
        await trx('warehouse_stock').insert({
          product_id,
          variant_id: variant_id || null,
          warehouse_name,
          quantity,
          reserved_quantity: 0
        });
      }

      // Update product cost price if 0 or market basis
      if (parseFloat(product.cost_price || 0) <= 0 || is_correction) {
        await trx('products').where({ id: product_id }).update({ cost_price: unit_cost, updated_at: new Date() });
      }

      // Insert opening stock record
      [openingRecord] = await trx('opening_stock_records').insert({
        product_id,
        variant_id: variant_id || null,
        warehouse_name,
        quantity,
        unit,
        unit_cost,
        total_valuation: totalValuation,
        valuation_basis,
        opening_date,
        notes: notes || 'Initial verified physical inventory',
        created_by_id: req.user.id,
        approved_by_id: approvedById,
        is_corrected: false,
        correction_notes: is_correction ? correction_notes : null
      }).returning('*');

      // Record in stock movement ledger
      await trx('stock_movements').insert({
        product_id,
        variant_id: variant_id || null,
        movement_type: 'OPENING_STOCK',
        quantity,
        unit,
        from_location: 'INITIAL_VERIFIED_INVENTORY',
        to_location: warehouse_name,
        reference_type: 'OPENING_STOCK',
        reference_id: openingRecord.id,
        reference_no: `OPN-${openingRecord.id}`,
        cost_price: unit_cost,
        total_cost: totalValuation,
        balance_after: balanceAfter,
        reason: is_correction ? `Opening stock correction: ${correction_notes || notes}` : `Verified opening inventory: ${notes || 'Initial stock count'}`,
        authorized_by_id: approvedById,
        created_by_id: req.user.id
      });
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      is_correction ? 'OPENING_STOCK_CORRECTED' : 'OPENING_STOCK_RECORDED',
      `${is_correction ? 'Corrected' : 'Recorded'} opening stock of ${quantity} ${unit} for "${product.name}" in ${warehouse_name} (Valuation: GH₵ ${totalValuation.toFixed(2)})`
    );

    return ApiResponse.success(res, openingRecord, 'Opening stock recorded successfully in inventory ledger', 201);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 2: STOCK RECEIPTS (Against Purchase Orders or Direct Supplier Receipts)
// ============================================================================

// POST /api/v1/inventory/receipts
router.post('/receipts', authenticateToken, requirePermission('inventory.receive'), validateBody(stockReceiptSchema), async (req, res, next) => {
  try {
    const {
      po_id,
      supplier_id,
      supplier_name,
      supplier_invoice_no,
      delivery_note_no,
      warehouse_name,
      notes,
      items
    } = req.body;

    let po = null;
    if (po_id) {
      po = await db('purchase_orders').where({ id: po_id }).first();
      if (!po) {
        return ApiResponse.error(res, `Purchase Order #${po_id} not found`, 404, 'NOT_FOUND');
      }
    }

    const receiptNo = `GRN-${Date.now()}`;
    let totalReceiptCost = 0;
    const processedMovements = [];
    const discrepancyList = [];

    await db.transaction(async (trx) => {
      for (const item of items) {
        const prod = await trx('products').where({ id: item.product_id }).first();
        if (!prod) {
          throw new Error(`Product ${item.product_id} not found`);
        }

        const receivedQty = parseFloat(item.received_quantity);
        const orderedQty = item.ordered_quantity !== undefined && item.ordered_quantity !== null
          ? parseFloat(item.ordered_quantity)
          : receivedQty;
        const unitCost = parseFloat(item.cost_price);
        const lineTotal = parseFloat((receivedQty * unitCost).toFixed(2));
        totalReceiptCost += lineTotal;

        const discrepancyQty = orderedQty - receivedQty;
        if (discrepancyQty !== 0 || item.discrepancy_notes) {
          discrepancyList.push({
            product_name: prod.name,
            sku: prod.sku,
            ordered: orderedQty,
            received: receivedQty,
            discrepancy: discrepancyQty,
            notes: item.discrepancy_notes || (discrepancyQty > 0 ? `Short delivered by ${discrepancyQty}` : `Over delivered by ${Math.abs(discrepancyQty)}`)
          });
        }

        // Lock warehouse stock row
        let stockQuery = trx('warehouse_stock').where({ product_id: item.product_id, warehouse_name });
        if (item.variant_id) {
          stockQuery = stockQuery.where({ variant_id: item.variant_id });
        } else {
          stockQuery = stockQuery.whereNull('variant_id');
        }

        const stockRow = await stockQuery.forUpdate().first();
        const currentQty = stockRow ? parseFloat(stockRow.quantity) : 0;
        const newQty = currentQty + receivedQty;

        // Calculate Weighted Average Cost (AVCO)
        const currentCost = parseFloat(prod.cost_price || 0);
        const avcoCost = calculateWeightedAverageCost(currentQty, currentCost, receivedQty, unitCost);

        // Update product cost price with AVCO
        await trx('products').where({ id: item.product_id }).update({
          cost_price: avcoCost,
          updated_at: new Date()
        });

        // Update or insert warehouse stock
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

        // Record in stock movement ledger
        const [movement] = await trx('stock_movements').insert({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          movement_type: 'PURCHASE_RECEIPT',
          quantity: receivedQty,
          unit: item.unit || prod.unit || 'pcs',
          from_location: supplier_name || (po ? `PO #${po.po_number}` : 'Supplier Delivery'),
          to_location: warehouse_name,
          reference_type: 'PURCHASE_RECEIPT',
          reference_no: delivery_note_no || supplier_invoice_no || receiptNo,
          cost_price: unitCost,
          total_cost: lineTotal,
          balance_after: newQty,
          discrepancy_quantity: discrepancyQty,
          reason: `Stock receipt against ${po ? `PO ${po.po_number}` : 'Supplier Delivery'}. Invoice: ${supplier_invoice_no || 'N/A'}${item.discrepancy_notes ? ` [Discrepancy: ${item.discrepancy_notes}]` : ''}`,
          created_by_id: req.user.id
        }).returning('*');

        processedMovements.push(movement);
      }

      // Record Goods Received Note (GRN)
      await trx('goods_received_notes').insert({
        grn_number: receiptNo,
        po_id: po_id || null,
        supplier_id: supplier_id || (po ? po.supplier_id : null),
        supplier_invoice_no: supplier_invoice_no || '',
        delivery_note_no: delivery_note_no || '',
        warehouse_name,
        total_cost: totalReceiptCost,
        items_json: JSON.stringify(items),
        discrepancy_notes: discrepancyList.length > 0 ? JSON.stringify(discrepancyList) : null,
        status: 'completed',
        received_by_id: req.user.id
      });

      // Update PO status if receiving against a PO
      if (po_id) {
        const poStatus = discrepancyList.some(d => d.discrepancy > 0) ? 'received_partial' : 'received_full';
        await trx('purchase_orders').where({ id: po_id }).update({ status: poStatus });
      }

      // Update supplier payables balance if supplier associated
      const targetSupplierId = supplier_id || (po ? po.supplier_id : null);
      if (targetSupplierId) {
        await trx('suppliers').where({ id: targetSupplierId }).increment('balance_owed', totalReceiptCost);
      }
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'STOCK_RECEIPT_PROCESSED',
      `Processed stock receipt ${receiptNo} for ${items.length} items in ${warehouse_name}. Total Cost: GH₵ ${totalReceiptCost.toFixed(2)}${discrepancyList.length > 0 ? ` (${discrepancyList.length} discrepancies noted)` : ''}`
    );

    return ApiResponse.success(res, {
      receipt_no: receiptNo,
      items_received: items.length,
      total_cost: totalReceiptCost,
      discrepancies: discrepancyList
    }, 'Stock receipt processed and inventory ledger updated', 201);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 3: COMPREHENSIVE STOCK LEDGER & TRANSACTION TYPES
// ============================================================================

// GET /api/v1/inventory/movements (The Inventory Ledger)
router.get('/movements', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const {
      product_id,
      movement_type,
      reference_type,
      warehouse_name,
      start_date,
      end_date
    } = req.query;

    let query = db('stock_movements as sm')
      .join('products as p', 'sm.product_id', 'p.id')
      .leftJoin('product_variants as pv', 'sm.variant_id', 'pv.id')
      .leftJoin('users as u', 'sm.created_by_id', 'u.id')
      .leftJoin('users as au', 'sm.authorized_by_id', 'au.id');

    if (product_id) query = query.where('sm.product_id', parseInt(product_id));
    if (movement_type) query = query.where('sm.movement_type', movement_type);
    if (reference_type) query = query.where('sm.reference_type', reference_type);
    if (warehouse_name) {
      query = query.where(builder => {
        builder.where('sm.from_location', warehouse_name)
          .orWhere('sm.to_location', warehouse_name);
      });
    }
    if (start_date) query = query.where('sm.created_at', '>=', new Date(start_date));
    if (end_date) query = query.where('sm.created_at', '<=', new Date(end_date));

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');

    const [totalRes, movements] = await Promise.all([
      query.clone().count('sm.id as total').first(),
      query.clone()
        .select(
          'sm.*',
          'p.name as product_name',
          'p.sku as product_sku',
          'p.category',
          'pv.variant_name',
          'pv.sku as variant_sku',
          'u.name as created_by_name',
          'au.name as authorized_by_name'
        )
        .orderBy('sm.id', 'desc')
        .limit(limit)
        .offset(offset)
    ]);

    const sanitized = movements.map(m => {
      if (!canViewCost) {
        delete m.cost_price;
        delete m.total_cost;
      }
      return m;
    });

    return ApiResponse.paginated(res, sanitized, parseInt(totalRes.total), page, limit, 'Stock ledger retrieved successfully');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/customer-returns (Customer Return -> Restock or Damage)
router.post('/customer-returns', authenticateToken, requirePermission('refunds.approve'), validateBody(customerReturnSchema), async (req, res, next) => {
  try {
    const {
      sale_id,
      receipt_no,
      product_id,
      variant_id,
      warehouse_name,
      quantity,
      condition = 'resellable',
      reason,
      refund_amount
    } = req.body;

    const product = await db('products').where({ id: product_id }).first();
    if (!product) return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');

    let newBalance;

    await db.transaction(async (trx) => {
      let stockQuery = trx('warehouse_stock').where({ product_id, warehouse_name });
      if (variant_id) {
        stockQuery = stockQuery.where({ variant_id });
      } else {
        stockQuery = stockQuery.whereNull('variant_id');
      }

      const stockRow = await stockQuery.forUpdate().first();
      const currentQty = stockRow ? parseFloat(stockRow.quantity) : 0;

      if (condition === 'resellable') {
        newBalance = currentQty + quantity;
        if (stockRow) {
          await trx('warehouse_stock').where({ id: stockRow.id }).update({ quantity: newBalance, updated_at: new Date() });
        } else {
          await trx('warehouse_stock').insert({
            product_id,
            variant_id: variant_id || null,
            warehouse_name,
            quantity: newBalance,
            reserved_quantity: 0
          });
        }
      } else {
        newBalance = currentQty; // Damaged items do not increase sellable stock
      }

      // Record Customer Return in ledger
      await trx('stock_movements').insert({
        product_id,
        variant_id: variant_id || null,
        movement_type: condition === 'resellable' ? 'CUSTOMER_RETURN' : 'DAMAGE',
        quantity: condition === 'resellable' ? quantity : -quantity,
        unit: product.unit || 'pcs',
        from_location: 'CUSTOMER',
        to_location: condition === 'resellable' ? warehouse_name : 'DAMAGED_HOLD',
        reference_type: 'CUSTOMER_RETURN',
        reference_id: sale_id || null,
        reference_no: receipt_no || `RET-${Date.now()}`,
        cost_price: product.cost_price,
        total_cost: parseFloat(product.cost_price || 0) * quantity,
        balance_after: newBalance,
        reason: `Customer return (${condition}): ${reason}`,
        authorized_by_id: req.user.id,
        created_by_id: req.user.id
      });
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'CUSTOMER_RETURN_PROCESSED',
      `Processed return of ${quantity} units of "${product.name}" in ${warehouse_name} (${condition}). Reason: ${reason}`
    );

    return ApiResponse.success(res, { balance_after: newBalance }, 'Customer return processed and logged in inventory ledger');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/supplier-returns (Return Defective Stock to Supplier)
router.post('/supplier-returns', authenticateToken, requirePermission('inventory.receive'), validateBody(supplierReturnSchema), async (req, res, next) => {
  try {
    const {
      supplier_id,
      product_id,
      variant_id,
      warehouse_name,
      quantity,
      reason,
      invoice_reference
    } = req.body;

    const product = await db('products').where({ id: product_id }).first();
    if (!product) return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');

    let newBalance;
    await db.transaction(async (trx) => {
      let stockQuery = trx('warehouse_stock').where({ product_id, warehouse_name });
      if (variant_id) {
        stockQuery = stockQuery.where({ variant_id });
      } else {
        stockQuery = stockQuery.whereNull('variant_id');
      }

      const stockRow = await stockQuery.forUpdate().first();
      const currentQty = stockRow ? parseFloat(stockRow.quantity) : 0;
      const reserved = stockRow ? parseFloat(stockRow.reserved_quantity || 0) : 0;
      const available = currentQty - reserved;

      if (available < quantity) {
        return ApiResponse.error(res, `Cannot return to supplier: insufficient available stock (${available} available, ${quantity} requested)`, 400, 'INSUFFICIENT_STOCK');
      }

      newBalance = currentQty - quantity;
      await trx('warehouse_stock').where({ id: stockRow.id }).update({ quantity: newBalance, updated_at: new Date() });

      const returnCost = parseFloat(product.cost_price || 0) * quantity;

      if (supplier_id) {
        await trx('suppliers').where({ id: supplier_id }).decrement('balance_owed', returnCost);
      }

      await trx('stock_movements').insert({
        product_id,
        variant_id: variant_id || null,
        movement_type: 'SUPPLIER_RETURN',
        quantity: -quantity,
        unit: product.unit || 'pcs',
        from_location: warehouse_name,
        to_location: 'SUPPLIER_RETURN',
        reference_type: 'SUPPLIER_RETURN',
        reference_id: supplier_id || null,
        reference_no: invoice_reference || `SUP-RET-${Date.now()}`,
        cost_price: product.cost_price,
        total_cost: returnCost,
        balance_after: newBalance,
        reason: `Returned to supplier: ${reason}`,
        authorized_by_id: req.user.id,
        created_by_id: req.user.id
      });
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'SUPPLIER_RETURN_PROCESSED',
      `Returned ${quantity} units of "${product.name}" from ${warehouse_name} to supplier. Reason: ${reason}`
    );

    return ApiResponse.success(res, { balance_after: newBalance }, 'Stock returned to supplier and recorded in ledger');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/damage-loss (Record Breakage or Approved Loss)
router.post('/damage-loss', authenticateToken, requirePermission('inventory.adjust'), validateBody(damageLossSchema), async (req, res, next) => {
  try {
    const {
      type, // 'DAMAGE' or 'LOSS'
      product_id,
      variant_id,
      warehouse_name,
      quantity,
      reason,
      admin_pin
    } = req.body;

    const pinCheck = await verifyAdminPin(admin_pin);
    if (!pinCheck.valid) {
      return ApiResponse.error(res, `Admin PIN authorization required for damage/loss write-offs: ${pinCheck.message}`, 403, 'INVALID_PIN');
    }

    const product = await db('products').where({ id: product_id }).first();
    if (!product) return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');

    let newBalance;

    await db.transaction(async (trx) => {
      let stockQuery = trx('warehouse_stock').where({ product_id, warehouse_name });
      if (variant_id) {
        stockQuery = stockQuery.where({ variant_id });
      } else {
        stockQuery = stockQuery.whereNull('variant_id');
      }

      const stockRow = await stockQuery.forUpdate().first();
      const currentQty = stockRow ? parseFloat(stockRow.quantity) : 0;

      if (currentQty < quantity) {
        return ApiResponse.error(res, `Cannot write off more than current on-hand stock (${currentQty} on hand, ${quantity} requested)`, 400, 'BAD_REQUEST');
      }

      newBalance = currentQty - quantity;
      await trx('warehouse_stock').where({ id: stockRow.id }).update({ quantity: newBalance, updated_at: new Date() });

      const costLoss = parseFloat(product.cost_price || 0) * quantity;

      await trx('stock_movements').insert({
        product_id,
        variant_id: variant_id || null,
        movement_type: type,
        quantity: -quantity,
        unit: product.unit || 'pcs',
        from_location: warehouse_name,
        to_location: type === 'DAMAGE' ? 'DAMAGED_SCRAP' : 'WRITTEN_OFF_LOSS',
        reference_type: type,
        reference_no: `${type}-${Date.now()}`,
        cost_price: product.cost_price,
        total_cost: costLoss,
        balance_after: newBalance,
        reason: `${type === 'DAMAGE' ? 'Damage / Breakage' : 'Approved Loss / Theft'}: ${reason}`,
        authorized_by_id: pinCheck.user.id,
        created_by_id: req.user.id
      });
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      `STOCK_${type}_LOGGED`,
      `Wrote off ${quantity} units of "${product.name}" as ${type} in ${warehouse_name}. Cost impact: GH₵ ${(parseFloat(product.cost_price || 0) * quantity).toFixed(2)}. Authorized by: ${pinCheck.user.name}`
    );

    return ApiResponse.success(res, { balance_after: newBalance }, `${type} logged and stock ledger updated`);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/transfer (Inter-Warehouse Stock Transfer)
router.post('/transfer', authenticateToken, requirePermission('inventory.transfer'), validateBody(transferSchema), async (req, res, next) => {
  try {
    const { product_id, variant_id, from_warehouse, to_warehouse, quantity, notes } = req.body;

    if (from_warehouse === to_warehouse) {
      return ApiResponse.error(res, 'Source and destination warehouses cannot be the same', 400, 'BAD_REQUEST');
    }

    const product = await db('products').where({ id: product_id }).first();
    if (!product) return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');

    const transferRef = `TRF-${Date.now()}`;
    let newSourceBalance;
    let newDestBalance;

    await db.transaction(async (trx) => {
      // Source stock
      let sourceQuery = trx('warehouse_stock').where({ product_id, warehouse_name: from_warehouse });
      if (variant_id) {
        sourceQuery = sourceQuery.where({ variant_id });
      } else {
        sourceQuery = sourceQuery.whereNull('variant_id');
      }

      const sourceStock = await sourceQuery.forUpdate().first();
      const currentSource = sourceStock ? parseFloat(sourceStock.quantity) : 0;
      const reserved = sourceStock ? parseFloat(sourceStock.reserved_quantity || 0) : 0;
      const available = currentSource - reserved;

      if (available < quantity) {
        return ApiResponse.error(res, `Insufficient available stock in ${from_warehouse}. Available: ${available}, Requested: ${quantity}`, 400, 'INSUFFICIENT_STOCK');
      }

      newSourceBalance = currentSource - quantity;
      await trx('warehouse_stock').where({ id: sourceStock.id }).update({ quantity: newSourceBalance, updated_at: new Date() });

      // Destination stock
      let destQuery = trx('warehouse_stock').where({ product_id, warehouse_name: to_warehouse });
      if (variant_id) {
        destQuery = destQuery.where({ variant_id });
      } else {
        destQuery = destQuery.whereNull('variant_id');
      }

      const destStock = await destQuery.forUpdate().first();
      const currentDest = destStock ? parseFloat(destStock.quantity) : 0;
      newDestBalance = currentDest + quantity;

      if (destStock) {
        await trx('warehouse_stock').where({ id: destStock.id }).update({ quantity: newDestBalance, updated_at: new Date() });
      } else {
        await trx('warehouse_stock').insert({
          product_id,
          variant_id: variant_id || null,
          warehouse_name: to_warehouse,
          quantity: newDestBalance,
          reserved_quantity: 0
        });
      }

      const costPrice = parseFloat(product.cost_price || 0);

      // Ledger: Transfer Out
      await trx('stock_movements').insert({
        product_id,
        variant_id: variant_id || null,
        movement_type: 'TRANSFER_OUT',
        quantity: -quantity,
        unit: product.unit || 'pcs',
        from_location: from_warehouse,
        to_location: to_warehouse,
        reference_type: 'TRANSFER',
        reference_no: transferRef,
        cost_price: costPrice,
        total_cost: costPrice * quantity,
        balance_after: newSourceBalance,
        reason: `Transfer to ${to_warehouse}: ${notes || 'Stock redistribution'}`,
        created_by_id: req.user.id
      });

      // Ledger: Transfer In
      await trx('stock_movements').insert({
        product_id,
        variant_id: variant_id || null,
        movement_type: 'TRANSFER_IN',
        quantity,
        unit: product.unit || 'pcs',
        from_location: from_warehouse,
        to_location: to_warehouse,
        reference_type: 'TRANSFER',
        reference_no: transferRef,
        cost_price: costPrice,
        total_cost: costPrice * quantity,
        balance_after: newDestBalance,
        reason: `Transfer from ${from_warehouse}: ${notes || 'Stock redistribution'}`,
        created_by_id: req.user.id
      });
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'STOCK_TRANSFER',
      `Transferred ${quantity} units of "${product.name}" from ${from_warehouse} to ${to_warehouse} (${transferRef})`
    );

    return ApiResponse.success(res, {
      reference_no: transferRef,
      from_warehouse_balance: newSourceBalance,
      to_warehouse_balance: newDestBalance
    }, `Transferred ${quantity} units to ${to_warehouse}`);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 4: STOCK CALCULATIONS & RESERVATIONS
// ============================================================================

// GET /api/v1/inventory/stock-summary
router.get('/stock-summary', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const { category, warehouse_name } = req.query;

    let query = db('products as p')
      .join('warehouse_stock as ws', 'p.id', 'ws.product_id')
      .leftJoin('product_variants as pv', 'ws.variant_id', 'pv.id');

    if (category && category !== 'All') query = query.where('p.category', category);
    if (warehouse_name) query = query.where('ws.warehouse_name', warehouse_name);

    const rows = await query.select(
      'p.id as product_id',
      'p.name as product_name',
      'p.sku as product_sku',
      'p.category',
      'p.unit',
      'p.min_stock_alert',
      'pv.id as variant_id',
      'pv.variant_name',
      'pv.sku as variant_sku',
      'ws.warehouse_name',
      'ws.quantity as on_hand',
      'ws.reserved_quantity as reserved',
      db.raw('(ws.quantity - ws.reserved_quantity) as available')
    ).orderBy('p.name', 'asc');

    return ApiResponse.success(res, rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/reserve (Reserve Stock for Delivery / Pending Sale)
router.post('/reserve', authenticateToken, requirePermission('inventory.reserve'), validateBody(reservationSchema), async (req, res, next) => {
  try {
    const { product_id, variant_id, warehouse_name, quantity, reference_no, notes } = req.body;

    let stockQuery = db('warehouse_stock').where({ product_id, warehouse_name });
    if (variant_id) {
      stockQuery = stockQuery.where({ variant_id });
    } else {
      stockQuery = stockQuery.whereNull('variant_id');
    }

    const stockRow = await stockQuery.first();
    if (!stockRow) return ApiResponse.error(res, 'Stock row not found', 404, 'NOT_FOUND');

    const onHand = parseFloat(stockRow.quantity);
    const currentReserved = parseFloat(stockRow.reserved_quantity || 0);
    const available = onHand - currentReserved;

    if (available < quantity) {
      return ApiResponse.error(res, `Cannot reserve: Insufficient available stock (${available} available, ${quantity} requested)`, 400, 'INSUFFICIENT_STOCK');
    }

    const newReserved = currentReserved + quantity;
    await db('warehouse_stock').where({ id: stockRow.id }).update({
      reserved_quantity: newReserved,
      updated_at: new Date()
    });

    await logAudit(req.user.id, req.user.name, req.user.role, 'STOCK_RESERVED', `Reserved ${quantity} units for ${reference_no || 'Pending Order'}`);

    return ApiResponse.success(res, {
      on_hand: onHand,
      reserved: newReserved,
      available: onHand - newReserved
    }, 'Stock reserved successfully');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/release-reservation (Release Reserved Stock)
router.post('/release-reservation', authenticateToken, requirePermission('inventory.reserve'), validateBody(reservationSchema), async (req, res, next) => {
  try {
    const { product_id, variant_id, warehouse_name, quantity, reference_no } = req.body;

    let stockQuery = db('warehouse_stock').where({ product_id, warehouse_name });
    if (variant_id) {
      stockQuery = stockQuery.where({ variant_id });
    } else {
      stockQuery = stockQuery.whereNull('variant_id');
    }

    const stockRow = await stockQuery.first();
    if (!stockRow) return ApiResponse.error(res, 'Stock row not found', 404, 'NOT_FOUND');

    const currentReserved = parseFloat(stockRow.reserved_quantity || 0);
    const newReserved = Math.max(0, currentReserved - quantity);

    await db('warehouse_stock').where({ id: stockRow.id }).update({
      reserved_quantity: newReserved,
      updated_at: new Date()
    });

    return ApiResponse.success(res, {
      on_hand: parseFloat(stockRow.quantity),
      reserved: newReserved,
      available: parseFloat(stockRow.quantity) - newReserved
    }, 'Reserved stock released');
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 5: PHYSICAL STOCK COUNTS & VARIANCE RECONCILIATION
// ============================================================================

// POST /api/v1/inventory/stock-counts (Initiate Stock Count Session)
router.post('/stock-counts', authenticateToken, requirePermission('inventory.stock_count'), validateBody(createStockCountSchema), async (req, res, next) => {
  try {
    const { warehouse_name, category = 'All', notes } = req.body;
    const countNumber = `STC-${Date.now().toString().slice(-6)}`;

    let countId;
    await db.transaction(async (trx) => {
      // 1. Create count session
      const [newCount] = await trx('stock_counts').insert({
        count_number: countNumber,
        warehouse_name,
        category,
        status: 'in_progress',
        notes: notes || 'Physical Inventory Count Session',
        counted_by_id: req.user.id
      }).returning('id');

      countId = newCount.id;

      // 2. Snapshot current system quantities for target warehouse
      let prodQuery = trx('products as p')
        .join('warehouse_stock as ws', 'p.id', 'ws.product_id')
        .where('ws.warehouse_name', warehouse_name);

      if (category && category !== 'All') {
        prodQuery = prodQuery.where('p.category', category);
      }

      const productsToCount = await prodQuery.select(
        'p.id as product_id',
        'p.cost_price',
        'ws.variant_id',
        'ws.warehouse_name',
        'ws.quantity'
      );

      const countItems = productsToCount.map(p => ({
        stock_count_id: countId,
        product_id: p.product_id,
        variant_id: p.variant_id || null,
        warehouse_name: p.warehouse_name,
        system_quantity: parseFloat(p.quantity),
        counted_quantity: parseFloat(p.quantity), // Default to system until counted
        variance_quantity: 0,
        unit_cost: parseFloat(p.cost_price || 0),
        variance_cost: 0,
        status: 'pending'
      }));

      if (countItems.length > 0) {
        await trx('stock_count_items').insert(countItems);
      }
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'STOCK_COUNT_INITIATED',
      `Initiated stock count session ${countNumber} for ${warehouse_name} (${category})`
    );

    return ApiResponse.success(res, { id: countId, count_number: countNumber }, 'Stock count session initiated', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/stock-counts (List Sessions)
router.get('/stock-counts', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const counts = await db('stock_counts as sc')
      .leftJoin('users as cu', 'sc.counted_by_id', 'cu.id')
      .leftJoin('users as au', 'sc.approved_by_id', 'au.id')
      .select(
        'sc.*',
        'cu.name as counted_by_name',
        'au.name as approved_by_name'
      )
      .orderBy('sc.id', 'desc');

    return ApiResponse.success(res, counts);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/stock-counts/:id (Session Details)
router.get('/stock-counts/:id', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const count = await db('stock_counts as sc')
      .leftJoin('users as cu', 'sc.counted_by_id', 'cu.id')
      .leftJoin('users as au', 'sc.approved_by_id', 'au.id')
      .where('sc.id', req.params.id)
      .select(
        'sc.*',
        'cu.name as counted_by_name',
        'au.name as approved_by_name'
      )
      .first();

    if (!count) return ApiResponse.error(res, 'Stock count session not found', 404, 'NOT_FOUND');

    const items = await db('stock_count_items as sci')
      .join('products as p', 'sci.product_id', 'p.id')
      .leftJoin('product_variants as pv', 'sci.variant_id', 'pv.id')
      .where('sci.stock_count_id', req.params.id)
      .select(
        'sci.*',
        'p.name as product_name',
        'p.sku as product_sku',
        'p.category',
        'p.unit',
        'pv.variant_name',
        'pv.sku as variant_sku'
      )
      .orderBy('p.name', 'asc');

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
    const sanitizedItems = items.map(item => {
      if (!canViewCost) {
        delete item.unit_cost;
        delete item.variance_cost;
      }
      return item;
    });

    return ApiResponse.success(res, {
      ...count,
      items: sanitizedItems
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/inventory/stock-counts/:id/items (Enter Counted Quantities)
router.put('/stock-counts/:id/items', authenticateToken, requirePermission('inventory.stock_count'), validateBody(updateCountItemsSchema), async (req, res, next) => {
  try {
    const countSession = await db('stock_counts').where({ id: req.params.id }).first();
    if (!countSession) return ApiResponse.error(res, 'Count session not found', 404, 'NOT_FOUND');

    if (countSession.status !== 'in_progress') {
      return ApiResponse.error(res, `Cannot update count items: Session is ${countSession.status}`, 400, 'BAD_REQUEST');
    }

    const { items } = req.body;
    let totalVarianceQty = 0;
    let totalVarianceCost = 0;

    await db.transaction(async (trx) => {
      for (const item of items) {
        let itemQuery = trx('stock_count_items')
          .where({ stock_count_id: req.params.id, product_id: item.product_id });
        if (item.variant_id) {
          itemQuery = itemQuery.where({ variant_id: item.variant_id });
        } else {
          itemQuery = itemQuery.whereNull('variant_id');
        }

        const countItem = await itemQuery.first();
        if (countItem) {
          const countedQty = parseFloat(item.counted_quantity);
          const systemQty = parseFloat(countItem.system_quantity);
          const varianceQty = countedQty - systemQty;
          const unitCost = parseFloat(countItem.unit_cost || 0);
          const varianceCost = parseFloat((varianceQty * unitCost).toFixed(2));

          totalVarianceQty += varianceQty;
          totalVarianceCost += varianceCost;

          await trx('stock_count_items').where({ id: countItem.id }).update({
            counted_quantity: countedQty,
            variance_quantity: varianceQty,
            variance_cost: varianceCost,
            discrepancy_reason: item.discrepancy_reason || null
          });
        }
      }

      await trx('stock_counts').where({ id: req.params.id }).update({
        total_items_counted: items.length,
        total_variance_qty: totalVarianceQty,
        total_variance_cost: totalVarianceCost,
        updated_at: new Date()
      });
    });

    return ApiResponse.success(res, null, 'Counted quantities saved');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/stock-counts/:id/submit (Submit Count for Approval)
router.post('/stock-counts/:id/submit', authenticateToken, requirePermission('inventory.stock_count'), async (req, res, next) => {
  try {
    const countSession = await db('stock_counts').where({ id: req.params.id }).first();
    if (!countSession) return ApiResponse.error(res, 'Count session not found', 404, 'NOT_FOUND');

    if (countSession.status !== 'in_progress') {
      return ApiResponse.error(res, `Count session already ${countSession.status}`, 400, 'BAD_REQUEST');
    }

    await db('stock_counts').where({ id: req.params.id }).update({
      status: 'submitted',
      submitted_at: new Date(),
      updated_at: new Date()
    });

    await logAudit(req.user.id, req.user.name, req.user.role, 'STOCK_COUNT_SUBMITTED', `Submitted stock count ${countSession.count_number} for approval`);

    return ApiResponse.success(res, null, 'Stock count submitted for manager authorization');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/stock-counts/:id/approve (Approve & Commit Variance Adjustments)
router.post('/stock-counts/:id/approve', authenticateToken, requirePermission('inventory.stock_count_approve'), validateBody(approveStockCountSchema), async (req, res, next) => {
  try {
    const countSession = await db('stock_counts').where({ id: req.params.id }).first();
    if (!countSession) return ApiResponse.error(res, 'Count session not found', 404, 'NOT_FOUND');

    if (countSession.status !== 'submitted') {
      return ApiResponse.error(res, `Only submitted count sessions can be approved (current status: ${countSession.status})`, 400, 'BAD_REQUEST');
    }

    // Separation of Duties Rule (Task 5):
    // "Do not let the person who performs a sensitive adjustment automatically approve it where separation of duties is required."
    if (countSession.counted_by_id === req.user.id && req.user.role !== 'super_admin') {
      return ApiResponse.error(
        res,
        'Separation of duties violation: You cannot approve your own stock count session. A different manager or Super Admin must review and approve it.',
        403,
        'FORBIDDEN_SELF_APPROVAL'
      );
    }

    const { approval_notes, admin_pin } = req.body;
    if (admin_pin) {
      const pinCheck = await verifyAdminPin(admin_pin);
      if (!pinCheck.valid) {
        return ApiResponse.error(res, pinCheck.message, 403, 'INVALID_PIN');
      }
    }

    const items = await db('stock_count_items').where({ stock_count_id: countSession.id });

    await db.transaction(async (trx) => {
      for (const item of items) {
        const variance = parseFloat(item.variance_quantity);
        if (variance !== 0) {
          // Adjust warehouse stock to exact counted physical quantity
          let stockQuery = trx('warehouse_stock').where({ product_id: item.product_id, warehouse_name: countSession.warehouse_name });
          if (item.variant_id) {
            stockQuery = stockQuery.where({ variant_id: item.variant_id });
          } else {
            stockQuery = stockQuery.whereNull('variant_id');
          }

          const stockRow = await stockQuery.forUpdate().first();
          const countedQty = parseFloat(item.counted_quantity);

          if (stockRow) {
            await trx('warehouse_stock').where({ id: stockRow.id }).update({ quantity: countedQty, updated_at: new Date() });
          } else {
            await trx('warehouse_stock').insert({
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              warehouse_name: countSession.warehouse_name,
              quantity: countedQty,
              reserved_quantity: 0
            });
          }

          // Insert into inventory ledger as COUNT_ADJUSTMENT
          await trx('stock_movements').insert({
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            movement_type: 'COUNT_ADJUSTMENT',
            quantity: variance,
            from_location: countSession.warehouse_name,
            to_location: countSession.warehouse_name,
            reference_type: 'STOCK_COUNT',
            reference_id: countSession.id,
            reference_no: countSession.count_number,
            cost_price: item.unit_cost,
            total_cost: item.variance_cost,
            balance_after: countedQty,
            reason: `Physical count adjustment (${countSession.count_number}): ${item.discrepancy_reason || 'Reconciliation variance'}`,
            authorized_by_id: req.user.id,
            created_by_id: countSession.counted_by_id
          });

          await trx('stock_count_items').where({ id: item.id }).update({ status: 'approved' });
        }
      }

      await trx('stock_counts').where({ id: countSession.id }).update({
        status: 'approved',
        approved_by_id: req.user.id,
        approval_notes: approval_notes || 'Physical count approved and inventory ledger reconciled',
        approved_at: new Date(),
        updated_at: new Date()
      });
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'STOCK_COUNT_APPROVED',
      `Approved physical stock count ${countSession.count_number} for ${countSession.warehouse_name}. Total Variance: ${countSession.total_variance_qty} units (GH₵ ${countSession.total_variance_cost})`
    );

    return ApiResponse.success(res, null, 'Stock count approved and physical inventory adjustments reconciled in ledger');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/stock-counts/:id/reject
router.post('/stock-counts/:id/reject', authenticateToken, requirePermission('inventory.stock_count_approve'), async (req, res, next) => {
  try {
    const { rejection_reason } = req.body;
    await db('stock_counts').where({ id: req.params.id }).update({
      status: 'rejected',
      approval_notes: rejection_reason || 'Rejected by manager',
      updated_at: new Date()
    });

    return ApiResponse.success(res, null, 'Stock count session rejected');
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TASK 6: ALERTS AND INVENTORY REPORTS
// ============================================================================

// GET /api/v1/inventory/alerts (Low-stock, Out-of-stock, Overstock)
router.get('/alerts', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const stockItems = await db('products as p')
      .join('warehouse_stock as ws', 'p.id', 'ws.product_id')
      .leftJoin('product_variants as pv', 'ws.variant_id', 'pv.id')
      .where('p.status', 'active')
      .select(
        'p.id as product_id',
        'p.name as product_name',
        'p.sku as product_sku',
        'p.category',
        'p.unit',
        'p.min_stock_alert',
        'pv.id as variant_id',
        'pv.variant_name',
        'ws.warehouse_name',
        'ws.quantity as on_hand',
        'ws.reserved_quantity as reserved',
        db.raw('(ws.quantity - ws.reserved_quantity) as available')
      );

    const lowStock = [];
    const outOfStock = [];
    const overStock = [];

    for (const item of stockItems) {
      const available = parseFloat(item.available);
      const minAlert = parseFloat(item.min_stock_alert || 10);
      const overstockThreshold = minAlert * 3; // 3x min alert threshold

      if (available <= 0) {
        outOfStock.push({ ...item, alert_type: 'OUT_OF_STOCK', severity: 'critical' });
      } else if (available <= minAlert) {
        lowStock.push({ ...item, alert_type: 'LOW_STOCK', severity: 'warning' });
      } else if (available >= overstockThreshold && overstockThreshold > 30) {
        overStock.push({ ...item, alert_type: 'OVERSTOCK', overstock_threshold: overstockThreshold, severity: 'info' });
      }
    }

    return ApiResponse.success(res, {
      summary: {
        out_of_stock_count: outOfStock.length,
        low_stock_count: lowStock.length,
        overstock_count: overStock.length
      },
      out_of_stock: outOfStock,
      low_stock: lowStock,
      overstock: overStock
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/reports/valuation (AVCO & FIFO Valuation)
router.get('/reports/valuation', authenticateToken, requirePermission('inventory.valuation'), async (req, res, next) => {
  try {
    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');

    const products = await db('products as p')
      .join('warehouse_stock as ws', 'p.id', 'ws.product_id')
      .leftJoin('product_variants as pv', 'ws.variant_id', 'pv.id')
      .select(
        'p.id as product_id',
        'p.name as product_name',
        'p.sku as product_sku',
        'p.category',
        'p.unit',
        'p.cost_price as avco_unit_cost',
        'p.selling_price',
        'ws.warehouse_name',
        'ws.quantity'
      );

    let totalAvcoCost = 0;
    let totalSellingValue = 0;
    const categoryBreakdown = {};

    for (const p of products) {
      const qty = parseFloat(p.quantity);
      const unitCost = parseFloat(p.avco_unit_cost || 0);
      const sellingPrice = parseFloat(p.selling_price || 0);

      const itemCostValuation = qty * unitCost;
      const itemSellingValuation = qty * sellingPrice;

      totalAvcoCost += itemCostValuation;
      totalSellingValue += itemSellingValuation;

      if (!categoryBreakdown[p.category]) {
        categoryBreakdown[p.category] = {
          category: p.category,
          total_units: 0,
          cost_valuation: 0,
          selling_valuation: 0
        };
      }
      categoryBreakdown[p.category].total_units += qty;
      categoryBreakdown[p.category].cost_valuation += itemCostValuation;
      categoryBreakdown[p.category].selling_valuation += itemSellingValuation;
    }

    const projectedProfit = totalSellingValue - totalAvcoCost;
    const marginPct = totalSellingValue > 0 ? ((projectedProfit / totalSellingValue) * 100).toFixed(1) : 0;

    return ApiResponse.success(res, {
      costing_method: 'WEIGHTED_AVERAGE_COST (AVCO)',
      total_selling_valuation: parseFloat(totalSellingValue.toFixed(2)),
      total_cost_valuation: canViewCost ? parseFloat(totalAvcoCost.toFixed(2)) : undefined,
      projected_gross_profit: canViewCost ? parseFloat(projectedProfit.toFixed(2)) : undefined,
      projected_margin_percent: canViewCost ? parseFloat(marginPct) : undefined,
      categories: Object.values(categoryBreakdown).map(c => ({
        category: c.category,
        total_units: c.total_units,
        cost_valuation: canViewCost ? parseFloat(c.cost_valuation.toFixed(2)) : undefined,
        selling_valuation: parseFloat(c.selling_valuation.toFixed(2))
      }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/reports/damaged-missing (Damaged & Missing Stock Report)
router.get('/reports/damaged-missing', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const { start_date, end_date, warehouse_name } = req.query;

    let query = db('stock_movements as sm')
      .join('products as p', 'sm.product_id', 'p.id')
      .leftJoin('users as u', 'sm.created_by_id', 'u.id')
      .leftJoin('users as au', 'sm.authorized_by_id', 'au.id')
      .whereIn('sm.movement_type', ['DAMAGE', 'LOSS']);

    if (warehouse_name) query = query.where('sm.from_location', warehouse_name);
    if (start_date) query = query.where('sm.created_at', '>=', new Date(start_date));
    if (end_date) query = query.where('sm.created_at', '<=', new Date(end_date));

    const movements = await query.select(
      'sm.*',
      'p.name as product_name',
      'p.sku as product_sku',
      'p.category',
      'u.name as reported_by_name',
      'au.name as authorized_by_name'
    ).orderBy('sm.id', 'desc');

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
    let totalCostImpact = 0;

    const sanitized = movements.map(m => {
      const cost = Math.abs(parseFloat(m.total_cost || 0));
      totalCostImpact += cost;
      if (!canViewCost) {
        delete m.cost_price;
        delete m.total_cost;
      }
      return m;
    });

    return ApiResponse.success(res, {
      total_incidents: movements.length,
      total_cost_impact: canViewCost ? parseFloat(totalCostImpact.toFixed(2)) : undefined,
      incidents: sanitized
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/reports/reorder-suggestions (Reorder Recommendations)
router.get('/reports/reorder-suggestions', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const { category, warehouse_name } = req.query;

    let query = db('products as p')
      .join('warehouse_stock as ws', 'p.id', 'ws.product_id')
      .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
      .where('p.status', 'active');

    if (category && category !== 'All') query = query.where('p.category', category);
    if (warehouse_name) query = query.where('ws.warehouse_name', warehouse_name);

    const rows = await query.select(
      'p.id as product_id',
      'p.name as product_name',
      'p.sku',
      'p.category',
      'p.unit',
      'p.cost_price',
      'p.min_stock_alert',
      'ws.warehouse_name',
      'ws.quantity as on_hand',
      'ws.reserved_quantity as reserved',
      db.raw('(ws.quantity - ws.reserved_quantity) as available'),
      's.id as supplier_id',
      's.name as supplier_name',
      's.phone as supplier_phone'
    );

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');

    const suggestions = rows
      .filter(r => parseFloat(r.available) <= parseFloat(r.min_stock_alert || 10))
      .map(r => {
        const available = parseFloat(r.available);
        const minAlert = parseFloat(r.min_stock_alert || 10);
        const targetStock = minAlert * 2; // Target 2x minimum threshold
        const suggestedOrderQty = Math.max(1, targetStock - available);
        const unitCost = parseFloat(r.cost_price || 0);

        return {
          product_id: r.product_id,
          product_name: r.product_name,
          sku: r.sku,
          category: r.category,
          unit: r.unit,
          warehouse_name: r.warehouse_name,
          current_stock: available,
          min_stock_alert: minAlert,
          suggested_order_qty: suggestedOrderQty,
          unit_cost: canViewCost ? unitCost : undefined,
          estimated_cost: canViewCost ? parseFloat((suggestedOrderQty * unitCost).toFixed(2)) : undefined,
          preferred_supplier: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name, phone: r.supplier_phone } : null
        };
      });

    return ApiResponse.success(res, {
      total_items_to_reorder: suggestions.length,
      suggestions
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/reports/slow-moving (Dead / Slow Inventory)
router.get('/reports/slow-moving', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 60;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const items = await db('products as p')
      .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
      .whereNotIn('p.id', function() {
        this.select('si.product_id')
          .from('sale_items as si')
          .join('sales as s', 'si.sale_id', 's.id')
          .where('s.created_at', '>=', cutoffDate);
      })
      .groupBy('p.id')
      .havingRaw('COALESCE(SUM(ws.quantity), 0) > 0')
      .select(
        'p.id',
        'p.name',
        'p.category',
        'p.sku',
        'p.unit',
        'p.cost_price',
        'p.selling_price',
        'p.image_url',
        db.raw('COALESCE(SUM(ws.quantity), 0) as current_stock'),
        db.raw('(COALESCE(SUM(ws.quantity), 0) * p.cost_price) as tied_up_cost')
      )
      .orderBy('tied_up_cost', 'desc');

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
    const sanitized = items.map(item => {
      item.current_stock = parseFloat(item.current_stock);
      item.tied_up_cost = parseFloat(item.tied_up_cost);
      if (!canViewCost) {
        delete item.cost_price;
        delete item.tied_up_cost;
      }
      return item;
    });

    return ApiResponse.success(res, {
      days_threshold: days,
      slow_moving_count: items.length,
      items: sanitized
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// LEGACY / CONVENIENCE ENDPOINTS FOR BACKWARD COMPATIBILITY
// ============================================================================

router.get('/history', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { product_id, movement_type, reference_type, warehouse_name, start_date, end_date } = req.query;

  let query = db('stock_movements as sm')
    .join('products as p', 'sm.product_id', 'p.id')
    .leftJoin('product_variants as pv', 'sm.variant_id', 'pv.id')
    .leftJoin('users as u', 'sm.created_by_id', 'u.id')
    .leftJoin('users as au', 'sm.authorized_by_id', 'au.id');

  if (product_id) query = query.where('sm.product_id', parseInt(product_id));
  if (movement_type) query = query.where('sm.movement_type', movement_type);
  if (reference_type) query = query.where('sm.reference_type', reference_type);
  if (warehouse_name) {
    query = query.where(builder => {
      builder.where('sm.from_location', warehouse_name).orWhere('sm.to_location', warehouse_name);
    });
  }
  if (start_date) query = query.where('sm.created_at', '>=', new Date(start_date));
  if (end_date) query = query.where('sm.created_at', '<=', new Date(end_date));

  const canViewCost = await checkUserPermission(req.user, 'products.cost_view');

  const [totalRes, movements] = await Promise.all([
    query.clone().count('sm.id as total').first(),
    query.clone()
      .select('sm.*', 'p.name as product_name', 'p.sku as product_sku', 'p.category', 'pv.variant_name', 'pv.sku as variant_sku', 'u.name as created_by_name', 'au.name as authorized_by_name')
      .orderBy('sm.id', 'desc')
      .limit(limit)
      .offset(offset)
  ]);

  const sanitized = movements.map(m => {
    if (!canViewCost) {
      delete m.cost_price;
      delete m.total_cost;
    }
    return m;
  });

  return ApiResponse.paginated(res, sanitized, parseInt(totalRes.total), page, limit, 'Stock history retrieved');
});

router.get('/valuation', authenticateToken, requirePermission('inventory.valuation'), async (req, res, next) => {
  const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
  const products = await db('products as p')
    .join('warehouse_stock as ws', 'p.id', 'ws.product_id')
    .leftJoin('product_variants as pv', 'ws.variant_id', 'pv.id')
    .select('p.id as product_id', 'p.name as product_name', 'p.sku as product_sku', 'p.category', 'p.unit', 'p.cost_price as avco_unit_cost', 'p.selling_price', 'ws.warehouse_name', 'ws.quantity');

  let totalAvcoCost = 0;
  let totalSellingValue = 0;
  const categoryBreakdown = {};

  for (const p of products) {
    const qty = parseFloat(p.quantity);
    const unitCost = parseFloat(p.avco_unit_cost || 0);
    const sellingPrice = parseFloat(p.selling_price || 0);
    const itemCostValuation = qty * unitCost;
    const itemSellingValuation = qty * sellingPrice;
    totalAvcoCost += itemCostValuation;
    totalSellingValue += itemSellingValuation;

    if (!categoryBreakdown[p.category]) {
      categoryBreakdown[p.category] = { category: p.category, total_units: 0, cost_valuation: 0, selling_valuation: 0 };
    }
    categoryBreakdown[p.category].total_units += qty;
    categoryBreakdown[p.category].cost_valuation += itemCostValuation;
    categoryBreakdown[p.category].selling_valuation += itemSellingValuation;
  }

  const projectedProfit = totalSellingValue - totalAvcoCost;
  const marginPct = totalSellingValue > 0 ? ((projectedProfit / totalSellingValue) * 100).toFixed(1) : 0;

  return ApiResponse.success(res, {
    costing_method: 'WEIGHTED_AVERAGE_COST (AVCO)',
    total_selling_valuation: parseFloat(totalSellingValue.toFixed(2)),
    total_cost_valuation: canViewCost ? parseFloat(totalAvcoCost.toFixed(2)) : undefined,
    projected_gross_profit: canViewCost ? parseFloat(projectedProfit.toFixed(2)) : undefined,
    projected_margin_percent: canViewCost ? parseFloat(marginPct) : undefined,
    categories: Object.values(categoryBreakdown).map(c => ({
      category: c.category,
      total_units: c.total_units,
      cost_valuation: canViewCost ? parseFloat(c.cost_valuation.toFixed(2)) : undefined,
      selling_valuation: parseFloat(c.selling_valuation.toFixed(2))
    }))
  });
});

router.get('/dead-stock', authenticateToken, requirePermission('inventory.view'), async (req, res, next) => {
  const days = parseInt(req.query.days) || 60;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const items = await db('products as p')
    .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
    .whereNotIn('p.id', function() {
      this.select('si.product_id').from('sale_items as si').join('sales as s', 'si.sale_id', 's.id').where('s.created_at', '>=', cutoffDate);
    })
    .groupBy('p.id')
    .havingRaw('COALESCE(SUM(ws.quantity), 0) > 0')
    .select(
      'p.id', 'p.name', 'p.category', 'p.sku', 'p.unit', 'p.cost_price', 'p.selling_price', 'p.image_url',
      db.raw('COALESCE(SUM(ws.quantity), 0) as current_stock'),
      db.raw('(COALESCE(SUM(ws.quantity), 0) * p.cost_price) as tied_up_cost')
    )
    .orderBy('tied_up_cost', 'desc');

  const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
  const sanitized = items.map(item => {
    item.current_stock = parseFloat(item.current_stock);
    item.tied_up_cost = parseFloat(item.tied_up_cost);
    if (!canViewCost) {
      delete item.cost_price;
      delete item.tied_up_cost;
    }
    return item;
  });

  return ApiResponse.success(res, sanitized);
});

router.post('/inward', authenticateToken, requirePermission('inventory.receive'), validateBody(inwardSchema), async (req, res, next) => {
  const { product_id, variant_id, warehouse_name, quantity, supplier_name, invoice_no, cost_price, notes } = req.body;
  const product = await db('products').where({ id: product_id }).first();
  if (!product) return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');
  const unitCost = cost_price || parseFloat(product.cost_price || 0);

  await db.transaction(async (trx) => {
    let stockQuery = trx('warehouse_stock').where({ product_id, warehouse_name });
    if (variant_id) stockQuery = stockQuery.where({ variant_id });
    else stockQuery = stockQuery.whereNull('variant_id');

    const stockRow = await stockQuery.forUpdate().first();
    const currentQty = stockRow ? parseFloat(stockRow.quantity) : 0;
    const newQty = currentQty + quantity;

    if (stockRow) {
      await trx('warehouse_stock').where({ id: stockRow.id }).update({ quantity: newQty, updated_at: new Date() });
    } else {
      await trx('warehouse_stock').insert({ product_id, variant_id: variant_id || null, warehouse_name, quantity: newQty, reserved_quantity: 0 });
    }

    if (cost_price && cost_price > 0) {
      await trx('products').where({ id: product_id }).update({ cost_price: unitCost, updated_at: new Date() });
    }

    await trx('stock_movements').insert({
      product_id,
      variant_id: variant_id || null,
      movement_type: 'PURCHASE_RECEIPT',
      quantity,
      unit: product.unit || 'pcs',
      from_location: supplier_name || 'Direct Inward',
      to_location: warehouse_name,
      reference_type: 'PURCHASE_RECEIPT',
      reference_no: invoice_no || `INW-${Date.now()}`,
      cost_price: unitCost,
      total_cost: quantity * unitCost,
      balance_after: newQty,
      reason: `Direct inward: ${supplier_name || 'Direct'} (${notes || 'Stock inward'})`,
      created_by_id: req.user.id
    });
  });

  return ApiResponse.success(res, null, `Successfully added ${quantity} units to ${warehouse_name}`);
});

router.post('/adjust', authenticateToken, requirePermission('inventory.adjust'), validateBody(adjustSchema), async (req, res, next) => {
  const { product_id, variant_id, warehouse_name, adjustment_type, quantity, reason, admin_pin } = req.body;
  const pinCheck = await verifyAdminPin(admin_pin);
  if (!pinCheck.valid) return ApiResponse.error(res, pinCheck.message, 403, 'INVALID_PIN');

  const product = await db('products').where({ id: product_id }).first();
  if (!product) return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');

  let stockQuery = db('warehouse_stock').where({ product_id, warehouse_name });
  if (variant_id) stockQuery = stockQuery.where({ variant_id });
  else stockQuery = stockQuery.whereNull('variant_id');

  const stockRow = await stockQuery.first();
  const currentQty = stockRow ? parseFloat(stockRow.quantity) : 0;

  let newQty = currentQty;
  let movementQty = 0;
  if (adjustment_type === 'SET_EXACT') {
    movementQty = quantity - currentQty;
    newQty = quantity;
  } else if (adjustment_type === 'DECREASE') {
    movementQty = -Math.abs(quantity);
    newQty = currentQty - Math.abs(quantity);
  } else if (adjustment_type === 'INCREASE') {
    movementQty = Math.abs(quantity);
    newQty = currentQty + Math.abs(quantity);
  }

  if (newQty < 0) return ApiResponse.error(res, `Cannot adjust below 0. Current stock is ${currentQty}`, 400, 'BAD_REQUEST');

  await db.transaction(async (trx) => {
    if (stockRow) {
      await trx('warehouse_stock').where({ id: stockRow.id }).update({ quantity: newQty, updated_at: new Date() });
    } else {
      await trx('warehouse_stock').insert({ product_id, variant_id: variant_id || null, warehouse_name, quantity: newQty, reserved_quantity: 0 });
    }
    await trx('stock_movements').insert({
      product_id,
      variant_id: variant_id || null,
      movement_type: 'COUNT_ADJUSTMENT',
      quantity: movementQty,
      unit: product.unit || 'pcs',
      from_location: warehouse_name,
      to_location: warehouse_name,
      reference_type: 'COUNT_ADJUSTMENT',
      reference_no: `ADJ-${Date.now()}`,
      cost_price: product.cost_price,
      total_cost: Math.abs(movementQty) * parseFloat(product.cost_price || 0),
      balance_after: newQty,
      reason: `Adjustment (${adjustment_type}): ${reason}. Previous: ${currentQty}, New: ${newQty}`,
      authorized_by_id: pinCheck.user.id,
      created_by_id: req.user.id
    });
  });

  return ApiResponse.success(res, { currentQty: newQty }, `Stock adjusted to ${newQty} units`);
});

module.exports = router;

import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/connection';
import { BadRequestError } from '../../common/errors';
import { authenticate, requirePermission } from '../../middleware/auth';

export const purchasingRouter = Router();

// Standard Hardware Suppliers
const STANDARD_SUPPLIERS = [
  { name: 'B5 Plus Ltd (Iron Rods & Steel)', contact_person: 'Sales Desk', phone: '+233 30 222 1100', email: 'sales@b5plus.com', address: 'Tema Industrial Area', status: 'active', current_balance: 0 },
  { name: 'Ghacem Cement Distributors', contact_person: 'Order Dep.', phone: '+233 30 266 2200', email: 'orders@ghacem.com', address: 'Harbour Road, Tema', status: 'active', current_balance: 0 },
  { name: 'Eurostar Security Doors & Locks', contact_person: 'Mr. Mensah', phone: '+233 24 411 3344', email: 'eurostar@omalhardware.com', address: 'Spintex Road, Accra', status: 'active', current_balance: 0 },
  { name: 'Sintex Pipes & Plumbing Ware', contact_person: 'Plumbing Supply', phone: '+233 30 281 1234', email: 'sales@sintex.com', address: 'Spintex Heavy Industrial, Accra', status: 'active', current_balance: 0 },
  { name: 'Superlock Burglary Proof & Security', contact_person: 'Wholesale Unit', phone: '+233 30 278 8990', email: 'info@superlockgh.com', address: 'North Industrial Area, Accra', status: 'active', current_balance: 0 },
];

// Supplier list
purchasingRouter.get('/suppliers', authenticate, requirePermission('suppliers.view', 'purchases.view'), async (_req, res, next) => {
  try {
    const db = getDb();
    let suppliers = await db('suppliers').orderBy('name', 'asc');

    if (suppliers.length === 0) {
      for (const sup of STANDARD_SUPPLIERS) {
        await db('suppliers').insert(sup);
      }
      suppliers = await db('suppliers').orderBy('name', 'asc');
    }

    res.json({
      success: true,
      data: suppliers.map((s: any) => ({
        ...s,
        current_balance: Number(s.current_balance),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Add Supplier
purchasingRouter.post('/suppliers', authenticate, requirePermission('purchases.create'), async (req, res, next) => {
  try {
    const { name, contact_person, phone, email, address, payment_terms } = req.body;
    if (!name || typeof name !== 'string') {
      throw new BadRequestError('Supplier name is required');
    }
    const db = getDb();

    const [newSup] = await db('suppliers')
      .insert({
        name: name.trim(),
        contact_person: contact_person || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        payment_terms: payment_terms || 'cash_on_delivery',
        status: 'active',
        current_balance: 0,
      })
      .returning('*');

    res.status(201).json({ success: true, data: newSup });
  } catch (err) {
    next(err);
  }
});

// List Purchase Orders
purchasingRouter.get('/orders', authenticate, requirePermission('purchases.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const { status, supplierId } = req.query;

    let query = db('purchase_orders')
      .join('suppliers', 'suppliers.id', 'purchase_orders.supplier_id')
      .join('warehouses', 'warehouses.id', 'purchase_orders.warehouse_id')
      .leftJoin('users as creators', 'creators.id', 'purchase_orders.created_by')
      .leftJoin('users as approvers', 'approvers.id', 'purchase_orders.approved_by')
      .select(
        'purchase_orders.*',
        'suppliers.name as supplier_name',
        'warehouses.name as warehouse_name',
        'creators.full_name as creator_name',
        'approvers.full_name as approver_name',
      );

    if (status) query = query.where('purchase_orders.status', String(status));
    if (supplierId) query = query.where('purchase_orders.supplier_id', Number(supplierId));

    const orders = await query.orderBy('purchase_orders.order_date', 'desc');

    const orderIds = orders.map((o: any) => o.id);
    const items = await db('purchase_order_items')
      .join('products', 'products.id', 'purchase_order_items.product_id')
      .leftJoin('product_variants', 'product_variants.id', 'purchase_order_items.variant_id')
      .select(
        'purchase_order_items.*',
        'products.name as product_name',
        'products.sku',
        'product_variants.name as variant_name',
      )
      .whereIn('purchase_order_items.po_id', orderIds);

    const result = orders.map((o: any) => ({
      ...o,
      subtotal: Number(o.subtotal),
      tax_amount: Number(o.tax_amount),
      total_amount: Number(o.total_amount),
      items: items
        .filter((i: any) => Number(i.po_id) === Number(o.id))
        .map((i: any) => ({
          ...i,
          quantity_ordered: Number(i.quantity_ordered),
          quantity_received: Number(i.quantity_received),
          unit_cost: Number(i.unit_cost),
          line_total: Number(i.line_total),
        })),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Create Purchase Order
const createPoSchema = z.object({
  supplierId: z.number().int(),
  warehouseId: z.number().int().default(1),
  poNumber: z.string().optional(),
  totalAmount: z.number().optional(),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  autoReceive: z.boolean().default(true),
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        variantId: z.number().int().optional(),
        quantityOrdered: z.number().positive(),
        unit: z.string().default('pcs'),
        unitCost: z.number().positive(),
      }),
    )
    .optional(),
});

purchasingRouter.post('/orders', authenticate, requirePermission('purchases.create'), async (req, res, next) => {
  try {
    const rawBody = { ...req.body };
    if (!rawBody.warehouseId) rawBody.warehouseId = 1;

    const parsed = createPoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestError('Invalid PO payload', parsed.error.issues);
    }

    const { supplierId, warehouseId, expectedDeliveryDate, notes, items, autoReceive } = parsed.data;
    const db = getDb();

    const itemsList = items || [];
    const subtotal = itemsList.length > 0
      ? itemsList.reduce((sum, item) => sum + item.quantityOrdered * item.unitCost, 0)
      : Number(rawBody.totalAmount || 0);

    const poNumber = parsed.data.poNumber || `PO-${Date.now().toString().slice(-6)}`;

    const poId = await db.transaction(async (trx: any) => {
      const [po] = await trx('purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_id: supplierId,
          warehouse_id: warehouseId,
          status: autoReceive && itemsList.length > 0 ? 'received' : 'approved',
          order_date: new Date(),
          expected_delivery_date: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          subtotal,
          tax_amount: 0,
          total_amount: subtotal,
          created_by: req.user!.id,
          approved_by: req.user!.id,
          approved_at: new Date(),
          notes: notes || null,
        })
        .returning('id');

      const id = typeof po === 'object' ? po.id : po;

      for (const item of itemsList) {
        await trx('purchase_order_items').insert({
          po_id: id,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity_ordered: item.quantityOrdered,
          quantity_received: autoReceive ? item.quantityOrdered : 0,
          unit: item.unit,
          unit_cost: item.unitCost,
          line_total: item.quantityOrdered * item.unitCost,
        });

        if (autoReceive) {
          // Increase stock on hand immediately
          let stockRow = await trx('stock_levels')
            .where({
              warehouse_id: warehouseId,
              product_id: item.productId,
              variant_id: item.variantId || null,
            })
            .forUpdate()
            .first();

          if (!stockRow) {
            const [created] = await trx('stock_levels')
              .insert({
                warehouse_id: warehouseId,
                product_id: item.productId,
                variant_id: item.variantId || null,
                quantity_on_hand: item.quantityOrdered,
                quantity_reserved: 0,
                reorder_threshold: 5,
              })
              .returning('*');
            stockRow = created;
          } else {
            await trx('stock_levels')
              .where('id', stockRow.id)
              .increment('quantity_on_hand', item.quantityOrdered);
          }

          // Record stock movement
          await trx('stock_movements').insert({
            movement_type: 'stock_receipt',
            warehouse_id: warehouseId,
            product_id: item.productId,
            variant_id: item.variantId || null,
            quantity: item.quantityOrdered,
            unit_cost: item.unitCost,
            total_valuation: item.quantityOrdered * item.unitCost,
            source_transaction_type: 'purchase_order',
            source_transaction_id: poNumber,
            operator_id: req.user!.id,
          });

          // Single source of truth: Update product master cost_price to match the latest purchase unit cost
          await trx('products')
            .where('id', item.productId)
            .update({
              cost_price: item.unitCost,
              updated_at: new Date(),
            });
        }
      }

      await trx('audit_logs').insert({
        action: 'purchasing.create_order',
        actor_user_id: req.user!.id,
        actor_label: req.user!.fullName,
        entity_type: 'purchase_order',
        entity_id: String(id),
        result: 'success',
      });

      return id;
    });

    res.status(201).json({ success: true, data: { id: poId, poNumber } });
  } catch (err) {
    next(err);
  }
});

// Record Goods Received Note (GRN) and update stock
const receiveGrnSchema = z.object({
  poId: z.number().int().optional(),
  supplierId: z.number().int(),
  warehouseId: z.number().int(),
  deliveryNoteRef: z.string().optional(),
  supplierInvoiceRef: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        variantId: z.number().int().optional(),
        quantityReceived: z.number().positive(),
        quantityRejected: z.number().min(0).default(0),
        unitCost: z.number().positive(),
        discrepancyReason: z.string().optional(),
      }),
    )
    .min(1),
});

purchasingRouter.post('/grn', authenticate, requirePermission('inventory.receive', 'purchases.create'), async (req, res, next) => {
  try {
    const parsed = receiveGrnSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid GRN payload', parsed.error.issues);
    }

    const {
      poId,
      supplierId,
      warehouseId,
      deliveryNoteRef,
      supplierInvoiceRef,
      notes,
      items,
    } = parsed.data;

    const db = getDb();
    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;

    await db.transaction(async (trx: any) => {
      // 1. Create GRN
      const [grn] = await trx('goods_received_notes')
        .insert({
          grn_number: grnNumber,
          po_id: poId || null,
          supplier_id: supplierId,
          warehouse_id: warehouseId,
          delivery_note_ref: deliveryNoteRef || null,
          supplier_invoice_ref: supplierInvoiceRef || null,
          status: 'confirmed',
          received_by: req.user!.id,
          notes: notes || null,
        })
        .returning('id');

      const grnId = typeof grn === 'object' ? grn.id : grn;

      // 2. Process received items
      for (const item of items) {
        await trx('goods_received_items').insert({
          grn_id: grnId,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity_received: item.quantityReceived,
          quantity_rejected: item.quantityRejected,
          unit_cost: item.unitCost,
          discrepancy_reason: item.discrepancyReason || null,
        });

        // Increase stock on hand
        const existingStock = await trx('stock_levels')
          .where({
            warehouse_id: warehouseId,
            product_id: item.productId,
            variant_id: item.variantId || null,
          })
          .forUpdate()
          .first();

        if (existingStock) {
          await trx('stock_levels')
            .where('id', existingStock.id)
            .update({
              quantity_on_hand: Number(existingStock.quantity_on_hand) + item.quantityReceived,
              updated_at: new Date(),
            });
        } else {
          await trx('stock_levels').insert({
            warehouse_id: warehouseId,
            product_id: item.productId,
            variant_id: item.variantId || null,
            quantity_on_hand: item.quantityReceived,
            quantity_reserved: 0,
          });
        }

        // Record stock movement ledger entry
        await trx('stock_movements').insert({
          movement_type: 'stock_receipt',
          warehouse_id: warehouseId,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity: item.quantityReceived,
          unit_cost: item.unitCost,
          total_valuation: item.quantityReceived * item.unitCost,
          source_transaction_type: 'grn',
          source_transaction_id: String(grnId),
          reference_number: grnNumber,
          operator_id: req.user!.id,
          notes: `Goods received against delivery note ${deliveryNoteRef || 'N/A'}`,
        });

        // Single source of truth: Update product master cost_price to match the latest purchase unit cost
        await trx('products')
          .where('id', item.productId)
          .update({
            cost_price: item.unitCost,
            updated_at: new Date(),
          });

        // Update PO item received quantity if linked
        if (poId) {
          await trx('purchase_order_items')
            .where({ po_id: poId, product_id: item.productId })
            .increment('quantity_received', item.quantityReceived);
        }
      }

      // 3. Write Immutable Audit Log
      await trx('audit_logs').insert({
        action: 'purchasing.receive_goods',
        actor_user_id: req.user!.id,
        actor_label: req.user!.fullName,
        entity_type: 'grn',
        entity_id: String(grnId),
        result: 'success',
      });
    });

    res.status(201).json({
      success: true,
      message: 'Goods received and stock inventory updated successfully',
      grnNumber,
    });
  } catch (err) {
    next(err);
  }
});

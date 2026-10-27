import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/connection';
import { BadRequestError } from '../../common/errors';
import { authenticate, requirePermission } from '../../middleware/auth';

export const inventoryRouter = Router();

// Current stock levels per warehouse
inventoryRouter.get('/levels', authenticate, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const { warehouseId, branchId, search } = req.query;

    let query = db('stock_levels')
      .join('warehouses', 'warehouses.id', 'stock_levels.warehouse_id')
      .join('branches', 'branches.id', 'warehouses.branch_id')
      .join('products', 'products.id', 'stock_levels.product_id')
      .join('product_categories', 'product_categories.id', 'products.category_id')
      .leftJoin('product_variants', 'product_variants.id', 'stock_levels.variant_id')
      .select(
        'stock_levels.id',
        'stock_levels.warehouse_id',
        'warehouses.name as warehouse_name',
        'warehouses.code as warehouse_code',
        'branches.id as branch_id',
        'branches.name as branch_name',
        'branches.code as branch_code',
        'products.id as product_id',
        'products.sku',
        'products.name as product_name',
        'products.base_unit',
        'products.cost_price as default_cost',
        'products.selling_price as default_price',
        'product_categories.name as category_name',
        'product_variants.id as variant_id',
        'product_variants.name as variant_name',
        'product_variants.sku_variant',
        'stock_levels.quantity_on_hand',
        'stock_levels.quantity_reserved',
        'stock_levels.reorder_threshold',
        'stock_levels.updated_at',
      );

    if (warehouseId) {
      query = query.where('stock_levels.warehouse_id', Number(warehouseId));
    }
    if (branchId) {
      query = query.where('branches.id', Number(branchId));
    }
    if (search) {
      const term = `%${String(search).toLowerCase()}%`;
      query = query.where((q: any) => {
        q.whereRaw('lower(products.name) like ?', [term])
          .orWhereRaw('lower(products.sku) like ?', [term]);
      });
    }

    const items = await query.orderBy('products.name', 'asc');

    const result = items.map((item: any) => {
      const onHand = Number(item.quantity_on_hand);
      const reserved = Number(item.quantity_reserved);
      const available = Math.max(0, onHand - reserved);
      const unitCost = Number(item.default_cost);
      const valuation = onHand * unitCost;
      const isLowStock = onHand <= Number(item.reorder_threshold);

      return {
        ...item,
        quantity_on_hand: onHand,
        quantity_reserved: reserved,
        quantity_available: available,
        reorder_threshold: Number(item.reorder_threshold),
        unit_cost: unitCost,
        valuation,
        is_low_stock: isLowStock,
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Stock Movement Ledger
inventoryRouter.get('/movements', authenticate, requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const { warehouseId, productId, movementType, limit = 100 } = req.query;

    let query = db('stock_movements')
      .join('warehouses', 'warehouses.id', 'stock_movements.warehouse_id')
      .join('branches', 'branches.id', 'warehouses.branch_id')
      .join('products', 'products.id', 'stock_movements.product_id')
      .leftJoin('product_variants', 'product_variants.id', 'stock_movements.variant_id')
      .join('users as operators', 'operators.id', 'stock_movements.operator_id')
      .leftJoin('users as approvers', 'approvers.id', 'stock_movements.approved_by')
      .select(
        'stock_movements.*',
        'warehouses.name as warehouse_name',
        'branches.name as branch_name',
        'products.name as product_name',
        'products.sku',
        'product_variants.name as variant_name',
        'operators.full_name as operator_name',
        'approvers.full_name as approver_name',
      );

    if (warehouseId) {
      query = query.where('stock_movements.warehouse_id', Number(warehouseId));
    }
    if (productId) {
      query = query.where('stock_movements.product_id', Number(productId));
    }
    if (movementType) {
      query = query.where('stock_movements.movement_type', String(movementType));
    }

    const movements = await query
      .orderBy('stock_movements.created_at', 'desc')
      .limit(Number(limit));

    res.json({
      success: true,
      data: movements.map((m: any) => ({
        ...m,
        quantity: Number(m.quantity),
        unit_cost: Number(m.unit_cost),
        total_valuation: Number(m.total_valuation),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Record Stock Adjustment (Breakage, Damage, Loss, Stock Count Adjustment)
const adjustStockSchema = z.object({
  warehouseId: z.number().int(),
  productId: z.number().int(),
  variantId: z.number().int().optional(),
  quantity: z.number().refine((val) => val !== 0, 'Quantity cannot be zero'),
  movementType: z.enum(['damage_breakage', 'approved_loss', 'stock_count_adjustment', 'customer_return']),
  reason: z.string().min(3, 'Detailed reason or notes required'),
  referenceNumber: z.string().optional(),
});

inventoryRouter.post('/adjust', authenticate, requirePermission('inventory.adjust'), async (req, res, next) => {
  try {
    const parsed = adjustStockSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid adjustment payload', parsed.error.issues);
    }

    const { warehouseId, productId, variantId, quantity, movementType, reason, referenceNumber } = parsed.data;
    const db = getDb();

    await db.transaction(async (trx: any) => {
      // 1. Lock current stock level
      let stockLevel = await trx('stock_levels')
        .where({
          warehouse_id: warehouseId,
          product_id: productId,
          variant_id: variantId || null,
        })
        .forUpdate()
        .first();

      if (!stockLevel) {
        if (quantity < 0) {
          throw new BadRequestError('Cannot reduce stock: no inventory recorded for this item');
        }
        const [created] = await trx('stock_levels')
          .insert({
            warehouse_id: warehouseId,
            product_id: productId,
            variant_id: variantId || null,
            quantity_on_hand: quantity,
            quantity_reserved: 0,
          })
          .returning('*');
        stockLevel = created;
      } else {
        const newOnHand = Number(stockLevel.quantity_on_hand) + quantity;
        if (newOnHand < 0) {
          throw new BadRequestError(
            `Adjustment rejected: Insufficient stock. On-hand is ${stockLevel.quantity_on_hand}, cannot deduct ${Math.abs(quantity)}.`,
          );
        }
        await trx('stock_levels')
          .where('id', stockLevel.id)
          .update({
            quantity_on_hand: newOnHand,
            updated_at: new Date(),
          });
      }

      // Fetch product unit cost
      const product = await trx('products').where('id', productId).first();
      const unitCost = Number(product?.cost_price || 0);

      // 2. Write Stock Movement Ledger entry
      await trx('stock_movements').insert({
        movement_type: movementType,
        warehouse_id: warehouseId,
        product_id: productId,
        variant_id: variantId || null,
        quantity,
        unit_cost: unitCost,
        total_valuation: Math.abs(quantity * unitCost),
        source_transaction_type: 'adjustment',
        reference_number: referenceNumber || `ADJ-${Date.now()}`,
        operator_id: req.user!.id,
        approved_by: req.user!.id,
        notes: reason,
      });

      // 3. Write Immutable Audit Log
      await trx('audit_logs').insert({
        action: `inventory.${movementType}`,
        actor_user_id: req.user!.id,
        actor_label: req.user!.fullName,
        entity_type: 'stock_level',
        entity_id: String(stockLevel.id),
        after_data: JSON.stringify({ warehouseId, productId, quantity, movementType, reason }),
        result: 'success',
      });
    });

    res.json({ success: true, message: 'Stock adjustment recorded successfully' });
  } catch (err) {
    next(err);
  }
});

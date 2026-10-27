import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/connection';
import { BadRequestError } from '../../common/errors';
import { authenticate } from '../../middleware/auth';

export const transfersRouter = Router();

// List transfers
transfersRouter.get('/', authenticate, async (_req, res, next) => {
  try {
    const db = getDb();
    const transfers = await db('interbranch_transfers')
      .join('branches as src_branch', 'src_branch.id', 'interbranch_transfers.source_branch_id')
      .join('warehouses as src_wh', 'src_wh.id', 'interbranch_transfers.source_warehouse_id')
      .join('branches as dst_branch', 'dst_branch.id', 'interbranch_transfers.dest_branch_id')
      .join('warehouses as dst_wh', 'dst_wh.id', 'interbranch_transfers.dest_warehouse_id')
      .leftJoin('users as requesters', 'requesters.id', 'interbranch_transfers.requested_by')
      .leftJoin('users as dispatchers', 'dispatchers.id', 'interbranch_transfers.dispatched_by')
      .leftJoin('users as receivers', 'receivers.id', 'interbranch_transfers.received_by')
      .select(
        'interbranch_transfers.*',
        'src_branch.name as source_branch_name',
        'src_wh.name as source_warehouse_name',
        'dst_branch.name as dest_branch_name',
        'dst_wh.name as dest_warehouse_name',
        'requesters.full_name as requested_by_name',
        'dispatchers.full_name as dispatched_by_name',
        'receivers.full_name as received_by_name',
      )
      .orderBy('interbranch_transfers.created_at', 'desc');

    const transferIds = transfers.map((t: any) => t.id);
    const items = await db('interbranch_transfer_items')
      .join('products', 'products.id', 'interbranch_transfer_items.product_id')
      .leftJoin('product_variants', 'product_variants.id', 'interbranch_transfer_items.variant_id')
      .select(
        'interbranch_transfer_items.*',
        'products.name as product_name',
        'products.sku',
        'product_variants.name as variant_name',
      )
      .whereIn('interbranch_transfer_items.transfer_id', transferIds);

    const result = transfers.map((t: any) => ({
      ...t,
      items: items
        .filter((i: any) => Number(i.transfer_id) === Number(t.id))
        .map((i: any) => ({
          ...i,
          quantity_requested: Number(i.quantity_requested),
          quantity_dispatched: Number(i.quantity_dispatched),
          quantity_received: Number(i.quantity_received),
          quantity_damaged: Number(i.quantity_damaged),
        })),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Request transfer
const requestTransferSchema = z.object({
  sourceBranchId: z.number().int(),
  sourceWarehouseId: z.number().int(),
  destBranchId: z.number().int(),
  destWarehouseId: z.number().int(),
  driverName: z.string().optional(),
  vehicleNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        variantId: z.number().int().optional(),
        quantity: z.number().positive(),
        unit: z.string().default('pcs'),
      }),
    )
    .min(1),
});

transfersRouter.post('/request', authenticate, async (req, res, next) => {
  try {
    const parsed = requestTransferSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid transfer request payload', parsed.error.issues);
    }

    const {
      sourceBranchId,
      sourceWarehouseId,
      destBranchId,
      destWarehouseId,
      driverName,
      vehicleNumber,
      notes,
      items,
    } = parsed.data;

    const db = getDb();
    const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;

    const transferId = await db.transaction(async (trx: any) => {
      const [transfer] = await trx('interbranch_transfers')
        .insert({
          transfer_number: transferNumber,
          source_branch_id: sourceBranchId,
          source_warehouse_id: sourceWarehouseId,
          dest_branch_id: destBranchId,
          dest_warehouse_id: destWarehouseId,
          status: 'requested',
          requested_by: req.user!.id,
          driver_name: driverName || null,
          vehicle_number: vehicleNumber || null,
          notes: notes || null,
        })
        .returning('id');

      const id = typeof transfer === 'object' ? transfer.id : transfer;

      for (const item of items) {
        await trx('interbranch_transfer_items').insert({
          transfer_id: id,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity_requested: item.quantity,
          unit: item.unit,
        });
      }

      await trx('audit_logs').insert({
        action: 'transfers.request',
        actor_user_id: req.user!.id,
        actor_label: req.user!.fullName,
        entity_type: 'transfer',
        entity_id: String(id),
        result: 'success',
      });

      return id;
    });

    res.status(201).json({ success: true, data: { id: transferId, transferNumber } });
  } catch (err) {
    next(err);
  }
});

// Dispatch Transfer
transfersRouter.post('/:id/dispatch', authenticate, async (req, res, next) => {
  try {
    const transferId = Number(req.params.id);
    const db = getDb();

    await db.transaction(async (trx: any) => {
      const transfer = await trx('interbranch_transfers').where('id', transferId).first();
      if (!transfer || transfer.status !== 'requested') {
        throw new BadRequestError('Transfer not in requested status');
      }

      const items = await trx('interbranch_transfer_items').where('transfer_id', transferId);

      for (const item of items) {
        const qty = Number(item.quantity_requested);
        const stock = await trx('stock_levels')
          .where({
            warehouse_id: transfer.source_warehouse_id,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
          })
          .forUpdate()
          .first();

        if (!stock || Number(stock.quantity_on_hand) < qty) {
          throw new BadRequestError(`Insufficient stock in source warehouse for product ID ${item.product_id}`);
        }

        await trx('stock_levels')
          .where('id', stock.id)
          .update({
            quantity_on_hand: Number(stock.quantity_on_hand) - qty,
            updated_at: new Date(),
          });

        await trx('stock_movements').insert({
          movement_type: 'warehouse_transfer_out',
          warehouse_id: transfer.source_warehouse_id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: -qty,
          source_transaction_type: 'transfer',
          source_transaction_id: String(transferId),
          reference_number: transfer.transfer_number,
          operator_id: req.user!.id,
          notes: `Transfer dispatched to destination warehouse`,
        });

        await trx('interbranch_transfer_items')
          .where('id', item.id)
          .update({ quantity_dispatched: qty });
      }

      await trx('interbranch_transfers')
        .where('id', transferId)
        .update({
          status: 'dispatched',
          dispatched_by: req.user!.id,
          dispatched_at: new Date(),
          updated_at: new Date(),
        });

      await trx('audit_logs').insert({
        action: 'transfers.dispatch',
        actor_user_id: req.user!.id,
        actor_label: req.user!.fullName,
        entity_type: 'transfer',
        entity_id: String(transferId),
        result: 'success',
      });
    });

    res.json({ success: true, message: 'Transfer dispatched successfully' });
  } catch (err) {
    next(err);
  }
});

// Receive Transfer
transfersRouter.post('/:id/receive', authenticate, async (req, res, next) => {
  try {
    const transferId = Number(req.params.id);
    const db = getDb();

    await db.transaction(async (trx: any) => {
      const transfer = await trx('interbranch_transfers').where('id', transferId).first();
      if (!transfer || transfer.status !== 'dispatched') {
        throw new BadRequestError('Transfer must be in dispatched status to receive');
      }

      const items = await trx('interbranch_transfer_items').where('transfer_id', transferId);

      for (const item of items) {
        const qty = Number(item.quantity_dispatched);

        const stock = await trx('stock_levels')
          .where({
            warehouse_id: transfer.dest_warehouse_id,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
          })
          .forUpdate()
          .first();

        if (stock) {
          await trx('stock_levels')
            .where('id', stock.id)
            .update({
              quantity_on_hand: Number(stock.quantity_on_hand) + qty,
              updated_at: new Date(),
            });
        } else {
          await trx('stock_levels').insert({
            warehouse_id: transfer.dest_warehouse_id,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            quantity_on_hand: qty,
            quantity_reserved: 0,
          });
        }

        await trx('stock_movements').insert({
          movement_type: 'warehouse_transfer_in',
          warehouse_id: transfer.dest_warehouse_id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: qty,
          source_transaction_type: 'transfer',
          source_transaction_id: String(transferId),
          reference_number: transfer.transfer_number,
          operator_id: req.user!.id,
          notes: `Transfer received at destination warehouse`,
        });

        await trx('interbranch_transfer_items')
          .where('id', item.id)
          .update({ quantity_received: qty });
      }

      await trx('interbranch_transfers')
        .where('id', transferId)
        .update({
          status: 'received',
          received_by: req.user!.id,
          received_at: new Date(),
          updated_at: new Date(),
        });

      await trx('audit_logs').insert({
        action: 'transfers.receive',
        actor_user_id: req.user!.id,
        actor_label: req.user!.fullName,
        entity_type: 'transfer',
        entity_id: String(transferId),
        result: 'success',
      });
    });

    res.json({ success: true, message: 'Transfer received and destination inventory updated' });
  } catch (err) {
    next(err);
  }
});

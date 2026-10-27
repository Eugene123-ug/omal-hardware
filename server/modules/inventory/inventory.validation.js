const { z } = require('zod');

const inwardSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  warehouse_name: z.string().min(1),
  quantity: z.number().positive('Quantity must be greater than 0'),
  supplier_name: z.string().optional().nullable(),
  invoice_no: z.string().optional().nullable(),
  cost_price: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable()
});

const adjustSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  warehouse_name: z.string().min(1),
  adjustment_type: z.enum(['DECREASE', 'INCREASE', 'SET_EXACT']),
  quantity: z.number().nonnegative('Quantity must be non-negative'),
  reason: z.string().min(3, 'Detailed adjustment reason is required'),
  admin_pin: z.string().min(4, 'Admin PIN is required')
});

const transferSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  from_warehouse: z.string().min(1),
  to_warehouse: z.string().min(1),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().optional().nullable()
});

const openingStockSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  warehouse_name: z.string().min(1),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit of measurement is required'),
  unit_cost: z.number().positive('Unit cost must be greater than 0'),
  valuation_basis: z.enum(['cost_price', 'market_value']).default('cost_price'),
  opening_date: z.string().optional(),
  notes: z.string().optional().nullable(),
  is_correction: z.boolean().optional().default(false),
  correction_notes: z.string().optional().nullable(),
  admin_pin: z.string().optional().nullable()
});

const stockReceiptSchema = z.object({
  po_id: z.number().int().positive().optional().nullable(),
  supplier_id: z.number().int().positive().optional().nullable(),
  supplier_name: z.string().optional().nullable(),
  supplier_invoice_no: z.string().optional().nullable(),
  delivery_note_no: z.string().optional().nullable(),
  warehouse_name: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive().optional().nullable(),
    ordered_quantity: z.number().nonnegative().optional().nullable(),
    received_quantity: z.number().positive('Received quantity must be positive'),
    unit: z.string().optional().default('pcs'),
    cost_price: z.number().positive('Cost price must be positive'),
    discrepancy_notes: z.string().optional().nullable()
  })).min(1, 'At least one item required for stock receipt')
});

const customerReturnSchema = z.object({
  sale_id: z.number().int().positive().optional().nullable(),
  receipt_no: z.string().optional().nullable(),
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  warehouse_name: z.string().min(1),
  quantity: z.number().positive('Return quantity must be positive'),
  condition: z.enum(['resellable', 'damaged']).default('resellable'),
  reason: z.string().min(3, 'Detailed return reason is required'),
  refund_amount: z.number().nonnegative().optional().nullable()
});

const supplierReturnSchema = z.object({
  supplier_id: z.number().int().positive().optional().nullable(),
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  warehouse_name: z.string().min(1),
  quantity: z.number().positive('Return quantity must be positive'),
  reason: z.string().min(3, 'Detailed return reason is required'),
  invoice_reference: z.string().optional().nullable()
});

const damageLossSchema = z.object({
  type: z.enum(['DAMAGE', 'LOSS']),
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  warehouse_name: z.string().min(1),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.string().min(3, 'Detailed reason required'),
  admin_pin: z.string().optional().nullable()
});

const reservationSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  warehouse_name: z.string().min(1),
  quantity: z.number().positive('Quantity must be positive'),
  reference_no: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

const createStockCountSchema = z.object({
  warehouse_name: z.string().min(1),
  category: z.string().optional().nullable().default('All'),
  notes: z.string().optional().nullable()
});

const updateCountItemsSchema = z.object({
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive().optional().nullable(),
    counted_quantity: z.number().nonnegative('Counted quantity cannot be negative'),
    discrepancy_reason: z.string().optional().nullable()
  })).min(1, 'At least one item required')
});

const approveStockCountSchema = z.object({
  approval_notes: z.string().optional().nullable(),
  admin_pin: z.string().optional().nullable()
});

module.exports = {
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
};

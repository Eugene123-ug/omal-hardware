const { z } = require('zod');

const saleItemSchema = z.object({
  product_id: z.number().int().positive('Product ID is required'),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unit: z.string().optional().default('pcs'),
  unit_price: z.number().positive().optional(),
  sqm_coverage: z.number().optional().default(0)
});

const salePaymentItemSchema = z.object({
  payment_method: z.enum(['CASH', 'MOMO', 'BANK', 'CARD', 'CREDIT']),
  amount: z.number().positive('Payment amount must be positive'),
  reference_no: z.string().optional().nullable(),
  momo_network: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'Cart cannot be empty'),
  customer_id: z.number().int().positive().optional().nullable(),
  customer_name: z.string().optional().default('Walk-in Customer'),
  customer_phone: z.string().optional().nullable(),
  warehouse_name: z.string().default('Main Showroom'),
  discount_percent: z.number().min(0).max(100).default(0),
  admin_pin: z.string().optional().nullable(),
  payment_method: z.enum(['CASH', 'MOMO', 'BANK', 'CARD', 'CREDIT', 'SPLIT']),
  payments: z.array(salePaymentItemSchema).optional(),
  momo_network: z.string().optional().nullable(),
  momo_reference: z.string().optional().nullable(),
  cash_tendered: z.number().optional().nullable(),
  credit_due_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  offline_client_id: z.string().optional().nullable(),
  idempotency_key: z.string().optional().nullable()
});

const refundItemSchema = z.object({
  sale_item_id: z.number().int().positive('Sale item ID is required'),
  quantity: z.number().positive('Return quantity must be greater than zero'),
  condition: z.enum(['RESELLABLE', 'DAMAGED']).default('RESELLABLE'),
  reason: z.string().optional().nullable()
});

const refundRequestSchema = z.object({
  sale_id: z.number().int().positive('Sale ID is required'),
  items: z.array(refundItemSchema).min(1, 'At least one item must be returned'),
  refund_method: z.enum(['CASH', 'MOMO', 'STORE_CREDIT', 'CREDIT_REVERSAL']).default('CASH'),
  reason: z.string().min(3, 'Detailed return reason is required'),
  warehouse_name: z.string().default('Main Showroom')
});

const refundApproveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  approval_notes: z.string().optional().nullable(),
  admin_pin: z.string().optional().nullable()
});

const paymentVerifySchema = z.object({
  verification_status: z.enum(['VERIFIED', 'REJECTED']),
  notes: z.string().optional().nullable()
});

module.exports = {
  createSaleSchema,
  refundRequestSchema,
  refundApproveSchema,
  paymentVerifySchema
};

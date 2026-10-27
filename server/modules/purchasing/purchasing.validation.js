const { z } = require('zod');

const supplierSchema = z.object({
  name: z.string().min(2, 'Supplier name must be at least 2 characters'),
  phone: z.string().min(5, 'Phone number must be at least 5 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  contact_person: z.string().optional().or(z.literal('')),
  location: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  tax_id: z.string().optional().or(z.literal('')),
  products_supplied: z.array(z.string()).optional().default([]),
  payment_terms: z.enum(['NET_30', 'COD', 'ADVANCE_50_DELIVERY_50', 'NET_15', 'NET_60']).optional().default('COD'),
  status: z.enum(['active', 'inactive', 'blacklisted']).optional().default('active'),
  supporting_documents: z.array(z.any()).optional().default([]),
  bank_details: z.object({
    bank_name: z.string().optional().or(z.literal('')),
    account_number: z.string().optional().or(z.literal('')),
    account_name: z.string().optional().or(z.literal('')),
    branch: z.string().optional().or(z.literal('')),
    momo_number: z.string().optional().or(z.literal(''))
  }).optional().nullable(),
  balance_owed: z.number().optional().default(0)
});

const purchaseOrderItemSchema = z.object({
  product_id: z.number().int().positive('Product ID required'),
  variant_id: z.number().int().positive().optional().nullable(),
  ordered_quantity: z.number().positive().optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().optional().default('pcs'),
  unit_cost: z.number().min(0).optional(),
  cost_price: z.number().min(0).optional(),
  notes: z.string().optional()
}).refine(data => data.ordered_quantity !== undefined || data.quantity !== undefined, {
  message: 'Ordered quantity or quantity required'
});

const purchaseOrderSchema = z.object({
  supplier_id: z.number().int().positive('Supplier selection is required'),
  warehouse_name: z.string().optional().default('Main Showroom'),
  expected_delivery_date: z.string().optional().nullable(),
  supplier_reference: z.string().optional().or(z.literal('')),
  status: z.string().optional(),
  total_amount: z.number().optional(),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(purchaseOrderItemSchema).min(1, 'Purchase order must have at least one line item')
});

const updatePOSchema = z.object({
  supplier_id: z.number().int().positive().optional(),
  warehouse_name: z.string().optional(),
  expected_delivery_date: z.string().optional().nullable(),
  supplier_reference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(purchaseOrderItemSchema).optional()
});

const approvePOSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  approval_notes: z.string().optional().or(z.literal('')),
  admin_pin: z.string().optional()
});

const grnItemSchema = z.object({
  product_id: z.number().int().positive('Product ID required'),
  variant_id: z.number().int().positive().optional().nullable(),
  po_item_id: z.number().int().positive().optional().nullable(),
  ordered_quantity: z.number().min(0).optional().default(0),
  received_quantity: z.number().min(0, 'Received quantity cannot be negative'),
  rejected_quantity: z.number().min(0).optional().default(0),
  damaged_quantity: z.number().min(0).optional().default(0),
  unit: z.string().optional().default('pcs'),
  unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
  discrepancy_reason: z.string().optional().or(z.literal(''))
});

const grnSchema = z.object({
  po_id: z.number().int().positive().optional().nullable(),
  supplier_id: z.number().int().positive().optional().nullable(),
  supplier_invoice_no: z.string().optional().or(z.literal('')),
  delivery_note_no: z.string().optional().or(z.literal('')),
  warehouse_name: z.string().optional().default('Main Showroom'),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(grnItemSchema).min(1, 'GRN must contain at least one line item')
});

const supplierInvoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Supplier invoice number is required'),
  supplier_id: z.number().int().positive('Supplier ID is required'),
  po_id: z.number().int().positive().optional().nullable(),
  grn_id: z.number().int().positive().optional().nullable(),
  invoice_date: z.string().min(8, 'Invoice date is required'),
  due_date: z.string().optional().nullable(),
  subtotal: z.number().min(0, 'Subtotal must be non-negative'),
  tax_amount: z.number().min(0).optional().default(0),
  total_amount: z.number().positive('Total invoice amount must be positive'),
  notes: z.string().optional().or(z.literal('')),
  supporting_documents: z.array(z.any()).optional().default([])
});

const supplierPaymentSchema = z.object({
  supplier_id: z.number().int().positive('Supplier ID is required'),
  invoice_id: z.number().int().positive().optional().nullable(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  payment_method: z.enum(['BANK_TRANSFER', 'CASH', 'MOMO', 'CHEQUE']),
  reference_no: z.string().optional().or(z.literal('')),
  payment_date: z.string().min(8, 'Payment date is required'),
  bank_account_used: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  supporting_documents: z.array(z.any()).optional().default([])
});

module.exports = {
  supplierSchema,
  purchaseOrderItemSchema,
  purchaseOrderSchema,
  updatePOSchema,
  approvePOSchema,
  grnItemSchema,
  grnSchema,
  supplierInvoiceSchema,
  supplierPaymentSchema
};

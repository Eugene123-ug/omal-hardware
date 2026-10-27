const { z } = require('zod');

const customerSchema = z.object({
  name: z.string().min(2, 'Customer name must be at least 2 characters').max(255),
  phone: z.string().min(5, 'Valid phone number is required').max(50),
  email: z.string().email('Invalid email address').optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  address: z.string().optional().nullable(),
  credit_limit: z.number().min(0, 'Credit limit cannot be negative').default(0),
  status: z.enum(['active', 'suspended', 'blacklisted']).default('active'),
  notes: z.string().optional().nullable()
});

const updateCustomerSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().min(5).max(50).optional(),
  email: z.string().email().optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  address: z.string().optional().nullable(),
  credit_limit: z.number().min(0).optional(),
  status: z.enum(['active', 'suspended', 'blacklisted']).optional(),
  notes: z.string().optional().nullable()
});

const customerStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'blacklisted']),
  reason: z.string().min(3, 'Status change reason is required')
});

const customerPaymentSchema = z.object({
  customer_id: z.number().int().positive('Customer ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  payment_method: z.enum(['CASH', 'MOMO', 'BANK', 'CHEQUE', 'CARD']).default('CASH'),
  reference_no: z.string().max(100).optional().nullable(),
  bank_account_used: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  payment_date: z.string().optional()
});

module.exports = {
  customerSchema,
  updateCustomerSchema,
  customerStatusSchema,
  customerPaymentSchema
};

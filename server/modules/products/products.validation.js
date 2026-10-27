const { z } = require('zod');

const VALID_UNITS = [
  'pcs', 'box', 'pallet', 'litre', 'gallon', 'bucket', 
  'bag', 'bundle', 'sqm', 'roll', 'set', 'pair', 'kg', 'meter'
];

const VALID_CATEGORIES = [
  'Tiles', 'Security Doors', 'Sanitary', 'Paints', 'General Hardware'
];

const conversionSchema = z.object({
  pieces_per_box: z.number().int().min(1).optional().nullable(),
  sqm_per_box: z.number().min(0.01).optional().nullable(),
  boxes_per_pallet: z.number().int().min(1).optional().nullable(),
  litres_per_unit: z.number().min(0.1).optional().nullable()
}).optional().nullable();

const variantSchema = z.object({
  id: z.number().int().optional(),
  variant_name: z.string().min(1, 'Variant name is required'),
  sku: z.string().min(2, 'Variant SKU is required'),
  barcode: z.string().optional().nullable(),
  cost_price: z.number().min(0).optional().nullable(),
  selling_price: z.number().min(0).optional().nullable(),
  wholesale_price: z.number().min(0).optional().nullable(),
  min_selling_price: z.number().min(0).optional().nullable(),
  attributes: z.record(z.any()).default({}),
  status: z.enum(['active', 'discontinued']).default('active')
});

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  category: z.string().min(2, 'Category is required'),
  subcategory: z.string().optional().nullable(),
  sku: z.string().min(2, 'SKU is required'),
  barcode: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  size_color: z.string().optional().nullable(),
  unit: z.string().refine(val => VALID_UNITS.includes(val.toLowerCase()), {
    message: `Invalid unit. Supported: ${VALID_UNITS.join(', ')}`
  }).default('pcs'),
  supplier_id: z.number().int().positive().optional().nullable(),
  cost_price: z.number().min(0, 'Cost price must be non-negative'),
  selling_price: z.number().min(0, 'Selling price must be non-negative'),
  wholesale_price: z.number().min(0).optional().nullable(),
  min_selling_price: z.number().min(0).optional().nullable(),
  min_stock_alert: z.number().int().min(0).default(10),
  warehouse_location: z.string().default('Main Showroom'),
  image_url: z.string().optional().nullable(),
  status: z.enum(['active', 'discontinued']).default('active'),
  sqm_per_box: z.number().min(0).default(0),
  pieces_per_box: z.number().int().min(0).default(0),
  attributes: z.record(z.any()).default({}),
  conversions: conversionSchema.default({}),
  variants: z.array(variantSchema).optional().default([])
});

const updatePriceSchema = z.object({
  cost_price: z.number().min(0).optional(),
  selling_price: z.number().min(0).optional(),
  wholesale_price: z.number().min(0).optional().nullable(),
  min_selling_price: z.number().min(0).optional().nullable(),
  reason: z.string().min(2, 'Reason for price modification is required'),
  admin_pin: z.string().optional()
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'discontinued'])
});

const bulkImportSchema = z.object({
  products: z.array(z.record(z.any())).min(1, 'Import must contain at least one product row')
});

module.exports = {
  VALID_UNITS,
  VALID_CATEGORIES,
  variantSchema,
  productSchema,
  updatePriceSchema,
  updateStatusSchema,
  bulkImportSchema
};

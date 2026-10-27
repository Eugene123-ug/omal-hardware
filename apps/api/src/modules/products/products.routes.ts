import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/connection';
import { BadRequestError } from '../../common/errors';
import { authenticate, requirePermission, requireRole } from '../../middleware/auth';

export const productsRouter = Router();

// List products with categories, variants and available stock
productsRouter.get('/', authenticate, requirePermission('products.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const { category, search, warehouseId } = req.query;

    let query = db('products')
      .join('product_categories', 'product_categories.id', 'products.category_id')
      .leftJoin('product_subcategories', 'product_subcategories.id', 'products.subcategory_id')
      .select(
        'products.*',
        'product_categories.name as category_name',
        'product_categories.code as category_code',
        'product_subcategories.name as subcategory_name',
      );

    if (category) {
      query = query.where('product_categories.code', String(category));
    }

    if (search) {
      const term = `%${String(search).toLowerCase()}%`;
      query = query.where((q: any) => {
        q.whereRaw('lower(products.name) like ?', [term])
          .orWhereRaw('lower(products.sku) like ?', [term])
          .orWhereRaw('lower(coalesce(products.brand, \'\')) like ?', [term])
          .orWhereRaw('coalesce(products.barcode, \'\') like ?', [term]);
      });
    }

    const products = await query.orderBy('products.name', 'asc');

    // Fetch all variants
    const productIds = products.map((p: any) => p.id);
    const variants = await db('product_variants')
      .whereIn('product_id', productIds)
      .andWhere('status', 'active');

    // Fetch stock levels
    let stockQuery = db('stock_levels')
      .whereIn('product_id', productIds);
    if (warehouseId) {
      stockQuery = stockQuery.andWhere('warehouse_id', Number(warehouseId));
    }
    const stockLevels = await stockQuery;

    // Attach variants and stocks to products
    const result = products.map((prod: any) => {
      const prodVariants = variants.filter((v: any) => Number(v.product_id) === Number(prod.id));
      const prodStocks = stockLevels.filter((s: any) => Number(s.product_id) === Number(prod.id));

      const totalOnHand = prodStocks.reduce((sum: number, s: any) => sum + Number(s.quantity_on_hand), 0);
      const totalReserved = prodStocks.reduce((sum: number, s: any) => sum + Number(s.quantity_reserved), 0);
      const totalAvailable = Math.max(0, totalOnHand - totalReserved);

      return {
        ...prod,
        cost_price: Number(prod.cost_price),
        selling_price: Number(prod.selling_price),
        wholesale_price: prod.wholesale_price ? Number(prod.wholesale_price) : null,
        min_stock_alert: Number(prod.min_stock_alert),
        totalOnHand,
        totalReserved,
        totalAvailable,
        variants: prodVariants.map((v: any) => ({
          ...v,
          cost_price: v.cost_price ? Number(v.cost_price) : Number(prod.cost_price),
          selling_price: v.selling_price ? Number(v.selling_price) : Number(prod.selling_price),
          wholesale_price: v.wholesale_price ? Number(v.wholesale_price) : null,
          conversion_ratio: Number(v.conversion_ratio),
          attributes: typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes,
        })),
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Categories list
productsRouter.get('/categories', authenticate, requirePermission('products.view'), async (_req, res, next) => {
  try {
    const db = getDb();
    const categories = await db('product_categories').where('is_active', true).orderBy('name', 'asc');
    const subcategories = await db('product_subcategories').where('is_active', true).orderBy('name', 'asc');

    // Get count of products per category
    const productCounts = await db('products')
      .groupBy('category_id')
      .select('category_id')
      .count('id as product_count');

    const countMap = new Map(productCounts.map((pc: any) => [Number(pc.category_id), Number(pc.product_count)]));

    const result = categories.map((cat: any) => ({
      ...cat,
      productCount: countMap.get(Number(cat.id)) || 0,
      subcategories: subcategories.filter((sub: any) => Number(sub.category_id) === Number(cat.id)),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Add Category
const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  code: z.string().min(2).optional(),
  description: z.string().optional(),
});

productsRouter.post('/categories', authenticate, requirePermission('products.create', 'products.view'), async (req, res, next) => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid category payload', parsed.error.issues);
    }
    const { name, code, description } = parsed.data;
    const catCode = code ? code.trim().toUpperCase() : name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 30);
    const db = getDb();

    const existing = await db('product_categories').where('code', catCode).first();
    if (existing) {
      throw new BadRequestError(`Category code '${catCode}' already exists`);
    }

    const [newCat] = await db('product_categories')
      .insert({
        code: catCode,
        name: name.trim(),
        description: description || null,
        is_active: true,
      })
      .returning('*');

    res.status(201).json({ success: true, data: newCat });
  } catch (err) {
    next(err);
  }
});

// Create product
const createProductSchema = z.object({
  sku: z.string().min(2, 'SKU is required'),
  name: z.string().min(2, 'Product name is required'),
  categoryId: z.number().int(),
  subcategoryId: z.number().int().optional(),
  brand: z.string().optional(),
  description: z.string().optional(),
  barcode: z.string().optional(),
  baseUnit: z.string().default('pcs'),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  wholesalePrice: z.number().min(0).optional(),
  minStockAlert: z.number().min(0).default(10),
  storageLocation: z.string().optional(),
  openingStock: z.number().min(0).optional().default(0),
  variants: z
    .array(
      z.object({
        skuVariant: z.string().min(2),
        name: z.string().min(2),
        barcode: z.string().optional(),
        attributes: z.record(z.string(), z.any()).default({}),
        conversionRatio: z.number().default(1.0),
        conversionUnit: z.string().optional(),
        costPrice: z.number().optional(),
        sellingPrice: z.number().optional(),
        wholesalePrice: z.number().optional(),
      }),
    )
    .optional(),
});

productsRouter.post('/', authenticate, requirePermission('products.create'), async (req, res, next) => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid product data', parsed.error.issues);
    }

    const db = getDb();
    const data = parsed.data;

    // Check unique SKU
    const existing = await db('products').whereRaw('lower(sku) = ?', [data.sku.toLowerCase()]).first();
    if (existing) {
      throw new BadRequestError(`Product with SKU '${data.sku}' already exists`);
    }

    const insertedId = await db.transaction(async (trx: any) => {
      const [prod] = await trx('products')
        .insert({
          sku: data.sku,
          name: data.name,
          category_id: data.categoryId,
          subcategory_id: data.subcategoryId || null,
          brand: data.brand || null,
          description: data.description || null,
          barcode: data.barcode || null,
          base_unit: data.baseUnit,
          cost_price: data.costPrice,
          selling_price: data.sellingPrice,
          wholesale_price: data.wholesalePrice || null,
          min_stock_alert: data.minStockAlert,
          storage_location: data.storageLocation || null,
        })
        .returning('id');

      const id = typeof prod === 'object' ? prod.id : prod;

      if (data.variants && data.variants.length > 0) {
        for (const v of data.variants) {
          await trx('product_variants').insert({
            product_id: id,
            sku_variant: v.skuVariant,
            name: v.name,
            barcode: v.barcode || null,
            attributes: JSON.stringify(v.attributes || {}),
            conversion_ratio: v.conversionRatio,
            conversion_unit: v.conversionUnit || null,
            cost_price: v.costPrice || null,
            selling_price: v.sellingPrice || null,
            wholesale_price: v.wholesalePrice || null,
          });
        }
      }

      // Initialize stock_levels across active warehouses
      const warehouses = await trx('warehouses').where('is_active', true).select('id');
      const initialStock = Number(data.openingStock || 0);

      for (let i = 0; i < warehouses.length; i++) {
        const whId = warehouses[i].id;
        const qtyOnHand = i === 0 ? initialStock : 0; // Primary warehouse gets opening stock
        await trx('stock_levels').insert({
          warehouse_id: whId,
          product_id: id,
          variant_id: null,
          quantity_on_hand: qtyOnHand,
          quantity_reserved: 0,
          reorder_threshold: data.minStockAlert,
        });

        if (qtyOnHand > 0) {
          await trx('stock_movements').insert({
            movement_type: 'opening_stock',
            warehouse_id: whId,
            product_id: id,
            variant_id: null,
            quantity: qtyOnHand,
            unit_cost: data.costPrice,
            total_valuation: qtyOnHand * data.costPrice,
            source_transaction_type: 'opening_stock',
            source_transaction_id: `PROD-${id}`,
            operator_id: req.user!.id,
          });
        }
      }

      // Record audit log
      await trx('audit_logs').insert({
        action: 'products.create',
        actor_user_id: req.user!.id,
        actor_label: req.user!.fullName,
        entity_type: 'product',
        entity_id: String(id),
        after_data: JSON.stringify({ sku: data.sku, name: data.name, price: data.sellingPrice }),
        result: 'success',
      });

      return id;
    });

    res.status(201).json({ success: true, data: { id: insertedId } });
  } catch (err) {
    next(err);
  }
});

// Update product
productsRouter.put('/:id', authenticate, requirePermission('products.edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = await db('products').where('id', id).first();
    if (!existing) {
      throw new BadRequestError('Product not found');
    }

    const { name, categoryId, sellingPrice, costPrice, minStockAlert, storageLocation, status } = req.body;
    const updatePayload: Record<string, any> = { updated_at: new Date() };

    if (name) updatePayload.name = name;
    if (categoryId) updatePayload.category_id = categoryId;
    if (sellingPrice !== undefined) updatePayload.selling_price = sellingPrice;
    if (costPrice !== undefined) updatePayload.cost_price = costPrice;
    if (minStockAlert !== undefined) updatePayload.min_stock_alert = minStockAlert;
    if (storageLocation !== undefined) updatePayload.storage_location = storageLocation;
    if (status) updatePayload.status = status;

    await db('products').where('id', id).update(updatePayload);

    await db('audit_logs').insert({
      action: 'products.edit',
      actor_user_id: req.user!.id,
      actor_label: req.user!.fullName,
      entity_type: 'product',
      entity_id: String(id),
      after_data: JSON.stringify(updatePayload),
      result: 'success',
    });

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Delete (or archive) product - Strictly Administrator & IT Manager
productsRouter.delete('/:id', authenticate, requireRole('administrator', 'owner'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const db = getDb();

    // Check if sales exist for this product
    const salesCount = await db('sale_items').where('product_id', id).count('id as count').first();
    const hasSales = Number(salesCount?.count || 0) > 0;

    if (!hasSales) {
      await db('stock_movements').where('product_id', id).delete();
      await db('stock_levels').where('product_id', id).delete();
      await db('product_variants').where('product_id', id).delete();
      await db('products').where('id', id).delete();
    } else {
      await db('products').where('id', id).update({ status: 'discontinued', updated_at: new Date() });
    }

    await db('audit_logs').insert({
      action: hasSales ? 'products.archive' : 'products.delete',
      actor_user_id: req.user!.id,
      actor_label: req.user!.fullName,
      entity_type: 'product',
      entity_id: String(id),
      result: 'success',
      metadata: JSON.stringify({ hasSales }),
    });

    res.json({
      success: true,
      message: hasSales
        ? 'Product has linked historical sales and was marked discontinued.'
        : 'Product completely deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// Update Category
productsRouter.put('/categories/:id', authenticate, requireRole('administrator', 'owner'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, code, description } = req.body;
    const db = getDb();

    await db('product_categories')
      .where('id', id)
      .update({
        name: name ? name.trim() : undefined,
        code: code ? code.trim().toUpperCase() : undefined,
        description: description !== undefined ? description : undefined,
      });

    const updated = await db('product_categories').where('id', id).first();
    res.json({ success: true, data: updated, message: 'Category updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Delete Category
productsRouter.delete('/categories/:id', authenticate, requireRole('administrator', 'owner'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const db = getDb();

    const linkedProducts = await db('products').where('category_id', id).count('id as cnt').first();
    if (Number(linkedProducts?.cnt || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${linkedProducts?.cnt} products are currently assigned to it. Please reassign or delete them first.`,
      });
    }

    await db('product_subcategories').where('category_id', id).delete();
    await db('product_categories').where('id', id).delete();

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Bulk Import Products (Excel / CSV)
productsRouter.post('/bulk-import', authenticate, requireRole('administrator', 'owner'), async (req, res, next) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      throw new BadRequestError('Array of products is required for bulk import');
    }

    const db = getDb();
    let imported = 0;
    const errors: string[] = [];

    await db.transaction(async (trx) => {
      // Pre-fetch all categories into map
      const cats = await trx('product_categories');
      const catMap = new Map(cats.map((c: any) => [c.name.toLowerCase().trim(), c.id]));

      for (let i = 0; i < products.length; i++) {
        const row = products[i];
        const rowNum = i + 1;

        if (!row.sku || !row.name) {
          errors.push(`Row ${rowNum}: SKU and Product Name are required.`);
          continue;
        }

        const sku = String(row.sku).trim().toUpperCase();
        const name = String(row.name).trim();
        const costPrice = Math.max(0, Number(row.costPrice ?? row.cost_price ?? 0));
        const sellingPrice = Math.max(0, Number(row.sellingPrice ?? row.selling_price ?? 0));
        const quantity = Math.max(0, Number(row.quantity ?? row.current_quantity ?? 0));
        const lowStock = Math.max(1, Number(row.lowStockThreshold ?? row.min_stock_alert ?? 10));
        const unit = String(row.unit ?? 'pcs').trim() || 'pcs';
        const barcode = row.barcode ? String(row.barcode).trim() : null;
        const description = row.description ? String(row.description).trim() : null;

        if (costPrice > 0 && sellingPrice > 0 && costPrice > sellingPrice) {
          errors.push(`Row ${rowNum} (${sku}): Cost price (GH₵ ${costPrice}) is higher than selling price (GH₵ ${sellingPrice}).`);
          continue;
        }

        // Find or auto-create category
        let categoryId: number;
        const catName = (row.category || 'General Hardware').trim();
        const catKey = catName.toLowerCase();

        if (catMap.has(catKey)) {
          categoryId = catMap.get(catKey)!;
        } else {
          const catCode = catName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 30);
          const [newCat] = await trx('product_categories')
            .insert({ name: catName, code: catCode, is_active: true })
            .returning('*');
          categoryId = newCat.id;
          catMap.set(catKey, categoryId);
        }

        // Check if product exists by SKU
        const existing = await trx('products').whereRaw('lower(sku) = ?', [sku.toLowerCase()]).first();

        let prodId: number;
        if (existing) {
          await trx('products')
            .where('id', existing.id)
            .update({
              name,
              category_id: categoryId,
              cost_price: costPrice,
              selling_price: sellingPrice,
              quantity,
              min_stock_alert: lowStock,
              base_unit: unit,
              barcode: barcode || existing.barcode,
              description: description || existing.description,
              status: 'active',
              updated_at: new Date(),
            });
          prodId = existing.id;
        } else {
          const [created] = await trx('products')
            .insert({
              sku,
              name,
              category_id: categoryId,
              cost_price: costPrice,
              selling_price: sellingPrice,
              quantity,
              min_stock_alert: lowStock,
              base_unit: unit,
              barcode,
              description,
              status: 'active',
            })
            .returning('*');
          prodId = created.id;
        }

        // Sync stock_levels table
        await trx('stock_levels')
          .insert({
            warehouse_id: 1,
            product_id: prodId,
            quantity_on_hand: quantity,
            quantity_reserved: 0,
            reorder_threshold: lowStock,
            updated_at: new Date(),
          })
          .onConflict(['warehouse_id', 'product_id', 'variant_id'])
          .merge({
            quantity_on_hand: quantity,
            reorder_threshold: lowStock,
            updated_at: new Date(),
          });

        imported++;
      }
    });

    res.json({
      success: true,
      importedCount: imported,
      errorCount: errors.length,
      errors,
      message: `Import completed: ${imported} product(s) successfully processed.${errors.length > 0 ? ` ${errors.length} error(s) encountered.` : ''}`,
    });
  } catch (err) {
    next(err);
  }
});


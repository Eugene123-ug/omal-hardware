const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse, parsePagination } = require('../../common/response');
const { validateBody } = require('../../middleware/validate');
const {
  VALID_UNITS,
  productSchema,
  updatePriceSchema,
  updateStatusSchema,
  variantSchema,
  bulkImportSchema
} = require('./products.validation');
const {
  authenticateToken,
  requireRole,
  requirePermission,
  verifyAdminPin,
  logAudit
} = require('../../middleware/auth');
const { checkUserPermission } = require('../../utils/security');

// Helper to sanitize product for role/permissions
async function sanitizeProduct(product, user) {
  const canViewCost = await checkUserPermission(user, 'products.cost_view');
  const safe = { ...product };

  if (safe.cost_price !== undefined) {
    if (canViewCost) {
      safe.cost_price = parseFloat(safe.cost_price);
    } else {
      delete safe.cost_price;
    }
  }

  if (safe.selling_price !== undefined) safe.selling_price = parseFloat(safe.selling_price);
  if (safe.wholesale_price !== undefined && safe.wholesale_price !== null) safe.wholesale_price = parseFloat(safe.wholesale_price);
  if (safe.min_selling_price !== undefined && safe.min_selling_price !== null) safe.min_selling_price = parseFloat(safe.min_selling_price);
  if (safe.total_stock !== undefined) safe.total_stock = parseFloat(safe.total_stock);

  if (safe.variants && Array.isArray(safe.variants)) {
    safe.variants = safe.variants.map(v => {
      const vCopy = { ...v };
      if (!canViewCost) delete vCopy.cost_price;
      else if (vCopy.cost_price !== null && vCopy.cost_price !== undefined) vCopy.cost_price = parseFloat(vCopy.cost_price);
      if (vCopy.selling_price !== null && vCopy.selling_price !== undefined) vCopy.selling_price = parseFloat(vCopy.selling_price);
      return vCopy;
    });
  }

  return safe;
}

// GET /api/v1/products (List products with rich filters & search - Task 5)
router.get('/', authenticateToken, requirePermission('products.view'), async (req, res, next) => {
  try {
    const {
      category, subcategory, brand, supplier_id, status,
      search, low_stock, min_price, max_price,
      attr_key, attr_val
    } = req.query;
    const { page, limit, offset, sortBy, sortOrder } = parsePagination(req.query);

    let baseQuery = db('products as p')
      .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
      .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
      .groupBy('p.id', 's.name');

    // Filter by Category
    if (category && category !== 'All') {
      baseQuery = baseQuery.where('p.category', category);
    }

    // Filter by Subcategory
    if (subcategory && subcategory !== 'All') {
      baseQuery = baseQuery.where('p.subcategory', subcategory);
    }

    // Filter by Brand
    if (brand && brand !== 'All') {
      baseQuery = baseQuery.where('p.brand', brand);
    }

    // Filter by Supplier
    if (supplier_id) {
      baseQuery = baseQuery.where('p.supplier_id', parseInt(supplier_id));
    }

    // Filter by Status (active / discontinued)
    if (status && status !== 'All') {
      baseQuery = baseQuery.where('p.status', status);
    }

    // Filter by Price Range
    if (min_price) {
      baseQuery = baseQuery.where('p.selling_price', '>=', parseFloat(min_price));
    }
    if (max_price) {
      baseQuery = baseQuery.where('p.selling_price', '<=', parseFloat(max_price));
    }

    // Filter by Hardware JSONB Attribute (Task 2)
    if (attr_key && attr_val) {
      baseQuery = baseQuery.whereRaw("p.attributes->>? = ?", [attr_key, String(attr_val)]);
    }

    // Text Search
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      baseQuery = baseQuery.where((builder) => {
        builder.whereILike('p.name', term)
          .orWhereILike('p.sku', term)
          .orWhereILike('p.barcode', term)
          .orWhereILike('p.brand', term)
          .orWhereILike('p.subcategory', term)
          .orWhereRaw("CAST(p.attributes AS TEXT) ILIKE ?", [term]);
      });
    }

    // Filter Low Stock
    if (low_stock === 'true') {
      baseQuery = baseQuery.havingRaw('COALESCE(SUM(ws.quantity), 0) <= p.min_stock_alert');
    }

    // Get Total Count
    const countQuery = db.from(baseQuery.clone().select('p.id').as('sub')).count('* as total').first();

    const orderColumn = sortBy === 'price' ? 'p.selling_price' : (sortBy === 'id' ? 'p.id' : 'p.name');
    const [countResult, products] = await Promise.all([
      countQuery,
      baseQuery.clone()
        .select(
          'p.*',
          's.name as supplier_name',
          db.raw('COALESCE(SUM(ws.quantity), 0) as total_stock'),
          db.raw("COALESCE(STRING_AGG(ws.warehouse_name || ':' || ws.quantity, ','), '') as warehouse_breakdown")
        )
        .orderBy(orderColumn, sortOrder)
        .limit(limit)
        .offset(offset)
    ]);

    const total = parseInt(countResult?.total || 0);

    // Attach variants and sanitize cost_price
    const productIds = products.map(p => p.id);
    const variants = productIds.length > 0 
      ? await db('product_variants').whereIn('product_id', productIds).where({ status: 'active' })
      : [];

    const variantsByProd = {};
    for (const v of variants) {
      if (!variantsByProd[v.product_id]) variantsByProd[v.product_id] = [];
      variantsByProd[v.product_id].push(v);
    }

    const sanitized = await Promise.all(products.map(async item => {
      const breakdown = {};
      if (item.warehouse_breakdown) {
        item.warehouse_breakdown.split(',').forEach(part => {
          const [wName, qty] = part.split(':');
          if (wName) breakdown[wName] = parseFloat(qty) || 0;
        });
      }
      item.warehouses = breakdown;
      item.variants = variantsByProd[item.id] || [];
      return await sanitizeProduct(item, req.user);
    }));

    return ApiResponse.paginated(res, sanitized, total, page, limit, 'Products retrieved successfully');
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/categories
router.get('/categories', authenticateToken, requirePermission('products.view'), async (req, res, next) => {
  try {
    const categories = await db('products')
      .select('category')
      .count('id as count')
      .groupBy('category')
      .orderBy('count', 'desc');

    return ApiResponse.success(res, categories);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/price-changes/pending (Pending sensitive price changes - Task 4)
router.get('/price-changes/pending', authenticateToken, requirePermission('prices.update'), async (req, res, next) => {
  try {
    const pending = await db('price_change_logs as pcl')
      .leftJoin('products as p', 'pcl.product_id', 'p.id')
      .leftJoin('users as u', 'pcl.changed_by_id', 'u.id')
      .where('pcl.status', 'pending_approval')
      .select(
        'pcl.*',
        'p.sku as product_sku',
        'p.category as product_category',
        'u.name as requested_by_name'
      )
      .orderBy('pcl.id', 'desc');

    return ApiResponse.success(res, pending, 'Pending price changes retrieved');
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/:id (Full Product Details with Variants & Stock - Task 5)
router.get('/:id', authenticateToken, requirePermission('products.view'), async (req, res, next) => {
  try {
    const prodId = parseInt(req.params.id);
    const product = await db('products as p')
      .leftJoin('warehouse_stock as ws', 'p.id', 'ws.product_id')
      .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
      .where('p.id', prodId)
      .groupBy('p.id', 's.name')
      .select('p.*', 's.name as supplier_name', db.raw('COALESCE(SUM(ws.quantity), 0) as total_stock'))
      .first();

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');
    }

    // Fetch warehouse stocks
    const stocks = await db('warehouse_stock').where({ product_id: prodId, variant_id: null });
    product.warehouses = {};
    stocks.forEach(s => { product.warehouses[s.warehouse_name] = parseFloat(s.quantity); });

    // Fetch variants with their stock
    const variants = await db('product_variants').where({ product_id: prodId });
    for (const v of variants) {
      const vStocks = await db('warehouse_stock').where({ variant_id: v.id });
      v.warehouses = {};
      vStocks.forEach(vs => { v.warehouses[vs.warehouse_name] = parseFloat(vs.quantity); });
      v.total_stock = vStocks.reduce((sum, item) => sum + parseFloat(item.quantity), 0);
    }
    product.variants = variants;

    // Fetch recent price change history (last 5)
    const priceHistory = await db('price_change_logs as pcl')
      .leftJoin('users as u', 'pcl.changed_by_id', 'u.id')
      .leftJoin('users as app', 'pcl.approved_by_id', 'app.id')
      .where('pcl.product_id', prodId)
      .select('pcl.*', 'u.name as changed_by_name', 'app.name as approved_by_name')
      .orderBy('pcl.id', 'desc')
      .limit(5);

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
    product.price_history = priceHistory.map(h => {
      const hCopy = { ...h };
      if (!canViewCost) {
        delete hCopy.old_cost_price;
        delete hCopy.new_cost_price;
      }
      return hCopy;
    });

    const sanitized = await sanitizeProduct(product, req.user);
    return ApiResponse.success(res, sanitized);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products (Create Product with Attributes & Variants - Tasks 1, 2, 3)
router.post('/', authenticateToken, requirePermission('products.create'), validateBody(productSchema), async (req, res, next) => {
  try {
    const {
      name, category, subcategory, sku, barcode, brand, description,
      size_color, unit, supplier_id, cost_price, selling_price,
      wholesale_price, min_selling_price, min_stock_alert, warehouse_location,
      image_url, status = 'active', sqm_per_box = 0, pieces_per_box = 0,
      attributes = {}, conversions = {}, variants = []
    } = req.body;

    // Check SKU duplicate
    const existing = await db('products').whereRaw('LOWER(sku) = LOWER(?)', [sku.trim()]).first();
    if (existing) {
      return ApiResponse.error(res, `Product with SKU "${sku}" already exists.`, 409, 'CONFLICT');
    }

    // Verify supplier if provided
    if (supplier_id) {
      const supplier = await db('suppliers').where({ id: supplier_id }).first();
      if (!supplier) {
        return ApiResponse.error(res, `Associated supplier ID ${supplier_id} does not exist.`, 404, 'SUPPLIER_NOT_FOUND');
      }
    }

    let createdProduct;
    await db.transaction(async (trx) => {
      const [newProd] = await trx('products').insert({
        name: name.trim(),
        category,
        subcategory: subcategory || null,
        sku: sku.trim().toUpperCase(),
        barcode: barcode || sku.trim().toUpperCase(),
        brand: brand || 'OMAL',
        description: description || null,
        size_color: size_color || null,
        unit: unit.toLowerCase(),
        supplier_id: supplier_id || null,
        cost_price: parseFloat(cost_price) || 0,
        selling_price: parseFloat(selling_price) || 0,
        wholesale_price: wholesale_price !== undefined && wholesale_price !== null ? parseFloat(wholesale_price) : null,
        min_selling_price: min_selling_price !== undefined && min_selling_price !== null ? parseFloat(min_selling_price) : null,
        min_stock_alert: parseInt(min_stock_alert) || 10,
        warehouse_location: warehouse_location || 'Main Showroom',
        image_url: image_url || null,
        status,
        sqm_per_box: parseFloat(sqm_per_box) || 0,
        pieces_per_box: parseInt(pieces_per_box) || 0,
        attributes: JSON.stringify(attributes || {}),
        conversions: JSON.stringify(conversions || {})
      }).returning('*');

      createdProduct = newProd;

      // Initialize default warehouse stocks for main product
      await trx('warehouse_stock').insert([
        { product_id: createdProduct.id, variant_id: null, warehouse_name: 'Main Showroom', quantity: 0 },
        { product_id: createdProduct.id, variant_id: null, warehouse_name: 'Warehouse B (Depot)', quantity: 0 }
      ]);

      // Handle product variants if supplied (Task 3)
      if (variants && variants.length > 0) {
        const createdVariants = [];
        for (const v of variants) {
          const [newVariant] = await trx('product_variants').insert({
            product_id: createdProduct.id,
            variant_name: v.variant_name.trim(),
            sku: v.sku.trim().toUpperCase(),
            barcode: v.barcode || v.sku.trim().toUpperCase(),
            cost_price: v.cost_price !== undefined && v.cost_price !== null ? parseFloat(v.cost_price) : createdProduct.cost_price,
            selling_price: v.selling_price !== undefined && v.selling_price !== null ? parseFloat(v.selling_price) : createdProduct.selling_price,
            wholesale_price: v.wholesale_price !== undefined && v.wholesale_price !== null ? parseFloat(v.wholesale_price) : createdProduct.wholesale_price,
            min_selling_price: v.min_selling_price !== undefined && v.min_selling_price !== null ? parseFloat(v.min_selling_price) : createdProduct.min_selling_price,
            attributes: JSON.stringify(v.attributes || {}),
            status: v.status || 'active'
          }).returning('*');

          createdVariants.push(newVariant);

          // Initialize stock for variant
          await trx('warehouse_stock').insert([
            { product_id: createdProduct.id, variant_id: newVariant.id, warehouse_name: 'Main Showroom', quantity: 0 },
            { product_id: createdProduct.id, variant_id: newVariant.id, warehouse_name: 'Warehouse B (Depot)', quantity: 0 }
          ]);
        }
        createdProduct.variants = createdVariants;
      }
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PRODUCT_CREATED',
      `Registered product: ${createdProduct.name} (${createdProduct.sku}) in category "${category}"`,
      req.ip
    );

    const sanitized = await sanitizeProduct(createdProduct, req.user);
    return ApiResponse.success(res, sanitized, 'Product registered successfully', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/products/:id (Update product details & price controls - Tasks 1, 4)
router.put('/:id', authenticateToken, requirePermission('products.update'), async (req, res, next) => {
  try {
    const prodId = parseInt(req.params.id);
    const oldProduct = await db('products').where({ id: prodId }).first();

    if (!oldProduct) {
      return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');
    }

    const {
      name, category, subcategory, brand, description, barcode, unit,
      supplier_id, min_stock_alert, warehouse_location, image_url,
      attributes, conversions, status,
      cost_price, selling_price, wholesale_price, min_selling_price,
      reason, admin_pin
    } = req.body;

    const isPriceModification = selling_price !== undefined || cost_price !== undefined || wholesale_price !== undefined || min_selling_price !== undefined;

    // Price change permissions check (Cashiers blocked from changing prices)
    if (isPriceModification) {
      const canUpdatePrice = await checkUserPermission(req.user, 'prices.update');
      if (!canUpdatePrice) {
        return ApiResponse.error(res, 'Permission denied: You are not authorized to modify prices.', 403, 'INSUFFICIENT_PERMISSIONS');
      }
    }

    let isApproved = true;
    let requiresApproval = false;
    let pendingPriceLogId = null;

    // Price change controls & sensitivity rules (Task 4)
    if (selling_price !== undefined && parseFloat(selling_price) !== parseFloat(oldProduct.selling_price)) {
      const newSell = parseFloat(selling_price);
      const oldSell = parseFloat(oldProduct.selling_price);
      const changePct = oldSell > 0 ? ((newSell - oldSell) / oldSell) * 100 : 0;
      const targetCost = cost_price !== undefined ? parseFloat(cost_price) : parseFloat(oldProduct.cost_price);
      const targetMin = min_selling_price !== undefined ? parseFloat(min_selling_price) : (oldProduct.min_selling_price ? parseFloat(oldProduct.min_selling_price) : null);

      // Sensitive change condition: Price drop > 10% OR selling below cost OR selling below min floor price
      const isSensitive = changePct < -10 || newSell < targetCost || (targetMin !== null && newSell < targetMin);

      if (isSensitive) {
        if (req.user.role === 'super_admin') {
          // Super admin immediately approved
          isApproved = true;
        } else {
          // Admin needs Super Admin PIN or triggers pending approval
          let pinValid = false;
          if (admin_pin) {
            const pinCheck = await verifyAdminPin(admin_pin);
            if (pinCheck.valid && pinCheck.user.role === 'super_admin') {
              pinValid = true;
            }
          }

          if (pinValid) {
            isApproved = true;
          } else {
            // Require approval by Super Admin
            isApproved = false;
            requiresApproval = true;
          }
        }
      }

      // Log price change
      const [priceLog] = await db('price_change_logs').insert({
        product_id: prodId,
        product_name: oldProduct.name,
        old_cost_price: oldProduct.cost_price,
        new_cost_price: cost_price !== undefined ? parseFloat(cost_price) : oldProduct.cost_price,
        old_selling_price: oldSell,
        new_selling_price: newSell,
        old_wholesale_price: oldProduct.wholesale_price,
        new_wholesale_price: wholesale_price !== undefined ? parseFloat(wholesale_price) : oldProduct.wholesale_price,
        min_selling_price: targetMin,
        change_percent: parseFloat(changePct.toFixed(2)),
        reason: reason || 'Product catalogue price adjustment',
        changed_by_id: req.user.id,
        approved_by_id: isApproved ? req.user.id : null,
        status: isApproved ? 'approved' : 'pending_approval',
        requires_approval: requiresApproval
      }).returning('id');

      pendingPriceLogId = priceLog.id;

      await logAudit(
        req.user.id,
        req.user.name,
        req.user.role,
        'PRICE_CHANGED',
        `Price adjustment for "${oldProduct.name}": GH₵ ${oldSell} -> GH₵ ${newSell} (${changePct.toFixed(1)}%). Status: ${isApproved ? 'Approved' : 'Pending Super Admin Approval'}`,
        req.ip
      );
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory;
    if (brand !== undefined) updateData.brand = brand;
    if (description !== undefined) updateData.description = description;
    if (barcode !== undefined) updateData.barcode = barcode;
    if (unit !== undefined) updateData.unit = unit.toLowerCase();
    if (supplier_id !== undefined) updateData.supplier_id = supplier_id;
    if (min_stock_alert !== undefined) updateData.min_stock_alert = parseInt(min_stock_alert);
    if (warehouse_location !== undefined) updateData.warehouse_location = warehouse_location;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (status !== undefined) updateData.status = status;
    if (attributes !== undefined) updateData.attributes = JSON.stringify(attributes);
    if (conversions !== undefined) updateData.conversions = JSON.stringify(conversions);

    // Apply price updates if approved
    if (isApproved) {
      if (cost_price !== undefined) updateData.cost_price = parseFloat(cost_price);
      if (selling_price !== undefined) updateData.selling_price = parseFloat(selling_price);
      if (wholesale_price !== undefined) updateData.wholesale_price = wholesale_price !== null ? parseFloat(wholesale_price) : null;
      if (min_selling_price !== undefined) updateData.min_selling_price = min_selling_price !== null ? parseFloat(min_selling_price) : null;
    }

    updateData.updated_at = new Date();

    const [updated] = await db('products').where({ id: prodId }).update(updateData).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PRODUCT_UPDATED',
      `Updated product ID ${prodId} (${updated.name})`,
      req.ip
    );

    const sanitized = await sanitizeProduct(updated, req.user);

    if (requiresApproval) {
      return ApiResponse.success(res, {
        product: sanitized,
        price_change_status: 'pending_approval',
        price_change_id: pendingPriceLogId,
        notice: 'Non-price attributes updated. Selling price reduction requires Super Admin approval before taking effect.'
      }, 'Product updated; sensitive price change submitted for owner approval');
    }

    return ApiResponse.success(res, sanitized, 'Product updated successfully');
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products/price-changes/:id/approve (Super Admin Owner Approval - Task 4)
router.post('/price-changes/:id/approve', authenticateToken, requireRole('super_admin'), async (req, res, next) => {
  try {
    const logId = parseInt(req.params.id);
    const log = await db('price_change_logs').where({ id: logId, status: 'pending_approval' }).first();

    if (!log) {
      return ApiResponse.error(res, 'Pending price change request not found.', 404, 'NOT_FOUND');
    }

    await db.transaction(async (trx) => {
      await trx('products').where({ id: log.product_id }).update({
        selling_price: log.new_selling_price,
        cost_price: log.new_cost_price,
        wholesale_price: log.new_wholesale_price,
        updated_at: new Date()
      });

      await trx('price_change_logs').where({ id: logId }).update({
        status: 'approved',
        approved_by_id: req.user.id
      });
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PRICE_CHANGE_APPROVED',
      `Approved price change for product ID ${log.product_id} (${log.product_name}) to GH₵ ${log.new_selling_price}`,
      req.ip
    );

    return ApiResponse.success(res, null, `Price change approved. Product selling price updated to GH₵ ${log.new_selling_price}.`);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products/price-changes/:id/reject (Super Admin Owner Rejection - Task 4)
router.post('/price-changes/:id/reject', authenticateToken, requireRole('super_admin'), async (req, res, next) => {
  try {
    const logId = parseInt(req.params.id);
    const { rejection_reason } = req.body;

    const log = await db('price_change_logs').where({ id: logId, status: 'pending_approval' }).first();
    if (!log) {
      return ApiResponse.error(res, 'Pending price change request not found.', 404, 'NOT_FOUND');
    }

    await db('price_change_logs').where({ id: logId }).update({
      status: 'rejected',
      approved_by_id: req.user.id,
      rejection_reason: rejection_reason || 'Rejected by Super Admin'
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PRICE_CHANGE_REJECTED',
      `Rejected price change for product ID ${log.product_id}: ${rejection_reason || 'No reason specified'}`,
      req.ip
    );

    return ApiResponse.success(res, null, 'Price change request rejected');
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/products/:id/status (Safe Product Deactivation - Task 5)
router.put('/:id/status', authenticateToken, requirePermission('products.update'), validateBody(updateStatusSchema), async (req, res, next) => {
  try {
    const prodId = parseInt(req.params.id);
    const { status } = req.body;

    const product = await db('products').where({ id: prodId }).first();
    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');
    }

    await db('products').where({ id: prodId }).update({
      status,
      updated_at: new Date()
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PRODUCT_STATUS_CHANGED',
      `Product "${product.name}" (${product.sku}) status set to "${status}"`,
      req.ip
    );

    return ApiResponse.success(res, { id: prodId, status }, `Product status set to ${status}`);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products/:id/variants (Add variant to product - Task 3)
router.post('/:id/variants', authenticateToken, requirePermission('products.create'), validateBody(variantSchema), async (req, res, next) => {
  try {
    const prodId = parseInt(req.params.id);
    const product = await db('products').where({ id: prodId }).first();

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');
    }

    const {
      variant_name, sku, barcode, cost_price, selling_price,
      wholesale_price, min_selling_price, attributes = {}, status = 'active'
    } = req.body;

    // Check SKU duplicate
    const existing = await db('product_variants').whereRaw('LOWER(sku) = LOWER(?)', [sku.trim()]).first();
    if (existing) {
      return ApiResponse.error(res, `Variant with SKU "${sku}" already exists.`, 409, 'CONFLICT');
    }

    let createdVariant;
    await db.transaction(async (trx) => {
      const [newVar] = await trx('product_variants').insert({
        product_id: prodId,
        variant_name: variant_name.trim(),
        sku: sku.trim().toUpperCase(),
        barcode: barcode || sku.trim().toUpperCase(),
        cost_price: cost_price !== undefined && cost_price !== null ? parseFloat(cost_price) : product.cost_price,
        selling_price: selling_price !== undefined && selling_price !== null ? parseFloat(selling_price) : product.selling_price,
        wholesale_price: wholesale_price !== undefined && wholesale_price !== null ? parseFloat(wholesale_price) : product.wholesale_price,
        min_selling_price: min_selling_price !== undefined && min_selling_price !== null ? parseFloat(min_selling_price) : product.min_selling_price,
        attributes: JSON.stringify(attributes || {}),
        status
      }).returning('*');

      createdVariant = newVar;

      // Initialize warehouse stock for variant
      await trx('warehouse_stock').insert([
        { product_id: prodId, variant_id: newVar.id, warehouse_name: 'Main Showroom', quantity: 0 },
        { product_id: prodId, variant_id: newVar.id, warehouse_name: 'Warehouse B (Depot)', quantity: 0 }
      ]);
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'VARIANT_CREATED',
      `Added variant "${variant_name}" (${sku}) to product "${product.name}"`,
      req.ip
    );

    const canViewCost = await checkUserPermission(req.user, 'products.cost_view');
    if (!canViewCost) delete createdVariant.cost_price;

    return ApiResponse.success(res, createdVariant, 'Variant created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products/import (Strict Validated Batch Import - Task 5)
router.post('/import', authenticateToken, requirePermission('products.create'), validateBody(bulkImportSchema), async (req, res, next) => {
  try {
    const { products: rawRows } = req.body;
    const errors = [];
    const seenSkusInFile = new Set();
    const validatedProducts = [];

    // Pre-fetch all existing SKUs to detect collisions
    const existingSkus = new Set(
      (await db('products').select('sku')).map(p => p.sku.toUpperCase())
    );

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 1;

      // 1. Required Name & SKU
      if (!row.name || String(row.name).trim().length < 2) {
        errors.push({ row: rowNum, sku: row.sku || '', field: 'name', message: 'Product name is required (min 2 characters)' });
      }

      if (!row.sku || String(row.sku).trim().length < 2) {
        errors.push({ row: rowNum, sku: '', field: 'sku', message: 'Valid SKU is required' });
      } else {
        const skuUpper = String(row.sku).trim().toUpperCase();
        if (seenSkusInFile.has(skuUpper)) {
          errors.push({ row: rowNum, sku: skuUpper, field: 'sku', message: `Duplicate SKU "${skuUpper}" within import file` });
        } else if (existingSkus.has(skuUpper)) {
          errors.push({ row: rowNum, sku: skuUpper, field: 'sku', message: `SKU "${skuUpper}" already exists in database` });
        }
        seenSkusInFile.add(skuUpper);
      }

      // 2. Unit Validation
      const unit = String(row.unit || 'pcs').trim().toLowerCase();
      if (!VALID_UNITS.includes(unit)) {
        errors.push({ row: rowNum, sku: row.sku, field: 'unit', message: `Invalid unit "${row.unit}". Supported units: ${VALID_UNITS.join(', ')}` });
      }

      // 3. Price Validation
      const costPrice = parseFloat(row.cost_price);
      const sellPrice = parseFloat(row.selling_price);

      if (isNaN(costPrice) || costPrice < 0) {
        errors.push({ row: rowNum, sku: row.sku, field: 'cost_price', message: 'Cost price must be a valid non-negative number' });
      }
      if (isNaN(sellPrice) || sellPrice < 0) {
        errors.push({ row: rowNum, sku: row.sku, field: 'selling_price', message: 'Selling price must be a valid non-negative number' });
      }

      if (errors.length === 0) {
        validatedProducts.push({
          name: String(row.name).trim(),
          category: String(row.category || 'General Hardware').trim(),
          subcategory: row.subcategory ? String(row.subcategory).trim() : null,
          sku: String(row.sku).trim().toUpperCase(),
          barcode: row.barcode ? String(row.barcode).trim() : String(row.sku).trim().toUpperCase(),
          brand: row.brand ? String(row.brand).trim() : 'OMAL',
          description: row.description ? String(row.description).trim() : null,
          unit,
          cost_price: costPrice || 0,
          selling_price: sellPrice || 0,
          wholesale_price: row.wholesale_price ? parseFloat(row.wholesale_price) : null,
          min_selling_price: row.min_selling_price ? parseFloat(row.min_selling_price) : null,
          min_stock_alert: parseInt(row.min_stock_alert) || 10,
          warehouse_location: row.warehouse_location ? String(row.warehouse_location).trim() : 'Main Showroom',
          image_url: row.image_url ? String(row.image_url).trim() : null,
          status: 'active',
          sqm_per_box: parseFloat(row.sqm_per_box) || 0,
          pieces_per_box: parseInt(row.pieces_per_box) || 0,
          attributes: JSON.stringify(row.attributes || {}),
          conversions: JSON.stringify(row.conversions || {})
        });
      }
    }

    // Acceptance Criteria Task 5: If ANY record is invalid, reject entire batch without partial imports
    if (errors.length > 0) {
      return ApiResponse.error(
        res,
        `Import rejected: Found ${errors.length} validation error(s) in import data. No records were imported.`,
        400,
        'IMPORT_VALIDATION_FAILED',
        { errors, total_rows_checked: rawRows.length, rejected_count: errors.length }
      );
    }

    // Transactionally insert all validated records
    await db.transaction(async (trx) => {
      for (const prod of validatedProducts) {
        const [created] = await trx('products').insert(prod).returning('id');

        await trx('warehouse_stock').insert([
          { product_id: created.id, variant_id: null, warehouse_name: 'Main Showroom', quantity: 0 },
          { product_id: created.id, variant_id: null, warehouse_name: 'Warehouse B (Depot)', quantity: 0 }
        ]);
      }
    });

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'PRODUCTS_BULK_IMPORTED',
      `Successfully validated and imported ${validatedProducts.length} products with zero errors`,
      req.ip
    );

    return ApiResponse.success(res, {
      imported_count: validatedProducts.length,
      status: 'complete'
    }, `Successfully imported ${validatedProducts.length} products.`, 201);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/products/:id (Super Admin Only with Financial Integrity Check)
router.delete('/:id', authenticateToken, requirePermission('products.delete'), async (req, res, next) => {
  try {
    const prodId = parseInt(req.params.id);
    const prod = await db('products').where({ id: prodId }).first();

    if (!prod) {
      return ApiResponse.error(res, 'Product not found', 404, 'NOT_FOUND');
    }

    // Financial integrity check: Do not delete products that have existing sales records!
    const saleItem = await db('sale_items').where({ product_id: prodId }).first();
    if (saleItem) {
      return ApiResponse.error(
        res,
        'Cannot permanently delete product with existing sales history. Deactivate or set status to discontinued instead to preserve financial records.',
        400,
        'INTEGRITY_VIOLATION'
      );
    }

    await db('products').where({ id: prodId }).del();
    await logAudit(req.user.id, req.user.name, req.user.role, 'PRODUCT_DELETED', `Deleted product ${prod.name} (${prod.sku})`);

    return ApiResponse.success(res, null, 'Product permanently deleted');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

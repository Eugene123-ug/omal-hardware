import Dexie from 'dexie';

// Initialize offline IndexedDB database
export const offlineDb = new Dexie('OmalPosOfflineDB');

offlineDb.version(1).stores({
  products: 'id, sku, barcode, name, category',
  customers: 'id, name, phone',
  pending_sales: 'offline_client_id, timestamp, status'
});

// Cache products into IndexedDB for offline selling
export async function cacheProductsLocally(products) {
  try {
    await offlineDb.products.clear();
    await offlineDb.products.bulkPut(products);
    console.log(`[OfflineDB] Cached ${products.length} products locally`);
  } catch (err) {
    console.warn('[OfflineDB] Failed to cache products:', err);
  }
}

// Cache customers locally
export async function cacheCustomersLocally(customers) {
  try {
    await offlineDb.customers.clear();
    await offlineDb.customers.bulkPut(customers);
  } catch (err) {
    console.warn('[OfflineDB] Failed to cache customers:', err);
  }
}

// Save sale locally when offline
export async function saveOfflineSale(saleData) {
  const offlineId = `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const record = {
    ...saleData,
    offline_client_id: offlineId,
    timestamp: new Date().toISOString(),
    status: 'pending_sync'
  };

  await offlineDb.pending_sales.put(record);

  // Decrement locally cached stock
  for (const item of saleData.items) {
    const cached = await offlineDb.products.get(item.product_id);
    if (cached) {
      cached.total_stock = Math.max(0, (cached.total_stock || 0) - item.quantity);
      await offlineDb.products.put(cached);
    }
  }

  return record;
}

// Get pending offline sales count
export async function getPendingOfflineSalesCount() {
  return await offlineDb.pending_sales.where('status').equals('pending_sync').count();
}

// Get all pending offline sales
export async function getPendingOfflineSales() {
  return await offlineDb.pending_sales.where('status').equals('pending_sync').toArray();
}

// Mark offline sales as synced
export async function markOfflineSalesSynced(offlineIds) {
  for (const id of offlineIds) {
    await offlineDb.pending_sales.delete(id);
  }
}

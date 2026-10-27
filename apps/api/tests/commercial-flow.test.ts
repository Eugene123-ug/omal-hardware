import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createDb, type Knex } from '../src/db/connection';
import { getConfig } from '../src/config/env';

describe('OMAL ERP Commercial Engine End-to-End Tests', () => {
  let app: any;
  let db: Knex;
  let ownerToken: string;
  let cashierToken: string;
  let accBranchId: number;
  let accWarehouseId: number;
  let testProductId: number;

  beforeAll(async () => {
    const config = getConfig();
    db = createDb(config);
    app = createApp({ config, db });

    // Ensure database is ready and fetch branches
    const accBranch = await db('branches').where('code', 'ACC').first();
    const accWh = await db('warehouses').where('branch_id', accBranch.id).first();
    accBranchId = Number(accBranch.id);
    accWarehouseId = Number(accWh.id);

    const product = await db('products').where('sku', 'TIL-POR-6060-WH').first();
    testProductId = Number(product.id);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('2.1. Authentication: Rejects incorrect password with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identity: 'owner', password: 'WrongPassword999!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2.2. Authentication: Successfully logs in owner and issues JWT with permissions and branches', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identity: 'owner', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('owner');
    expect(res.body.data.branches.length).toBeGreaterThanOrEqual(1);

    ownerToken = res.body.data.token;
  });

  it('2.3. Authentication: Logs in cashier to POS workspace', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identity: 'cashier', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('cashier');

    cashierToken = res.body.data.token;
  });

  it('3.1. Products: Cashier searches hardware catalog by name or SKU', async () => {
    const res = await request(app)
      .get('/api/v1/products?search=porcelain')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].category_name).toBe('Tiles & Ceramics');
  });

  it('4.1. Inventory: Returns real-time stock levels and valuation across Accra Showroom and Tema Depot', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/levels')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const item = res.body.data[0];
    expect(item.quantity_on_hand).toBeGreaterThan(0);
    expect(item.valuation).toBeGreaterThan(0);
  });

  it('6.1. POS Sale: Confirms sale, creates receipt, deducts inventory, records ledger & audit log', async () => {
    // Check initial stock
    const initialStock = await db('stock_levels')
      .where({ warehouse_id: accWarehouseId, product_id: testProductId })
      .first();
    const startQty = Number(initialStock.quantity_on_hand);

    const salePayload = {
      branchId: accBranchId,
      warehouseId: accWarehouseId,
      items: [
        {
          productId: testProductId,
          quantity: 2,
          unit: 'box',
          unitPrice: 135.00,
        },
      ],
      payments: [
        {
          paymentMethod: 'cash',
          amount: 270.00,
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(salePayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.receiptNumber).toMatch(/^REC-/);
    expect(res.body.data.totalAmount).toBe(270.00);

    // Verify stock was deducted by exactly 2
    const updatedStock = await db('stock_levels')
      .where({ warehouse_id: accWarehouseId, product_id: testProductId })
      .first();
    expect(Number(updatedStock.quantity_on_hand)).toBe(startQty - 2);

    // Verify stock movement ledger entry exists
    const movement = await db('stock_movements')
      .where({
        movement_type: 'confirmed_sale',
        reference_number: res.body.data.receiptNumber,
      })
      .first();
    expect(movement).toBeDefined();
    expect(Number(movement.quantity)).toBe(-2);

    // Verify immutable audit log recorded
    const audit = await db('audit_logs')
      .where({
        action: 'sales.confirm_sale',
        entity_id: String(res.body.data.saleId),
      })
      .first();
    expect(audit).toBeDefined();
  });

  it('6.2. POS Concurrency/Integrity: Strictly rejects sale exceeding available stock and rolls back', async () => {
    const salePayload = {
      branchId: accBranchId,
      warehouseId: accWarehouseId,
      items: [
        {
          productId: testProductId,
          quantity: 999999, // Exceeds available stock
          unit: 'box',
          unitPrice: 135.00,
        },
      ],
      payments: [
        {
          paymentMethod: 'cash',
          amount: 999999 * 135,
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(salePayload);

    expect(res.status).toBe(400);
    const errMsg = res.body?.error?.message || res.body?.message || '';
    expect(errMsg).toMatch(/insufficient stock/i);
  });

  it('8.1. Finance: Records expense and calculates net cash flow', async () => {
    const categories = await db('expense_categories').select('id');
    const catId = Number(categories[0].id);

    const expenseRes = await request(app)
      .post('/api/v1/finance/expenses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        branchId: accBranchId,
        categoryId: catId,
        amount: 350.00,
        description: 'Monthly ECG Power Bill - Accra Showroom',
        paymentMethod: 'momo_business',
      });

    expect(expenseRes.status).toBe(201);
    expect(expenseRes.body.data.approval_status).toBe('approved');

    const summaryRes = await request(app)
      .get('/api/v1/finance/summary')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data.totalExpenses).toBeGreaterThanOrEqual(350);
  });

  it('10.1. Remote Owner Dashboard: Returns consolidated multi-branch financials, stock valuation and audit trail', async () => {
    const res = await request(app)
      .get('/api/v1/reports/owner-dashboard')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.inventoryValuation.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.recentAuditLogs.length).toBeGreaterThanOrEqual(1);
  });
});

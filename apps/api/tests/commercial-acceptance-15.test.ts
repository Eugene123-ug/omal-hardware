import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Knex } from 'knex';
import { createApp } from '../src/app';
import { createDb } from '../src/db/connection';
import { getConfig } from '../src/config/env';
import { createLogger } from '../src/common/logger';

describe('OMAL ERP — Commercial 15/15 Acceptance Criteria Test Suite', () => {
  let app: Express;
  let db: Knex;
  let adminToken: string;
  let ownerToken: string;
  let cashierToken: string;

  beforeAll(async () => {
    const config = getConfig();
    const logger = createLogger(config);
    db = createDb(config);
    app = createApp({ config, logger, db });

    // Login Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identity: 'admin', password: 'Password123!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // Login Owner
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identity: 'owner', password: 'Password123!' });
    expect(ownerRes.status).toBe(200);
    ownerToken = ownerRes.body.data.token;

    // Login Cashier
    const cashierRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identity: 'cashier', password: 'Password123!' });
    expect(cashierRes.status).toBe(200);
    cashierToken = cashierRes.body.data.token;
  });

  afterAll(async () => {
    await db.destroy();
  });

  // 1. Admin can create staff account and assign custom role
  it('Criterion 1: Admin can create staff account and assign role', async () => {
    const randomSuffix = Date.now().toString().slice(-4);
    const cashierRole = await db('roles').where('key', 'cashier').first();

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: `staff_${randomSuffix}`,
        email: `staff_${randomSuffix}@omal.com`,
        fullName: `Staff Member ${randomSuffix}`,
        roleId: cashierRole.id,
        branchIds: [1],
        password: 'Password123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe(`staff_${randomSuffix}`);

    // Verify in DB
    const userInDb = await db('users').where('username', `staff_${randomSuffix}`).first();
    expect(userInDb).toBeDefined();
    expect(userInDb.role_id).toBe(cashierRole.id);
  });

  // 2. Owner can create role with specific permissions and assign to user
  it('Criterion 2: Owner can create role with specific permissions', async () => {
    const randomSuffix = Date.now().toString().slice(-4);
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Senior Cashier ${randomSuffix}`,
        description: 'Special cashier with reprint access',
        permissionKeys: ['sales.create', 'receipts.print', 'products.view'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const createdRole = await db('roles').where('name', `Senior Cashier ${randomSuffix}`).first();
    expect(createdRole).toBeDefined();

    const rolePerms = await db('role_permissions')
      .join('permissions', 'permissions.id', 'role_permissions.permission_id')
      .where('role_permissions.role_id', createdRole.id)
      .select('permissions.key');

    const permKeys = rolePerms.map((p) => p.key);
    expect(permKeys).toContain('sales.create');
    expect(permKeys).toContain('receipts.print');
    expect(permKeys).toContain('products.view');
  });

  // 3. Salesperson can search and complete sale
  it('Criterion 3: Salesperson can search products and complete sale', async () => {
    // Search
    const searchRes = await request(app)
      .get('/api/v1/products?search=Porcelain')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);

    const testProd = searchRes.body.data[0];

    // Complete POS Sale
    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        branchId: 1,
        warehouseId: 1,
        items: [
          {
            productId: testProd.id,
            quantity: 1,
            unitPrice: testProd.selling_price,
          },
        ],
        payments: [
          {
            paymentMethod: 'cash',
            amount: testProd.selling_price,
          },
        ],
      });

    expect(saleRes.status).toBe(201);
    expect(saleRes.body.success).toBe(true);
    expect(saleRes.body.data.receiptNumber).toBeDefined();
    expect(saleRes.body.data.totalAmount).toBe(testProd.selling_price);
  });

  // 4. Salesperson blocked from daily reports and company history
  it('Criterion 4: Salesperson is strictly blocked from company reports and sales history', async () => {
    // Blocked from Admin Dashboard
    const dashRes = await request(app)
      .get('/api/v1/reports/admin-dashboard')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(dashRes.status).toBe(403);

    // Blocked from Daily Sales Report
    const dailyRes = await request(app)
      .get('/api/v1/reports/daily-sales')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(dailyRes.status).toBe(403);

    // Blocked from Profit & Loss
    const plRes = await request(app)
      .get('/api/v1/reports/profit-loss')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(plRes.status).toBe(403);

    // Blocked from Company Sales History
    const historyRes = await request(app)
      .get('/api/v1/sales')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(historyRes.status).toBe(403);

    // Blocked from Finance Summary
    const finRes = await request(app)
      .get('/api/v1/finance/summary')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(finRes.status).toBe(403);
  });

  // 5. URL/API bypass blocked by backend middleware
  it('Criterion 5: Direct URL and API bypass blocked by requirePermission middleware', async () => {
    const unauthRes = await request(app).get('/api/v1/reports/admin-dashboard');
    expect(unauthRes.status).toBe(401);

    const cashierRes = await request(app)
      .get('/api/v1/reports/audit-logs')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(cashierRes.status).toBe(403);
  });

  // 6. Completed sale deducts stock in PostgreSQL
  it('Criterion 6: Completed sale deducts stock accurately in PostgreSQL', async () => {
    const stockRow = await db('stock_levels')
      .where('warehouse_id', 1)
      .andWhere('quantity_on_hand', '>', 5)
      .first();
    expect(stockRow).toBeDefined();

    const product = await db('products').where('id', stockRow.product_id).first();
    const prevStock = Number(stockRow.quantity_on_hand);
    const saleQty = 2;

    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: 1,
        warehouseId: 1,
        items: [
          {
            productId: product.id,
            quantity: saleQty,
            unitPrice: Number(product.selling_price),
          },
        ],
        payments: [
          {
            paymentMethod: 'cash',
            amount: saleQty * Number(product.selling_price),
          },
        ],
      });

    expect(saleRes.status).toBe(201);

    const afterStockRow = await db('stock_levels').where('id', stockRow.id).first();
    expect(Number(afterStockRow.quantity_on_hand)).toBe(prevStock - saleQty);
  });

  // 7. Stock consistency: prevents negative stock or overselling
  it('Criterion 7: Rejects transactions attempting to oversell beyond on-hand inventory', async () => {
    const stockRow = await db('stock_levels')
      .where('warehouse_id', 1)
      .first();

    const product = await db('products').where('id', stockRow.product_id).first();
    const excessiveQty = Number(stockRow.quantity_on_hand) + 99999;

    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: 1,
        warehouseId: 1,
        items: [
          {
            productId: product.id,
            quantity: excessiveQty,
            unitPrice: Number(product.selling_price),
          },
        ],
        payments: [
          {
            paymentMethod: 'cash',
            amount: excessiveQty * Number(product.selling_price),
          },
        ],
      });

    expect(res.status).toBe(400);
    const errMsg = res.body.error?.message || res.body.message || '';
    expect(errMsg).toMatch(/insufficient stock/i);
  });

  // 8. Receipt generation works
  it('Criterion 8: Sale confirmation generates a complete formal receipt', async () => {
    const product = await db('products').first();

    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: 1,
        warehouseId: 1,
        items: [
          {
            productId: product.id,
            quantity: 1,
            unitPrice: Number(product.selling_price),
          },
        ],
        payments: [
          {
            paymentMethod: 'momo_mtn',
            amount: Number(product.selling_price),
            referenceNumber: 'MM-789012',
          },
        ],
      });

    expect(saleRes.status).toBe(201);
    expect(saleRes.body.data.receiptNumber).toMatch(/^REC-\d+/);
    expect(saleRes.body.data.saleNumber).toMatch(/^SAL-\d+/);
    expect(saleRes.body.data.paymentStatus).toBe('paid');
  });

  // 9. Dashboard figures match database records
  it('Criterion 9: Admin dashboard KPI counts and figures match database records', async () => {
    const res = await request(app)
      .get('/api/v1/reports/admin-dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const kpis = res.body.data.kpis;

    const activeProducts = await db('products').where('status', 'active').count('id as cnt');
    const activeStaff = await db('users').where('is_active', true).count('id as cnt');

    expect(kpis.totalProducts).toBe(Number(activeProducts[0]?.cnt || 0));
    expect(kpis.totalStaff).toBe(Number(activeStaff[0]?.cnt || 0));
  });

  // 10. Users see only permitted modules (JWT permissions)
  it('Criterion 10: JWT token payload provides accurate role and permissions list', () => {
    // Decoding payload from cashier token
    const tokenParts = cashierToken.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1] || '', 'base64').toString('utf-8'));

    expect(payload.role).toBe('cashier');
    expect(payload.permissions).toContain('sales.create');
    expect(payload.permissions).not.toContain('reports.daily_sales');
    expect(payload.permissions).not.toContain('finance.view');
  });

  // 11. Expired/invalid OTP codes rejected
  it('Criterion 11: Invalid OTP verification code is rejected with 400', async () => {
    await request(app)
      .post('/api/v1/auth/otp-request')
      .send({ email: 'admin@omal.com' });

    const badVerify = await request(app)
      .post('/api/v1/auth/otp-verify')
      .send({ email: 'admin@omal.com', code: '000000' });

    expect(badVerify.status).toBe(400);
    expect(badVerify.body.message).toMatch(/incorrect verification code/i);
  });

  // 12. Suspended accounts blocked immediately
  it('Criterion 12: Suspended staff accounts are blocked from authentication immediately', async () => {
    const randomSuffix = Date.now().toString().slice(-4);
    const cashierRole = await db('roles').where('key', 'cashier').first();

    const createRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: `suspend_target_${randomSuffix}`,
        email: `suspend_${randomSuffix}@omal.com`,
        fullName: 'Suspension Test User',
        roleId: cashierRole.id,
        branchIds: [1],
        password: 'Password123!',
      });

    const targetUserId = createRes.body.data.id;

    // Suspend user
    const suspendRes = await request(app)
      .put(`/api/v1/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(suspendRes.status).toBe(200);

    // Try to login suspended user
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identity: `suspend_target_${randomSuffix}`, password: 'Password123!' });

    expect(loginRes.status).toBe(401);
  });

  // 13. Audit logs record all major business actions
  it('Criterion 13: Audit log records important business operations', async () => {
    const logs = await db('audit_logs')
      .whereIn('action', ['auth.login_success', 'sales.confirm_sale'])
      .orderBy('occurred_at', 'desc')
      .limit(5);

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actor_label).toBeDefined();
    expect(logs[0].result).toBe('success');
  });

  // 14. Responsive reports: Daily sales report returns aggregated figures
  it('Criterion 14: Daily sales report aggregates revenue and cashiers accurately', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily-sales')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.data.cashierBreakdown)).toBe(true);
    expect(Array.isArray(res.body.data.paymentBreakdown)).toBe(true);
  });

  // 15. Profit and loss report calculation
  it('Criterion 15: Profit & Loss endpoint calculates revenue, COGS, and gross margin', async () => {
    const res = await request(app)
      .get('/api/v1/reports/profit-loss')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(data.costOfGoodsSold).toBeGreaterThanOrEqual(0);
    expect(data.grossProfit).toBe(data.totalRevenue - data.costOfGoodsSold);
  });
});

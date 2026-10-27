import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createDb, type Knex } from '../src/db/connection';
import { getConfig } from '../src/config/env';

describe('Granular Roles, Permissions, OTP & Admin Dashboard API Tests', () => {
  let app: any;
  let db: Knex;
  let adminToken: string;

  beforeAll(async () => {
    const config = getConfig();
    db = createDb(config);
    app = createApp({ config, db });

    // Login as admin
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identity: 'admin', password: 'Password123!' });

    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('1. OTP Request: Dispatches verification code for valid user email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp-request')
      .send({ email: 'admin@omal.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('verification code has been dispatched');
    expect(res.body.devCode).toBeDefined();

    // Verify code exists in DB
    const otpRecord = await db('otp_verifications')
      .where('email', 'admin@omal.com')
      .andWhere('is_used', false)
      .first();
    expect(otpRecord).toBeDefined();

    // 2. OTP Verify: Logs in user with OTP and returns token & permissions
    const verifyRes = await request(app)
      .post('/api/v1/auth/otp-verify')
      .send({ email: 'admin@omal.com', code: res.body.devCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.token).toBeDefined();
    expect(verifyRes.body.data.user.email).toBe('admin@omal.com');
  });

  it('2. Granular Permissions: GET /api/v1/roles/permissions returns all permissions grouped by module', async () => {
    const res = await request(app)
      .get('/api/v1/roles/permissions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products).toBeDefined();
    expect(res.body.data.sales).toBeDefined();
    expect(res.body.data.inventory).toBeDefined();
    expect(res.body.flat.length).toBeGreaterThanOrEqual(30);
  });

  it('3. Custom Roles: Owner/Admin creates custom role with specific permissions', async () => {
    const roleKey = `test_role_${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Custom Supervisor ${Date.now()}`,
        description: 'Store supervisor role with void and report permissions',
        permissionKeys: ['dashboard.view', 'sales.view_all', 'sales.void', 'reports.daily_sales'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it('4. Staff Management: GET /api/v1/users lists all staff accounts', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(8);
  });

  it('5. Admin Dashboard: GET /api/v1/reports/admin-dashboard returns full commercial dashboard data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/admin-dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    if (res.status !== 200) {
      console.error('ADMIN DASHBOARD ERROR:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // Verify 4 top KPI cards
    expect(data.kpis.totalProducts).toBeGreaterThanOrEqual(240);
    expect(data.kpis.totalStaff).toBeGreaterThanOrEqual(8);
    expect(data.kpis.totalSalesToday).toBeGreaterThan(0);
    expect(data.kpis.totalPurchases).toBeGreaterThan(0);

    // Verify charts
    expect(data.salesOverview.chartData.length).toBeGreaterThanOrEqual(5);
    expect(data.salesByCategory.length).toBeGreaterThanOrEqual(4);

    // Verify operational tables
    expect(data.topSellingProducts.length).toBeGreaterThanOrEqual(4);
    expect(data.stockAlerts.length).toBeGreaterThanOrEqual(3);
    expect(data.recentPurchases.length).toBeGreaterThanOrEqual(3);
    expect(data.recentActivities.length).toBeGreaterThanOrEqual(4);

    // Verify system info
    expect(data.systemInfo.databaseStatus).toBe('Connected');
    expect(data.systemInfo.softwareVersion).toBe('v1.0.0');
  });
});

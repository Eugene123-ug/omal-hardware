const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL
  ? `${(import.meta as any).env.VITE_API_BASE_URL}/api/v1`
  : '/api/v1';

export function getAuthToken(): string | null {
  return localStorage.getItem('omal_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('omal_token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('omal_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (err?.name === 'TypeError' || err?.message?.includes('fetch')) {
      throw new Error('Unable to connect to OMAL API server. Please check your network or ensure backend is running.');
    }
    throw err;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || 'Server request failed';
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  login: (identity: string, password: string) =>
    request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identity, password }),
    }),
  forgotPassword: (email: string) =>
    request<any>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (data: { token: string; email: string; password: string }) =>
    request<any>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  requestOtp: (email: string) =>
    request<any>('/auth/otp-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyOtp: (email: string, code: string) =>
    request<any>('/auth/otp-verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  getMe: () => request<any>('/auth/me'),

  // Products
  getProducts: (params?: { category?: string; search?: string; warehouseId?: number }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.warehouseId) query.set('warehouseId', String(params.warehouseId));
    return request<any>(`/products?${query.toString()}`);
  },
  getCategories: () => request<any>('/products/categories'),
  createCategory: (data: { name: string; code?: string; description?: string }) =>
    request<any>('/products/categories', { method: 'POST', body: JSON.stringify(data) }),
  createProduct: (data: any) =>
    request<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
  deleteProduct: (id: number) =>
    request<any>(`/products/${id}`, { method: 'DELETE' }),

  // Inventory
  getStockLevels: (params?: { warehouseId?: number; branchId?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.warehouseId) query.set('warehouseId', String(params.warehouseId));
    if (params?.branchId) query.set('branchId', String(params.branchId));
    if (params?.search) query.set('search', params.search);
    return request<any>(`/inventory/levels?${query.toString()}`);
  },
  getStockMovements: (params?: { warehouseId?: number; movementType?: string }) => {
    const query = new URLSearchParams();
    if (params?.warehouseId) query.set('warehouseId', String(params.warehouseId));
    if (params?.movementType) query.set('movementType', params.movementType);
    return request<any>(`/inventory/movements?${query.toString()}`);
  },
  adjustStock: (data: any) =>
    request<any>('/inventory/adjust', { method: 'POST', body: JSON.stringify(data) }),

  // Sales & POS
  confirmSale: (data: any) =>
    request<any>('/sales', { method: 'POST', body: JSON.stringify(data) }),
  deleteSale: (id: number) =>
    request<any>(`/sales/${id}`, { method: 'DELETE' }),
  getSales: (params?: { branchId?: number; date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branchId) query.set('branchId', String(params.branchId));
    if (params?.date) query.set('date', params.date);
    return request<any>(`/sales?${query.toString()}`);
  },
  getCurrentShift: () => request<any>('/sales/shifts/current'),
  openShift: (data: { branchId: number; warehouseId: number; openingFloat: number }) =>
    request<any>('/sales/shifts/open', { method: 'POST', body: JSON.stringify(data) }),
  closeShift: (data: { shiftId: number; closingCashDeclared: number; notes?: string }) =>
    request<any>('/sales/shifts/close', { method: 'POST', body: JSON.stringify(data) }),

  // Purchasing & Suppliers
  getSuppliers: () => request<any>('/purchasing/suppliers'),
  getPurchaseOrders: (params?: { status?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    return request<any>(`/purchasing/orders?${query.toString()}`);
  },
  createPurchaseOrder: (data: any) =>
    request<any>('/purchasing/orders', { method: 'POST', body: JSON.stringify(data) }),
  receiveGrn: (data: any) =>
    request<any>('/purchasing/grn', { method: 'POST', body: JSON.stringify(data) }),

  // Inter-branch transfers
  getTransfers: () => request<any>('/transfers'),
  requestTransfer: (data: any) =>
    request<any>('/transfers/request', { method: 'POST', body: JSON.stringify(data) }),
  dispatchTransfer: (id: number) =>
    request<any>(`/transfers/${id}/dispatch`, { method: 'POST' }),
  receiveTransfer: (id: number) =>
    request<any>(`/transfers/${id}/receive`, { method: 'POST' }),

  // Finance & Expenses
  getFinanceSummary: (params?: { branchId?: number }) => {
    const query = new URLSearchParams();
    if (params?.branchId) query.set('branchId', String(params.branchId));
    return request<any>(`/finance/summary?${query.toString()}`);
  },
  getExpenses: (params?: { branchId?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.branchId) query.set('branchId', String(params.branchId));
    if (params?.status) query.set('status', params.status);
    return request<any>(`/finance/expenses?${query.toString()}`);
  },
  getExpenseCategories: () => request<any>('/finance/categories'),
  createExpenseCategory: (data: { name: string; code?: string; description?: string }) =>
    request<any>('/finance/categories', { method: 'POST', body: JSON.stringify(data) }),
  recordExpense: (data: any) =>
    request<any>('/finance/expenses', { method: 'POST', body: JSON.stringify(data) }),
  approveExpense: (id: number, data: { status: 'approved' | 'rejected'; notes?: string }) =>
    request<any>(`/finance/expenses/${id}/approve`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: number) =>
    request<any>(`/finance/expenses/${id}`, { method: 'DELETE' }),

  // Customers & Debt
  getCustomers: (params?: { search?: string; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    return request<any>(`/customers?${query.toString()}`);
  },
  createCustomer: (data: any) =>
    request<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  recordDebtPayment: (customerId: number, data: any) =>
    request<any>(`/customers/${customerId}/payment`, { method: 'POST', body: JSON.stringify(data) }),

  // Roles & Custom Permissions
  getRoles: () => request<any>('/roles'),
  getPermissions: () => request<any>('/roles/permissions'),
  createRole: (data: any) =>
    request<any>('/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: number, data: any) =>
    request<any>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id: number) =>
    request<any>(`/roles/${id}`, { method: 'DELETE' }),

  // Users & Staff
  getStaff: () => request<any>('/users'),
  createStaff: (data: any) =>
    request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateStaffStatus: (id: number, isActive: boolean) =>
    request<any>(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ isActive }) }),
  updateStaff: (id: number, data: any) =>
    request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Reports & Dashboards
  getAdminDashboard: () => request<any>('/reports/admin-dashboard'),
  getOwnerDashboard: () => request<any>('/reports/owner-dashboard'),
  getAuditLogs: (params?: { action?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.limit) query.set('limit', String(params.limit));
    return request<any>(`/reports/audit-logs?${query.toString()}`);
  },
  getBranches: () => request<any>('/reports/branches'),
  createBranch: (data: { name: string; code?: string; address?: string; phone?: string }) =>
    request<any>('/reports/branches', { method: 'POST', body: JSON.stringify(data) }),
  getDailySales: (params?: { date?: string; branchId?: number }) => {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.branchId) query.set('branchId', String(params.branchId));
    return request<any>(`/reports/daily-sales?${query.toString()}`);
  },
  getProfitLoss: (params?: { startDate?: string; endDate?: string; branchId?: number }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.branchId) query.set('branchId', String(params.branchId));
    return request<any>(`/reports/profit-loss?${query.toString()}`);
  },
};

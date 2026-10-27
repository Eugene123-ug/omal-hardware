export type UserRole = 'owner' | 'administrator' | 'cashier' | 'accountant' | 'branch_manager';

export interface Branch {
  id: string;
  code: string;
  name: string;
  type: 'showroom' | 'depot' | 'warehouse';
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  branchIds: string[];
}

export interface AuthSession {
  user: User;
  token?: string;
  activeBranch?: Branch;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected';
    database: string;
  };
}

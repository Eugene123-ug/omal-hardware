import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  CreditCard,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Shield,
  Search,
  Receipt,
  FileText,
  AlertTriangle,
  Layers,
  DollarSign,
  UserCheck,
  Building,
  User,
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';

export type NavItem =
  | 'dashboard'
  | 'sales_new'
  | 'sales_find'
  | 'sales_history'
  | 'sales_daily'
  | 'sales_reports'
  | 'products_list'
  | 'products_categories'
  | 'inventory_movement'
  | 'inventory_alerts'
  | 'suppliers_list'
  | 'purchases_new'
  | 'purchases_orders'
  | 'purchases_history'
  | 'finance_expenses'
  | 'finance_income'
  | 'finance_pl'
  | 'staff_users'
  | 'staff_roles'
  | 'reports_system'
  | 'reports_custom'
  | 'settings_business'
  | 'settings_system';

interface AdminSidebarProps {
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
  currentUser: any;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeItem,
  onNavigate,
  currentUser,
}) => {
  const { companyName, companyLogo } = useCompany();

  // Accordion open states
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    sales: true,
    products: true,
    purchases: true,
    finance: true,
    staff: true,
    reports: true,
    settings: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleItemClick = (item: NavItem) => {
    onNavigate(item);
  };

  // Permission Verification Engine
  const canAccess = useMemo(() => {
    return (requiredKeys: string[]): boolean => {
      if (!currentUser) return false;

      const roleKey = (currentUser.role || '').toLowerCase();
      // Administrators and Owners have full god-mode access
      if (roleKey === 'administrator' || roleKey === 'owner' || roleKey === 'admin') {
        return true;
      }

      const userPerms: string[] = currentUser.permissions || [];
      if (userPerms.includes('*') || userPerms.includes('all')) return true;

      return requiredKeys.some((reqKey) => {
        const cleanReq = reqKey.toLowerCase().replace(/_/g, '.');
        return userPerms.some((userPerm) => {
          const cleanUser = userPerm.toLowerCase().replace(/_/g, '.');
          return (
            cleanUser === cleanReq ||
            userPerm.toLowerCase() === reqKey.toLowerCase() ||
            userPerm.toLowerCase().replace(/\./g, '_') === reqKey.toLowerCase().replace(/\./g, '_') ||
            cleanUser.startsWith(cleanReq.split('.')[0] + '.') ||
            cleanReq.startsWith(cleanUser.split('.')[0] + '.')
          );
        });
      });
    };
  }, [currentUser]);

  // Section 1: Sales Permissions
  const canViewSalesHistory = canAccess(['sales.view_all', 'sales.view_own', 'invoices_view', 'sales.view', 'sales_view']);
  const canCreateSale = canAccess(['sales.create', 'pos.access', 'sales_create']);
  const canFindProducts = canAccess(['products.view', 'sales.create', 'sales.view_all', 'products_view']);
  const canViewDailySales = canAccess(['reports.daily_sales', 'sales.view_all', 'reports_view', 'sales_daily_report']);
  const canViewSalesReports = canAccess(['reports.daily_sales', 'reports_view', 'sales.view_all', 'reports.view']);
  const showSalesGroup = canCreateSale || canFindProducts || canViewSalesHistory || canViewDailySales || canViewSalesReports;

  // Section 2: Products & Inventory Permissions
  const canViewProductsList = canAccess(['products.view', 'products_view']);
  const canManageCategories = canAccess(['products.view', 'products.create', 'products.edit', 'categories_manage']);
  const canViewMovement = canAccess(['inventory.view', 'inventory.adjust', 'inventory.receive', 'inventory.issue', 'inventory_movement_view']);
  const canViewAlerts = canAccess(['inventory.view', 'products.view', 'inventory_alerts_view']);
  const canViewSuppliers = canAccess(['suppliers.view', 'suppliers.manage', 'suppliers_view']);
  const showProductsGroup = canViewProductsList || canManageCategories || canViewMovement || canViewAlerts || canViewSuppliers;

  // Section 3: Purchases Permissions
  const canCreatePurchase = canAccess(['purchases.create', 'purchases_create']);
  const canViewOrders = canAccess(['purchases.view', 'orders_view', 'purchases_orders_view']);
  const canViewPurchaseHistory = canAccess(['purchases.view', 'purchases_history_view']);
  const showPurchasesGroup = canCreatePurchase || canViewOrders || canViewPurchaseHistory;

  // Section 4: Accounts & Finance Permissions
  const canManageExpenses = canAccess(['finance.view', 'expenses_manage', 'finance_expenses_manage']);
  const canViewIncome = canAccess(['finance.view', 'finance_income_view']);
  const canViewPL = canAccess(['reports.profit_loss', 'finance.view', 'profit_loss_view']);
  const showFinanceGroup = canManageExpenses || canViewIncome || canViewPL;

  // Section 5: Staff & Roles Permissions
  const canManageUsers = canAccess(['staff.create', 'staff.suspend', 'staff_manage', 'admin_manage']);
  const canManageRoles = canAccess(['roles.create', 'roles.edit_permissions', 'roles_manage', 'admin_manage']);
  const showStaffGroup = canManageUsers || canManageRoles;

  // Section 6: Reports Permissions
  const canViewSystemReports = canAccess(['audit_logs.view', 'admin_manage', 'audit_view']);
  const canViewCustomReports = canAccess(['reports.daily_sales', 'reports.profit_loss', 'reports_view', 'reports.view']);
  const showReportsGroup = canViewSystemReports || canViewCustomReports;

  // Section 7: Settings Permissions
  const canManageSettings = canAccess(['settings.manage', 'admin_manage', 'settings_manage']);
  const showSettingsGroup = canManageSettings;

  return (
    <aside className="w-64 bg-[#0b1328] text-slate-100 flex flex-col shrink-0 min-h-screen sticky top-0 h-screen border-r border-[#152342] select-none print:hidden overflow-y-auto z-20 font-sans antialiased">
      {/* Brand Header: Crisp, sharp and high-contrast */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#152342] bg-[#070c1a]">
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={companyName}
              className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 border border-white/20 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="leading-tight min-w-0 flex-1">
            <div className="font-extrabold text-sm text-white tracking-wide truncate">
              {companyName}
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold tracking-wider uppercase">
              ENTERPRISE ERP
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links Scrollable Body */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-2 text-xs font-medium scrollbar-thin scrollbar-thumb-slate-700">
        {/* Top: Dashboard Link */}
        <button
          onClick={() => handleItemClick('dashboard')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeItem === 'dashboard'
              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
              : 'text-slate-200 hover:bg-[#132040] hover:text-white font-semibold'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0 text-blue-400" />
          <span className="text-[13px]">Dashboard</span>
        </button>

        {/* 1. SALES GROUP */}
        {showSalesGroup && (
          <div className="pt-1">
            <button
              onClick={() => toggleSection('sales')}
              className="w-full flex items-center justify-between px-3 py-2 text-white hover:bg-[#132040] rounded-xl transition cursor-pointer font-bold"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase tracking-wider text-slate-200 font-bold">Sales &amp; POS</span>
              </div>
              {openSections.sales ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.sales && (
              <div className="pl-4 pr-1 py-1 space-y-1">
                {canCreateSale && (
                  <button
                    onClick={() => handleItemClick('sales_new')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'sales_new'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>New Sale (POS Till)</span>
                  </button>
                )}
                {canFindProducts && (
                  <button
                    onClick={() => handleItemClick('sales_find')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'sales_find'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Find Products</span>
                  </button>
                )}
                {canViewSalesHistory && (
                  <button
                    onClick={() => handleItemClick('sales_history')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'sales_history'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Sales History (Invoices)</span>
                  </button>
                )}
                {canViewDailySales && (
                  <button
                    onClick={() => handleItemClick('sales_daily')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'sales_daily'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Daily Sales Report</span>
                  </button>
                )}
                {canViewSalesReports && (
                  <button
                    onClick={() => handleItemClick('sales_reports')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'sales_reports'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Sales Summary Reports</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. PRODUCTS & INVENTORY GROUP */}
        {showProductsGroup && (
          <div className="pt-1">
            <button
              onClick={() => toggleSection('products')}
              className="w-full flex items-center justify-between px-3 py-2 text-white hover:bg-[#132040] rounded-xl transition cursor-pointer font-bold"
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase tracking-wider text-slate-200 font-bold">Products &amp; Stock</span>
              </div>
              {openSections.products ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.products && (
              <div className="pl-4 pr-1 py-1 space-y-1">
                {canViewProductsList && (
                  <button
                    onClick={() => handleItemClick('products_list')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'products_list'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Products List</span>
                  </button>
                )}
                {canManageCategories && (
                  <button
                    onClick={() => handleItemClick('products_categories')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'products_categories'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Categories</span>
                  </button>
                )}
                {canViewMovement && (
                  <button
                    onClick={() => handleItemClick('inventory_movement')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'inventory_movement'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Stock Movement</span>
                  </button>
                )}
                {canViewAlerts && (
                  <button
                    onClick={() => handleItemClick('inventory_alerts')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'inventory_alerts'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span>Low Stock Alert</span>
                  </button>
                )}
                {canViewSuppliers && (
                  <button
                    onClick={() => handleItemClick('suppliers_list')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'suppliers_list'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Suppliers Directory</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. PURCHASES GROUP */}
        {showPurchasesGroup && (
          <div className="pt-1">
            <button
              onClick={() => toggleSection('purchases')}
              className="w-full flex items-center justify-between px-3 py-2 text-white hover:bg-[#132040] rounded-xl transition cursor-pointer font-bold"
            >
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase tracking-wider text-slate-200 font-bold">Purchases &amp; Orders</span>
              </div>
              {openSections.purchases ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.purchases && (
              <div className="pl-4 pr-1 py-1 space-y-1">
                {canCreatePurchase && (
                  <button
                    onClick={() => handleItemClick('purchases_new')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'purchases_new'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>New Purchase</span>
                  </button>
                )}
                {canViewOrders && (
                  <button
                    onClick={() => handleItemClick('purchases_orders')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'purchases_orders'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Purchase Orders</span>
                  </button>
                )}
                {canViewPurchaseHistory && (
                  <button
                    onClick={() => handleItemClick('purchases_history')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'purchases_history'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Purchase History</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. ACCOUNTS & FINANCE */}
        {showFinanceGroup && (
          <div className="pt-1">
            <button
              onClick={() => toggleSection('finance')}
              className="w-full flex items-center justify-between px-3 py-2 text-white hover:bg-[#132040] rounded-xl transition cursor-pointer font-bold"
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase tracking-wider text-slate-200 font-bold">Accounts &amp; Finance</span>
              </div>
              {openSections.finance ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.finance && (
              <div className="pl-4 pr-1 py-1 space-y-1">
                {canManageExpenses && (
                  <button
                    onClick={() => handleItemClick('finance_expenses')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'finance_expenses'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Expenses Ledger</span>
                  </button>
                )}
                {canViewIncome && (
                  <button
                    onClick={() => handleItemClick('finance_income')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'finance_income'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Income by Date</span>
                  </button>
                )}
                {canViewPL && (
                  <button
                    onClick={() => handleItemClick('finance_pl')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'finance_pl'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Profit &amp; Loss</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. STAFF & ROLES */}
        {showStaffGroup && (
          <div className="pt-1">
            <button
              onClick={() => toggleSection('staff')}
              className="w-full flex items-center justify-between px-3 py-2 text-white hover:bg-[#132040] rounded-xl transition cursor-pointer font-bold"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase tracking-wider text-slate-200 font-bold">Staff &amp; Roles</span>
              </div>
              {openSections.staff ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.staff && (
              <div className="pl-4 pr-1 py-1 space-y-1">
                {canManageUsers && (
                  <button
                    onClick={() => handleItemClick('staff_users')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'staff_users'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Manage Users</span>
                  </button>
                )}
                {canManageRoles && (
                  <button
                    onClick={() => handleItemClick('staff_roles')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'staff_roles'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Roles &amp; Permissions</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 6. REPORTS */}
        {showReportsGroup && (
          <div className="pt-1">
            <button
              onClick={() => toggleSection('reports')}
              className="w-full flex items-center justify-between px-3 py-2 text-white hover:bg-[#132040] rounded-xl transition cursor-pointer font-bold"
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase tracking-wider text-slate-200 font-bold">Reports</span>
              </div>
              {openSections.reports ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.reports && (
              <div className="pl-4 pr-1 py-1 space-y-1">
                {canViewCustomReports && (
                  <button
                    onClick={() => handleItemClick('reports_custom')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'reports_custom'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Financial &amp; Sales Reports</span>
                  </button>
                )}
                {canViewSystemReports && (
                  <button
                    onClick={() => handleItemClick('reports_system')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                      activeItem === 'reports_system'
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Audit Trail &amp; System Logs</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 7. SETTINGS */}
        {showSettingsGroup && (
          <div className="pt-1">
            <button
              onClick={() => toggleSection('settings')}
              className="w-full flex items-center justify-between px-3 py-2 text-white hover:bg-[#132040] rounded-xl transition cursor-pointer font-bold"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase tracking-wider text-slate-200 font-bold">Settings</span>
              </div>
              {openSections.settings ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.settings && (
              <div className="pl-4 pr-1 py-1 space-y-1">
                <button
                  onClick={() => handleItemClick('settings_business')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'settings_business'
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'text-slate-200 hover:bg-[#132040] hover:text-white font-medium text-[13px]'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span>Business Settings &amp; Backups</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Panel Badge: Displays Logged-in User and Active Role */}
      <div className="p-3 border-t border-[#152342] bg-[#070c1a]">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#0e1933] border border-[#1b2b52]">
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 truncate">
            <div className="text-xs font-bold text-white truncate">
              {currentUser?.fullName || currentUser?.username || 'Staff User'}
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider truncate">
              {currentUser?.roleName || currentUser?.role || 'Staff Member'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;

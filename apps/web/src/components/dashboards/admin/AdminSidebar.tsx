import React from 'react';
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
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { CompanyLogo } from '../../common/CompanyLogo';

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
    finance: false,
    staff: true,
    reports: false,
    settings: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleItemClick = (item: NavItem) => {
    onNavigate(item);
  };

  return (
    <aside className="w-64 bg-[#042111] text-emerald-100/80 flex flex-col shrink-0 min-h-screen sticky top-0 h-screen border-r border-[#0b3b20] select-none print:hidden overflow-y-auto">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#0b3b20] bg-[#03190d]">
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={companyName}
              className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 border border-emerald-500/30 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
              <Shield className="w-5 h-5 text-amber-300" />
            </div>
          )}
          <div className="leading-tight min-w-0 flex-1">
            <div className="font-bold text-sm text-white tracking-tight truncate">
              {companyName}
            </div>
            <div className="text-[10px] text-emerald-400/80 font-medium tracking-wide">
              ENTERPRISE COMMERCIAL ERP
            </div>
          </div>
        </div>
      </div>

        {/* Navigation Links Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 text-xs font-medium scrollbar-thin scrollbar-thumb-emerald-900">
          {/* Top: Dashboard Link */}
          <button
            onClick={() => handleItemClick('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeItem === 'dashboard'
                ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30'
                : 'text-emerald-100/70 hover:bg-[#08331b] hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>

          {/* 1. SALES GROUP */}
          <div className="pt-2">
            <button
              onClick={() => toggleSection('sales')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-emerald-300/80 hover:text-white rounded-lg hover:bg-[#08331b] transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-xs text-emerald-100">Sales</span>
              </div>
              {openSections.sales ? (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>

            {openSections.sales && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                <button
                  onClick={() => handleItemClick('sales_new')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'sales_new' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>New Sale (POS)</span>
                </button>
                <button
                  onClick={() => handleItemClick('sales_find')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'sales_find' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Find Products</span>
                </button>
                <button
                  onClick={() => handleItemClick('sales_history')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'sales_history' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Sales History</span>
                </button>
                <button
                  onClick={() => handleItemClick('sales_daily')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'sales_daily' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Daily Sales Report</span>
                </button>
                <button
                  onClick={() => handleItemClick('sales_reports')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'sales_reports' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Sales Reports</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. PRODUCTS & INVENTORY GROUP */}
          <div>
            <button
              onClick={() => toggleSection('products')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-emerald-300/80 hover:text-white rounded-lg hover:bg-[#08331b] transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-xs text-emerald-100">Products &amp; Inventory</span>
              </div>
              {openSections.products ? (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>

            {openSections.products && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                <button
                  onClick={() => handleItemClick('products_list')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'products_list' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Products List</span>
                </button>
                <button
                  onClick={() => handleItemClick('products_categories')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'products_categories' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Categories</span>
                </button>
                <button
                  onClick={() => handleItemClick('inventory_movement')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'inventory_movement' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Stock Movement</span>
                </button>
                <button
                  onClick={() => handleItemClick('inventory_alerts')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'inventory_alerts' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Low Stock Alert</span>
                </button>
                <button
                  onClick={() => handleItemClick('suppliers_list')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'suppliers_list' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Suppliers</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. PURCHASES GROUP */}
          <div>
            <button
              onClick={() => toggleSection('purchases')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-emerald-300/80 hover:text-white rounded-lg hover:bg-[#08331b] transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-xs text-emerald-100">Purchases</span>
              </div>
              {openSections.purchases ? (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>

            {openSections.purchases && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                <button
                  onClick={() => handleItemClick('purchases_new')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'purchases_new' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>New Purchase</span>
                </button>
                <button
                  onClick={() => handleItemClick('purchases_orders')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'purchases_orders' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Purchase Orders</span>
                </button>
                <button
                  onClick={() => handleItemClick('purchases_history')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'purchases_history' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Purchase History</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. ACCOUNTS & FINANCE */}
          <div>
            <button
              onClick={() => toggleSection('finance')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-emerald-300/80 hover:text-white rounded-lg hover:bg-[#08331b] transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-xs text-emerald-100">Accounts &amp; Finance</span>
              </div>
              {openSections.finance ? (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>

            {openSections.finance && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                <button
                  onClick={() => handleItemClick('finance_expenses')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'finance_expenses' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Expenses Ledger</span>
                </button>
                <button
                  onClick={() => handleItemClick('finance_income')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'finance_income' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Income by Date</span>
                </button>
                <button
                  onClick={() => handleItemClick('finance_pl')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'finance_pl' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Profit &amp; Loss</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. STAFF & ROLES */}
          <div>
            <button
              onClick={() => toggleSection('staff')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-emerald-300/80 hover:text-white rounded-lg hover:bg-[#08331b] transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-xs text-emerald-100">Staff &amp; Roles</span>
              </div>
              {openSections.staff ? (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>

            {openSections.staff && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                <button
                  onClick={() => handleItemClick('staff_users')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'staff_users' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Manage Users</span>
                </button>
                <button
                  onClick={() => handleItemClick('staff_roles')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'staff_roles' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Roles &amp; Permissions</span>
                </button>
              </div>
            )}
          </div>

          {/* 6. REPORTS */}
          <div>
            <button
              onClick={() => toggleSection('reports')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-emerald-300/80 hover:text-white rounded-lg hover:bg-[#08331b] transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-xs text-emerald-100">Reports</span>
              </div>
              {openSections.reports ? (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>

            {openSections.reports && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                <button
                  onClick={() => handleItemClick('reports_system')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'reports_system' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Executive Reports</span>
                </button>
              </div>
            )}
          </div>

          {/* 7. SETTINGS */}
          <div>
            <button
              onClick={() => toggleSection('settings')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-emerald-300/80 hover:text-white rounded-lg hover:bg-[#08331b] transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-xs text-emerald-100">Settings</span>
              </div>
              {openSections.settings ? (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>

            {openSections.settings && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                <button
                  onClick={() => handleItemClick('settings_business')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    activeItem === 'settings_business' ? 'text-emerald-300 font-bold bg-[#0a381e]' : 'text-emerald-200/60 hover:text-white'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Business Settings</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Panel Badge */}
        <div className="p-3 border-t border-[#0b3b20] bg-[#03190d]">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#072c18] border border-[#0d4727]">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 truncate">
              <div className="text-[11px] font-bold text-white truncate">{companyName}</div>
              <div className="text-[9px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Single Company Store</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    );
  };

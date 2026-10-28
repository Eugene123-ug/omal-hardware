import React, { useState } from 'react';
import { AdminSidebar, NavItem } from './admin/AdminSidebar';
import { AdminHeader } from './admin/AdminHeader';
import { AdminDashboardView } from './admin/AdminDashboardView';
import { AddProductModal } from './admin/AddProductModal';
import { ManageStaffModal } from './admin/ManageStaffModal';
import { CreateRoleModal } from './admin/CreateRoleModal';
import { PosSaleModal } from './admin/PosSaleModal';
import { PurchaseStockModal } from './admin/PurchaseStockModal';
import { DailySalesReportView } from './admin/views/DailySalesReportView';
import { SystemReportsView } from './admin/views/SystemReportsView';
import { ProductsListView } from './admin/views/ProductsListView';
import { InventoryMovementView } from './admin/views/InventoryMovementView';
import { SalesHistoryView } from './admin/views/SalesHistoryView';
import { BusinessSettingsView } from './admin/views/BusinessSettingsView';
import { CategoriesManagementView } from './admin/views/CategoriesManagementView';
import { StockAndLowStockView } from './admin/views/StockAndLowStockView';
import { ProfitAndLossView } from './admin/views/ProfitAndLossView';
import { ExpensesManagementView } from './admin/views/ExpensesManagementView';
import { IncomeReportsView } from './admin/views/IncomeReportsView';
import { ComprehensiveReportsOverview } from './admin/views/ComprehensiveReportsOverview';
import { SuppliersManagementView } from './admin/views/SuppliersManagementView';
import { PurchaseOrdersView } from './admin/views/PurchaseOrdersView';
import { PurchaseHistoryView } from './admin/views/PurchaseHistoryView';

interface AdminDashboardProps {
  currentUser: any;
  currentBranch: any;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  currentBranch,
  onLogout,
}) => {
  const [activeItem, setActiveItem] = useState<NavItem>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Modals
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showManageStaff, setShowManageStaff] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showPosSale, setShowPosSale] = useState(false);
  const [showPurchaseStock, setShowPurchaseStock] = useState(false);

  // Trigger modal or view from sidebar navigation
  const handleNavigate = (item: NavItem) => {
    setActiveItem(item);
    if (item === 'sales_new') {
      setShowPosSale(true);
    } else if (item === 'staff_users') {
      setShowManageStaff(true);
    } else if (item === 'staff_roles') {
      setShowCreateRole(true);
    } else if (item === 'purchases_new') {
      setShowPurchaseStock(true);
    }
  };

  // Quick Action triggers from the dashboard grid
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add_product':
        setShowAddProduct(true);
        break;
      case 'new_sale':
      case 'add_sale':
      case 'pos':
        setShowPosSale(true);
        break;
      case 'manage_staff':
        setShowManageStaff(true);
        break;
      case 'create_role':
        setShowCreateRole(true);
        break;
      case 'view_reports':
      case 'audit_logs':
        setActiveItem('reports_system');
        break;
      case 'purchase_stock':
      case 'purchases':
        setShowPurchaseStock(true);
        break;
      case 'system_settings':
        setActiveItem('settings_business');
        break;
      case 'products':
        setActiveItem('products_list');
        break;
      case 'inventory':
        setActiveItem('inventory_movement');
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f8fafc] text-slate-800 font-sans antialiased selection:bg-emerald-600 selection:text-white">
      {/* 1. Permanently Open Stationary Sidebar on Desktop, Drawer on Mobile */}
      <AdminSidebar
        activeItem={activeItem}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* 2. Main Content Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen">
        {/* Top Header Bar */}
        <AdminHeader
          currentUser={currentUser}
          onLogout={onLogout}
          onToggleSidebar={() => setIsMobileNavOpen(!isMobileNavOpen)}
        />

        {/* Dashboard Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeItem === 'dashboard' && (
            <AdminDashboardView onQuickAction={handleQuickAction} />
          )}

          {activeItem === 'sales_daily' && (
            <DailySalesReportView onNewSale={() => setShowPosSale(true)} />
          )}

          {activeItem === 'sales_history' && (
            <SalesHistoryView />
          )}

          {(activeItem === 'sales_reports' || activeItem === 'finance_income') && (
            <IncomeReportsView currentUser={currentUser} />
          )}

          {activeItem === 'products_categories' && (
            <CategoriesManagementView />
          )}

          {(activeItem === 'products_list' || activeItem === 'sales_find') && (
            <StockAndLowStockView
              initialFilter="all"
              currentUser={currentUser}
              onAddProduct={() => setShowAddProduct(true)}
              onRestock={() => setShowPurchaseStock(true)}
            />
          )}

          {activeItem === 'inventory_alerts' && (
            <StockAndLowStockView
              initialFilter="low_stock"
              currentUser={currentUser}
              onAddProduct={() => setShowAddProduct(true)}
              onRestock={() => setShowPurchaseStock(true)}
            />
          )}

          {activeItem === 'inventory_movement' && (
            <InventoryMovementView />
          )}

          {activeItem === 'suppliers_list' && (
            <SuppliersManagementView />
          )}

          {activeItem === 'purchases_orders' && (
            <PurchaseOrdersView onNewPurchase={() => setShowPurchaseStock(true)} />
          )}

          {activeItem === 'purchases_history' && (
            <PurchaseHistoryView />
          )}

          {activeItem === 'finance_pl' && (
            <ProfitAndLossView currentUser={currentUser} />
          )}

          {activeItem === 'finance_expenses' && (
            <ExpensesManagementView currentUser={currentUser} />
          )}

          {(activeItem === 'reports_system' || activeItem === 'reports_custom') && (
            <ComprehensiveReportsOverview />
          )}

          {(activeItem === 'settings_business' || activeItem === 'settings_system') && (
            <BusinessSettingsView />
          )}
        </main>
      </div>

      {/* 3. Interactive Modals */}
      <AddProductModal
        isOpen={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        onSuccess={() => {}}
      />

      <ManageStaffModal
        isOpen={showManageStaff}
        onClose={() => setShowManageStaff(false)}
        onRefresh={() => {}}
      />

      <CreateRoleModal
        isOpen={showCreateRole}
        onClose={() => setShowCreateRole(false)}
        onSuccess={() => {}}
      />

      <PosSaleModal
        isOpen={showPosSale}
        onClose={() => setShowPosSale(false)}
        currentUser={currentUser}
        currentBranch={currentBranch}
        onSuccess={() => {}}
      />

      <PurchaseStockModal
        isOpen={showPurchaseStock}
        onClose={() => setShowPurchaseStock(false)}
        onSuccess={() => {}}
      />
    </div>
  );
};

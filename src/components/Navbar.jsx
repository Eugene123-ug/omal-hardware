import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPendingOfflineSalesCount } from '../db/offlineDb';
import { syncOfflineSalesToServer } from '../services/api';
import { 
  Building2, ShoppingCart, Smartphone, Package, Layers, 
  Receipt, Users, Truck, DollarSign, BarChart3, ShieldCheck, 
  Settings, Wifi, WifiOff, RefreshCw, LogOut, ChevronDown, UserCheck
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, isSimulatedMobile, setIsSimulatedMobile }) {
  const { user, logout, switchDemoRole, isSuperAdmin, isAdmin, isSales } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  // Check pending offline sales periodically
  useEffect(() => {
    const updatePending = async () => {
      try {
        const count = await getPendingOfflineSalesCount();
        setPendingSyncCount(count);
      } catch (e) {}
    };

    updatePending();
    const interval = setInterval(updatePending, 4000);

    const handleOnline = () => {
      setIsOnline(true);
      handleTriggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTriggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncOfflineSalesToServer();
      const count = await getPendingOfflineSalesCount();
      setPendingSyncCount(count);
    } catch (e) {
      console.warn('Sync attempt failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Demo accounts for instant role-testing
  const demoUsers = [
    { name: 'Alhaji Osei Mensah', role: 'super_admin', label: 'Super Admin (Remote Owner)', email: 'owner@omal.com', pass: 'owner123', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { name: 'Kofi Boateng', role: 'admin', label: 'Admin / IT Manager (Ghana)', email: 'admin@omal.com', pass: 'admin123', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    { name: 'Kwame Asante', role: 'sales', label: 'Sales Staff / Cashier', email: 'kwame@omal.com', pass: 'kwame123', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    { name: 'Ama Serwaa', role: 'sales', label: 'Sales Executive', email: 'ama@omal.com', pass: 'ama123', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    { name: 'Yaw Frimpong', role: 'accountant', label: 'Accountant', email: 'accountant@omal.com', pass: 'acc123', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      {/* Top Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="font-semibold text-slate-200">OMAL ERP</span>
            <span className="text-slate-400 hidden sm:inline">| Accra Showroom & Tema Depot</span>
          </div>

          {/* Online / Offline Sync Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors"
               style={{
                 borderColor: isOnline ? (pendingSyncCount > 0 ? '#eab308' : '#10b981') : '#ef4444',
                 backgroundColor: isOnline ? (pendingSyncCount > 0 ? 'rgba(234, 179, 8, 0.1)' : 'rgba(16, 185, 129, 0.1)') : 'rgba(239, 68, 68, 0.1)'
               }}>
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Live Cloud</span>
                {pendingSyncCount > 0 && (
                  <button 
                    onClick={handleTriggerSync}
                    disabled={isSyncing}
                    className="ml-1 text-amber-300 flex items-center gap-1 hover:underline">
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{pendingSyncCount} Pending Sync</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-300 font-bold">Offline Mode Active</span>
                {pendingSyncCount > 0 && (
                  <span className="bg-red-500/40 text-red-100 px-1.5 rounded-full text-[10px]">
                    {pendingSyncCount} saved locally
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* User Role Switcher & Phone Toggle */}
        <div className="flex items-center gap-2">
          {/* Owner Mobile View Simulation Toggle */}
          {isSuperAdmin && (
            <button
              onClick={() => setIsSimulatedMobile(!isSimulatedMobile)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                isSimulatedMobile 
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Toggle Owner Smartphone View">
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Owner Phone View</span>
            </button>
          )}

          {/* Quick Role Tester Menu */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-md border border-slate-700 text-slate-200">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium">{user?.name}</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {user?.role?.replace('_', ' ')}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-2 z-50">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 mb-1">
                  Switch Active Role (Demo)
                </div>
                {demoUsers.map(du => (
                  <button
                    key={du.email}
                    onClick={() => {
                      switchDemoRole(du.email, du.pass);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors ${
                      user?.email === du.email ? 'bg-slate-700/60 font-semibold' : ''
                    }`}>
                    <div>
                      <div className="text-slate-100">{du.name}</div>
                      <div className="text-[10px] text-slate-400">{du.label}</div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${du.badge}`}>
                      {du.role.replace('_', ' ')}
                    </span>
                  </button>
                ))}
                <div className="border-t border-slate-700 mt-1 pt-1">
                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none">
        <nav className="flex space-x-1 py-1">
          {/* POS is available for Cashiers, Admins, and Super Admin */}
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'pos'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}>
            <ShoppingCart className="w-4 h-4" />
            <span>POS Counter</span>
          </button>

          {/* Owner Phone Live Feed (Super Admin) */}
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('owner_dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'owner_dashboard'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}>
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Owner Remote View</span>
            </button>
          )}

          {/* Product Management (Admin & Super Admin) */}
          {!isSales && (
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'products'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}>
              <Package className="w-4 h-4" />
              <span>Products & Catalog</span>
            </button>
          )}

          {/* Stock & Warehouses (Admin & Super Admin) */}
          {!isSales && (
            <button
              onClick={() => setActiveTab('stock')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'stock'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}>
              <Layers className="w-4 h-4" />
              <span>Stock & Warehouses</span>
            </button>
          )}

          {/* Sales History */}
          <button
            onClick={() => setActiveTab('sales_history')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'sales_history'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}>
            <Receipt className="w-4 h-4" />
            <span>{isSales ? 'My Sales Today' : 'Sales Records'}</span>
          </button>

          {/* Customer Management & Credit */}
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}>
            <Users className="w-4 h-4" />
            <span>Customers & Credit</span>
          </button>

          {/* Suppliers & PO/GRN */}
          {!isSales && (
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'suppliers'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}>
              <Truck className="w-4 h-4" />
              <span>Suppliers & PO</span>
            </button>
          )}

          {/* Daily Cash & Expenses */}
          <button
            onClick={() => setActiveTab('cash_expenses')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'cash_expenses'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}>
            <DollarSign className="w-4 h-4" />
            <span>Daily Cash & Closing</span>
          </button>

          {/* Reports & Analytics (Super Admin & Admin) */}
          {!isSales && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}>
              <BarChart3 className="w-4 h-4" />
              <span>Reports & Profit</span>
            </button>
          )}

          {/* Security & Audit Trail (Super Admin & Admin) */}
          {!isSales && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}>
              <ShieldCheck className="w-4 h-4" />
              <span>Anti-Theft & Audit</span>
            </button>
          )}

          {/* System Settings & Backup (Super Admin & Admin) */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}>
              <Settings className="w-4 h-4" />
              <span>Settings & Backup</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

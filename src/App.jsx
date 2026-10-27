import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginScreen from './components/Auth/LoginScreen';
import POSScreen from './components/POS/POSScreen';
import OwnerRemoteDashboard from './components/Owner/OwnerRemoteDashboard';
import ProductCatalog from './components/Products/ProductCatalog';
import StockManagement from './components/Stock/StockManagement';
import SalesHistory from './components/Sales/SalesHistory';
import CustomerLedger from './components/Customers/CustomerLedger';
import SupplierManagement from './components/Suppliers/SupplierManagement';
import CashClosingScreen from './components/CashClosing/CashClosingScreen';
import ReportsHub from './components/Reports/ReportsHub';
import AuditLogs from './components/Security/AuditLogs';
import SettingsScreen from './components/Settings/SettingsScreen';
import { Smartphone, RefreshCw, X } from 'lucide-react';

export default function App() {
  const { user, loading, isSuperAdmin, isSales } = useAuth();
  
  // Default tab based on role
  const [activeTab, setActiveTab] = useState('pos');
  const [isSimulatedMobile, setIsSimulatedMobile] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-2">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium">Starting OMAL ERP System...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Active view content
  const renderContent = () => {
    switch (activeTab) {
      case 'pos':
        return <POSScreen />;
      case 'owner_dashboard':
        return <OwnerRemoteDashboard />;
      case 'products':
        return <ProductCatalog />;
      case 'stock':
        return <StockManagement />;
      case 'sales_history':
        return <SalesHistory />;
      case 'customers':
        return <CustomerLedger />;
      case 'suppliers':
        return <SupplierManagement />;
      case 'cash_expenses':
        return <CashClosingScreen />;
      case 'reports':
        return <ReportsHub />;
      case 'audit':
        return <AuditLogs />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <POSScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isSimulatedMobile={isSimulatedMobile}
        setIsSimulatedMobile={setIsSimulatedMobile}
      />

      <main className="flex-1">
        {isSimulatedMobile ? (
          /* Owner Phone Chassis Simulation */
          <div className="py-6 flex flex-col items-center justify-center bg-slate-900/50 min-h-[calc(100vh-65px)]">
            <div className="flex items-center gap-2 mb-2 text-xs text-amber-400 font-semibold">
              <Smartphone className="w-4 h-4" />
              <span>Owner Remote Smartphone Simulation (Outside Ghana)</span>
              <button 
                onClick={() => setIsSimulatedMobile(false)}
                className="text-slate-400 hover:text-white p-1 ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Device Frame */}
            <div className="w-[390px] h-[780px] bg-slate-950 border-[10px] border-slate-800 rounded-[48px] shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-slate-700">
              {/* Dynamic Island / Speaker Notch */}
              <div className="h-6 w-32 bg-slate-800 rounded-b-2xl mx-auto z-20 shrink-0"></div>

              {/* Phone Content Screen */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'owner_dashboard' ? <OwnerRemoteDashboard /> : renderContent()}
              </div>

              {/* Home indicator bar */}
              <div className="h-4 bg-slate-950 flex items-center justify-center shrink-0">
                <div className="w-32 h-1 bg-slate-700 rounded-full"></div>
              </div>
            </div>
          </div>
        ) : (
          renderContent()
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { LoginScreen } from './components/auth/LoginScreen';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { CashierDashboard } from './components/dashboards/CashierDashboard';
import { AccountantDashboard } from './components/dashboards/AccountantDashboard';
import { ManagerDashboard } from './components/dashboards/ManagerDashboard';
import { User, Branch, SystemHealth } from './types';
import { api, setAuthToken, clearAuthToken, getAuthToken } from './services/api';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check health and auto-restore session on mount
  useEffect(() => {
    const initApp = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const meRes = await api.getMe();
          if (meRes.success && meRes.data.user) {
            setCurrentUser(meRes.data.user);
            setAvailableBranches(meRes.data.branches || []);
            const primary =
              (meRes.data.branches || []).find((b: any) => b.is_primary) ||
              meRes.data.branches[0];
            setCurrentBranch(primary || null);
          }
        } catch {
          clearAuthToken();
        }
      }
      setIsInitializing(false);
    };

    initApp();
  }, []);

  const handleLoginSuccess = (user: any, branches: any[], primaryBranch: any) => {
    setCurrentUser(user);
    setAvailableBranches(branches || []);
    setCurrentBranch(primaryBranch || branches[0] || null);
  };

  const handleLogout = () => {
    clearAuthToken();
    setCurrentUser(null);
    setCurrentBranch(null);
    setAvailableBranches([]);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#091427] text-white text-xs font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>INITIALIZING OMAL HARDWARE MANAGEMENT SYSTEM...</span>
        </div>
      </div>
    );
  }

  // Not logged in: Show Pixel-Perfect Split-Screen Login Page (Image 2)
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Cashier View: Strictly Isolated Fast POS till interface (Section 6)
  if (currentUser.role === 'cashier') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <div className="bg-[#0b1328] text-white px-6 py-3 flex items-center justify-between border-b border-[#152342]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide text-white">OMAL HARDWARE</span>
            <span className="text-xs text-amber-400 font-semibold px-2 py-0.5 rounded bg-[#162340]">
              TILL WORKSPACE
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-300">Cashier: <strong>{currentUser.fullName}</strong></span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
        <div className="flex-1 p-6">
          <CashierDashboard currentUser={currentUser} currentBranch={currentBranch} />
        </div>
      </div>
    );
  }

  // Admin & Owner View: Pixel-Perfect Executive Commercial Dashboard (Image 1)
  return (
    <AdminDashboard
      currentUser={currentUser}
      currentBranch={currentBranch}
      onLogout={handleLogout}
    />
  );
};

export default App;

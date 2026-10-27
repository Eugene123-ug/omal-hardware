import React from 'react';
import { Building2, LogOut, ShieldCheck, Activity } from 'lucide-react';
import { User, Branch } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useCompany } from '../../context/CompanyContext';

export interface AppShellProps {
  currentUser: User | null;
  currentBranch?: Branch | null;
  onLogout?: () => void;
  apiConnected?: boolean;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentUser,
  currentBranch,
  onLogout,
  apiConnected = true,
  children,
}) => {
  const { companyName, companyLogo } = useCompany();

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'success';
      case 'administrator':
        return 'info';
      case 'cashier':
        return 'warning';
      case 'accountant':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Application Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="w-9 h-9 object-contain rounded-lg" />
              ) : (
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white font-bold text-base shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-slate-900 tracking-tight">{companyName}</span>
                  <span className="hidden sm:inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium border border-slate-200">
                    Enterprise ERP
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  Single Company Commercial Store
                </div>
              </div>
            </div>

            {/* User Session Info & Action Controls */}
            <div className="flex items-center gap-4">
              {currentUser && (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold text-slate-900 leading-none">
                      {currentUser.fullName}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      <Badge variant={getRoleBadgeVariant(currentUser.role)} size="sm">
                        {currentUser.role.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onLogout}
                    leftIcon={<LogOut className="w-3.5 h-3.5" />}
                  >
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body Content Region */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};

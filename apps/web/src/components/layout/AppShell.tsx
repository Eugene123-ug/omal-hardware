import React from 'react';
import { Building2, LogOut, ShieldCheck, Activity } from 'lucide-react';
import { User, Branch } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

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
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white font-bold text-base shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-slate-900 tracking-tight">OMAL ERP</span>
                  <span className="hidden sm:inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium border border-slate-200">
                    Ghana Operations
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  Accra Showroom &bull; Tema Depot
                </div>
              </div>
            </div>

            {/* Right Status & Profile Controls */}
            <div className="flex items-center gap-4">
              {/* System Connectivity Indicator */}
              <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                <Activity
                  className={`w-3.5 h-3.5 ${
                    apiConnected ? 'text-emerald-500 animate-pulse' : 'text-rose-500'
                  }`}
                />
                <span>{apiConnected ? 'System Online' : 'Connecting...'}</span>
              </div>

              {currentUser && (
                <>
                  {/* Current Branch Display */}
                  {currentBranch && (
                    <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-blue-50/70 border border-blue-200 px-2.5 py-1 rounded-md">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>{currentBranch.name}</span>
                    </div>
                  )}

                  {/* User Profile */}
                  <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs font-semibold text-slate-800 leading-tight">
                        {currentUser.fullName}
                      </div>
                      <Badge variant={getRoleBadgeVariant(currentUser.role)} size="sm">
                        {currentUser.role.toUpperCase()}
                      </Badge>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onLogout}
                      className="text-slate-600 hover:text-red-600 hover:border-red-200"
                      title="Sign Out"
                    >
                      <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
                      <span className="hidden sm:inline">Sign Out</span>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Light Clean Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          OMAL ERP &bull; Accra Showroom &bull; Tema Depot &bull; Secure Multi-Branch Operating System
        </div>
      </footer>
    </div>
  );
};

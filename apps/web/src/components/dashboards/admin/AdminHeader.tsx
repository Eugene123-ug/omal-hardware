import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Bell,
  User,
  LogOut,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';

interface AdminHeaderProps {
  currentUser: any;
  onLogout: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentUser,
  onLogout,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { companyLogo, companyName } = useCompany();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      setCurrentTime(`${dateStr} ${timeStr}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getDisplayName = () => {
    if (!currentUser) return 'Administrator';
    const name = currentUser.fullName || currentUser.full_name || currentUser.name;
    if (name && !name.toLowerCase().includes('system') && !name.toLowerCase().includes('administrator')) {
      return name.split(' ')[0];
    }
    if (currentUser.username && currentUser.username.toLowerCase() !== 'admin') {
      return currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
    }
    return currentUser.fullName || 'Admin';
  };

  return (
    <header className="h-20 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Left: Store Branding & Greeting */}
      <div className="flex items-center gap-4">
        {companyLogo && (
          <img
            src={companyLogo}
            alt={companyName}
            className="h-10 max-w-[120px] object-contain hidden sm:block rounded-lg"
          />
        )}

        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
            Admin Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            {getGreetingTime()},{' '}
            <span className="font-semibold text-slate-800">{getDisplayName()}</span>! Here&apos;s what&apos;s happening in your company store today.
          </p>
        </div>
      </div>

      {/* Right: Date Time + Notifications Badge + Admin Profile */}
      <div className="flex items-center gap-5">
        {/* Date Time Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>{currentTime || 'Loading date...'}</span>
        </div>

        {/* Notifications Icon with Badge */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
              3
            </span>
          </button>

          {/* Notifications Dropdown Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 text-xs">
              <div className="px-4 pb-2 border-b border-slate-100 font-bold text-slate-800 flex items-center justify-between">
                <span>Notifications</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  3 Updates
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                <div className="p-3 hover:bg-slate-50 transition">
                  <div className="font-semibold text-slate-800">Low Stock Alert: Physical Stock Check</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">Some items have fallen below low stock threshold.</div>
                  <div className="text-[10px] text-slate-400 mt-1">10 mins ago</div>
                </div>
                <div className="p-3 hover:bg-slate-50 transition">
                  <div className="font-semibold text-slate-800">New Purchase Received</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">Purchase Order verified and stock added to inventory.</div>
                  <div className="text-[10px] text-slate-400 mt-1">1 hour ago</div>
                </div>
                <div className="p-3 hover:bg-slate-50 transition">
                  <div className="font-semibold text-slate-800">POS Till Ready</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">Counter till active for daily commercial sales.</div>
                  <div className="text-[10px] text-slate-400 mt-1">2 hours ago</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Admin Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 pl-2 py-1 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-700 text-white font-bold text-sm flex items-center justify-center shadow-sm">
              {currentUser?.fullName?.charAt(0) || 'A'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {currentUser?.fullName?.split(' ')[0] || 'Admin'}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {currentUser?.roleName || 'System Administrator'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-slate-100">
                <div className="font-bold text-slate-900">{currentUser?.fullName}</div>
                <div className="text-[11px] text-slate-500 truncate">{currentUser?.email}</div>
              </div>
              <button
                onClick={onLogout}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

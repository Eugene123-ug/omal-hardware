import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { 
  Settings, Database, Download, Users, UserPlus, 
  ShieldCheck, Lock, Save, Clock, Key, Building2, Check
} from 'lucide-react';

export default function SettingsScreen() {
  const { isSuperAdmin, isAdmin, autoLogoutMinutes, setAutoLogoutMinutes } = useAuth();
  const [activeTab, setActiveTab] = useState('store'); // 'store', 'users', 'backup'
  const [settings, setSettings] = useState({
    company_name: 'OMAL TILES & HARDWARE DEPOT',
    company_tin: 'C0028914567',
    company_phone: '+233 24 456 7890',
    company_address: 'Plot 48 Spintex Road, Accra, Ghana',
    receipt_footer: 'Thank you for your business! Goods once sold are not returnable after 48 hours.',
    max_cashier_discount_pct: '2',
    auto_logout_mins: '15'
  });
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // New user modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'sales',
    admin_pin: '',
    phone: ''
  });

  const loadSettingsAndUsers = async () => {
    setLoading(true);
    try {
      const [sett, uList] = await Promise.all([
        apiRequest('/settings'),
        apiRequest('/auth/users')
      ]);
      setSettings(prev => ({ ...prev, ...sett }));
      setUsersList(uList);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsAndUsers();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      setAutoLogoutMinutes(parseInt(settings.auto_logout_mins) || 15);
      alert('Settings saved successfully');
    } catch (err) {
      alert(`Save error: ${err.message}`);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      alert('User created successfully');
      setShowUserModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'sales', admin_pin: '', phone: '' });
      loadSettingsAndUsers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDownloadBackup = () => {
    const token = localStorage.getItem('omal_pos_token');
    window.open(`/api/settings/backup/download?token=${token}`, '_blank');
  };

  const handleExportJson = () => {
    const token = localStorage.getItem('omal_pos_token');
    window.open(`/api/settings/backup/export-json?token=${token}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <span>System Configuration & Security Settings</span>
          </h2>
          <div className="text-xs text-slate-400">
            Store profile, Ghana GRA TIN, staff user permissions & automated database backups
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold space-x-4">
        {[
          { id: 'store', label: 'Company Profile & Receipts', icon: Building2 },
          { id: 'users', label: 'Staff Roles & PINs', icon: Users },
          { id: 'backup', label: 'Database Backup & Cloud Sync', icon: Database }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 py-2.5 border-b-2 transition-all ${
                activeTab === t.id
                  ? 'border-amber-500 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}>
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: STORE PROFILE */}
      {activeTab === 'store' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-2xl shadow-xl text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-slate-400 block mb-1">Company Trading Name *</label>
              <input
                type="text"
                required
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Ghana GRA TIN (Tax ID) *</label>
              <input
                type="text"
                required
                value={settings.company_tin}
                onChange={(e) => setSettings({ ...settings, company_tin: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Store Phone Numbers *</label>
              <input
                type="text"
                required
                value={settings.company_phone}
                onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="col-span-2">
              <label className="text-slate-400 block mb-1">Showroom & Warehouse Address</label>
              <input
                type="text"
                value={settings.company_address}
                onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="col-span-2">
              <label className="text-slate-400 block mb-1">Thermal Receipt Footer Policy Note</label>
              <textarea
                rows={2}
                value={settings.receipt_footer}
                onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Max Cashier Discount % (without PIN)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={settings.max_cashier_discount_pct}
                onChange={(e) => setSettings({ ...settings, max_cashier_discount_pct: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Auto-Logout Inactivity Timer (Minutes)</label>
              <input
                type="number"
                min="5"
                max="120"
                value={settings.auto_logout_mins}
                onChange={(e) => setSettings({ ...settings, auto_logout_mins: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md">
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: STAFF USERS & PERMISSIONS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowUserModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md">
              <UserPlus className="w-4 h-4" />
              <span>Create Staff Account</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Staff Name</th>
                  <th className="px-4 py-3">Email (Login)</th>
                  <th className="px-4 py-3">Role & Permissions</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {usersList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-white">{u.name}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.role === 'super_admin' 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                          : u.role === 'admin' 
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {u.role.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{u.phone || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BACKUP & CLOUD EXPORT */}
      {activeTab === 'backup' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 max-w-2xl shadow-xl text-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400">
              <Database className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Automated Cloud & Local Backups</h3>
              <p className="text-slate-400">
                Daily backup scheduled at 11:00 PM GMT. You can download immediate full snapshots below.
              </p>
            </div>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2">
            <div className="font-semibold text-white">Full SQLite Database File (.db)</div>
            <p className="text-slate-400 text-[11px]">
              Direct binary snapshot of the entire database including all sales, products, stock tables, and audit logs.
            </p>
            <button
              onClick={handleDownloadBackup}
              disabled={!isSuperAdmin}
              className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span>Download SQLite Backup (.db)</span>
            </button>
            {!isSuperAdmin && (
              <span className="text-[10px] text-red-400 block pt-1">
                * Super Admin (Owner) permission required to download full database.
              </span>
            )}
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2">
            <div className="font-semibold text-white">Cloud JSON Export (Google Drive Sync)</div>
            <p className="text-slate-400 text-[11px]">
              Formatted JSON dump containing all tables for cloud redundancy and secondary cold storage.
            </p>
            <button
              onClick={handleExportJson}
              disabled={!isSuperAdmin}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl text-xs flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span>Export Complete JSON Backup</span>
            </button>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base">Create Staff Account</h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="e.g. Samuel Annan"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Email (Username) *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="e.g. samuel@omal.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Assigned Role *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  <option value="sales">Sales Staff / Cashier (POS Only, No Costs)</option>
                  <option value="admin">Admin / IT Manager (Ghana Showroom)</option>
                  <option value="accountant">Accountant (Sales, Expenses & Reports)</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin (Remote Owner)</option>}
                </select>
              </div>

              {(newUser.role === 'admin' || newUser.role === 'super_admin') && (
                <div>
                  <label className="text-amber-400 block mb-1">Admin 4-digit PIN Code *</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newUser.admin_pin}
                    onChange={(e) => setNewUser({ ...newUser, admin_pin: e.target.value })}
                    placeholder="e.g. 5566"
                    className="w-full bg-slate-800 border border-amber-500/50 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="e.g. +233 24 555 6677"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

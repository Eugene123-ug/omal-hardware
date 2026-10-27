import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  Shield,
  Check,
  Ban,
  RefreshCw,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { api } from '../../../services/api';

interface ManageStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const ManageStaffModal: React.FC<ManageStaffModalProps> = ({ isOpen, onClose, onRefresh }) => {
  const [staff, setStaff] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New staff form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('Wonark@2026');
  const [roleId, setRoleId] = useState('');
  const [phone, setPhone] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [staffRes, rolesRes] = await Promise.all([api.getStaff(), api.getRoles()]);
      if (staffRes.data) {
        // Sanitize any email typo for Johnson Nketia if found
        const cleaned = staffRes.data.map((u: any) => {
          if (u.fullName?.toUpperCase().includes('JOHNSON NKETIA') && u.email?.includes('samuel@')) {
            return { ...u, email: 'johnson.nketia@wonark.com' };
          }
          return u;
        });
        setStaff(cleaned);
      }
      if (rolesRes.data) setRoles(rolesRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load staff list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!fullName || !email || !roleId) {
      setError('Full name, email, and assigned role are required.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.createStaff({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim() || email.split('@')[0],
        password: password || 'Wonark@2026',
        roleId: Number(roleId),
        phone: phone.trim() || null,
      });

      if (res.success) {
        setIsAdding(false);
        setFullName('');
        setEmail('');
        setUsername('');
        setPhone('');
        setSuccessMsg(`Staff member ${fullName} registered successfully!`);
        loadData();
        onRefresh();
      } else {
        setError(res.message || 'Failed to register staff account');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating staff account');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleToggleStatus = async (user: any) => {
    try {
      const newStatus = !user.isActive;
      await api.updateStaffStatus(user.id, newStatus);
      setSuccessMsg(`User ${user.fullName} is now ${newStatus ? 'Active' : 'Suspended'}.`);
      loadData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    }
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleDeleteUser = async (user: any) => {
    if (!window.confirm(`Are you sure you want to delete staff account for "${user.fullName}"?`)) {
      return;
    }

    try {
      const res = await api.deleteStaff(user.id);
      setSuccessMsg(res.message || `Staff account "${user.fullName}" deleted successfully.`);
      loadData();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleResetPassword = async (user: any) => {
    const customPass = window.prompt(`Reset password for ${user.fullName} (${user.email}). Enter new password or leave blank for default (Wonark@2026):`);
    if (customPass === null) return; // user cancelled prompt

    try {
      const res = await api.resetStaffPassword(user.id, customPass.trim() || undefined);
      alert(res.message || `Password for ${user.fullName} reset to: ${res.temporaryPassword}`);
      setSuccessMsg(`Password for ${user.fullName} reset successfully!`);
    } catch (err: any) {
      alert(`Error resetting password: ${err.message}`);
    }
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Manage Staff Accounts</h3>
              <p className="text-[11px] text-slate-500">Configure active employees, assign roles, reset credentials, and audit access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isAdding ? 'View Staff List' : 'Add New Staff'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {isAdding ? (
            /* Add Staff Form */
            <form onSubmit={handleCreateStaff} className="space-y-4 max-w-xl mx-auto py-2">
              <h4 className="font-bold text-sm text-slate-900 mb-2">Register New Employee Account</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Johnson Nketia"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. johnson@wonark.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. jnketia"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 24 000 0000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer bg-white"
                    required
                  >
                    <option value="">Select Role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Password</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isLoading ? 'Saving...' : 'Register Staff Account'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Staff Table */
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-3">Name &amp; Username</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Role &amp; Permissions</th>
                    <th className="py-3 px-3">Last Login</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {staff.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{u.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">@{u.username}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{u.email}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{u.roleName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({u.roleKey || 'standard'})</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {u.lastLoginAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {new Date(u.lastLoginAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Never logged in</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Reset Password */}
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Reset User Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend / Reactivate */}
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              u.isActive
                                ? 'text-amber-700 hover:bg-amber-50 border border-amber-200'
                                : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                            }`}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>

                          {/* Delete Account */}
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Permanently Delete Staff Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

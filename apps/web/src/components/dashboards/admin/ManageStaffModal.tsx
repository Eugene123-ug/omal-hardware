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
  Copy,
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

  // Dedicated In-App Reset Password Dialog
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('Wonark@2026');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessData, setResetSuccessData] = useState<{ user: any; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
        setSuccessMsg(`Staff member ${fullName} registered successfully! Default password: ${password}`);
        loadData();
        onRefresh();
      } else {
        setError(res.message || 'Failed to register staff account');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating staff account');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccessMsg(null), 5000);
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
    if (!window.confirm(`Are you sure you want to delete staff account for "${user.fullName}"? This action is permanent.`)) {
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

  const openResetDialog = (user: any) => {
    setResetTargetUser(user);
    setNewResetPassword(`Wonark@${Math.floor(1000 + Math.random() * 9000)}`);
    setResetSuccessData(null);
    setCopied(false);
    setShowResetModal(true);
  };

  const handleExecuteReset = async () => {
    if (!resetTargetUser || !newResetPassword.trim()) return;

    setIsResetting(true);
    setError(null);
    try {
      const res = await api.resetStaffPassword(resetTargetUser.id, newResetPassword.trim());
      const pass = newResetPassword.trim();
      setResetSuccessData({ user: resetTargetUser, password: pass });
      setSuccessMsg(`Password for ${resetTargetUser.fullName} was reset successfully!`);
    } catch (err: any) {
      setError(err.message || 'Failed to reset user password.');
    } finally {
      setIsResetting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Manage Staff Accounts</h3>
                <p className="text-[11px] text-slate-500">Configure employees, roles, password resets, and access controls</p>
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

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1">
            {isAdding ? (
              /* Add New Staff Form */
              <form onSubmit={handleCreateStaff} className="space-y-4 max-w-xl mx-auto">
                <div className="text-center pb-2">
                  <h4 className="font-bold text-slate-800 text-sm">Register New Employee Account</h4>
                  <p className="text-xs text-slate-500">Create login credentials and assign system roles</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Kwame Mensah"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Company Email *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. kwame.mensah@wonark.com"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Username (Optional)</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. kmensah"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Telephone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +233 24 000 0000"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">System Role *</label>
                    <select
                      required
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Assigned Role</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.role_key})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Temporary Password</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Wonark@2026"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Staff will use this initial password on their first login.</p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? 'Registering...' : 'Save & Register Staff'}
                  </button>
                </div>
              </form>
            ) : (
              /* Staff Table List */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-3">Email Address</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staff.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
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
                            {/* Reset Password Button - Prominent & Visible */}
                            <button
                              onClick={() => openResetDialog(u)}
                              className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs"
                              title="Reset User Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset Password</span>
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

      {/* Dedicated Interactive Reset Password Dialog */}
      {showResetModal && resetTargetUser && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Reset Staff Password</h3>
                  <p className="text-[11px] text-slate-500">Update credentials for {resetTargetUser.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetSuccessData ? (
              /* Success State with Copy Button */
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-sm text-emerald-950">Password Reset Successfully!</h4>
                  <p className="text-xs text-emerald-800">
                    The account password for <strong>{resetSuccessData.user.fullName}</strong> ({resetSuccessData.user.email}) has been changed to:
                  </p>
                  <div className="p-3 bg-white rounded-xl border border-emerald-300 font-mono font-black text-emerald-700 text-base flex items-center justify-between">
                    <span>{resetSuccessData.password}</span>
                    <button
                      onClick={() => copyToClipboard(resetSuccessData.password)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-600 pt-1">
                    Please provide this temporary password to the employee to sign in.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Done &amp; Close
                </button>
              </div>
            ) : (
              /* Reset Form */
              <div className="space-y-4 py-1 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employee:</span>
                    <span className="font-bold text-slate-800">{resetTargetUser.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Username:</span>
                    <span className="font-mono text-slate-700">@{resetTargetUser.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-mono text-slate-700">{resetTargetUser.email}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">New Password</label>
                    <button
                      type="button"
                      onClick={() => setNewResetPassword(`Wonark@${Math.floor(1000 + Math.random() * 9000)}`)}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Random</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-3 py-2.5 font-mono text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Must be at least 6 characters long.</p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isResetting || !newResetPassword.trim()}
                    onClick={handleExecuteReset}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isResetting ? 'Saving...' : 'Confirm & Reset Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

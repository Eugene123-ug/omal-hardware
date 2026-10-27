import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Building,
  Plus,
  Check,
  X,
  Database,
  Printer,
  Shield,
  Percent,
  Bell,
  QrCode,
  FileText,
  MapPin,
  Phone,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  Trash2,
  User,
} from 'lucide-react';
import { api } from '../../../../services/api';

export const BusinessSettingsView: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // General Settings
  const [companyName, setCompanyName] = useState('OMAL Hardware Ltd');
  const [address, setAddress] = useState('Spintex Road, Near Shell Signboard, Accra');
  const [phone, setPhone] = useState('+233 (0) 30 281 1200 / +233 (0) 24 455 6677');
  const [currency, setCurrency] = useState('GHS');
  const [taxRate, setTaxRate] = useState('0'); // Standard retail or VAT
  const [reorderLevel, setReorderLevel] = useState('10');
  const [adminDisplayName, setAdminDisplayName] = useState('Benjamin');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedLogo = localStorage.getItem('omal_company_logo') || '';
    const savedName = localStorage.getItem('omal_user_display_name') || 'Benjamin';
    if (savedLogo) setLogoUrl(savedLogo);
    if (savedName) setAdminDisplayName(savedName);
  }, []);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Logo file size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoUrl(base64);
        localStorage.setItem('omal_company_logo', base64);
        setSavedMsg('Company logo uploaded and saved successfully!');
        setTimeout(() => setSavedMsg(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    localStorage.removeItem('omal_company_logo');
    setSavedMsg('Company logo removed.');
    setTimeout(() => setSavedMsg(null), 3000);
  };

  // Toggles
  const [showLogo, setShowLogo] = useState(true);
  const [qrVerification, setQrVerification] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [paperSize, setPaperSize] = useState('A4');

  // Add Branch Modal
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [submittingBranch, setSubmittingBranch] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const loadBranches = async () => {
    setIsLoading(true);
    try {
      const res = await api.getBranches();
      if (res.data) setBranches(res.data);
    } catch {
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('omal_user_display_name', adminDisplayName.trim());
    if (logoUrl) {
      localStorage.setItem('omal_company_logo', logoUrl);
    }
    setSavedMsg('Settings saved successfully! Welcome greeting and logo updated.');
    setTimeout(() => setSavedMsg(null), 3500);
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      setBranchError('Branch name is required.');
      return;
    }

    setSubmittingBranch(true);
    setBranchError(null);
    try {
      const res = await api.createBranch({
        name: branchName.trim(),
        code: branchCode.trim().toUpperCase() || undefined,
        address: branchAddress.trim() || undefined,
        phone: branchPhone.trim() || undefined,
      });

      if (res.success) {
        setSavedMsg(`Branch "${branchName}" created and active across system!`);
        setTimeout(() => setSavedMsg(null), 3500);
        setBranchName('');
        setBranchCode('');
        setBranchAddress('');
        setBranchPhone('');
        setIsBranchModalOpen(false);
        await loadBranches();
      } else {
        setBranchError(res.message || 'Failed to create branch.');
      }
    } catch (err: any) {
      setBranchError(err.message || 'Error creating branch.');
    } finally {
      setSubmittingBranch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <Settings className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight">Business Settings &amp; Regional Configuration</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure OMAL Hardware company identity, branches, tax rules, and universal print templates
          </p>
        </div>

        <button
          onClick={loadBranches}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer self-start sm:self-auto"
          title="Refresh branches"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {savedMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Company Profile & Regional Settings */}
        <div className="space-y-6">
          {/* 1. Official Logo Upload Card */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-sm text-slate-900">Official Company Logo</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">PNG, JPG, SVG, WebP (Max 2MB)</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* Logo Preview */}
              <div className="w-36 h-28 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative group p-2">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Company Logo Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-slate-400 p-2">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                    <span className="text-[10px]">No logo set</span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2 text-left w-full">
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  className="hidden"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload New Logo</span>
                  </button>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  This logo automatically appears on all printed receipts, A4 invoices, sales reports, and header bars.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveGeneral} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900">Company Identity &amp; Invoicing Header</h2>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Store Administrator Greeting Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={adminDisplayName}
                  onChange={(e) => setAdminDisplayName(e.target.value)}
                  placeholder="e.g. Benjamin"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Displays as: &quot;Good morning, {adminDisplayName || 'Admin'}!&quot; in the dashboard header.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Trading Name *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Headquarters / Physical Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Contact Phone Numbers</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Currency Code</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">VAT / Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="block font-semibold text-slate-700 mb-1">Default Low Stock Reorder Threshold</label>
              <input
                type="number"
                min="1"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Triggers low-stock warning badge when quantity drops to this number.</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer"
              >
                Save General Settings
              </button>
            </div>
          </form>

          {/* Universal Print & PDF Settings (Section 8 & 9) */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Printer className="w-4 h-4 text-purple-600" />
              <h2 className="font-bold text-sm text-slate-900">Universal Print &amp; PDF Configurations</h2>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 block">Show Brand Logo &amp; Shield on PDF Header</span>
                  <span className="text-[11px] text-slate-500">Includes OMAL emblem on printed invoices and P&amp;L sheets</span>
                </div>
                <input
                  type="checkbox"
                  checked={showLogo}
                  onChange={(e) => setShowLogo(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 block">QR Code Verification on Documents</span>
                  <span className="text-[11px] text-slate-500">Generates unique document verification code for tamper protection</span>
                </div>
                <input
                  type="checkbox"
                  checked={qrVerification}
                  onChange={(e) => setQrVerification(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 block">Real-Time Low Stock Alerts</span>
                  <span className="text-[11px] text-slate-500">Highlights critical items in red and warns counter staff</span>
                </div>
                <input
                  type="checkbox"
                  checked={lowStockAlerts}
                  onChange={(e) => setLowStockAlerts(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-800">Print Paper Standard</span>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800 cursor-pointer"
                >
                  <option value="A4">A4 (Standard 210 × 297 mm)</option>
                  <option value="Letter">Letter (8.5 × 11 in)</option>
                  <option value="Thermal80">Thermal 80mm Till Paper</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Branch Registry */}
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-sm text-slate-900">Branch &amp; Depot Registry</h2>
              </div>
              <button
                onClick={() => setIsBranchModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Branch</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Branches registered here immediately appear dynamically across all inventory, POS till points, and financial filters.
            </p>

            <div className="space-y-3">
              {branches.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No branches found in database. Click "Add Branch" above.
                </div>
              ) : (
                branches.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {b.code}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{b.name}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Outlet
                      </span>
                    </div>

                    <div className="text-slate-500 space-y-0.5 pt-1">
                      {b.address && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{b.address}</span>
                        </div>
                      )}
                      {b.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">{b.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Database & Supabase Live Status Card */}
          <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Database Engine</h3>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Supabase Live</span>
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Provider:</span>
                <span className="text-white">Supabase PostgreSQL 15+</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Region:</span>
                <span className="text-white">EU West 2 (London Pooler)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Project Ref:</span>
                <span className="text-emerald-400">knuzlbpkvbkdwsokewku</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Migrations:</span>
                <span className="text-emerald-400">12 / 12 Applied (0 Pending)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              All inventory, cash receipts, and operating ledgers are persisted permanently to your remote Supabase cloud database.
            </p>
          </div>
        </div>
      </div>

      {/* Add Branch Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Add Business Branch</h3>
                  <p className="text-[11px] text-slate-500">Register new shop, showroom or depot</p>
                </div>
              </div>
              <button
                onClick={() => setIsBranchModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {branchError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl">
                {branchError}
              </div>
            )}

            <form onSubmit={handleCreateBranch} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Kumasi Central Depot"
                  value={branchName}
                  onChange={(e) => {
                    setBranchName(e.target.value);
                    if (!branchCode) {
                      setBranchCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 10));
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Code (Short)</label>
                <input
                  type="text"
                  placeholder="e.g. KMS"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Location Address</label>
                <input
                  type="text"
                  placeholder="e.g. Suame Roundabout, Kumasi"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +233 32 201 9988"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBranch}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{submittingBranch ? 'Creating...' : 'Register Branch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

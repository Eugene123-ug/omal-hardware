import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Building,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Shield,
  Percent,
  Bell,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Globe,
  DollarSign,
  Receipt,
} from 'lucide-react';
import { useCompany } from '../../../../context/CompanyContext';

export const BusinessSettingsView: React.FC = () => {
  const { settings, updateSettings, isLoading } = useCompany();

  // Form states initialized from global CompanyContext
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [address, setAddress] = useState(settings.address);
  const [phone1, setPhone1] = useState(settings.phone1);
  const [phone2, setPhone2] = useState(settings.phone2);
  const [email, setEmail] = useState(settings.email);
  const [tin, setTin] = useState(settings.tin);
  const [website, setWebsite] = useState(settings.website);
  const [currency, setCurrency] = useState(settings.currency);
  const [taxRate, setTaxRate] = useState(String(settings.taxRate || 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(settings.defaultLowStockThreshold || 10));
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);
  const [terms, setTerms] = useState(settings.termsAndConditions);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setLogoUrl(settings.logoUrl);
    setAddress(settings.address);
    setPhone1(settings.phone1);
    setPhone2(settings.phone2);
    setEmail(settings.email);
    setTin(settings.tin);
    setWebsite(settings.website);
    setCurrency(settings.currency);
    setTaxRate(String(settings.taxRate || 0));
    setLowStockThreshold(String(settings.defaultLowStockThreshold || 10));
    setReceiptFooter(settings.receiptFooter);
    setTerms(settings.termsAndConditions);
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Logo file size must be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoUrl(base64);
        setMsg({ type: 'success', text: 'Logo uploaded. Click "Save Settings" below to publish company-wide.' });
        setTimeout(() => setMsg(null), 4000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    setMsg({ type: 'success', text: 'Logo removed. Click "Save Settings" below to apply.' });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setMsg({ type: 'error', text: 'Company Name is strictly required.' });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      await updateSettings({
        companyName: companyName.trim(),
        logoUrl,
        address: address.trim(),
        phone1: phone1.trim(),
        phone2: phone2.trim(),
        email: email.trim(),
        tin: tin.trim(),
        website: website.trim(),
        currency,
        taxRate: Number(taxRate) || 0,
        defaultLowStockThreshold: Number(lowStockThreshold) || 10,
        receiptFooter: receiptFooter.trim(),
        termsAndConditions: terms.trim(),
      });

      setMsg({
        type: 'success',
        text: 'Business settings saved successfully! Company name, branding & parameters updated everywhere instantly.',
      });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Business Profile &amp; Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize company name, logo, tax rates, currency, and printed receipt policies for any buyer
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm self-start sm:self-auto"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving Settings...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Message notification */}
      {msg && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Company Identity & Logo */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              1. Company Identity &amp; Branding
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Whatever you enter here instantly updates the sidebar logo area, login typewriter animation, A5 receipts, and A4 reports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Logo Preview & Upload */}
            <div className="flex flex-col items-center p-4 border border-slate-200 rounded-xl bg-slate-50/60 text-center">
              <span className="text-xs font-bold text-slate-700 mb-3">Official Company Logo</span>
              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden relative shadow-xs">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center text-slate-400 p-2">
                    <Building className="w-8 h-8 mb-1" />
                    <span className="text-[10px] font-semibold">No logo uploaded</span>
                  </div>
                )}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="Remove Logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-2">PNG, JPG or SVG &bull; Max 2MB</span>
            </div>

            {/* Company Name & Registration */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company Legal Name <span className="text-red-500">* (Global Dynamic Variable)</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. WONARK COMPANY LIMITED"
                  className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Displayed on sidebar top, login animation, POS headers, A5 receipts, and A4 reports.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">TIN / Ghana Card / Reg No</label>
                  <input
                    type="text"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="e.g. C0001234567 / GHA-..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Website</label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="e.g. www.wonark.com"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Headquarters Location */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              2. Headquarters Address &amp; Contact Numbers
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Contact coordinates printed on receipts and legal purchase invoices
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Headquarters Physical Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Commercial Industrial Area, Greater Accra, Ghana"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telephone Line 1</label>
              <input
                type="text"
                value={phone1}
                onChange={(e) => setPhone1(e.target.value)}
                placeholder="e.g. +233 (0) 30 281 1200"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telephone Line 2 / MoMo Helpline</label>
              <input
                type="text"
                value={phone2}
                onChange={(e) => setPhone2(e.target.value)}
                placeholder="e.g. +233 (0) 24 455 6677"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Official Business Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. sales@wonark.com"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Financial & Operational Parameters */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-purple-600" />
              3. Financial Parameters &amp; Inventory Thresholds
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Default Currency Code</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="GHS">GHS (Ghana Cedi, GH₵)</option>
                <option value="USD">USD (US Dollar, $)</option>
                <option value="EUR">EUR (Euro, €)</option>
                <option value="GBP">GBP (British Pound, £)</option>
                <option value="NGN">NGN (Nigerian Naira, ₦)</option>
                <option value="XOF">XOF (CFA Franc)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Standard VAT / Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="25"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Set 0 for tax-exempt retail</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Default Low Stock Reorder Level</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Default alert trigger: 10 units</span>
            </div>
          </div>
        </div>

        {/* Section 4: Receipt & Invoice Terms */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-600" />
              4. Client Receipt &amp; Invoice Terms
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Custom text printed at the bottom of client A5 sales slips and A4 invoices
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Footer Message</label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="e.g. Thank you for your business! Please visit again."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Terms &amp; Conditions</label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="e.g. Goods sold in good condition are not returnable after 7 days. Breakages during customer transport are at buyer's risk."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Updating Business Settings...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save Business Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

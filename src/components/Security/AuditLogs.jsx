import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { 
  ShieldCheck, History, AlertTriangle, CheckCircle2, 
  Trash2, RefreshCw, KeyRound, Lock, Search, FileText
} from 'lucide-react';

export default function AuditLogs() {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('audit'); // 'audit', 'prices', 'integrity'
  const [auditLogs, setAuditLogs] = useState([]);
  const [priceLogs, setPriceLogs] = useState([]);
  const [integrityData, setIntegrityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('All');

  const loadData = async () => {
    setLoading(true);
    try {
      const [logs, prices, integrity] = await Promise.all([
        apiRequest(`/audit/logs${filterAction !== 'All' ? `?action=${filterAction}` : ''}`),
        apiRequest('/audit/price-changes'),
        isSuperAdmin ? apiRequest('/audit/receipt-integrity-check') : Promise.resolve(null)
      ]);
      setAuditLogs(logs);
      setPriceLogs(prices);
      setIntegrityData(integrity);
    } catch (err) {
      console.error('Failed to load audit data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterAction]);

  const handlePurgeLogs = async () => {
    if (!isSuperAdmin) {
      alert('Only Super Admin can purge audit logs.');
      return;
    }
    if (confirm('Are you sure you want to purge audit logs older than 90 days?')) {
      try {
        const res = await apiRequest('/audit/logs/purge', {
          method: 'DELETE',
          body: JSON.stringify({ older_than_days: 90 })
        });
        alert(res.message);
        loadData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <span>Anti-Theft Surveillance & Audit Trail</span>
          </h2>
          <div className="text-xs text-slate-400">
            Immutable log of logins, price changes, deletions & receipt gap checks
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button
              onClick={handlePurgeLogs}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge &gt; 90 Days</span>
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold space-x-4">
        {[
          { id: 'audit', label: 'Activity Logs', icon: History },
          { id: 'prices', label: 'Price Change History', icon: KeyRound },
          { id: 'integrity', label: 'Receipt Gap & Sequential Check', icon: FileText }
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

      {/* TAB 1: SYSTEM ACTIVITY LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          {/* Action filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {['All', 'LOGIN', 'SALE_CREATED', 'PRICE_CHANGED', 'STOCK_ADJUSTED', 'CASH_CLOSING', 'USER_CREATED'].map(act => (
              <button
                key={act}
                onClick={() => setFilterAction(act)}
                className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  filterAction === act
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}>
                {act}
              </button>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Staff / User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Action Type</th>
                    <th className="px-4 py-3">Action Details</th>
                    <th className="px-4 py-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {auditLogs.map(l => (
                    <tr key={l.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{l.user_name}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] uppercase font-mono">
                          {l.user_role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          l.action.includes('SALE') 
                            ? 'bg-emerald-500/15 text-emerald-300' 
                            : l.action.includes('PRICE') 
                            ? 'bg-amber-500/15 text-amber-300' 
                            : l.action.includes('ADJUST') 
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-blue-500/15 text-blue-300'
                        }`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{l.details}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{l.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRICE CHANGE LOGS */}
      {activeTab === 'prices' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3 text-right">Old Selling (GH₵)</th>
                  <th className="px-4 py-3 text-right">New Selling (GH₵)</th>
                  {isSuperAdmin && <th className="px-4 py-3 text-right">Old Cost (GH₵)</th>}
                  {isSuperAdmin && <th className="px-4 py-3 text-right">New Cost (GH₵)</th>}
                  <th className="px-4 py-3">Changed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {priceLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      No price changes recorded yet.
                    </td>
                  </tr>
                ) : (
                  priceLogs.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{p.product_name}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        GH₵ {p.old_selling_price?.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                        GH₵ {p.new_selling_price?.toFixed(2)}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          GH₵ {p.old_cost_price?.toFixed(2)}
                        </td>
                      )}
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-300">
                          GH₵ {p.new_cost_price?.toFixed(2)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-300">{p.changed_by_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RECEIPT INTEGRITY CHECK */}
      {activeTab === 'integrity' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Sequential Receipt Integrity Status</h3>
                <p className="text-xs text-slate-400">
                  Verifies that every single sale has an unbroken sequential receipt number (e.g. REC-20261024-0001, REC-20261024-0002) with zero deletions or missing transactions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                <span className="text-xs text-slate-400 block">Total Receipts Audited</span>
                <span className="text-2xl font-bold text-white font-mono mt-1">
                  {integrityData?.total_sales_checked || 0} sales
                </span>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                <span className="text-xs text-slate-400 block">Sequence Integrity</span>
                <span className="text-lg font-bold text-emerald-400 mt-1 block">
                  {integrityData?.intact ? '100% Intact - No Gaps' : 'Gap Warning Detected'}
                </span>
              </div>
            </div>

            {integrityData?.missing_receipt_gaps?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-xs text-red-200">
                <div className="font-bold mb-1">Missing Receipts Detected:</div>
                <div className="font-mono">{integrityData.missing_receipt_gaps.join(', ')}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import * as XLSX from 'xlsx';
import { 
  BarChart3, TrendingUp, Users, DollarSign, Download, 
  Calendar, Award, AlertTriangle, ShieldCheck
} from 'lucide-react';

export default function ReportsHub() {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('profit'); // 'profit', 'staff'
  const [profitLossData, setProfitLossData] = useState(null);
  const [staffData, setStaffData] = useState([]);
  const [period, setPeriod] = useState('monthly'); // 'daily', 'monthly', 'yearly'
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [pl, st] = await Promise.all([
        isSuperAdmin ? apiRequest(`/reports/profit-loss?period=${period}`) : Promise.resolve(null),
        apiRequest('/reports/staff-performance')
      ]);
      setProfitLossData(pl);
      setStaffData(st);
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [period]);

  const exportStaffExcel = () => {
    const ws = XLSX.utils.json_to_sheet(staffData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Performance');
    XLSX.writeFile(wb, `omal_staff_performance_${Date.now()}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            <span>Executive Business Analytics & Performance</span>
          </h2>
          <div className="text-xs text-slate-400">
            Profit & loss analysis, sales performance & staff cashier accountability
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'profit' && isSuperAdmin && (
            <div className="flex bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              {['daily', 'monthly', 'yearly'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-lg capitalize transition-colors ${
                    period === p ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'staff' && (
            <button
              onClick={exportStaffExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold">
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold space-x-4">
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('profit')}
            className={`flex items-center gap-1.5 py-2.5 border-b-2 transition-all ${
              activeTab === 'profit'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}>
            <TrendingUp className="w-4 h-4" />
            <span>Profit & Loss (P&L Breakdown)</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-1.5 py-2.5 border-b-2 transition-all ${
            activeTab === 'staff'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}>
          <Users className="w-4 h-4" />
          <span>Staff Performance & Discrepancies</span>
        </button>
      </div>

      {/* 1. PROFIT & LOSS BREAKDOWN (SUPER ADMIN ONLY) */}
      {activeTab === 'profit' && isSuperAdmin && profitLossData && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Sales Revenue</span>
              <div className="text-xl font-bold text-white font-mono mt-1">
                GH₵ {profitLossData.summary?.total_sales.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Cost of Goods Sold (COGS)</span>
              <div className="text-xl font-bold text-slate-400 font-mono mt-1">
                GH₵ {profitLossData.summary?.total_cogs.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Shop Operating Expenses</span>
              <div className="text-xl font-bold text-red-400 font-mono mt-1">
                GH₵ {profitLossData.summary?.total_expenses.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Company Net Profit</span>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                GH₵ {profitLossData.summary?.net_profit.toFixed(2)}
              </div>
              <span className="text-[10px] text-emerald-500 font-semibold">
                Net Margin: {profitLossData.summary?.net_margin_pct}%
              </span>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 font-bold text-xs text-white">
              P&L Timeline Breakdown ({period})
            </div>
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Period</th>
                  <th className="px-4 py-2.5 text-center">Orders</th>
                  <th className="px-4 py-2.5 text-right">Revenue (GH₵)</th>
                  <th className="px-4 py-2.5 text-right">COGS (GH₵)</th>
                  <th className="px-4 py-2.5 text-right">Gross Profit (GH₵)</th>
                  <th className="px-4 py-2.5 text-right">Expenses (GH₵)</th>
                  <th className="px-4 py-2.5 text-right">Net Profit (GH₵)</th>
                  <th className="px-4 py-2.5 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {profitLossData.breakdown?.map(row => (
                  <tr key={row.period} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-semibold text-white">{row.period}</td>
                    <td className="px-4 py-3 text-center font-mono">{row.orders}</td>
                    <td className="px-4 py-3 text-right font-mono text-white font-semibold">
                      GH₵ {row.sales.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      GH₵ {row.cost_of_goods.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-400">
                      GH₵ {row.gross_profit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">
                      GH₵ {row.expenses.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                      GH₵ {row.net_profit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">
                      {row.margin_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. STAFF PERFORMANCE & AUDIT */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 font-bold text-xs text-white flex justify-between items-center">
              <span>Staff Performance Leaderboard</span>
              <span className="text-[11px] text-slate-400">Ranked by Total Revenue Generated</span>
            </div>
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-center">Sales Closed</th>
                  <th className="px-4 py-3 text-right">Revenue Sold (GH₵)</th>
                  <th className="px-4 py-3 text-right">Discounts Given (GH₵)</th>
                  <th className="px-4 py-3 text-right">Avg Discount %</th>
                  <th className="px-4 py-3 text-right">Cash Shortages (GH₵)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {staffData.map((s, idx) => {
                  const hasShortage = s.total_cash_shortages > 0;
                  return (
                    <tr key={s.staff_id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-white">{s.staff_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] uppercase">
                          {s.staff_role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-white">
                        {s.total_sales_count}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 text-sm">
                        GH₵ {s.total_revenue.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        GH₵ {s.total_discounts_given.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {s.avg_discount_pct.toFixed(1)}%
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${hasShortage ? 'text-red-400' : 'text-emerald-400'}`}>
                        {hasShortage ? `GH₵ ${s.total_cash_shortages.toFixed(2)}` : 'GH₵ 0.00'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

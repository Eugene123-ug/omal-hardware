import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Building,
  Search,
  Download,
  Printer,
  RefreshCw,
  ShoppingBag,
  ArrowUpRight,
  Receipt,
  Layers,
  Trash2,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { formatGHS } from '../../../../utils/currency';
import { PrintPreviewModal } from '../../common/PrintPreviewModal';

interface IncomeReportsViewProps {
  currentUser?: any;
}

export const IncomeReportsView: React.FC<IncomeReportsViewProps> = ({ currentUser }) => {
  const [sales, setSales] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const branchParam = selectedBranch === 'all' ? undefined : Number(selectedBranch);
      const [salesRes, branchRes, catRes] = await Promise.all([
        api.getSales({ branchId: branchParam }),
        api.getBranches().catch(() => ({ data: [] })),
        api.getCategories().catch(() => ({ data: [] })),
      ]);

      setSales(salesRes.data?.sales || salesRes.data || []);
      setBranches(branchRes.data || []);
      setCategories(catRes.data || []);
    } catch {
      setSales([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranch]);

  // Flatten sale items into detailed transaction rows
  const detailedTransactions = useMemo(() => {
    const rows: any[] = [];
    for (const s of sales) {
      const dateStr = (s.sale_date || s.saleDate || '').slice(0, 10);
      if (startDate && dateStr < startDate) continue;
      if (endDate && dateStr > endDate) continue;

      const items = (s.items && s.items.length > 0) ? s.items : [
        {
          product_name: 'Hardware Item',
          quantity: 1,
          unit_cost: 0,
          unit_price: Number(s.totalAmount || s.total_amount || 0),
          line_total: Number(s.totalAmount || s.total_amount || 0),
        },
      ];

      for (const it of items) {
        const prodName = it.product_name || it.name || 'Hardware Item';
        const qty = Number(it.quantity || 1);
        const costPrice = Number(it.unit_cost ?? it.unitCost ?? 0);
        const sellPrice = Number(it.unit_price ?? it.unitPrice ?? (qty > 0 ? (it.line_total || it.lineTotal || 0) / qty : 0));
        const income = Number(it.line_total ?? it.lineTotal ?? (qty * sellPrice));
        const profit = income - (qty * costPrice);

        rows.push({
          id: `${s.id}-${it.product_id || it.productId || Math.random()}`,
          saleId: s.id,
          date: dateStr,
          saleNumber: s.sale_number || s.saleNumber,
          receiptNumber: s.receipt_number || s.receiptNumber,
          branchName: s.branch_name || s.branchName || 'Accra Showroom',
          productName: prodName,
          categoryName: it.category_name || 'Hardware',
          qty,
          costPrice,
          sellPrice,
          income,
          profit,
          cashierName: s.cashier_name || s.cashierName || 'Counter Till',
        });
      }
    }
    return rows;
  }, [sales, startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    return detailedTransactions.filter((t) => {
      const matchSearch =
        t.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.saleNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'all' || t.categoryName === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [detailedTransactions, searchQuery, selectedCategory]);

  const canDelete = ['administrator', 'admin', 'owner'].includes((currentUser?.role || '').toLowerCase());

  const handleDeleteSale = async (saleId: number, ref: string) => {
    if (!saleId) return;
    if (
      !window.confirm(
        `Are you sure you want to void and delete Sale #${ref}? This action is restricted to Administrators and will automatically return the sold units back into stock.`,
      )
    ) {
      return;
    }

    try {
      await api.deleteSale(saleId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete sale transaction.');
    }
  };

  const totalIncome = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => acc + t.income, 0);
  }, [filteredTransactions]);

  const totalQtySold = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => acc + t.qty, 0);
  }, [filteredTransactions]);

  const totalProfit = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => acc + t.profit, 0);
  }, [filteredTransactions]);

  // Group by date for daily chart / timeline
  const dailyIncomeMap = useMemo(() => {
    const map = new Map<string, { date: string; income: number; count: number }>();
    for (const t of filteredTransactions) {
      const prev = map.get(t.date) || { date: t.date, income: 0, count: 0 };
      prev.income += t.income;
      prev.count += t.qty;
      map.set(t.date, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions]);

  const exportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ['Sale Ref', 'Date', 'Product', 'Branch', 'Quantity', 'Cost Price (GHS)', 'Selling Price (GHS)', 'Income (GHS)', 'Gross Profit (GHS)'];
    const rows = filteredTransactions.map((t) => [
      t.saleNumber,
      t.date,
      `"${t.productName.replace(/"/g, '""')}"`,
      `"${t.branchName.replace(/"/g, '""')}"`,
      t.qty,
      t.costPrice.toFixed(2),
      t.sellPrice.toFixed(2),
      t.income.toFixed(2),
      t.profit.toFixed(2),
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `omal_income_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight">Income &amp; Daily Sales Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit realization by date, product units sold, and counter revenues
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh income"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredTransactions.length === 0}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Income Report</span>
          </button>
        </div>
      </div>

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Realized Income</span>
          <div className="text-2xl font-black text-slate-900 mt-2">{formatGHS(totalIncome)}</div>
          <p className="text-[11px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Gross customer counter receipts</span>
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Quantity Sold</span>
          <div className="text-2xl font-black text-blue-600 mt-2">{totalQtySold} units</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Physical items dispatched</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Gross Trade Profit</span>
          <div className="text-2xl font-black text-emerald-600 mt-2">{formatGHS(totalProfit)}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Sum of (Selling − Cost) × Qty</p>
        </div>
      </div>

      {/* Daily Income Bars Chart */}
      {dailyIncomeMap.length > 0 && (
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Income Realization by Date
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Daily Inflow</span>
          </div>
          <div className="space-y-2">
            {dailyIncomeMap.map((d) => {
              const maxIncome = Math.max(...dailyIncomeMap.map((x) => x.income), 1);
              const percentage = Math.round((d.income / maxIncome) * 100);
              return (
                <div key={d.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{d.date}</span>
                    <span className="font-mono text-slate-900">
                      <strong>{formatGHS(d.income)}</strong> ({d.count} items)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name or sale ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none"
            />
          </div>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Income Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Loading sales transactions from database...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-800">No Transactions for this Period</h3>
            <p className="text-slate-400 mt-1">
              Zero sales logged between {startDate} and {endDate}. Completed counter sales will appear dynamically here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Sale Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Cost Price (GHS)</th>
                  <th className="py-3 px-4 text-right">Selling Price (GHS)</th>
                  <th className="py-3 px-4 text-right">Total Income (GHS)</th>
                  <th className="py-3 px-4 text-right">Profit (GHS)</th>
                  {canDelete && <th className="py-3 px-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{t.saleNumber}</td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{t.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{t.productName}</td>
                    <td className="py-3 px-4 text-slate-500">{t.branchName}</td>
                    <td className="py-3 px-4 text-center font-black">{t.qty}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{t.costPrice.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900">{t.sellPrice.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{t.income.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">
                      +{t.profit.toFixed(2)}
                    </td>
                    {canDelete && (
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteSale(t.saleId, t.saleNumber || t.receiptNumber)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Admin: Void & Delete Sale"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Universal Print Modal */}
      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="INCOME & SALES REPORT"
        period={`${startDate} to ${endDate}`}
        dataRows={filteredTransactions.map((t) => ({
          ref: t.saleNumber,
          date: t.date,
          product: t.productName,
          branch: t.branchName,
          qty: t.qty,
          sellPrice: t.sellPrice.toFixed(2),
          income: t.income.toFixed(2),
          profit: t.profit.toFixed(2),
        }))}
        columns={[
          { key: 'ref', header: 'Sale Ref' },
          { key: 'date', header: 'Date' },
          { key: 'product', header: 'Product' },
          { key: 'branch', header: 'Branch' },
          { key: 'qty', header: 'Qty', align: 'center' },
          { key: 'sellPrice', header: 'Sell (GHS)', align: 'right' },
          { key: 'income', header: 'Income (GHS)', align: 'right' },
          { key: 'profit', header: 'Profit (GHS)', align: 'right' },
        ]}
        totals={[
          { label: 'Total Units Sold', value: String(totalQtySold) },
          { label: 'Total Realized Income', value: formatGHS(totalIncome) },
          { label: 'Total Gross Profit', value: formatGHS(totalProfit) },
        ]}
      />
    </div>
  );
};

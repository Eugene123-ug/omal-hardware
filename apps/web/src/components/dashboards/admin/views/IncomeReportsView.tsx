import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Search,
  Download,
  Printer,
  RefreshCw,
  ShoppingBag,
  ArrowUpRight,
  Receipt,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { formatGHS } from '../../../../utils/currency';
import { useCompany } from '../../../../context/CompanyContext';
import { exportToPdfA4, exportToExcel } from '../../../../utils/excelTemplates';

interface IncomeReportsViewProps {
  currentUser?: any;
}

export const IncomeReportsView: React.FC<IncomeReportsViewProps> = ({ currentUser }) => {
  const { companyName, companyAddress, companyPhone, currency } = useCompany();
  const [sales, setSales] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [salesRes, catRes] = await Promise.all([
        api.getSales(),
        api.getCategories().catch(() => ({ data: [] })),
      ]);

      setSales(salesRes.data?.sales || salesRes.data || []);
      setCategories(catRes.data || []);
    } catch {
      setSales([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Flatten sale items into detailed transaction rows
  const detailedTransactions = useMemo(() => {
    const rows: any[] = [];
    for (const s of sales) {
      const dateStr = (s.sale_date || s.saleDate || s.created_at || '').slice(0, 10);
      if (startDate && dateStr < startDate) continue;
      if (endDate && dateStr > endDate) continue;

      const items = (s.items && s.items.length > 0) ? s.items : [
        {
          product_name: s.product_name || 'Hardware Item',
          quantity: 1,
          unit_cost: 0,
          unit_price: Number(s.total_amount || s.totalAmount || 0),
          line_total: Number(s.total_amount || s.totalAmount || 0),
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
          receiptNumber: s.receipt_no || s.receipt_number || `REC-${s.id}`,
          customerName: s.customer_name || 'Walk-in',
          cashierName: s.cashier_name || 'Staff',
          productName: prodName,
          category: it.category_name || it.category || 'General Hardware',
          quantity: qty,
          costPrice,
          sellingPrice: sellPrice,
          income,
          profit,
        });
      }
    }
    return rows;
  }, [sales, startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    return detailedTransactions.filter((t) => {
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.productName.toLowerCase().includes(q) ||
          t.receiptNumber.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [detailedTransactions, selectedCategory, searchQuery]);

  const totalIncome = useMemo(
    () => filteredTransactions.reduce((acc, t) => acc + t.income, 0),
    [filteredTransactions],
  );

  const totalProfit = useMemo(
    () => filteredTransactions.reduce((acc, t) => acc + t.profit, 0),
    [filteredTransactions],
  );

  const totalUnits = useMemo(
    () => filteredTransactions.reduce((acc, t) => acc + t.quantity, 0),
    [filteredTransactions],
  );

  const handleExportPdf = () => {
    const columns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Receipt #', dataKey: 'receipt' },
      { header: 'Product Item', dataKey: 'product' },
      { header: 'Qty', dataKey: 'qty' },
      { header: 'Price (GHS)', dataKey: 'price' },
      { header: 'Income (GHS)', dataKey: 'income' },
      { header: 'Gross Profit (GHS)', dataKey: 'profit' },
    ];

    const data = filteredTransactions.map((t) => ({
      date: t.date,
      receipt: t.receiptNumber,
      product: t.productName,
      qty: t.quantity,
      price: t.sellingPrice.toFixed(2),
      income: t.income.toFixed(2),
      profit: t.profit.toFixed(2),
    }));

    exportToPdfA4({
      title: 'Commercial Income & Revenue Audit',
      companyName,
      companyAddress,
      companyPhone,
      dateRange: `${startDate} to ${endDate}`,
      columns,
      data,
      summary: [
        { label: 'Total Volume Sold', value: `${totalUnits} units` },
        { label: 'Total Gross Revenue', value: formatGHS(totalIncome) },
        { label: 'Total Commercial Profit', value: formatGHS(totalProfit) },
      ],
      filename: `${companyName.replace(/\s+/g, '_')}_Income_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const handleExportExcel = () => {
    const exportData = filteredTransactions.map((t) => ({
      Date: t.date,
      'Receipt No': t.receiptNumber,
      Product: t.productName,
      Quantity: t.quantity,
      'Cost Price (GHS)': t.costPrice,
      'Selling Price (GHS)': t.sellingPrice,
      'Income (GHS)': t.income,
      'Gross Profit (GHS)': t.profit,
    }));
    exportToExcel(exportData, `${companyName.replace(/\s+/g, '_')}_Income_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight">Income &amp; Revenue Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Realized income, gross sales volume and trade profit margins for {companyName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF (A4)</span>
          </button>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Gross Realized Income</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{formatGHS(totalIncome)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Total revenue collected</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Gross Trade Profit</span>
          <div className="text-2xl font-black text-blue-700 mt-1">{formatGHS(totalProfit)}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Margin: {totalIncome > 0 ? ((totalProfit / totalIncome) * 100).toFixed(1) : 0}%
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Physical Units Sold</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalUnits}</div>
          <p className="text-[11px] text-slate-400 mt-1">Across all hardware lines</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
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

          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search product or receipt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div className="text-slate-500 font-medium">
          Showing <strong>{filteredTransactions.length}</strong> line items
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading income ledger...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Income Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Sales transactions for the selected date range will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Selling Price ({currency})</th>
                  <th className="py-3 px-4 text-right">Income ({currency})</th>
                  <th className="py-3 px-4 text-right">Profit ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">{t.date}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">{t.receiptNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{t.productName}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{t.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      GH₵ {t.sellingPrice.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      GH₵ {t.income.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                      GH₵ {t.profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

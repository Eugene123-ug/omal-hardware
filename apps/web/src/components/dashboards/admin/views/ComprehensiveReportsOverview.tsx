import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  CreditCard,
  AlertTriangle,
  Award,
  Calendar,
  Building,
  Printer,
  Download,
  RefreshCw,
  ShoppingBag,
  ArrowUpRight,
  PieChart as PieIcon,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { formatGHS } from '../../../../utils/currency';
import { useCompany } from '../../../../context/CompanyContext';
import { exportToPdfA4, exportToExcel } from '../../../../utils/excelTemplates';

export const ComprehensiveReportsOverview: React.FC = () => {
  const { companyName, companyAddress, companyPhone, currency } = useCompany();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [plData, setPlData] = useState<any | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [plRes, prodRes] = await Promise.all([
        api.getProfitLoss({
          startDate: `${startDate}T00:00:00.000Z`,
          endDate: `${endDate}T23:59:59.999Z`,
        }),
        api.getProducts(),
      ]);

      setPlData(plRes.data || null);
      setProducts(prodRes.data || []);
    } catch {
      setPlData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const totalIncome = Number(plData?.totalRevenue || 0);
  const totalCOGS = Number(plData?.costOfGoodsSold || 0);
  const grossProfit = Number(plData?.grossProfit || (totalIncome - totalCOGS));
  const totalOperatingExpenses = Number(plData?.operatingExpenses || 0);
  const netProfit = Number(plData?.netProfit || (grossProfit - totalOperatingExpenses));

  const totalStockValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.quantity ?? p.totalOnHand ?? 0) * Number(p.cost_price || 0)), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      const onHand = Number(p.quantity ?? p.totalOnHand ?? 0);
      const thresh = Number(p.min_stock_alert || 10);
      return onHand <= thresh;
    }).length;
  }, [products]);

  const bestProduct = plData?.bestProduct || null;
  const expensesByCategory = plData?.expensesByCategory || [];
  const transactions = plData?.transactionBreakdown || [];

  const handleDownloadPdf = () => {
    const columns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Product Name', dataKey: 'product' },
      { header: 'Quantity Sold', dataKey: 'qty' },
      { header: 'Revenue (GHS)', dataKey: 'income' },
      { header: 'Gross Profit (GHS)', dataKey: 'profit' },
    ];

    const data = transactions.map((t: any) => ({
      date: new Date(t.sale_date).toLocaleDateString('en-GB'),
      product: t.product_name,
      qty: t.quantity,
      income: Number(t.income || 0).toFixed(2),
      profit: Number(t.gross_profit || 0).toFixed(2),
    }));

    exportToPdfA4({
      title: 'Executive Business Performance & Audit Report',
      companyName,
      companyAddress,
      companyPhone,
      dateRange: `${startDate} to ${endDate}`,
      columns,
      data,
      summary: [
        { label: 'Total Gross Revenue', value: formatGHS(totalIncome) },
        { label: 'Total Cost of Goods (COGS)', value: formatGHS(totalCOGS) },
        { label: 'Gross Trade Margin', value: formatGHS(grossProfit) },
        { label: 'Operating Expenses', value: formatGHS(totalOperatingExpenses) },
        { label: 'Net Profit', value: formatGHS(netProfit) },
        { label: 'Current Inventory Valuation', value: formatGHS(totalStockValue) },
      ],
      filename: `${companyName.replace(/\s+/g, '_')}_Executive_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const handleExportExcel = () => {
    const data = transactions.map((t: any) => ({
      Date: new Date(t.sale_date).toLocaleDateString('en-GB'),
      Product: t.product_name,
      Quantity: t.quantity,
      'Revenue (GHS)': Number(t.income || 0),
      'Profit (GHS)': Number(t.gross_profit || 0),
    }));
    exportToExcel(data, `${companyName.replace(/\s+/g, '_')}_Executive_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight">Executive Business &amp; Operations Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Consolidated commercial audit across Sales, Income, Profit, Expenses and Inventory for {companyName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh reports"
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
            onClick={handleDownloadPdf}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF (A4)</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">Reporting Range:</span>
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
        </div>

        <div className="text-slate-500 font-medium">
          Company Store: <strong className="text-emerald-700 font-semibold">{companyName}</strong>
        </div>
      </div>

      {/* 6 Dynamic Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Sales / Transactions */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
            Total Sales
          </span>
          <div className="text-xl font-black text-slate-900 mt-1">{transactions.length}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Counter receipts</p>
        </div>

        {/* 2. Income */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
            Total Income
          </span>
          <div className="text-xl font-black text-emerald-700 mt-1">{formatGHS(totalIncome)}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Gross revenue</p>
        </div>

        {/* 3. Profit */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
            Net Profit
          </span>
          <div className={`text-xl font-black mt-1 ${netProfit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {formatGHS(netProfit)}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Commercial margin</p>
        </div>

        {/* 4. Stock Value */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
            Physical Stock
          </span>
          <div className="text-xl font-black text-blue-700 mt-1">{formatGHS(totalStockValue)}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">{products.length} catalog items</p>
        </div>

        {/* 5. Expenses */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
            Expenses
          </span>
          <div className="text-xl font-black text-purple-700 mt-1">{formatGHS(totalOperatingExpenses)}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Operating outflows</p>
        </div>

        {/* 6. Low Stock */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider block truncate">
            Low Stock Alert
          </span>
          <div className="text-xl font-black text-amber-600 mt-1">{lowStockCount}</div>
          <p className="text-[10px] text-amber-600/80 mt-0.5">Below threshold</p>
        </div>
      </div>

      {/* Best Product Banner if sold */}
      {bestProduct && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Top Performing Product (Period Champion)
              </span>
              <h3 className="font-bold text-sm text-slate-900">{bestProduct.name}</h3>
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="font-black text-amber-900">{bestProduct.quantity} units sold</div>
            <div className="text-slate-500 font-mono">{formatGHS(bestProduct.income)} gross sales</div>
          </div>
        </div>
      )}

      {/* Row: Expense Distribution + Commercial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-500" />
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Operating Cost Breakdown
              </h3>
            </div>
            <span className="font-mono text-xs text-slate-500">{formatGHS(totalOperatingExpenses)}</span>
          </div>

          {expensesByCategory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No operating expenses recorded for this period.
            </div>
          ) : (
            <div className="space-y-3">
              {expensesByCategory.map((c: any) => (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{c.category}</span>
                    <span className="font-mono text-slate-900">
                      <strong>{formatGHS(c.amount)}</strong> ({c.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-500"
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* P&L Snapshot */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Commercial Performance Summary
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                Formula Engine
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Total Billed Inflows</span>
                <span className="font-mono font-bold text-slate-900">{formatGHS(totalIncome)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Total Product Cost (COGS)</span>
                <span className="font-mono text-amber-700 font-semibold">− {formatGHS(totalCOGS)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Gross Trade Margin</span>
                <span className="font-mono font-bold text-emerald-700">{formatGHS(grossProfit)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Store Operating Expenses</span>
                <span className="font-mono text-purple-700 font-semibold">− {formatGHS(totalOperatingExpenses)}</span>
              </div>
              <div className="flex justify-between py-2 font-black text-sm bg-slate-50 px-3 rounded-xl">
                <span>Net Bottom Line</span>
                <span className={`font-mono ${netProfit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatGHS(netProfit)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
            Calculated as Gross Revenue − COGS − Operational Expenses.
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Building,
  RefreshCw,
  Printer,
  Download,
  Info,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  PieChart,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { formatGHS } from '../../../../utils/currency';
import { PrintPreviewModal } from '../../common/PrintPreviewModal';

interface ProfitAndLossViewProps {
  currentUser?: any;
}

export const ProfitAndLossView: React.FC<ProfitAndLossViewProps> = () => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState<string>('all');
  const [branches, setBranches] = useState<any[]>([]);

  const [plData, setPlData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCalculated, setLastCalculated] = useState<string>('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Pagination for transactions
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const branchParam = branchId === 'all' ? undefined : Number(branchId);
      const [plRes, branchRes] = await Promise.all([
        api.getProfitLoss({
          startDate: `${startDate}T00:00:00.000Z`,
          endDate: `${endDate}T23:59:59.999Z`,
          branchId: branchParam,
        }),
        api.getBranches().catch(() => ({ data: [] })),
      ]);

      setPlData(plRes.data || null);
      if (branchRes.data) setBranches(branchRes.data);
      setLastCalculated(new Date().toLocaleTimeString('en-GH'));
    } catch {
      setPlData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, branchId]);

  // Variables bound dynamically from database queries
  const totalRevenue = Number(plData?.totalRevenue || 0);
  const totalCOGS = Number(plData?.costOfGoodsSold || 0);
  const grossProfit = Number(plData?.grossProfit || (totalRevenue - totalCOGS));
  const operatingExpenses = Number(plData?.operatingExpenses || 0);
  const netProfit = Number(plData?.netProfit || (grossProfit - operatingExpenses));
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const cogsPercent = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
  const isLoss = netProfit < 0;

  const transactions = plData?.transactionBreakdown || [];
  const expensesByCategory = plData?.expensesByCategory || [];

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return transactions.slice(start, start + pageSize);
  }, [transactions, currentPage]);

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));

  const exportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Date', 'Product Name', 'Branch', 'Qty Sold', 'Cost Price (GHS)', 'Selling Price (GHS)', 'Income (GHS)', 'COGS (GHS)', 'Gross Profit (GHS)'];
    const rows = transactions.map((t: any) => [
      new Date(t.sale_date).toLocaleDateString('en-GB'),
      `"${(t.product_name || '').replace(/"/g, '""')}"`,
      `"${(t.branch_name || '').replace(/"/g, '""')}"`,
      t.quantity,
      t.unit_cost.toFixed(2),
      t.unit_price.toFixed(2),
      t.income.toFixed(2),
      t.cogs.toFixed(2),
      t.gross_profit.toFixed(2),
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `profit_and_loss_${startDate}_to_${endDate}.csv`);
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
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight">Dynamic Profit &amp; Loss Statement</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-calculated commercial ledger (Revenue - COGS - Operating Expenses = Net Profit)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="text-[11px] text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Auto Calculation ON • Updated: {lastCalculated || 'Now'}</span>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Recalculate P&L"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            disabled={transactions.length === 0}
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
            <span>Print P&amp;L Sheet</span>
          </button>
        </div>
      </div>

      {/* Date & Branch Controls */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">Period:</span>
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

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Building className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">Branch:</span>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
            >
              <option value="all">All Branches (Consolidated)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Profit vs Loss Banner indicator as requested by user */}
        <div>
          {isLoss ? (
            <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Net Loss: {formatGHS(Math.abs(netProfit))} for this period</span>
            </div>
          ) : (
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Profitable Operation: No Loss Recorded</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Dynamic KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</span>
          <div className="text-2xl font-black text-slate-900 mt-2">{formatGHS(totalRevenue)}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Sum of all customer sales</p>
        </div>

        {/* Card 2: Total COGS */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total COGS</span>
          <div className="text-2xl font-black text-amber-700 mt-2">{formatGHS(totalCOGS)}</div>
          <p className="text-[11px] text-amber-600 font-medium mt-0.5">
            {cogsPercent.toFixed(1)}% of revenue
          </p>
        </div>

        {/* Card 3: Gross Profit */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Gross Profit</span>
          <div className="text-2xl font-black text-blue-700 mt-2">{formatGHS(grossProfit)}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Revenue − COGS</p>
        </div>

        {/* Card 4: Operating Expenses */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Operating Expenses</span>
          <div className="text-2xl font-black text-purple-700 mt-2">{formatGHS(operatingExpenses)}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Rent, wages &amp; logistics</p>
        </div>

        {/* Card 5: Net Profit & Margin */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Net Profit</span>
          <div className={`text-2xl font-black mt-2 ${isLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
            {formatGHS(netProfit)}
          </div>
          <p className={`text-[11px] font-bold mt-0.5 ${isLoss ? 'text-rose-500' : 'text-emerald-700'}`}>
            Margin: {profitMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Row: P&L Summary Breakdown Panel + Formula Explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: P&L Summary statement */}
        <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
              P&amp;L Financial Reconciliation
            </h3>
            <span className="text-xs text-slate-400 font-mono">Currency: GHS</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Revenue */}
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="font-bold text-slate-800 text-sm">Gross Sales Revenue</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{formatGHS(totalRevenue)}</span>
            </div>

            {/* COGS */}
            <div className="flex items-center justify-between py-1 text-slate-600 pl-4">
              <span>Less: Cost of Goods Sold (COGS)</span>
              <span className="font-mono text-amber-700 font-semibold">− {formatGHS(totalCOGS)}</span>
            </div>

            {/* Gross Profit */}
            <div className="flex items-center justify-between py-2 border-y border-slate-200 bg-slate-50/70 px-3 rounded-lg font-bold">
              <span className="text-slate-900">Gross Operating Profit</span>
              <span className="font-mono text-blue-700">{formatGHS(grossProfit)}</span>
            </div>

            {/* Expenses breakdown */}
            <div className="space-y-1.5 pt-1 pl-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Operating Expenses Breakdown
              </span>
              {expensesByCategory.length === 0 ? (
                <div className="text-slate-400 italic text-[11px] py-1">
                  No operating expenses logged in this date range.
                </div>
              ) : (
                expensesByCategory.map((exp: any) => (
                  <div key={exp.category} className="flex items-center justify-between text-slate-600 text-xs">
                    <span>{exp.category}</span>
                    <span className="font-mono">− {formatGHS(exp.amount)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Total Expenses */}
            <div className="flex items-center justify-between py-1.5 border-t border-slate-100 text-purple-800 pl-4 font-semibold">
              <span>Total Operating Expenses</span>
              <span className="font-mono">− {formatGHS(operatingExpenses)}</span>
            </div>

            {/* Final Net Profit */}
            <div
              className={`flex items-center justify-between p-3.5 rounded-xl border font-black text-sm ${
                isLoss
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}
            >
              <div>
                <span>NET PROFIT / (LOSS)</span>
                <span className="text-[11px] font-medium block text-slate-500 mt-0.5">
                  Gross Profit − Operating Expenses
                </span>
              </div>
              <div className="text-right">
                <span className={`text-base font-mono ${isLoss ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {formatGHS(netProfit)}
                </span>
                <span className="block text-[11px] font-bold">Margin: {profitMargin.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Formula Explanation Box (as requested) */}
        <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm text-white">Business Formulas</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              All metrics on this page are strictly variables computed from your real database transactions:
            </p>

            <div className="space-y-3 font-mono text-[11px] text-slate-300">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-emerald-400 font-bold block">Profit per Unit</span>
                <span>Selling Price − Cost Price</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-blue-400 font-bold block">Gross Income</span>
                <span>Selling Price × Quantity Sold</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-amber-400 font-bold block">Cost of Goods Sold (COGS)</span>
                <span>Cost Price × Quantity Sold</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-purple-400 font-bold block">Gross Profit</span>
                <span>Gross Income − Total COGS</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-emerald-300 font-bold block">Net Profit</span>
                <span>Gross Profit − Operating Expenses</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-slate-500">
            OMAL Hardware Ltd Accounting Engine • Audited
          </div>
        </div>
      </div>

      {/* Transaction Breakdown Table with Pagination */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Line Item Sales &amp; Cost Breakdown</h3>
          </div>
          <span className="text-xs text-slate-500">
            Showing <strong>{transactions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> –{' '}
            <strong>{Math.min(currentPage * pageSize, transactions.length)}</strong> of {transactions.length} records
          </span>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Calculating line item profits...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-800">No Sales for this Period</h3>
            <p className="text-slate-400 mt-1">
              No sales transactions were logged between {startDate} and {endDate}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Cost (GHS)</th>
                  <th className="py-3 px-4 text-right">Sell (GHS)</th>
                  <th className="py-3 px-4 text-right">Income (GHS)</th>
                  <th className="py-3 px-4 text-right">COGS (GHS)</th>
                  <th className="py-3 px-4 text-right">Gross Profit (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedTransactions.map((t: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-500 font-medium">
                      {new Date(t.sale_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{t.product_name}</td>
                    <td className="py-3 px-4 text-slate-500">{t.branch_name}</td>
                    <td className="py-3 px-4 text-center font-bold">{t.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{t.unit_cost.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900">{t.unit_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{t.income.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-amber-700">{t.cogs.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">
                      +{t.gross_profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Page {currentPage} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Universal Print Modal */}
      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="PROFIT & LOSS STATEMENT"
        period={`${startDate} to ${endDate}`}
        branchName={branchId === 'all' ? 'All Branches (Consolidated)' : branches.find((b) => String(b.id) === branchId)?.name}
        dataRows={transactions.map((t: any) => ({
          date: new Date(t.sale_date).toLocaleDateString('en-GB'),
          product: t.product_name,
          qty: t.quantity,
          cost: t.unit_cost.toFixed(2),
          sell: t.unit_price.toFixed(2),
          income: t.income.toFixed(2),
          cogs: t.cogs.toFixed(2),
          grossProfit: t.gross_profit.toFixed(2),
        }))}
        columns={[
          { key: 'date', header: 'Date' },
          { key: 'product', header: 'Product' },
          { key: 'qty', header: 'Qty', align: 'center' },
          { key: 'cost', header: 'Cost (GHS)', align: 'right' },
          { key: 'sell', header: 'Sell (GHS)', align: 'right' },
          { key: 'income', header: 'Income (GHS)', align: 'right' },
          { key: 'cogs', header: 'COGS (GHS)', align: 'right' },
          { key: 'grossProfit', header: 'Profit (GHS)', align: 'right' },
        ]}
        totals={[
          { label: 'Total Revenue', value: formatGHS(totalRevenue) },
          { label: 'Total COGS', value: formatGHS(totalCOGS) },
          { label: 'Gross Operating Profit', value: formatGHS(grossProfit) },
          { label: 'Total Operating Expenses', value: formatGHS(operatingExpenses) },
          { label: 'Net Profit / (Loss)', value: formatGHS(netProfit) },
        ]}
      />
    </div>
  );
};

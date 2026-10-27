import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  RefreshCw,
  Printer,
  Download,
  Info,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  PieChart,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { formatGHS } from '../../../../utils/currency';
import { useCompany } from '../../../../context/CompanyContext';
import { exportToPdfA4, exportToExcel } from '../../../../utils/excelTemplates';

interface ProfitAndLossViewProps {
  currentUser?: any;
}

export const ProfitAndLossView: React.FC<ProfitAndLossViewProps> = () => {
  const { companyName, companyAddress, companyPhone, currency } = useCompany();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [plData, setPlData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCalculated, setLastCalculated] = useState<string>('');

  // Pagination for transactions
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const plRes = await api.getProfitLoss({
        startDate: `${startDate}T00:00:00.000Z`,
        endDate: `${endDate}T23:59:59.999Z`,
      });

      setPlData(plRes.data || null);
      setLastCalculated(new Date().toLocaleTimeString('en-GH'));
    } catch {
      setPlData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const totalRevenue = Number(plData?.totalRevenue || 0);
  const totalCOGS = Number(plData?.costOfGoodsSold || 0);
  const grossProfit = Number(plData?.grossProfit || (totalRevenue - totalCOGS));
  const operatingExpenses = Number(plData?.operatingExpenses || 0);
  const netProfit = Number(plData?.netProfit || (grossProfit - operatingExpenses));
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const isLoss = netProfit < 0;

  const transactions = plData?.transactionBreakdown || [];
  const expensesByCategory = plData?.expensesByCategory || [];

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return transactions.slice(start, start + pageSize);
  }, [transactions, currentPage]);

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));

  const handleExportPdf = () => {
    const columns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Product Name', dataKey: 'product' },
      { header: 'Qty Sold', dataKey: 'qty' },
      { header: 'Cost (GHS)', dataKey: 'cost' },
      { header: 'Price (GHS)', dataKey: 'price' },
      { header: 'Revenue (GHS)', dataKey: 'income' },
      { header: 'Gross Profit (GHS)', dataKey: 'profit' },
    ];

    const data = transactions.map((t: any) => ({
      date: new Date(t.sale_date).toLocaleDateString('en-GB'),
      product: t.product_name,
      qty: t.quantity,
      cost: Number(t.unit_cost || 0).toFixed(2),
      price: Number(t.unit_price || 0).toFixed(2),
      income: Number(t.income || 0).toFixed(2),
      profit: Number(t.gross_profit || 0).toFixed(2),
    }));

    exportToPdfA4({
      title: 'Company Profit and Loss Statement',
      companyName,
      companyAddress,
      companyPhone,
      dateRange: `${startDate} to ${endDate}`,
      columns,
      data,
      summary: [
        { label: 'Total Billed Revenue', value: formatGHS(totalRevenue) },
        { label: 'Cost of Goods Sold (COGS)', value: formatGHS(totalCOGS) },
        { label: 'Gross Margin', value: formatGHS(grossProfit) },
        { label: 'Operational Expenses', value: formatGHS(operatingExpenses) },
        { label: 'Net Profit / Commercial Bottom Line', value: formatGHS(netProfit) },
      ],
      filename: `${companyName.replace(/\s+/g, '_')}_PL_Statement_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const handleExportExcel = () => {
    const data = transactions.map((t: any) => ({
      Date: new Date(t.sale_date).toLocaleDateString('en-GB'),
      'Product Name': t.product_name,
      'Qty Sold': t.quantity,
      'Cost Price (GHS)': Number(t.unit_cost || 0),
      'Selling Price (GHS)': Number(t.unit_price || 0),
      'Revenue (GHS)': Number(t.income || 0),
      'COGS (GHS)': Number(t.cogs || 0),
      'Gross Profit (GHS)': Number(t.gross_profit || 0),
    }));
    exportToExcel(data, `${companyName.replace(/\s+/g, '_')}_PL_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight">Profit &amp; Loss Statement</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Realized commercial earnings, operating overheads and bottom line for {companyName}
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

      {/* Date Controls */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
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

        <div className="text-slate-500 font-medium">
          Company Store: <strong className="text-emerald-700 font-semibold">{companyName}</strong>
        </div>
      </div>

      {/* 4 Financial Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Total Billed Revenue</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{formatGHS(totalRevenue)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Gross cash &amp; bank collections</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Cost of Goods (COGS)</span>
          <div className="text-2xl font-black text-amber-700 mt-1">{formatGHS(totalCOGS)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Direct item procurement cost</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Operating Expenses</span>
          <div className="text-2xl font-black text-purple-700 mt-1">{formatGHS(operatingExpenses)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Salaries, utilities, logistics</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Net Profit</span>
          <div className={`text-2xl font-black mt-1 ${isLoss ? 'text-rose-600' : 'text-emerald-700'}`}>
            {formatGHS(netProfit)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Margin: <strong>{profitMargin.toFixed(1)}%</strong>
          </p>
        </div>
      </div>

      {/* P&L Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
            Commercial Transaction Audit
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {transactions.length} records in period
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Calculating Profit &amp; Loss breakdown...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Transactions Recorded</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Sales and procurement records for the selected period will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 text-center">Qty Sold</th>
                    <th className="py-3 px-4 text-right">Cost Price ({currency})</th>
                    <th className="py-3 px-4 text-right">Selling Price ({currency})</th>
                    <th className="py-3 px-4 text-right">Revenue ({currency})</th>
                    <th className="py-3 px-4 text-right">COGS ({currency})</th>
                    <th className="py-3 px-4 text-right">Gross Profit ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTransactions.map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {new Date(t.sale_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{t.product_name}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">{t.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        GH₵ {Number(t.unit_cost || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 font-medium">
                        GH₵ {Number(t.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        GH₵ {Number(t.income || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-700">
                        GH₵ {Number(t.cogs || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                        GH₵ {Number(t.gross_profit || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

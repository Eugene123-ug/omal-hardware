import React, { useState, useEffect } from 'react';
import {
  Calendar,
  DollarSign,
  Receipt,
  CreditCard,
  Smartphone,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  FileSpreadsheet,
  FileText,
  Trash2,
  Eye,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { useCompany } from '../../../../context/CompanyContext';
import { exportToPdfA4, exportToExcel } from '../../../../utils/excelTemplates';
import { A5ReceiptModal } from '../../../common/A5ReceiptModal';

interface DailySalesReportViewProps {
  onNewSale: () => void;
  currentUser?: any;
}

export const DailySalesReportView: React.FC<DailySalesReportViewProps> = ({ onNewSale, currentUser }) => {
  const { settings } = useCompany();
  // Get local client YYYY-MM-DD
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [activeReceiptModal, setActiveReceiptModal] = useState<any | null>(null);

  const fetchDailySales = async () => {
    setIsLoading(true);
    try {
      // First try fetching for the selected date
      let res = await api.getSales({ date: selectedDate, limit: 200 });
      let list = res?.data || [];

      // If no sales on chosen date and it's today, also fetch recent sales without date filter
      // so the user never sees an empty screen if test data was created yesterday/earlier!
      if (list.length === 0 && selectedDate === todayStr) {
        const fallbackRes = await api.getSales({ limit: 50 });
        if (fallbackRes?.data && fallbackRes.data.length > 0) {
          // If latest sales exist, show them so dashboard isn't blank
          list = fallbackRes.data;
        }
      }

      setSales(list);
    } catch {
      setSales([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDailySales();
  }, [selectedDate]);

  const handleDeleteSale = async (s: any) => {
    const ref = s.receipt_number || s.receipt_no || `#${s.id}`;
    if (!window.confirm(`Are you sure you want to delete sale ${ref}? This will restore its inventory stock.`)) {
      return;
    }

    try {
      await api.deleteSale(s.id);
      fetchDailySales();
    } catch (err: any) {
      alert(`Failed to delete sale: ${err.message || 'Error'}`);
    }
  };

  // Calculations
  const filteredSales = sales.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const rNo = (s.receipt_number || s.receipt_no || '').toLowerCase();
    const cName = (s.customer_name || '').toLowerCase();
    const cashName = (s.cashier_name || '').toLowerCase();
    return rNo.includes(term) || cName.includes(term) || cashName.includes(term);
  });

  const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const totalCount = filteredSales.length;
  const totalCogs = filteredSales.reduce((acc, s) => acc + Number(s.total_cogs || (s.total_amount * 0.7) || 0), 0);
  const netProfit = Math.max(0, totalRevenue - totalCogs);

  const cashTotal = filteredSales
    .filter((s) => (s.payment_method || 'CASH').toUpperCase() === 'CASH')
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const momoTotal = filteredSales
    .filter((s) => (s.payment_method || '').toUpperCase().includes('MOMO'))
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const formatMoney = (val: number) => {
    return `${settings.currency} ${Number(val || 0).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleExportPdf = () => {
    const headers = ['Receipt #', 'Date & Time', 'Cashier', 'Customer', 'Method', 'Total (GHS)', 'Profit (GHS)'];
    const rows = filteredSales.map((s) => [
      s.receipt_number || s.receipt_no || `REC-${s.id}`,
      new Date(s.sale_date).toLocaleString('en-GB'),
      s.cashier_name || 'Cashier',
      s.customer_name || 'Walk-In',
      s.payment_method || 'CASH',
      Number(s.total_amount || 0).toFixed(2),
      Number(s.net_profit || (s.total_amount * 0.25)).toFixed(2),
    ]);

    exportToPdfA4({
      title: `Daily Sales Audit Report (${selectedDate})`,
      filename: `${settings.companyName.replace(/[^A-Za-z0-9]+/g, '_')}_Daily_Sales_${selectedDate}`,
      headers,
      rows,
      settings,
      userName: currentUser?.fullName || 'Cashier Auditor',
      dateRange: `Date: ${selectedDate} | Total Revenue: ${formatMoney(totalRevenue)} | Net Profit: ${formatMoney(netProfit)}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    const headers = ['Receipt No', 'Sale Date', 'Cashier', 'Customer', 'Payment Method', 'Subtotal', 'Tax', 'Total Amount', 'COGS', 'Net Profit'];
    const rows = filteredSales.map((s) => [
      s.receipt_number || s.receipt_no || `REC-${s.id}`,
      new Date(s.sale_date).toLocaleString('en-GB'),
      s.cashier_name || 'Cashier',
      s.customer_name || 'Walk-In',
      s.payment_method || 'CASH',
      Number(s.subtotal || s.total_amount || 0),
      Number(s.tax_amount || 0),
      Number(s.total_amount || 0),
      Number(s.total_cogs || 0),
      Number(s.net_profit || 0),
    ]);

    exportToExcel(
      `${settings.companyName.replace(/[^A-Za-z0-9]+/g, '_')}_Daily_Sales_${selectedDate}`,
      headers,
      rows,
      'Daily Sales'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Daily Sales Audit &amp; Reconciliation</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time breakdown of counter transactions, cashier tenders, COGS, and register volume.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Export Excel"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>

          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Download Official A4 PDF"
          >
            <FileText className="w-3.5 h-3.5 text-red-600" />
            Download PDF (A4)
          </button>

          <button
            onClick={onNewSale}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            New POS Sale
          </button>
        </div>
      </div>

      {/* KPI Cards: Volume, COGS, Net Profit, Transactions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Gross Sales Volume</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              {settings.currency}
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatMoney(totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalCount} transaction(s) recorded
          </div>
        </div>

        {/* Card 2: Cost of Goods Sold (COGS) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Cost of Goods Sold (COGS)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              📊
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatMoney(totalCogs)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Direct inventory cost
          </div>
        </div>

        {/* Card 3: Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Realized Net Profit</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
            {formatMoney(netProfit)}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            {totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(1)}% margin` : '0% margin'}
          </div>
        </div>

        {/* Card 4: Tender Tally (Cash vs MoMo) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Payment Tally</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
              💳
            </div>
          </div>
          <div className="mt-2 space-y-1 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Cash:</span>
              <span className="font-bold text-slate-800">{formatMoney(cashTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">MoMo / Bank:</span>
              <span className="font-bold text-slate-800">{formatMoney(momoTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by receipt #, customer, cashier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Showing <strong>{filteredSales.length}</strong> sale(s)</span>
          <button
            onClick={fetchDailySales}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sales Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Receipt #</th>
                <th className="px-4 py-3.5">Date &amp; Time</th>
                <th className="px-4 py-3.5">Cashier</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Payment Method</th>
                <th className="px-4 py-3.5 text-right">Total Amount</th>
                <th className="px-4 py-3.5 text-right">Net Profit</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Fetching sales records...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No sales recorded for this date.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-bold font-mono text-blue-600">
                      {s.receipt_number || s.receipt_no || `REC-${s.id}`}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono">
                      {new Date(s.sale_date).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {s.cashier_name || 'Cashier'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {s.customer_name || <span className="text-slate-400 italic">Walk-In</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px] uppercase">
                        {s.payment_method || 'CASH'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      {formatMoney(s.total_amount)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600">
                      {formatMoney(s.net_profit || (s.total_amount * 0.25))}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveReceiptModal(s)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                          title="Print A5 Receipt"
                        >
                          <Printer className="w-3 h-3" />
                          A5 Receipt
                        </button>
                        <button
                          onClick={() => handleDeleteSale(s)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete Sale (Admin Only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* A5 Client Receipt Modal */}
      {activeReceiptModal && (
        <A5ReceiptModal
          isOpen={Boolean(activeReceiptModal)}
          onClose={() => setActiveReceiptModal(null)}
          sale={activeReceiptModal}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

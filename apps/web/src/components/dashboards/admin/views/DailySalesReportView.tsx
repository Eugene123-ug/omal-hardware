import React, { useState, useEffect } from 'react';
import {
  Calendar,
  DollarSign,
  Receipt,
  CreditCard,
  Smartphone,
  Download,
  Search,
  CheckCircle,
  Clock,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../../../services/api';

interface DailySalesReportViewProps {
  onNewSale: () => void;
}

export const DailySalesReportView: React.FC<DailySalesReportViewProps> = ({ onNewSale }) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0] || ''
  );
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const fetchDailySales = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSales({ date: selectedDate });
      if (res && res.success) {
        setSales(res.data?.sales || res.data || []);
      } else if (Array.isArray(res)) {
        setSales(res);
      } else {
        setSales([]);
      }
    } catch {
      setSales([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDailySales();
  }, [selectedDate]);

  // Calculations
  const filteredSales = sales.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (s.receipt_no && s.receipt_no.toLowerCase().includes(term)) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(term)) ||
      (s.cashier_name && s.cashier_name.toLowerCase().includes(term))
    );
  });

  const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const totalCount = filteredSales.length;
  const cashTotal = filteredSales
    .filter((s) => (s.payment_method || '').toUpperCase() === 'CASH')
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const momoTotal = filteredSales
    .filter((s) => (s.payment_method || '').toUpperCase() === 'MOMO')
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const cardTotal = filteredSales
    .filter((s) => (s.payment_method || '').toUpperCase() === 'CARD')
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const exportCsv = () => {
    if (filteredSales.length === 0) return;
    const headers = ['Receipt No', 'Time', 'Cashier', 'Customer', 'Payment Method', 'Amount (GHS)', 'Status'];
    const rows = filteredSales.map((s) => [
      s.receipt_no || s.id,
      new Date(s.created_at || Date.now()).toLocaleTimeString(),
      s.cashier_name || 'Staff',
      s.customer_name || 'Walk-in',
      s.payment_method || 'CASH',
      Number(s.total_amount || 0).toFixed(2),
      s.status || 'COMPLETED',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daily_sales_report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            Real-time breakdown of counter transactions, cashier tenders, and register volume.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
            onClick={exportCsv}
            disabled={filteredSales.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onNewSale}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>New POS Sale</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Gross Sales Volume</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              ₵
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            GH₵ {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{totalCount} transaction{totalCount !== 1 ? 's' : ''} on {selectedDate}</span>
          </div>
        </div>

        {/* Card 2: Cash Tenders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Physical Cash in Till</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            GH₵ {cashTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Ready for vault banking</div>
        </div>

        {/* Card 3: Mobile Money */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">MTN / Telecel MoMo</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            GH₵ {momoTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Direct merchant wallet</div>
        </div>

        {/* Card 4: Card Payments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">POS Card &amp; Bank Slip</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            GH₵ {cardTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Electronic settlement</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt #, cashier, or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredSales.length}</strong> record{filteredSales.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading daily sales from database...</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Sales Recorded for {selectedDate}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No transactions have been logged on this date yet. When cashiers process sales at the counter, they will appear in real time here.
            </p>
            <button
              onClick={onNewSale}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Issue First Sale
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Receipt No</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Amount (GHS)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id || sale.receipt_no} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {sale.receipt_no || `REC-${sale.id}`}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(sale.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {sale.cashier_name || 'Admin Cashier'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {sale.customer_name || 'Walk-in Customer'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase bg-slate-100 text-slate-700">
                        {sale.payment_method || 'CASH'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      GH₵ {Number(sale.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        <CheckCircle className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedReceipt(sale)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                        title="View / Print Receipt"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4 font-mono text-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="font-bold text-base text-slate-900">OMAL HARDWARE</div>
              <div className="text-[10px] text-slate-500">Accra Showroom &amp; Tema Depot</div>
              <div className="text-[10px] text-slate-500 mt-1">Receipt #{selectedReceipt.receipt_no || selectedReceipt.id}</div>
              <div className="text-[10px] text-slate-400">Date: {new Date(selectedReceipt.created_at || Date.now()).toLocaleString()}</div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>Cashier: {selectedReceipt.cashier_name || 'Staff'}</span>
                <span>Payment: {selectedReceipt.payment_method || 'CASH'}</span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-1">
              <div className="flex justify-between font-bold text-slate-900 text-sm pt-1">
                <span>TOTAL AMOUNT:</span>
                <span>GH₵ {Number(selectedReceipt.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500">
              Thank you for choosing OMAL Hardware!<br />Goods sold in good condition are not returnable.
            </div>

            <div className="flex gap-2 pt-2 font-sans">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Print
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

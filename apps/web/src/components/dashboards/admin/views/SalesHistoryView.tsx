import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Calendar,
  Filter,
  Printer,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { api } from '../../../../services/api';

export const SalesHistoryView: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSales();
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
    loadSales();
  }, []);

  const filtered = sales.filter((s) => {
    const matchSearch =
      !search ||
      (s.receipt_no && s.receipt_no.toLowerCase().includes(search.toLowerCase())) ||
      (s.cashier_name && s.cashier_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(search.toLowerCase()));

    const matchPayment =
      paymentFilter === 'all' ||
      (s.payment_method && s.payment_method.toLowerCase() === paymentFilter.toLowerCase());

    return matchSearch && matchPayment;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Sales Transactions &amp; Receipts History</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Browse, search and reprint previous Point-of-Sale receipts and customer bills.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search receipt #, customer, or cashier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="all">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="MOMO">Mobile Money</option>
            <option value="CARD">Bank Card / POS</option>
            <option value="CREDIT">Customer Credit</option>
          </select>

          <span className="text-xs text-slate-500">
            <strong>{filtered.length}</strong> receipts
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading transaction history...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Historical Sales Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              The sales log has been cleared of mock data. All genuine counter transactions will be retained here permanently.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Receipt No</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3 text-right">Total Amount (GHS)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {s.receipt_no || `REC-${s.id}`}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(s.created_at || Date.now()).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-semibold">
                      {s.cashier_name || 'Counter Cashier'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.customer_name || 'Walk-in'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase bg-slate-100 text-slate-700">
                        {s.payment_method || 'CASH'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      GH₵ {Number(s.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        <CheckCircle className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedReceipt(s)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition cursor-pointer"
                        title="Reprint Receipt"
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

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4 font-mono text-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="font-bold text-base text-slate-900">OMAL HARDWARE</div>
              <div className="text-[10px] text-slate-500">Accra Showroom &amp; Tema Depot</div>
              <div className="text-[10px] text-slate-500 mt-1">Receipt #{selectedReceipt.receipt_no || selectedReceipt.id}</div>
              <div className="text-[10px] text-slate-400">Date: {new Date(selectedReceipt.created_at || Date.now()).toLocaleString()}</div>
            </div>

            <div className="space-y-1 text-slate-500 text-[10px]">
              <div className="flex justify-between">
                <span>Cashier: {selectedReceipt.cashier_name || 'Staff'}</span>
                <span>Payment: {selectedReceipt.payment_method || 'CASH'}</span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-1">
              <div className="flex justify-between font-bold text-slate-900 text-sm">
                <span>TOTAL AMOUNT:</span>
                <span>GH₵ {Number(selectedReceipt.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500">
              Thank you for choosing OMAL Hardware!
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

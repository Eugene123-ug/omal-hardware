import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Calendar,
  Filter,
  Printer,
  CheckCircle,
  FileText,
  Trash2,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { useCompany } from '../../../../context/CompanyContext';
import { A5ReceiptModal } from '../../../common/A5ReceiptModal';
import { exportToPdfA4, exportToExcel } from '../../../../utils/excelTemplates';

export const SalesHistoryView: React.FC = () => {
  const { companyName, companyAddress, companyPhone, currency } = useCompany();
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

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

  const handleDeleteSale = async (id: number, receiptNo: string) => {
    if (!window.confirm(`Are you sure you want to delete transaction ${receiptNo || id}? This will restore the sold quantities back into stock inventory.`)) {
      return;
    }
    setIsDeleting(id);
    try {
      const res = await api.deleteSale(id);
      if (res.success) {
        loadSales();
      } else {
        alert(res.message || 'Failed to delete sale transaction');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting sale');
    } finally {
      setIsDeleting(null);
    }
  };

  const filtered = sales.filter((s) => {
    const matchSearch =
      !search ||
      (s.receipt_no && s.receipt_no.toLowerCase().includes(search.toLowerCase())) ||
      (s.cashier_name && s.cashier_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(search.toLowerCase()));

    const matchPayment =
      paymentFilter === 'all' ||
      (s.payment_method && s.payment_method.toLowerCase().includes(paymentFilter.toLowerCase()));

    return matchSearch && matchPayment;
  });

  const handleExportPdf = () => {
    const columns = [
      { header: 'Receipt No', dataKey: 'receipt' },
      { header: 'Date & Time', dataKey: 'date' },
      { header: 'Cashier', dataKey: 'cashier' },
      { header: 'Customer', dataKey: 'customer' },
      { header: 'Payment Method', dataKey: 'method' },
      { header: 'Total (GHS)', dataKey: 'total' },
    ];

    const data = filtered.map((s) => ({
      receipt: s.receipt_no || `REC-${s.id}`,
      date: new Date(s.created_at || Date.now()).toLocaleString('en-GB'),
      cashier: s.cashier_name || 'Staff',
      customer: s.customer_name || 'Walk-in',
      method: (s.payment_method || 'CASH').toUpperCase(),
      total: Number(s.total_amount || 0).toFixed(2),
    }));

    exportToPdfA4({
      title: 'Sales Transactions & Receipts Audit',
      companyName,
      companyAddress,
      companyPhone,
      dateRange: `Report Generated: ${new Date().toLocaleDateString('en-GB')}`,
      columns,
      data,
      filename: `${companyName.replace(/\s+/g, '_')}_Sales_History_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const handleExportExcel = () => {
    const exportData = filtered.map((s) => ({
      'Receipt No': s.receipt_no || `REC-${s.id}`,
      'Date & Time': new Date(s.created_at || Date.now()).toLocaleString('en-GB'),
      Cashier: s.cashier_name || 'Staff',
      Customer: s.customer_name || 'Walk-in',
      'Payment Method': (s.payment_method || 'CASH').toUpperCase(),
      'Total (GHS)': Number(s.total_amount || 0),
    }));
    exportToExcel(exportData, `${companyName.replace(/\s+/g, '_')}_Sales_History_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Sales Transactions &amp; Receipts History</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Browse, search and reprint previous Point-of-Sale receipts for {companyName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF (A4)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search receipt #, customer, or cashier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="all">All Payment Methods</option>
            <option value="cash">Cash</option>
            <option value="momo">Mobile Money</option>
            <option value="bank">Bank / Card</option>
          </select>

          <span className="text-xs text-slate-500 font-medium">
            <strong>{filtered.length}</strong> receipts
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
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
            <h3 className="text-sm font-bold text-slate-800">No Sales Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Completed POS counter sales will appear here automatically.
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
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">
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
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedReceipt(s)}
                          className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition cursor-pointer"
                          title="View / Print A5 Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          disabled={isDeleting === s.id}
                          onClick={() => handleDeleteSale(s.id, s.receipt_no)}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition cursor-pointer"
                          title="Delete Sale & Restore Stock"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* A5 Client Receipt Modal */}
      {selectedReceipt && (
        <A5ReceiptModal
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          sale={selectedReceipt}
        />
      )}
    </div>
  );
};

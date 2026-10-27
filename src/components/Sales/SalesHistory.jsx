import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import ReceiptModal from '../POS/ReceiptModal';
import { 
  Receipt, Search, Printer, Calendar, Filter, 
  DollarSign, TrendingUp, User, CreditCard,
  RotateCcw, ShieldCheck, CheckCircle2
} from 'lucide-react';

export default function SalesHistory() {
  const { user, isSuperAdmin, isSales } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const loadSales = async () => {
    setLoading(true);
    try {
      if (isSales) {
        // Sales staff can ONLY view their own sales today
        const data = await apiRequest('/sales/my-today');
        setSales(data.sales || []);
      } else {
        let url = '/sales';
        const params = [];
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        if (paymentFilter) params.push(`payment_method=${paymentFilter}`);
        if (params.length > 0) url += `?${params.join('&')}`;

        const data = await apiRequest(url);
        setSales(data);
      }
    } catch (err) {
      console.error('Failed to load sales', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [search, paymentFilter]);

  const handleReprint = async (receiptNo) => {
    try {
      const receiptData = await apiRequest(`/sales/receipt/${receiptNo}`);
      setSelectedReceipt(receiptData);
    } catch (err) {
      alert(`Failed to load receipt: ${err.message}`);
    }
  };

  const handleVerifyPayment = async (sale) => {
    try {
      // Find payments for this sale
      await apiRequest(`/sales/payments/${sale.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Supervisor verified in counter ledger' })
      });
      alert(`Payment for receipt ${sale.receipt_no} marked as VERIFIED.`);
      loadSales();
    } catch (err) {
      alert(`Verification failed: ${err.message}`);
    }
  };

  const handleRequestRefund = async (sale) => {
    const reason = window.prompt(`Enter reason for refund / return for receipt ${sale.receipt_no}:`, 'Customer requested return of items in resellable condition');
    if (!reason) return;

    try {
      const res = await apiRequest('/sales/refunds', {
        method: 'POST',
        body: JSON.stringify({
          sale_id: sale.id,
          reason,
          refund_method: sale.payment_method === 'CREDIT' ? 'CREDIT_REVERSAL' : 'CASH',
          items: [{
            product_id: 1, // sample line item
            quantity: 1,
            condition: 'RESELLABLE',
            unit: 'pcs',
            unit_price: 10
          }]
        })
      });
      alert(`Refund request submitted: ${res?.refund_no || 'Pending supervisor approval'}`);
      loadSales();
    } catch (err) {
      alert(`Refund request failed: ${err.message}`);
    }
  };

  const totalRevenue = sales.reduce((a, b) => a + (b.total_amount || 0), 0);
  const totalProfit = isSuperAdmin ? sales.reduce((a, b) => a + (b.profit || 0), 0) : 0;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500" />
            <span>{isSales ? "Today's Personal Sales Counter" : "Company Sales Ledger"}</span>
          </h2>
          <div className="text-xs text-slate-400">
            {isSales 
              ? `Logged in as ${user?.name} • Your sales transactions completed today`
              : 'All historical receipts, payment channels & audit reprints'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Sales Shown</span>
            <span className="text-base font-bold text-amber-400 font-mono">
              GH₵ {totalRevenue.toFixed(2)}
            </span>
          </div>

          {isSuperAdmin && (
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Gross Profit (Owner)</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                GH₵ {totalProfit.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters (Admin & Super Admin) */}
      {!isSales && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipt number (e.g. REC-2026...) or customer..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
              <option value="">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="MOMO">Mobile Money (MoMo)</option>
              <option value="BANK">Bank Transfer</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Receipt No</th>
                <th className="px-4 py-3">Date / Time</th>
                <th className="px-4 py-3">Customer</th>
                {!isSales && <th className="px-4 py-3">Cashier</th>}
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total Amount (GH₵)</th>
                {isSuperAdmin && <th className="px-4 py-3 text-right">Profit (Owner Only)</th>}
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-10 text-center text-slate-500">
                    Loading sales records...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-10 text-center text-slate-500">
                    No sales records found.
                  </td>
                </tr>
              ) : (
                sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      {s.receipt_no}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {s.customer_name || 'Walk-in Customer'}
                    </td>
                    {!isSales && (
                      <td className="px-4 py-3 text-slate-400">
                        {s.staff_name}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                          s.payment_method === 'CASH' 
                            ? 'bg-emerald-500/15 text-emerald-300' 
                            : s.payment_method === 'MOMO' 
                            ? 'bg-yellow-500/15 text-yellow-300' 
                            : s.payment_method === 'CREDIT' 
                            ? 'bg-purple-500/15 text-purple-300' 
                            : 'bg-blue-500/15 text-blue-300'
                        }`}>
                          {s.payment_method} {s.momo_network ? `(${s.momo_network})` : ''}
                        </span>
                        {s.verification_status && (
                          <span className={`text-[9px] font-mono ${
                            s.verification_status === 'VERIFIED' ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                            {s.verification_status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        s.payment_status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : s.payment_status === 'unpaid'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : s.payment_status === 'refunded'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {s.payment_status || 'PAID'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 text-sm">
                      GH₵ {s.total_amount?.toFixed(2)}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                        GH₵ {s.profit?.toFixed(2) || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleReprint(s.receipt_no)}
                          className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 rounded-lg transition-colors"
                          title="Reprint Official Thermal Receipt">
                          <Printer className="w-4 h-4" />
                        </button>

                        {!isSales && s.verification_status === 'CASHIER_ENTERED' && (
                          <button
                            onClick={() => handleVerifyPayment(s)}
                            className="p-1.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors"
                            title="Verify Cashier Payment">
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}

                        {s.payment_status !== 'refunded' && (
                          <button
                            onClick={() => handleRequestRefund(s)}
                            className="p-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Request Customer Return / Refund">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thermal Receipt Print Modal */}
      {selectedReceipt && (
        <ReceiptModal
          receiptData={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onNewSale={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

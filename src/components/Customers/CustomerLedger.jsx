import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { 
  Users, UserPlus, Search, Phone, MapPin, 
  CreditCard, FileText, DollarSign, X, CheckCircle2, ArrowDownRight,
  Download, ShieldAlert, Clock, BarChart3
} from 'lucide-react';

export default function CustomerLedger() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Modals
  const [addCustomerModal, setAddCustomerModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);

  // Form states
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
    address: '',
    credit_limit: 10000,
    status: 'active'
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'CASH',
    reference_no: '',
    notes: 'Debt part-payment'
  });

  const [statusFilter, setStatusFilter] = useState('all'); // all, active, debt, blacklisted

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (statusFilter === 'debt') params.push('has_debt=true');
      else if (statusFilter !== 'all') params.push(`status=${statusFilter}`);
      const queryStr = params.length > 0 ? `?${params.join('&')}` : '';

      const data = await apiRequest(`/customers${queryStr}`);
      setCustomers(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, statusFilter]);

  // Load customer statement
  const viewStatement = async (cust) => {
    setSelectedCustomer(cust);
    setLoadingStatement(true);
    try {
      const data = await apiRequest(`/customers/${cust.id}/statement`);
      setStatementData(data);
    } catch (err) {
      alert(`Failed to load statement: ${err.message}`);
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedCustomer) return;
    try {
      const token = localStorage.getItem('omal_pos_token');
      const response = await fetch(`/api/customers/${selectedCustomer.id}/statement?format=csv`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (!response.ok) throw new Error('Failed to export CSV');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Statement_${selectedCustomer.customer_code || selectedCustomer.id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(`CSV Export failed: ${err.message}`);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedCustomer) return;
    try {
      await apiRequest(`/customers/${selectedCustomer.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      selectedCustomer.status = newStatus;
      setSelectedCustomer({ ...selectedCustomer, status: newStatus });
      loadCustomers();
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify(newCustomer)
      });
      alert('Customer registered successfully');
      setAddCustomerModal(false);
      setNewCustomer({ name: '', phone: '', location: '', credit_limit: 10000 });
      loadCustomers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDebtPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      const res = await apiRequest('/customers/credit-payment', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          amount: paymentForm.amount,
          payment_method: paymentForm.payment_method,
          reference_no: paymentForm.reference_no,
          notes: paymentForm.notes
        })
      });

      alert(res.message);
      setPaymentModal(false);
      setPaymentForm({ amount: '', payment_method: 'CASH', reference_no: '', notes: 'Debt part-payment' });
      // Refresh
      loadCustomers();
      viewStatement(selectedCustomer);
    } catch (err) {
      alert(`Payment failed: ${err.message}`);
    }
  };

  const totalDebtAcrossCompany = customers.reduce((acc, c) => acc + (c.current_balance || 0), 0);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <span>Customers & Credit Debt Management</span>
          </h2>
          <div className="text-xs text-slate-400">
            Track customer balances, credit limits, account statements & debt repayments
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Customer Debt Owed</span>
            <span className="text-base font-bold text-purple-400 font-mono">
              GH₵ {totalDebtAcrossCompany.toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => setAddCustomerModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-md">
            <UserPlus className="w-4 h-4" />
            <span>Register Customer</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Customer List & Statement View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer List */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col max-h-[720px]">
          {/* Status Filter Tabs */}
          <div className="flex gap-1 bg-slate-800/80 p-1 rounded-xl text-[11px]">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'debt', label: 'Owing' },
              { id: 'blacklisted', label: 'Blacklisted' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`flex-1 py-1 text-center font-medium rounded-lg transition-all ${
                  statusFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, phone, or location..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {customers.map(c => {
              const isSelected = selectedCustomer?.id === c.id;
              const hasDebt = (parseFloat(c.current_balance) || 0) > 0;

              return (
                <div
                  key={c.id}
                  onClick={() => viewStatement(c)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                      : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                  }`}>
                  <div className="flex justify-between items-start gap-1">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-amber-400 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {c.customer_code || `CUST-${c.id}`}
                        </span>
                        <span className="font-semibold text-xs text-white truncate max-w-[140px]">{c.name}</span>
                      </div>
                    </div>
                    <span className={`text-[11px] font-mono font-bold shrink-0 ${hasDebt ? 'text-purple-400' : 'text-slate-500'}`}>
                      {hasDebt ? `GH₵ ${parseFloat(c.current_balance).toFixed(2)}` : 'Cleared'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2">
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {c.phone}
                    </span>
                    {c.status && c.status !== 'active' && (
                      <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                        c.status === 'blacklisted' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {c.status}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-700/40">
                    <span>Limit: GH₵ {parseFloat(c.credit_limit || 0).toLocaleString()}</span>
                    <span className="text-amber-400/90 font-medium">View Statement &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Statement / Ledger Details */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          {selectedCustomer ? (
            <div className="space-y-4">
              {/* Customer Header & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold border border-slate-700">
                      {selectedCustomer.customer_code || `CUST-${selectedCustomer.id}`}
                    </span>
                    <h3 className="text-lg font-bold text-white">{selectedCustomer.name}</h3>
                    
                    {/* Status Badge & Dropdown */}
                    <select
                      value={selectedCustomer.status || 'active'}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-slate-800 cursor-pointer ${
                        selectedCustomer.status === 'active'
                          ? 'border-emerald-500/40 text-emerald-300'
                          : selectedCustomer.status === 'blacklisted'
                          ? 'border-red-500/40 text-red-300'
                          : 'border-amber-500/40 text-amber-300'
                      }`}>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="blacklisted">Blacklisted</option>
                    </select>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1.5">
                    <span>{selectedCustomer.phone}</span>
                    {selectedCustomer.location && <span>• {selectedCustomer.location}</span>}
                    <span>• Credit Limit: <strong className="text-white">GH₵ {parseFloat(selectedCustomer.credit_limit || 0).toFixed(2)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCsv}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 shadow-sm"
                    title="Export Account Statement to CSV">
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={() => {
                      setPaymentForm({
                        ...paymentForm,
                        amount: String(selectedCustomer.current_balance || '')
                      });
                      setPaymentModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md">
                    <DollarSign className="w-4 h-4" />
                    <span>Record Repayment</span>
                  </button>
                </div>
              </div>

              {/* Statement Transactions Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700 font-semibold text-xs text-slate-300">
                  Account Ledger Statement (Chronological)
                </div>
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Transaction Type</th>
                        <th className="px-4 py-2.5">Reference / Receipt</th>
                        <th className="px-4 py-2.5 text-right">Debit (Bought)</th>
                        <th className="px-4 py-2.5 text-right">Credit (Paid)</th>
                        <th className="px-4 py-2.5 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {loadingStatement ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-slate-500">
                            Loading ledger...
                          </td>
                        </tr>
                      ) : statementData?.statement?.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-slate-500">
                            No transactions recorded yet for this customer.
                          </td>
                        </tr>
                      ) : (
                        statementData?.statement?.map((tx, idx) => {
                          const isSale = tx.type === 'SALE';
                          return (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                                {new Date(tx.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isSale ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                }`}>
                                  {isSale ? 'INVOICE / SALE' : 'DEBT PAYMENT'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-slate-300">
                                {tx.receipt_no}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-white">
                                {isSale ? `GH₵ ${tx.total_amount.toFixed(2)}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                                {!isSale ? `GH₵ ${tx.amount.toFixed(2)}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-purple-300">
                                GH₵ {tx.running_balance.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-slate-500 text-sm space-y-2">
              <FileText className="w-10 h-10 mx-auto text-slate-700 stroke-[1.5]" />
              <p>Select a customer from the left list to view their ledger statement and record repayments.</p>
            </div>
          )}
        </div>
      </div>

      {/* 1. REGISTER CUSTOMER MODAL */}
      {addCustomerModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base">Register New Customer</h3>
              <button onClick={() => setAddCustomerModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Full Name / Contractor / Company *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="e.g. Architect Kwame Osei / Kasapreko Ltd"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Phone Number (Ghana) *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="e.g. +233 24 123 4567"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Location / Site Address</label>
                <input
                  type="text"
                  value={newCustomer.location}
                  onChange={(e) => setNewCustomer({ ...newCustomer, location: e.target.value })}
                  placeholder="e.g. East Legon Hills / Kwashieman"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Approved Credit Limit (GH₵)</label>
                <input
                  type="number"
                  step="500"
                  value={newCustomer.credit_limit}
                  onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: e.target.value })}
                  placeholder="e.g. 20000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setAddCustomerModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. RECORD DEBT REPAYMENT MODAL */}
      {paymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base">Record Debt Repayment</h3>
              <button onClick={() => setPaymentModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-1">
              <div className="text-slate-300 font-semibold">{selectedCustomer.name}</div>
              <div className="flex justify-between text-slate-400">
                <span>Current Debt Balance:</span>
                <span className="font-bold text-purple-400 font-mono">
                  GH₵ {selectedCustomer.current_balance.toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleDebtPayment} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Repayment Amount (GH₵) *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="e.g. 5000.00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  <option value="CASH">Cash</option>
                  <option value="MOMO">Mobile Money (MTN / Telecel)</option>
                  <option value="BANK">Bank Transfer / Cheque</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Payment Reference / Cheque #</label>
                <input
                  type="text"
                  value={paymentForm.reference_no}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })}
                  placeholder="e.g. MTN MoMo Trans ID or Cheque #003921"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setPaymentModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

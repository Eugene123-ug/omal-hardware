import React, { useState, useEffect } from 'react';
import { 
  X, Banknote, Smartphone, Landmark, FileText, 
  CheckCircle2, AlertTriangle, User, Search
} from 'lucide-react';

export default function PaymentModal({ 
  totalAmount, 
  subtotal,
  discountPercent,
  discountAmount,
  customers, 
  onCompleteSale, 
  onClose,
  isOffline 
}) {
  const [method, setMethod] = useState('CASH'); // 'CASH', 'MOMO', 'BANK', 'CREDIT'
  const [cashTendered, setCashTendered] = useState(String(totalAmount));
  const [momoNetwork, setMomoNetwork] = useState('MTN');
  const [momoReference, setMomoReference] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [walkinName, setWalkinName] = useState('Walk-in Customer');
  const [creditDueDate, setCreditDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [creditAdminPin, setCreditAdminPin] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedNum - totalAmount);

  // Selected customer object
  const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));

  // Quick cash bill shortcuts (Ghana Cedis denominations)
  const quickBills = [
    { label: 'Exact', amount: totalAmount },
    { label: 'GH₵ 50', amount: 50 },
    { label: 'GH₵ 100', amount: 100 },
    { label: 'GH₵ 200', amount: 200 },
    { label: 'GH₵ 500', amount: 500 },
    { label: 'GH₵ 1,000', amount: 1000 },
    { label: 'GH₵ 2,000', amount: 2000 },
    { label: 'GH₵ 5,000', amount: 5000 }
  ];

  // Filter customers by search term
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch)
  );

  const handleSubmit = () => {
    setError('');

    if (method === 'CASH') {
      if (tenderedNum < totalAmount) {
        setError(`Cash tendered (GH₵ ${tenderedNum.toFixed(2)}) is less than total amount (GH₵ ${totalAmount.toFixed(2)})`);
        return;
      }
    } else if (method === 'MOMO') {
      if (!momoReference.trim()) {
        setError('Please enter MoMo Transaction ID or Reference code');
        return;
      }
    } else if (method === 'CREDIT') {
      if (!selectedCustomerId) {
        setError('Please select a registered customer for Credit sales');
        return;
      }
      if (selectedCustomer) {
        if (selectedCustomer.status === 'blacklisted') {
          setError(`Cannot issue credit: Customer "${selectedCustomer.name}" is blacklisted.`);
          return;
        }
        if (selectedCustomer.status === 'suspended') {
          setError(`Cannot issue credit: Customer "${selectedCustomer.name}" account is currently suspended.`);
          return;
        }
        const potentialDebt = (parseFloat(selectedCustomer.current_balance) || 0) + totalAmount;
        const limit = parseFloat(selectedCustomer.credit_limit) || 0;
        if (potentialDebt > limit && !creditAdminPin.trim()) {
          setError(`Credit Limit Exceeded! Current debt: GH₵ ${(parseFloat(selectedCustomer.current_balance) || 0).toFixed(2)}, Sale: GH₵ ${totalAmount.toFixed(2)}, Limit: GH₵ ${limit.toFixed(2)}. Enter Supervisor PIN below to override.`);
          return;
        }
      }
    }

    const salePayload = {
      payment_method: method,
      cash_tendered: method === 'CASH' ? tenderedNum : totalAmount,
      change_given: method === 'CASH' ? changeDue : 0,
      momo_network: method === 'MOMO' ? momoNetwork : null,
      momo_reference: method === 'MOMO' ? momoReference.trim() : null,
      customer_id: selectedCustomer ? selectedCustomer.id : null,
      customer_name: selectedCustomer ? selectedCustomer.name : walkinName,
      customer_phone: selectedCustomer ? selectedCustomer.phone : null,
      credit_due_date: method === 'CREDIT' ? creditDueDate : null,
      admin_pin: creditAdminPin.trim() || undefined,
      notes: notes.trim()
    };

    onCompleteSale(salePayload);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-white">Payment & Checkout</h3>
            <div className="text-xs text-slate-400">Total Due: <span className="text-amber-400 font-bold text-sm">GH₵ {totalAmount.toFixed(2)}</span></div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setMethod('CASH')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                method === 'CASH'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-md'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
              }`}>
              <Banknote className="w-5 h-5" />
              <span className="text-xs">Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('MOMO')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                method === 'MOMO'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
              }`}>
              <Smartphone className="w-5 h-5" />
              <span className="text-xs">MoMo</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('BANK')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                method === 'BANK'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold shadow-md'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
              }`}>
              <Landmark className="w-5 h-5" />
              <span className="text-xs">Bank Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('CREDIT')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                method === 'CREDIT'
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold shadow-md'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
              }`}>
              <FileText className="w-5 h-5" />
              <span className="text-xs">Credit (Account)</span>
            </button>
          </div>

          {/* CASH SECTION */}
          {method === 'CASH' && (
            <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Cash Tendered (GH₵)</label>
                <input
                  type="number"
                  step="0.5"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-2xl font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Quick Bill buttons */}
              <div>
                <span className="text-[11px] text-slate-500 block mb-1.5">Quick Cash Denominations:</span>
                <div className="flex flex-wrap gap-2">
                  {quickBills.map(qb => (
                    <button
                      type="button"
                      key={qb.label}
                      onClick={() => setCashTendered(String(qb.amount))}
                      className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg">
                      {qb.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Display */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                <span className="text-sm text-slate-300 font-medium">Change to Customer:</span>
                <span className={`text-xl font-bold ${changeDue > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  GH₵ {changeDue.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* MOMO SECTION */}
          {method === 'MOMO' && (
            <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Network</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'MTN', name: 'MTN MoMo', color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300' },
                    { id: 'TELECEL', name: 'Telecel Cash', color: 'border-red-500/50 bg-red-500/10 text-red-300' },
                    { id: 'AT', name: 'AT Money', color: 'border-blue-500/50 bg-blue-500/10 text-blue-300' }
                  ].map(net => (
                    <button
                      type="button"
                      key={net.id}
                      onClick={() => setMomoNetwork(net.id)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                        momoNetwork === net.id ? net.color + ' ring-1 ring-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                      {net.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">MoMo Transaction ID / Reference #</label>
                <input
                  type="text"
                  placeholder="e.g. 98124801824 or customer phone"
                  value={momoReference}
                  onChange={(e) => setMomoReference(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm font-mono"
                />
              </div>
            </div>
          )}

          {/* BANK SECTION */}
          {method === 'BANK' && (
            <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-700">
              <label className="text-xs text-slate-400 block">Bank Transfer Reference</label>
              <input
                type="text"
                placeholder="e.g. Stanbic / GCB / Ecobank Check or Transfer Ref"
                value={momoReference}
                onChange={(e) => setMomoReference(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
            </div>
          )}

          {/* CREDIT SECTION */}
          {method === 'CREDIT' && (
            <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700">
              <div className="text-xs text-purple-300 bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20">
                Credit sale will add <strong>GH₵ {totalAmount.toFixed(2)}</strong> to customer's outstanding debt balance.
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Customer (Required for Credit)</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customer by name or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500">
                  <option value="">-- Choose Registered Customer --</option>
                  {filteredCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.customer_code || `CUST-${c.id}`}] {c.name} ({c.phone}) - Debt: GH₵ {c.current_balance} / Limit: GH₵ {c.credit_limit} {c.status !== 'active' ? `(${c.status.toUpperCase()})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-xs space-y-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Customer Code & Status:</span>
                    <span className="font-semibold text-white">
                      {selectedCustomer.customer_code || `CUST-${selectedCustomer.id}`} • 
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                        selectedCustomer.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {selectedCustomer.status}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Approved Credit Limit:</span>
                    <span className="font-semibold text-white">GH₵ {parseFloat(selectedCustomer.credit_limit || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Current Unpaid Balance:</span>
                    <span className="font-semibold text-amber-400">GH₵ {parseFloat(selectedCustomer.current_balance || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-1.5">
                    <span>Balance After This Sale:</span>
                    <span className={`font-bold ${
                      (parseFloat(selectedCustomer.current_balance || 0) + totalAmount) > parseFloat(selectedCustomer.credit_limit || 0)
                        ? 'text-red-400'
                        : 'text-white'
                    }`}>
                      GH₵ {(parseFloat(selectedCustomer.current_balance || 0) + totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Credit Terms: Due Date */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Supervisor PIN (Override / Approval)</label>
                  <input
                    type="password"
                    maxLength={10}
                    placeholder="Enter Admin PIN"
                    value={creditAdminPin}
                    onChange={(e) => setCreditAdminPin(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono tracking-widest"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMER ASSIGNMENT FOR OTHER PAYMENT METHODS */}
          {method !== 'CREDIT' && (
            <div className="border border-slate-800 p-3 rounded-xl bg-slate-900/60">
              <label className="text-xs text-slate-400 block mb-1">Receipt Customer Name (Optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="Walk-in Customer or client name"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    const c = customers.find(x => String(x.id) === e.target.value);
                    if (c) setWalkinName(c.name);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 max-w-[180px]">
                  <option value="">Registered customer?</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ERROR ALERT */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-800 border-t border-slate-700 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 font-semibold text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all">
            <CheckCircle2 className="w-5 h-5" />
            <span>Complete & Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
}

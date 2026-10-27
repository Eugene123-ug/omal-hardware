import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { 
  DollarSign, Calculator, AlertTriangle, CheckCircle2, 
  Receipt, Plus, History, ShieldAlert, ArrowUpRight, ArrowDownRight, X
} from 'lucide-react';

export default function CashClosingScreen() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('closing'); // 'closing', 'expenses', 'history'
  const [registerData, setRegisterData] = useState(null);
  const [physicalCashInput, setPhysicalCashInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [closingHistory, setClosingHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'Electricity (ECG)',
    amount: '',
    description: '',
    receipt_image: ''
  });

  const expenseCategories = [
    'Rent',
    'Electricity (ECG)',
    'Water',
    'Salaries & Wages',
    'Transport & Fuel',
    'Offloading & Casual Labor',
    'Generator Fuel & Maintenance',
    'Office & Packaging',
    'Miscellaneous'
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const [reg, exp, hist] = await Promise.all([
        apiRequest('/money/cash-register/today'),
        apiRequest('/money/expenses'),
        isAdmin ? apiRequest('/money/cash-register/history') : Promise.resolve([])
      ]);
      setRegisterData(reg);
      setExpenses(exp);
      setClosingHistory(hist);

      if (reg.existing_closing) {
        setPhysicalCashInput(String(reg.existing_closing.physical_cash));
        setClosingNotes(reg.existing_closing.notes || '');
      }
    } catch (err) {
      console.error('Failed to load cash closing data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const physicalCash = parseFloat(physicalCashInput) || 0;
  const expectedCash = registerData ? registerData.expected_cash : 0;
  const discrepancy = physicalCash - expectedCash;
  const hasShortage = discrepancy < 0;
  const hasExcess = discrepancy > 0;

  const handleSubmitClosing = async (e) => {
    e.preventDefault();
    if (!physicalCashInput) {
      alert('Please enter counted physical cash in drawer');
      return;
    }

    try {
      const res = await apiRequest('/money/cash-register/close', {
        method: 'POST',
        body: JSON.stringify({
          opening_cash: registerData?.opening_cash || 500,
          physical_cash: physicalCash,
          notes: closingNotes
        })
      });

      alert(res.message);
      loadData();
    } catch (err) {
      alert(`Submission error: ${err.message}`);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/money/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseForm)
      });
      alert('Expense recorded successfully');
      setShowExpenseModal(false);
      setExpenseForm({ category: 'Electricity (ECG)', amount: '', description: '', receipt_image: '' });
      loadData();
    } catch (err) {
      alert(`Expense error: ${err.message}`);
    }
  };

  const totalExpensesAmount = expenses.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            <span>Daily Cash Register & Expense Tracking</span>
          </h2>
          <div className="text-xs text-slate-400">
            End of day drawer reconciliation, cash discrepancy detection & shop expenses
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors">
            <Plus className="w-4 h-4 text-red-400" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold space-x-4">
        {[
          { id: 'closing', label: 'Today\'s Cash Register Closing', icon: Calculator },
          { id: 'expenses', label: `Shop Expenses (GH₵ ${totalExpensesAmount.toFixed(2)})`, icon: Receipt },
          { id: 'history', label: 'Historical Register Closings', icon: History }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 py-2.5 border-b-2 transition-all ${
                activeTab === t.id
                  ? 'border-amber-500 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}>
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DAILY CASH REGISTER CLOSING */}
      {activeTab === 'closing' && registerData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Calculation breakdown */}
          <div className="lg:col-span-2 space-y-4">
            {/* Breakdown Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm">System Calculated Expected Cash</h3>
                <span className="text-xs text-slate-400 font-mono">Date: {registerData.date}</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 text-slate-300">
                  <span>(+) Opening Cash Float in Drawer:</span>
                  <span className="font-mono text-white font-semibold">
                    GH₵ {registerData.opening_cash.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 text-emerald-400">
                  <span>(+) Today's Cash Sales:</span>
                  <span className="font-mono font-bold">
                    GH₵ {registerData.cash_sales.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 text-red-400">
                  <span>(-) Cash Expenses Paid from Drawer:</span>
                  <span className="font-mono font-bold">
                    -GH₵ {registerData.cash_expenses.toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-sm font-bold">
                  <span className="text-white">(=) SYSTEM EXPECTED CASH:</span>
                  <span className="font-mono text-amber-400 text-xl font-black">
                    GH₵ {expectedCash.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Other Payment Channels Summary today */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Other Channels Received Today (Non-Cash)
              </h4>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase block">MoMo (MTN/Telecel)</span>
                  <span className="text-base font-bold text-yellow-300 font-mono">
                    GH₵ {registerData.momo_sales.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase block">Bank Transfers</span>
                  <span className="text-base font-bold text-blue-300 font-mono">
                    GH₵ {registerData.bank_sales.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase block">Credit Sales</span>
                  <span className="text-base font-bold text-purple-300 font-mono">
                    GH₵ {registerData.credit_sales.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Physical Cash Entry & Discrepancy Alert */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xl space-y-5">
            <form onSubmit={handleSubmitClosing} className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-sm mb-1">Cashier Closing Entry</h3>
                <p className="text-xs text-slate-400">Count all physical bank notes and coins in the drawer.</p>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1.5">
                  Physical Cash Counted (GH₵) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={physicalCashInput}
                  onChange={(e) => setPhysicalCashInput(e.target.value)}
                  placeholder="e.g. 15000.00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-2xl font-bold font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* LIVE DISCREPANCY CARD */}
              {physicalCashInput !== '' && (
                <div className={`p-4 rounded-xl border space-y-1.5 transition-all ${
                  discrepancy === 0
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : hasShortage
                    ? 'bg-red-500/10 border-red-500/50 text-red-300'
                    : 'bg-blue-500/10 border-blue-500/50 text-blue-300'
                }`}>
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span>
                      {discrepancy === 0 
                        ? 'PERFECT BALANCE' 
                        : hasShortage 
                        ? 'CASH SHORTAGE DETECTED!' 
                        : 'CASH EXCESS'}
                    </span>
                    <span className="font-mono text-sm">
                      {discrepancy > 0 ? `+GH₵ ${discrepancy.toFixed(2)}` : `GH₵ ${discrepancy.toFixed(2)}`}
                    </span>
                  </div>

                  {hasShortage && (
                    <p className="text-[11px] text-red-200">
                      Warning: Cash shortage of <strong>GH₵ {Math.abs(discrepancy).toFixed(2)}</strong> will be automatically reported to the Owner / Super Admin.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 block mb-1">Closing Notes / Comments</label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Optional notes regarding discrepancy or denomination breakdown..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20">
                Submit Daily Closing Register
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES LIST */}
      {activeTab === 'expenses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Authorized By</th>
                  <th className="px-4 py-3 text-right">Amount (GH₵)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500">
                      No expenses recorded yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map(e => (
                    <tr key={e.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                        {new Date(e.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{e.description}</td>
                      <td className="px-4 py-3 text-slate-400">{e.paid_by_name || 'Admin'}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-red-400">
                        GH₵ {e.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CLOSING HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Closing Date</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3 text-right">Cash Sales</th>
                  <th className="px-4 py-3 text-right">Expected Cash</th>
                  <th className="px-4 py-3 text-right">Physical Declared</th>
                  <th className="px-4 py-3 text-right">Discrepancy</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {closingHistory.map(c => {
                  const hasShort = c.discrepancy < 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-semibold text-white">{c.closing_date}</td>
                      <td className="px-4 py-3 text-slate-300">{c.staff_name}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400">
                        GH₵ {c.cash_sales.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        GH₵ {c.expected_cash.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-white">
                        GH₵ {c.physical_cash.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${hasShort ? 'text-red-400' : 'text-emerald-400'}`}>
                        {c.discrepancy > 0 ? `+GH₵ ${c.discrepancy.toFixed(2)}` : `GH₵ ${c.discrepancy.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          hasShort ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {hasShort ? 'SHORTAGE ALERT' : 'BALANCED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base">Record Business Expense</h3>
              <button onClick={() => setShowExpenseModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Expense Category *</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Amount (GH₵) *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="e.g. 450.00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description / Purpose *</label>
                <textarea
                  required
                  rows={2}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g. Offloading 400 bags cement from Tema truck into showroom"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold">
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

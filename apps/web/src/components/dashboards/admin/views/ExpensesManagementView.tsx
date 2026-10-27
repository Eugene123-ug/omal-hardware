import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Calendar,
  Building,
  Filter,
  DollarSign,
  Download,
  Printer,
  RefreshCw,
  X,
  Check,
  Tag,
  Receipt,
  PieChart as PieChartIcon,
  Trash2,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { formatGHS } from '../../../../utils/currency';
import { PrintPreviewModal } from '../../common/PrintPreviewModal';

interface ExpensesManagementViewProps {
  currentUser?: any;
}

export const ExpensesManagementView: React.FC<ExpensesManagementViewProps> = ({ currentUser }) => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branchId, setBranchId] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptRef, setReceiptRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const canDelete = ['administrator', 'admin', 'owner'].includes((currentUser?.role || '').toLowerCase());

  const handleDeleteExpense = async (id: number, ref: string) => {
    if (!window.confirm(`Are you sure you want to delete expense #${ref}? This action is restricted to Administrators and IT Managers.`)) {
      return;
    }
    try {
      await api.deleteExpense(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense.');
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [expRes, catRes, branchRes] = await Promise.all([
        api.getExpenses(),
        api.getExpenseCategories().catch(() => ({ data: [] })),
        api.getBranches().catch(() => ({ data: [] })),
      ]);

      setExpenses(expRes.data || []);
      setCategories(catRes.data || []);
      setBranches(branchRes.data || []);
    } catch {
      setExpenses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount || Number(amount) <= 0 || !description.trim()) {
      setError('Please provide category, positive amount and description.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.recordExpense({
        branchId: Number(branchId),
        categoryId: Number(categoryId),
        amount: Number(amount),
        expenseDate,
        description: description.trim(),
        paymentMethod,
        receiptRef: receiptRef.trim() || undefined,
      });

      if (res.success) {
        setSuccessMsg(`Expense of GH₵ ${Number(amount).toFixed(2)} recorded successfully!`);
        setTimeout(() => setSuccessMsg(null), 3500);
        setAmount('');
        setDescription('');
        setReceiptRef('');
        setIsModalOpen(false);
        await loadData();
      } else {
        setError(res.message || 'Failed to record expense.');
      }
    } catch (err: any) {
      setError(err.message || 'Error recording expense.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const queryMatch =
        (e.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.category_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.expense_number || '').toLowerCase().includes(searchQuery.toLowerCase());

      const catMatch = selectedCategory === 'all' || String(e.category_id) === selectedCategory;
      const branchMatch = selectedBranch === 'all' || String(e.branch_id) === selectedBranch;

      const dateStr = (e.expense_date || '').slice(0, 10);
      const dateMatch = (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);

      return queryMatch && catMatch && branchMatch && dateMatch;
    });
  }, [expenses, searchQuery, selectedCategory, selectedBranch, startDate, endDate]);

  const totalOperatingExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  // Donut category breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filteredExpenses) {
      const cat = e.category_name || 'General';
      map.set(cat, (map.get(cat) || 0) + Number(e.amount || 0));
    }

    const colors = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#eab308', '#64748b'];
    return Array.from(map.entries()).map(([name, val], idx) => ({
      name,
      amount: val,
      percentage: totalOperatingExpenses > 0 ? Math.round((val / totalOperatingExpenses) * 100) : 0,
      color: colors[idx % colors.length],
    }));
  }, [filteredExpenses, totalOperatingExpenses]);

  const exportCSV = () => {
    if (filteredExpenses.length === 0) return;
    const headers = ['Expense Ref', 'Date', 'Category', 'Branch', 'Description', 'Method', 'Amount (GHS)', 'Receipt Ref', 'Status'];
    const rows = filteredExpenses.map((e) => [
      e.expense_number,
      (e.expense_date || '').slice(0, 10),
      `"${(e.category_name || '').replace(/"/g, '""')}"`,
      `"${(e.branch_name || '').replace(/"/g, '""')}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.payment_method,
      Number(e.amount || 0).toFixed(2),
      e.receipt_ref || '',
      e.approval_status,
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `omal_expenses_${startDate}_to_${endDate}.csv`);
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
            <CreditCard className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl font-bold tracking-tight">Operating Expenses Ledger</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track and categorize operational outflows: rent, salaries, utilities, haulage &amp; repairs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh expenses"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredExpenses.length === 0}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Cards & Donut Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Expenses Card */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Operating Expenses
            </span>
            <div className="text-3xl font-black text-slate-900 mt-2">{formatGHS(totalOperatingExpenses)}</div>
            <p className="text-xs text-slate-400 mt-1">
              Active period total across <strong>{filteredExpenses.length}</strong> logged expense vouchers
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Recorded by Admin &amp; Managers</span>
            <span className="font-bold text-orange-600">Auto-Audited</span>
          </div>
        </div>

        {/* Donut / Percentage Category Breakdown (as requested in Section 4) */}
        <div className="md:col-span-2 p-6 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-orange-500" />
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Expense Breakdown by Category</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Total: {formatGHS(totalOperatingExpenses)}</span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No expenses recorded for this period yet.
            </div>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-mono text-slate-600">
                      <strong>{formatGHS(item.amount)}</strong> ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search expenses by description or ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
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

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Expense Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-orange-600" />
            <span>Loading expenses from database...</span>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-800">No Expenses Recorded for this Period</h3>
            <p className="text-slate-400 mt-1">
              Click "Add Expense" above to record store rent, utility bills, staff wages or maintenance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Expense Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-right">Amount (GHS)</th>
                  <th className="py-3 px-4 text-right">Status</th>
                  {canDelete && <th className="py-3 px-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{exp.expense_number}</td>
                    <td className="py-3 px-4 text-slate-500 font-medium">
                      {(exp.expense_date || '').slice(0, 10)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                        <Tag className="w-3 h-3" />
                        {exp.category_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{exp.branch_name}</td>
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-sm truncate">{exp.description}</td>
                    <td className="py-3 px-4 text-center capitalize text-slate-500 font-mono">
                      {exp.payment_method || 'cash'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                      − {formatGHS(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          exp.approval_status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {exp.approval_status || 'approved'}
                      </span>
                    </td>
                    {canDelete && (
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.expense_number)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Admin: Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Record Operational Expense</h3>
                  <p className="text-[11px] text-slate-500">Log outflow into OMAL financial statement</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleRecordExpense} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch *</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expense Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Memo *</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid Electricity ECG prepaid bill for Spintex Showroom"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="cash">Cash Counter</option>
                    <option value="momo">Mobile Money (MTN / Telecel)</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receipt / Voucher Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. REC-99214"
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{submitting ? 'Saving...' : 'Record Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Print Modal */}
      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="OPERATING EXPENSES STATEMENT"
        period={`${startDate} to ${endDate}`}
        dataRows={filteredExpenses.map((e) => ({
          ref: e.expense_number,
          date: (e.expense_date || '').slice(0, 10),
          category: e.category_name,
          branch: e.branch_name,
          description: e.description,
          method: e.payment_method,
          amount: Number(e.amount || 0).toFixed(2),
        }))}
        columns={[
          { key: 'ref', header: 'Expense Ref' },
          { key: 'date', header: 'Date' },
          { key: 'category', header: 'Category' },
          { key: 'branch', header: 'Branch' },
          { key: 'description', header: 'Description' },
          { key: 'method', header: 'Method' },
          { key: 'amount', header: 'Amount (GHS)', align: 'right' },
        ]}
        totals={[
          { label: 'Total Operating Expenses', value: formatGHS(totalOperatingExpenses) },
        ]}
      />
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Calendar,
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
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { formatGHS } from '../../../../utils/currency';
import { useCompany } from '../../../../context/CompanyContext';
import { exportToPdfA4, exportToExcel } from '../../../../utils/excelTemplates';

interface ExpensesManagementViewProps {
  currentUser?: any;
}

export const ExpensesManagementView: React.FC<ExpensesManagementViewProps> = ({ currentUser }) => {
  const { companyName, companyAddress, companyPhone, currency } = useCompany();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptRef, setReceiptRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canDelete = ['administrator', 'admin', 'owner'].includes((currentUser?.role || '').toLowerCase());

  const handleDeleteExpense = async (id: number, ref: string) => {
    if (!window.confirm(`Are you sure you want to delete expense #${ref}?`)) {
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
      const [expRes, catRes] = await Promise.all([
        api.getExpenses(),
        api.getExpenseCategories().catch(() => ({ data: [] })),
      ]);

      setExpenses(expRes.data || []);
      setCategories(catRes.data || []);
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
      await api.createExpense({
        branchId: 1,
        categoryId: Number(categoryId),
        amount: Number(amount),
        expenseDate: `${expenseDate}T12:00:00.000Z`,
        description: description.trim(),
        paymentMethod,
        receiptNumber: receiptRef.trim() || undefined,
      });

      setSuccessMsg('Expense recorded successfully.');
      setIsModalOpen(false);
      setAmount('');
      setDescription('');
      setReceiptRef('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const queryMatch =
        !searchQuery ||
        (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.expense_number && e.expense_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.receipt_number && e.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()));

      const catMatch = selectedCategory === 'all' || String(e.category_id) === selectedCategory;
      const dateStr = (e.expense_date || '').slice(0, 10);
      const dateMatch = (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);

      return queryMatch && catMatch && dateMatch;
    });
  }, [expenses, searchQuery, selectedCategory, startDate, endDate]);

  const totalFilteredAmount = useMemo(
    () => filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0),
    [filteredExpenses],
  );

  const handleExportPdf = () => {
    const columns = [
      { header: 'Ref #', dataKey: 'ref' },
      { header: 'Date', dataKey: 'date' },
      { header: 'Category', dataKey: 'category' },
      { header: 'Description', dataKey: 'desc' },
      { header: 'Payment Method', dataKey: 'method' },
      { header: 'Amount (GHS)', dataKey: 'amount' },
    ];

    const data = filteredExpenses.map((e) => ({
      ref: e.expense_number || `#EXP-${e.id}`,
      date: new Date(e.expense_date).toLocaleDateString('en-GB'),
      category: e.category_name || 'General',
      desc: e.description || '-',
      method: (e.payment_method || 'cash').toUpperCase(),
      amount: Number(e.amount || 0).toFixed(2),
    }));

    exportToPdfA4({
      title: 'Company Operational Expenses Ledger',
      companyName,
      companyAddress,
      companyPhone,
      dateRange: `${startDate} to ${endDate}`,
      columns,
      data,
      summary: [
        { label: 'Total Recorded Expenses', value: formatGHS(totalFilteredAmount) },
        { label: 'Total Number of Vouchers', value: `${filteredExpenses.length} records` },
      ],
      filename: `${companyName.replace(/\s+/g, '_')}_Expenses_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const handleExportExcel = () => {
    const data = filteredExpenses.map((e) => ({
      'Expense Ref': e.expense_number || `#EXP-${e.id}`,
      Date: new Date(e.expense_date).toLocaleDateString('en-GB'),
      Category: e.category_name || 'General',
      Description: e.description || '-',
      'Payment Method': (e.payment_method || 'cash').toUpperCase(),
      'Amount (GHS)': Number(e.amount || 0),
      'Receipt Ref': e.receipt_number || '-',
    }));
    exportToExcel(data, `${companyName.replace(/\s+/g, '_')}_Expenses_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <CreditCard className="w-6 h-6 text-purple-600" />
            <h1 className="text-xl font-bold tracking-tight">Expenses Management &amp; Ledger</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Log and audit operational costs, utilities and overheads for {companyName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF (A4)</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Total Filtered Outflow</span>
          <div className="text-2xl font-black text-purple-700 mt-1">{formatGHS(totalFilteredAmount)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Across all matching expense entries</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Recorded Vouchers</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{filteredExpenses.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Authorized payment receipts</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search description or ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
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
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-slate-500 font-medium">
          Company Store: <strong className="text-emerald-700 font-semibold">{companyName}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading expense vouchers...</span>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Expenses Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Record operational expenses to monitor overheads and net commercial profitability.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ref #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount ({currency})</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {exp.expense_number || `#EXP-${exp.id}`}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {new Date(exp.expense_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-purple-700">
                      {exp.category_name || 'General'}
                    </td>
                    <td className="py-3 px-4 text-slate-800 max-w-xs truncate">{exp.description}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {exp.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      GH₵ {Number(exp.amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.expense_number || String(exp.id))}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition cursor-pointer"
                          title="Delete expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 md:left-64 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Record New Operational Expense</h3>
                <p className="text-[11px] text-slate-500">Log outflow into company accounts</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleRecordExpense} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expense Date *</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
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
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="momo">Mobile Money</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Purpose *</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Utility bill, showroom fuel, logistics delivery..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Receipt / Voucher Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-9042 or MoMo Trx ID"
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

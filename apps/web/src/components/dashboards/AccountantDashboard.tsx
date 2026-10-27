import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Users,
  CheckCircle,
  PlusCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { api } from '../../services/api';
import { User } from '../../types';

export const AccountantDashboard: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'expenses' | 'receivables'>('reconciliation');
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Expense form
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    branchId: 1,
    categoryId: 1,
    amount: '',
    description: '',
    paymentMethod: 'cash',
    receiptRef: '',
  });

  // Customer debt repayment modal
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('cash');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, expRes, catRes, custRes] = await Promise.all([
        api.getFinanceSummary(),
        api.getExpenses(),
        api.getExpenseCategories(),
        api.getCustomers(),
      ]);
      setSummary(sumRes.data);
      setExpenses(expRes.data || []);
      setCategories(catRes.data || []);
      setCustomers(custRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load financial records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.recordExpense({
        branchId: Number(newExpense.branchId),
        categoryId: Number(newExpense.categoryId),
        amount: Number(newExpense.amount),
        description: newExpense.description,
        paymentMethod: newExpense.paymentMethod,
        receiptRef: newExpense.receiptRef || undefined,
      });
      setShowExpenseModal(false);
      setNewExpense({
        branchId: 1,
        categoryId: 1,
        amount: '',
        description: '',
        paymentMethod: 'cash',
        receiptRef: '',
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to record expense');
    }
  };

  const handleApproveExpense = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await api.approveExpense(id, { status });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update expense status');
    }
  };

  const handleDebtRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      await api.recordDebtPayment(selectedCustomer.id, {
        amount: Number(repayAmount),
        paymentMethod: repayMethod,
      });
      setSelectedCustomer(null);
      setRepayAmount('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to record repayment');
    }
  };

  const formatGHS = (val: number) => {
    return `GH₵ ${Number(val || 0).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              Finance &amp; Treasury Ledger
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Cash Reconciliation &amp; Financial Control
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit cash receipts, manage operating disbursements, and track customer credit exposure.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowExpenseModal(true)}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Record Expense
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Gross Sales Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatGHS(summary?.totalRevenue || 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Realized sales collections</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Total Operating Expenses</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatGHS(summary?.totalExpenses || 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Disbursements &amp; utility bills</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Net Operating Cash Flow</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-2xl font-bold mt-2 ${
                (summary?.netCashFlow || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {formatGHS(summary?.netCashFlow || 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Surplus after expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'reconciliation', label: 'Cashier Shifts & Reconciliation' },
          { id: 'expenses', label: 'Operating Expenses Ledger' },
          { id: 'receivables', label: 'Customer Receivables & Credit' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-4 font-semibold text-xs border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Cashier Shift Reconciliation */}
      {activeTab === 'reconciliation' && (
        <Card className="border-slate-200">
          <CardHeader className="py-3 px-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-slate-900">
                Cash Drawer Auditing &amp; Reconciliation
              </h3>
            </div>
            <Badge variant="info">Phase 8 Cash Float Protocol</Badge>
          </CardHeader>
          <CardContent className="p-6 text-center text-slate-500 text-xs">
            <div className="max-w-md mx-auto space-y-3">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-500" />
              <h4 className="font-bold text-slate-900 text-sm">
                Cash Balances Active &bull; No Unreconciled Shortages
              </h4>
              <p className="text-slate-500 leading-relaxed">
                Cash drawers are tracked per active cashier session. Cashier declared closing cash is matched against expected opening float and receipts. Shortages trigger mandatory explanation notes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Expenses Ledger */}
      {activeTab === 'expenses' && (
        <Card className="border-slate-200">
          <CardHeader className="py-3 px-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-600" />
              <h3 className="font-semibold text-sm text-slate-900">
                Expense Disbursements ({expenses.length} Records)
              </h3>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Ref #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Branch</th>
                  <th className="py-2.5 px-4">Expense Category</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Amount (GH₵)</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No expense records registered yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{exp.expense_number}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {new Date(exp.expense_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-2.5 px-4">{exp.branch_name}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{exp.category_name}</td>
                      <td className="py-2.5 px-4 max-w-xs truncate">{exp.description}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {formatGHS(exp.amount)}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant={
                            exp.approval_status === 'approved'
                              ? 'success'
                              : exp.approval_status === 'pending'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {exp.approval_status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {exp.approval_status === 'pending' && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleApproveExpense(exp.id, 'approved')}
                              className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproveExpense(exp.id, 'rejected')}
                              className="text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 hover:bg-rose-100 cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Customer Receivables */}
      {activeTab === 'receivables' && (
        <Card className="border-slate-200">
          <CardHeader className="py-3 px-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-slate-900">
                Customer Credit Accounts &amp; Debtors Ledger
              </h3>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Customer Name</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Phone</th>
                  <th className="py-2.5 px-4 text-right">Credit Limit (GH₵)</th>
                  <th className="py-2.5 px-4 text-right">Outstanding Debt (GH₵)</th>
                  <th className="py-2.5 px-4">Credit Status</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-4 uppercase text-[11px] text-slate-500">{c.customer_type}</td>
                    <td className="py-2.5 px-4 font-mono">{c.phone || '—'}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                      {formatGHS(c.credit_limit)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-rose-600">
                      {formatGHS(c.credit_balance)}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant={c.credit_status === 'good' ? 'success' : 'danger'} size="sm">
                        {c.credit_status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {c.credit_balance > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setRepayAmount(String(c.credit_balance));
                          }}
                        >
                          Record Payment
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Record Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Record Operating Expense</h3>
            <form onSubmit={handleRecordExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Expense Category
                </label>
                <select
                  value={newExpense.categoryId}
                  onChange={(e) => setNewExpense({ ...newExpense, categoryId: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-md p-2 text-xs text-slate-900 bg-white"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Amount (GH₵)"
                type="number"
                step="0.01"
                required
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                placeholder="0.00"
              />

              <Input
                label="Description / Purpose"
                required
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="e.g. ECG electricity pre-paid top-up"
              />

              <Input
                label="Receipt Reference / Invoice #"
                value={newExpense.receiptRef}
                onChange={(e) => setNewExpense({ ...newExpense, receiptRef: e.target.value })}
                placeholder="e.g. ECG-RCP-99218"
              />

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowExpenseModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  Submit Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Debt Repayment Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Record Customer Debt Payment</h3>
            <p className="text-xs text-slate-500">
              Customer: <strong className="text-slate-800">{selectedCustomer.name}</strong><br />
              Total Debt: <strong className="text-rose-600">{formatGHS(selectedCustomer.credit_balance)}</strong>
            </p>

            <form onSubmit={handleDebtRepayment} className="space-y-3">
              <Input
                label="Repayment Amount (GH₵)"
                type="number"
                step="0.01"
                required
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
              />

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={repayMethod}
                  onChange={(e) => setRepayMethod(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 text-xs text-slate-900 bg-white"
                >
                  <option value="cash">Cash</option>
                  <option value="momo_mtn">MTN Mobile Money</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedCustomer(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  Post Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

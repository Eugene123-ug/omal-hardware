import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  Users,
  FileText,
  TrendingUp,
  ArrowUpRight,
  Plus,
  UserCheck,
  Shield,
  BarChart3,
  Settings,
  RefreshCw,
  Server,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Eye,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../../../services/api';

interface AdminDashboardViewProps {
  onQuickAction: (action: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onQuickAction }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('Last 7 Days');
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAdminDashboard();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load live dashboard statistics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // 30s live sync
    return () => clearInterval(interval);
  }, []);

  const formatGHS = (val: number) => {
    return `GH₵ ${Number(val || 0).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Fallback defaults for clean state
  const kpis = data?.kpis || {
    totalSalesToday: 0,
    salesGrowth: '0%',
    totalProducts: 0,
    totalStaff: 1,
    totalPurchases: 0,
    purchasesGrowth: '0%',
  };

  const chartData = data?.salesOverview?.chartData || [];
  const totalSales7Days = data?.salesOverview?.totalSales7Days || 0;
  const totalProfit7Days = data?.salesOverview?.totalProfit7Days || 0;

  const topSellingProducts = data?.topSellingProducts || [];
  const salesByCategory = data?.salesByCategory || [];
  const stockAlerts = data?.stockAlerts || [];
  const recentPurchases = data?.recentPurchases || [];
  const recentActivities = data?.recentActivities || [];

  return (
    <div className="space-y-6 pb-12">
      {/* ============================================================ */}
      {/* 1. TOP 4 KEY METRIC CARDS                                     */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Sales Today (Blue) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Sales Today</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatGHS(kpis.totalSalesToday)}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1.5">
              <span className="text-xs">↑ {kpis.salesGrowth}</span>
              <span className="text-slate-400 font-normal">vs. yesterday</span>
            </div>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-[#2563eb] text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Total Products (Green) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Products</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {kpis.totalProducts}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1.5">
              Active in stock
            </div>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-[#10b981] text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Total Staff (Purple) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Staff</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {kpis.totalStaff}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1.5">
              Active accounts
            </div>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-[#8b5cf6] text-white flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Total Purchases (Orange) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Purchases</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatGHS(kpis.totalPurchases)}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1.5">
              <span className="text-xs">↑ {kpis.purchasesGrowth}</span>
              <span className="text-slate-400 font-normal">vs. last week</span>
            </div>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-[#f97316] text-white flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. ROW 1: SALES OVERVIEW (CHART) + RECENT ACTIVITIES         */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Sales Overview Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h3 className="font-bold text-base text-slate-900">Sales Overview</h3>
                <div className="flex items-center gap-4 mt-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="text-slate-600 font-medium">Sales</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 font-medium">Profit</span>
                  </div>
                </div>
              </div>

              {/* Time Period Filter Dropdown */}
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                <option>Last 7 Days</option>
                <option>This Month</option>
                <option>This Year</option>
              </select>
            </div>

            {/* Line Chart & Summary Cards Container */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
              {/* Line Chart Canvas (3 cols) */}
              <div className="sm:col-span-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 5000]}
                      ticks={[0, 1000, 2000, 3000, 4000, 5000]}
                    />
                    <Tooltip
                      formatter={(val: any) => [`GH₵ ${Number(val).toLocaleString()}`, '']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Right Side Summary Stats inside card (1 col) */}
              <div className="sm:col-span-1 space-y-4 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500">Total Sales (7 days)</span>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {formatGHS(totalSales7Days)}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-600 mt-1 flex items-center gap-0.5">
                    <span>↑ 12%</span>
                    <span className="text-slate-400 font-normal">vs. previous 7 days</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500">Total Profit (7 days)</span>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {formatGHS(totalProfit7Days)}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-600 mt-1 flex items-center gap-0.5">
                    <span>↑ 10%</span>
                    <span className="text-slate-400 font-normal">vs. previous 7 days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Recent Activities Live Feed */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base text-slate-900">Recent Activities</h3>
              <button
                onClick={() => onQuickAction('audit_logs')}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                View All
              </button>
            </div>

            {/* Activities List */}
            <div className="space-y-4">
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No recent activities recorded yet.
                </div>
              ) : (
                recentActivities.map((act: any) => {
                  const getIcon = () => {
                    switch (act.type) {
                      case 'sale':
                        return <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />;
                      case 'product':
                        return <Package className="w-3.5 h-3.5 text-emerald-600" />;
                      case 'purchase':
                        return <FileText className="w-3.5 h-3.5 text-purple-600" />;
                      case 'staff':
                        return <Users className="w-3.5 h-3.5 text-sky-600" />;
                      case 'role':
                        return <Shield className="w-3.5 h-3.5 text-amber-600" />;
                      case 'alert':
                        return <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />;
                      default:
                        return <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />;
                    }
                  };

                  const getBg = () => {
                    switch (act.type) {
                      case 'sale':
                        return 'bg-blue-50';
                      case 'product':
                        return 'bg-emerald-50';
                      case 'purchase':
                        return 'bg-purple-50';
                      case 'staff':
                        return 'bg-sky-50';
                      case 'role':
                        return 'bg-amber-50';
                      case 'alert':
                        return 'bg-rose-50';
                      default:
                        return 'bg-slate-100';
                    }
                  };

                  return (
                    <div key={act.id} className="flex items-start gap-3 text-xs">
                      <div className={`w-8 h-8 rounded-full ${getBg()} flex items-center justify-center shrink-0 mt-0.5`}>
                        {getIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{act.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">{act.subtitle}</div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0 pt-0.5">{act.time}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. ROW 2: TOP SELLING PRODUCTS + SALES BY CATEGORY           */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Top Selling Products Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900">Top Selling Products</h3>
            <button
              onClick={() => onQuickAction('products')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Qty Sold</th>
                  <th className="py-2.5 px-3 text-right">Total Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {topSellingProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No sales recorded yet. Products sold at the counter will appear here.
                    </td>
                  </tr>
                ) : (
                  topSellingProducts.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 text-slate-400 font-semibold">{p.id}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-3 px-3 text-slate-500">{p.category}</td>
                      <td className="py-3 px-3 font-bold text-slate-800">{p.qtySold}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatGHS(p.totalSales)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Sales by Category (Interactive Donut Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 mb-2">Sales by Category</h3>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 my-2">
              {/* Donut Chart with Center Total */}
              <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByCategory}
                      dataKey="percentage"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {salesByCategory.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-xs font-bold text-slate-900">
                    {formatGHS(totalSales7Days)}
                  </span>
                  <span className="text-[10px] text-slate-400">Total Sales</span>
                </div>
              </div>

              {/* Legend with percentage values */}
              <div className="space-y-2 text-xs">
                {salesByCategory.map((cat: any) => (
                  <div key={cat.name} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-slate-600 font-medium">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">{cat.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. ROW 3: STOCK ALERTS + QUICK ACTIONS                       */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 1 Col: Stock Alerts Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900">Stock Alerts</h3>
            <button
              onClick={() => onQuickAction('inventory')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3 text-center">Current Stock</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {stockAlerts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-slate-400">
                    No low stock alerts. Warehouse quantities are in good standing.
                  </td>
                </tr>
              ) : (
                stockAlerts.map((s: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-semibold text-slate-900">{s.product}</td>
                    <td className="py-3 px-3 text-center font-bold text-red-600">{s.currentStock}</td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                          s.status === 'Low Stock'
                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Right 2 Cols: Quick Actions 6-Card Grid */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 mb-4">Quick Actions</h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Action 1: Add Product */}
              <button
                onClick={() => onQuickAction('add_product')}
                className="p-4 rounded-xl bg-blue-50/60 hover:bg-blue-50 border border-blue-100 text-left transition group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900">Add Product</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Create a new product</div>
              </button>

              {/* Action 2: Manage Staff */}
              <button
                onClick={() => onQuickAction('manage_staff')}
                className="p-4 rounded-xl bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100 text-left transition group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition">
                  <Users className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900">Manage Staff</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Add or edit staff</div>
              </button>

              {/* Action 3: Create Role */}
              <button
                onClick={() => onQuickAction('create_role')}
                className="p-4 rounded-xl bg-purple-50/60 hover:bg-purple-50 border border-purple-100 text-left transition group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900">Create Role</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Set permissions</div>
              </button>

              {/* Action 4: View Reports */}
              <button
                onClick={() => onQuickAction('view_reports')}
                className="p-4 rounded-xl bg-sky-50/60 hover:bg-sky-50 border border-sky-100 text-left transition group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900">View Reports</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Sales, purchases, profit</div>
              </button>

              {/* Action 5: Purchase Stock */}
              <button
                onClick={() => onQuickAction('purchase_stock')}
                className="p-4 rounded-xl bg-orange-50/60 hover:bg-orange-50 border border-orange-100 text-left transition group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900">Purchase Stock</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Create purchase order</div>
              </button>

              {/* Action 6: System Settings */}
              <button
                onClick={() => onQuickAction('system_settings')}
                className="p-4 rounded-xl bg-slate-100/70 hover:bg-slate-100 border border-slate-200 text-left transition group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition">
                  <Settings className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900">System Settings</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Configure system</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 5. ROW 4: RECENT PURCHASES + SYSTEM INFORMATION              */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Recent Purchases Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900">Recent Purchases</h3>
            <button
              onClick={() => onQuickAction('purchases')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Items</th>
                  <th className="py-2.5 px-3">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {recentPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No purchase orders recorded yet. Stock inward manifests will appear here.
                    </td>
                  </tr>
                ) : (
                  recentPurchases.map((pur: any) => (
                    <tr key={pur.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 text-slate-400 font-semibold">{pur.id}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{pur.supplier}</td>
                      <td className="py-3 px-3 text-slate-500">{pur.items}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {formatGHS(pur.totalAmount)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 text-[11px]">
                        {pur.date}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: System Information Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-slate-700" />
              <h3 className="font-bold text-base text-slate-900">System Information</h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Software Version</span>
                <span className="font-mono font-semibold text-slate-800">v1.0.0</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Database Status</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-emerald-600">Connected</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Last Backup</span>
                <span className="font-semibold text-slate-800">May 27, 2025 08:00 AM</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Uptime</span>
                <span className="font-semibold text-slate-800">12 hours, 24 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

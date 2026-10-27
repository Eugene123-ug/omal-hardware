import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { 
  Smartphone, TrendingUp, AlertTriangle, Bell, Clock, 
  DollarSign, Package, CheckCircle2, RefreshCw, Eye, 
  ArrowUpRight, ArrowDownRight, ShieldAlert, Truck, ChevronRight
} from 'lucide-react';

export default function OwnerRemoteDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [morningSummary, setMorningSummary] = useState(null);
  const [liveSales, setLiveSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefreshSecs, setAutoRefreshSecs] = useState(10);

  const fetchOwnerData = async () => {
    try {
      const [dash, morning] = await Promise.all([
        apiRequest('/reports/dashboard'),
        apiRequest('/reports/morning-summary')
      ]);
      setDashboardData(dash);
      setMorningSummary(morning);
      if (dash.recent_sales) {
        setLiveSales(dash.recent_sales);
      }
    } catch (err) {
      console.error('Owner dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOwnerData();
    const interval = setInterval(fetchOwnerData, 10000); // 10s auto-refresh for live phone tracking
    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboardData) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
        <p>Connecting to Ghana shop database...</p>
      </div>
    );
  }

  const { today, low_stock_items, cash_alert, top_selling, credit_owed } = dashboardData || {};

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Remote Owner Top Status Header */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute right-3 top-3 opacity-10">
          <Smartphone className="w-32 h-32 text-amber-400" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                Remote Executive Surveillance
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">OMAL Hardware & Tiles Ghana</h2>
            <div className="text-xs text-slate-400 mt-0.5">
              Live link to Accra Showroom & Tema Depot • Refreshing every {autoRefreshSecs}s
            </div>
          </div>

          <button
            onClick={fetchOwnerData}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {/* 1. CASH ALERT WIDGET (Discrepancy / Shortage from closing) */}
      {cash_alert && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-lg ${
          cash_alert.has_shortage
            ? 'bg-red-500/10 border-red-500/40 text-red-200'
            : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
        }`}>
          <div className={`p-2 rounded-xl shrink-0 ${cash_alert.has_shortage ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs space-y-1">
            <div className="font-bold text-sm text-white flex items-center justify-between">
              <span>{cash_alert.has_shortage ? 'Cash Shortage Detected' : 'Cash Closing Balanced'}</span>
              <span className="font-mono text-xs">{cash_alert.date}</span>
            </div>
            <p>
              Staff <strong>{cash_alert.staff_name}</strong> submitted register closing:
              Expected cash was <strong>GH₵ {cash_alert.expected?.toFixed(2)}</strong>, but declared physical cash was <strong>GH₵ {cash_alert.physical?.toFixed(2)}</strong>.
            </p>
            {cash_alert.has_shortage && (
              <div className="font-bold text-red-400 text-sm pt-1">
                Shortage Discrepancy: -GH₵ {Math.abs(cash_alert.discrepancy).toFixed(2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. 8:00 AM MORNING REPORT CARD (Yesterday's summary) */}
      {morningSummary && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Clock className="w-4 h-4" />
              <span>Morning Executive Brief (Yesterday: {morningSummary.date})</span>
            </div>
            <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Daily 8:00 AM</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Yesterday Revenue</span>
              <span className="text-base font-bold text-white font-mono">
                GH₵ {morningSummary.yesterday_revenue?.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Yesterday Net Profit</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                GH₵ {morningSummary.yesterday_net_profit?.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Yesterday Expenses</span>
              <span className="text-base font-bold text-slate-300 font-mono">
                GH₵ {morningSummary.yesterday_expenses?.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Low Stock Alerts</span>
              <span className="text-base font-bold text-amber-400 font-mono">
                {morningSummary.low_stock_count} items
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. TODAY'S LIVE NUMBERS FOR THE OWNER */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Today's Sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Today's Total Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            GH₵ {today?.sales?.toFixed(2) || '0.00'}
          </div>
          <div className="text-[10px] text-slate-500">
            {today?.transactions || 0} completed orders today
          </div>
        </div>

        {/* Today's Net Profit (Super Admin privilege) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Today's Net Profit</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            GH₵ {today?.net_profit?.toFixed(2) || '0.00'}
          </div>
          <div className="text-[10px] text-emerald-500/80 font-medium">
            Margin: {today?.profit_margin || '0%'}
          </div>
        </div>

        {/* Customer Credit Debt Owed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Customer Debt Owed</span>
            <ArrowUpRight className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 font-mono">
            GH₵ {credit_owed?.toFixed(2) || '0.00'}
          </div>
          <div className="text-[10px] text-slate-500">Owed by contractors & clients</div>
        </div>

        {/* Cash in Drawer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400 block">Cash in Register</span>
          <div className="text-xl font-bold text-amber-300 font-mono">
            GH₵ {today?.cash?.toFixed(2) || '0.00'}
          </div>
          <span className="text-[10px] text-slate-500">Physical paper cedis</span>
        </div>

        {/* MoMo Received Today */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400 block">MoMo Received</span>
          <div className="text-xl font-bold text-yellow-300 font-mono">
            GH₵ {today?.momo?.toFixed(2) || '0.00'}
          </div>
          <span className="text-[10px] text-slate-500">MTN / Telecel wallet</span>
        </div>

        {/* Expenses Paid Today */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400 block">Shop Expenses</span>
          <div className="text-xl font-bold text-red-400 font-mono">
            GH₵ {today?.expenses?.toFixed(2) || '0.00'}
          </div>
          <span className="text-[10px] text-slate-500">Rent, ECG, fuel, labor</span>
        </div>
      </div>

      {/* 4. LIVE SALES PUSH NOTIFICATION STREAM */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>Live Sales Feed (Real-Time Counter Stream)</span>
          </div>
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Live
          </span>
        </div>

        <div className="space-y-2">
          {liveSales.map((s, idx) => (
            <div 
              key={s.id || idx}
              className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 p-3 rounded-xl flex items-center justify-between text-xs transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  {s.staff_name?.charAt(0) || 'S'}
                </div>
                <div>
                  <div className="text-slate-200 font-semibold">
                    Staff <strong className="text-white">{s.staff_name}</strong> completed sale
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Receipt #{s.receipt_no} • {s.customer_name} • {new Date(s.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold text-amber-400 font-mono">
                  GH₵ {s.total_amount?.toFixed(2)}
                </div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                  {s.payment_method}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. LOW STOCK CARDS WITH PHOTO & REORDER TRIGGER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Package className="w-4 h-4 text-amber-400" />
            <span>Critical Low Stock Items (Reorder Needed)</span>
          </div>
          <span className="text-xs text-amber-400 font-semibold">
            {low_stock_items?.length || 0} items low
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {low_stock_items?.map(item => (
            <div 
              key={item.id}
              className="bg-slate-800/40 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
              <img 
                src={item.image_url || 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=100'} 
                alt={item.name} 
                className="w-14 h-14 rounded-lg object-cover bg-slate-950 shrink-0 border border-slate-700" 
              />
              <div className="flex-1 min-w-0 text-xs">
                <h5 className="font-semibold text-white truncate" title={item.name}>{item.name}</h5>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku}</div>
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="text-red-400 font-bold">
                    Stock: {item.current_stock} {item.unit}
                  </span>
                  <span className="text-slate-500">Min Alert: {item.min_stock_alert}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

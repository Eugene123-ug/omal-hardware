import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Warehouse,
  AlertTriangle,
  CreditCard,
  ShieldAlert,
  Building,
  RefreshCw,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { api } from '../../services/api';

export const OwnerDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getOwnerDashboard();
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load executive monitoring dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatGHS = (val: number) => {
    return `GH₵ ${Number(val || 0).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Remote Executive Surveillance
              </span>
              <span className="text-xs text-slate-400">Live Sync (30s)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Accra Showroom &amp; Tema Depot Overview
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidated remote surveillance of multi-branch hardware operations, stock valuations, and audit trail.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Feed
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Today's Gross Sales
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatGHS(data?.todaySalesTotal || 0)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-medium flex items-center">
                <ArrowUpRight className="w-3 h-3 inline" /> Real-time
              </span>
              across both branches
            </p>
          </CardContent>
        </Card>

        {/* Total Stock Valuation */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Stock Valuation
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Warehouse className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatGHS(
                (data?.inventoryValuation || []).reduce(
                  (sum: number, w: any) => sum + Number(w.valuation || 0),
                  0,
                ),
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              At cost price (Accra &amp; Tema)
            </p>
          </CardContent>
        </Card>

        {/* Customer Receivables (Credit Owed) */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Outstanding Receivables
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatGHS(data?.totalReceivables || 0)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Contractor &amp; wholesale debt
            </p>
          </CardContent>
        </Card>

        {/* Low Stock Reorder Alerts */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Low Stock Thresholds
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {data?.lowStockItemsCount || 0}
            </div>
            <p className="text-[11px] text-rose-600 font-medium mt-1">
              Items at or below reorder level
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dual-Branch Stock Valuation Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-slate-800">
                Warehouse Valuation Breakdown
              </h3>
            </div>
            <Badge variant="neutral">Verified Stock Levels</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {(data?.inventoryValuation || []).map((w: any) => (
                <div key={w.warehouseId} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{w.warehouseName}</span>
                      <Badge variant="info" size="sm">{w.warehouseCode}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Physical Units on Hand: <span className="font-medium text-slate-700">{Number(w.totalUnits || 0).toLocaleString()} units</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">{formatGHS(w.valuation)}</div>
                    <div className="text-[11px] text-slate-400">Ledger value</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dual Branch Sales Performance */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-sm text-slate-800">
                Today's Branch Performance
              </h3>
            </div>
            <Badge variant="success">Active Trading Day</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {(data?.salesByBranch || []).length > 0 ? (
                (data.salesByBranch || []).map((b: any) => (
                  <div key={b.branchId} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-slate-900">{b.branchName}</span>
                      <div className="text-xs text-slate-500 mt-0.5">Branch Code: {b.branchCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-700">{formatGHS(b.totalAmount)}</div>
                      <div className="text-[11px] text-slate-400">Total processed</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  No sales completed yet today across branches.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Immutable Audit Feed */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-sm text-slate-800">
              Tamper-Evident Audit Ledger (Live Surveillance)
            </h3>
          </div>
          <Badge variant="success">Append-Only Immutability Active</Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Timestamp (UTC/GMT)</th>
                <th className="py-2.5 px-4">Operator</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Target Entity</th>
                <th className="py-2.5 px-4">Result</th>
                <th className="py-2.5 px-4">IP / Terminal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.recentAuditLogs || []).map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {new Date(log.occurred_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {log.actor_label || 'System'}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                      {log.action}
                    </code>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                    {log.entity_type ? `${log.entity_type} #${log.entity_id}` : '—'}
                  </td>
                  <td className="py-2.5 px-4">
                    <Badge variant={log.result === 'success' ? 'success' : 'danger'} size="sm">
                      {log.result.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {log.ip_address || '127.0.0.1'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

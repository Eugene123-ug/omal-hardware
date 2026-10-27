import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  RefreshCw,
  Eye,
  Download,
  Calendar,
  DollarSign,
  PackageCheck,
  Building,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { useCompany } from '../../../../context/CompanyContext';
import { exportToPdfA4, exportToExcel } from '../../../../utils/excelTemplates';

interface PurchaseOrdersViewProps {
  onNewPurchase?: () => void;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({ onNewPurchase }) => {
  const { settings } = useCompany();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await api.getPurchaseOrders();
      if (res.data) {
        setOrders(res.data);
      }
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleMarkAsReceived = async (order: any) => {
    if (!window.confirm(`Mark Purchase Order ${order.po_number} as RECEIVED and add its items to live stock?`)) return;

    try {
      const res = await api.receivePurchaseOrder(order.id);
      setMsg({ type: 'success', text: res.message || `Order ${order.po_number} received into stock.` });
      fetchOrders();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to receive order' });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  const handleDeleteOrder = async (order: any) => {
    if (!window.confirm(`Are you sure you want to delete purchase order ${order.po_number}?`)) return;

    try {
      const res = await api.deletePurchaseOrder(order.id);
      setMsg({ type: 'success', text: res.message || 'Order deleted successfully' });
      fetchOrders();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete order' });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.po_number?.toLowerCase().includes(term) ||
      o.supplier_name?.toLowerCase().includes(term) ||
      o.creator_name?.toLowerCase().includes(term)
    );
  });

  const handleExportPdf = () => {
    const headers = ['PO Number', 'Supplier', 'Order Date', 'Items', 'Total (GHS)', 'Status'];
    const rows = filtered.map((o) => [
      o.po_number,
      o.supplier_name || 'N/A',
      new Date(o.order_date).toLocaleDateString('en-GB'),
      o.items?.length || 0,
      Number(o.total_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 }),
      o.status.toUpperCase(),
    ]);
    exportToPdfA4({
      title: 'Commercial Purchase Orders Register',
      filename: `${settings.companyName.replace(/[^A-Za-z0-9]+/g, '_')}_Purchase_Orders_${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows,
      settings,
      dateRange: `Status: ${statusFilter.toUpperCase()} | Count: ${filtered.length}`,
      orientation: 'landscape',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Purchase Orders (Placed)</h2>
            <p className="text-xs text-slate-500">
              Track vendor orders placed, pending stock arrival, and supplier delivery confirmations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportPdf}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-red-600" />
            Export PDF (A4)
          </button>
          {onNewPurchase && (
            <button
              onClick={onNewPurchase}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* Message notification */}
      {msg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO number or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {['all', 'draft', 'pending_approval', 'approved', 'received'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition capitalize ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
          <button
            onClick={fetchOrders}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">PO Number</th>
                <th className="px-4 py-3.5">Supplier</th>
                <th className="px-4 py-3.5">Order Date</th>
                <th className="px-4 py-3.5">Items</th>
                <th className="px-4 py-3.5 text-right">Total Amount</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading purchase orders...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No purchase orders found matching your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-bold font-mono text-slate-900">
                      {o.po_number}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {o.supplier_name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono">
                      {new Date(o.order_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      <span className="font-semibold">{o.items?.length || 0}</span> item(s)
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      {settings.currency} {Number(o.total_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          o.status === 'received' || o.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.status === 'pending_approval' || o.status === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {o.status !== 'received' && o.status !== 'completed' && (
                          <button
                            onClick={() => handleMarkAsReceived(o)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-sm cursor-pointer"
                            title="Mark as Received & Add Stock"
                          >
                            <PackageCheck className="w-3 h-3" />
                            Receive Stock
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Order Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(o)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Purchase Order: {selectedOrder.po_number}</h3>
                <p className="text-xs text-slate-400">Supplier: {selectedOrder.supplier_name}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Cost</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOrder.items?.map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium">{it.product_name} ({it.sku})</td>
                      <td className="px-3 py-2 text-center">{it.quantity_ordered} {it.unit}</td>
                      <td className="px-3 py-2 text-right font-mono">{settings.currency} {it.unit_cost?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {settings.currency} {(it.quantity_ordered * it.unit_cost)?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center font-bold text-sm">
                <span>Grand Total:</span>
                <span className="font-mono text-blue-600">
                  {settings.currency} {Number(selectedOrder.total_amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

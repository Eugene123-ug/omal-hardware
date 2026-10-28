import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Download,
  FileText,
  Calendar,
  Eye,
  Trash2,
  RefreshCw,
  Building,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { useCompany } from '../../../../context/CompanyContext';
import { exportToPdfA4, exportToExcel } from '../../../../utils/excelTemplates';

export const PurchaseHistoryView: React.FC = () => {
  const { settings } = useCompany();
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await api.getPurchaseHistory();
      if (res.data) {
        setHistory(res.data);
      }
    } catch {
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Delete purchase record ${item.po_number || `#${item.id}`} from history? (Admin only)`)) return;

    try {
      await api.deletePurchaseOrder(item.id);
      setMsg({ type: 'success', text: `Purchase record ${item.po_number} deleted.` });
      fetchHistory();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete purchase record' });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  const filtered = history.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.po_number?.toLowerCase().includes(term) ||
      p.supplier_name?.toLowerCase().includes(term) ||
      p.received_by_name?.toLowerCase().includes(term)
    );
  });

  const totalSpent = filtered.reduce((acc, p) => acc + Number(p.total_amount || 0), 0);

  const handleExportPdf = () => {
    const headers = ['Date', 'Supplier', 'PO / Invoice Ref', 'Received By', 'Items', 'Total (GHS)'];
    const rows = filtered.map((p) => [
      new Date(p.updated_at || p.order_date).toLocaleDateString('en-GB'),
      p.supplier_name,
      p.po_number,
      p.received_by_name || 'System Admin',
      p.items?.length || 0,
      Number(p.total_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 }),
    ]);

    exportToPdfA4({
      title: 'Historical Stock Inward & Purchases Log',
      filename: `${settings.companyName.replace(/[^A-Za-z0-9]+/g, '_')}_Purchase_History_${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows,
      settings,
      dateRange: `Total Completed Orders: ${filtered.length} | Total Value: ${settings.currency} ${totalSpent.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`,
      orientation: 'landscape',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Purchase History (Completed)</h2>
            <p className="text-xs text-slate-500">
              Audited historical log of received vendor supplies already added into active company inventory
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportPdf}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-red-600" />
            Export PDF (A4)
          </button>
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
            placeholder="Search invoice number, supplier or receiver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span>
            Total Procured: <strong>{settings.currency} {totalSpent.toLocaleString('en-GH', { minimumFractionDigits: 2 })}</strong>
          </span>
          <button
            onClick={fetchHistory}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Received Date</th>
                <th className="px-4 py-3.5">Supplier Name</th>
                <th className="px-4 py-3.5">PO / Invoice Number</th>
                <th className="px-4 py-3.5">Received By</th>
                <th className="px-4 py-3.5">Items Count</th>
                <th className="px-4 py-3.5 text-right">Total Cost</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Loading purchase history...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No completed purchases recorded in history yet.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-mono text-slate-700">
                      {new Date(item.updated_at || item.order_date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">
                      {item.supplier_name}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-blue-600">
                      {item.po_number}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 font-medium">
                      {item.received_by_name || 'System Administrator'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <span className="font-semibold text-slate-800">{item.items?.length || 0}</span> product(s)
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      {settings.currency} {Number(item.total_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedPurchase(item)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="View Inward Breakdown"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete History Record"
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

      {/* Purchase Breakdown Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Purchase Receipt: {selectedPurchase.po_number}</h3>
                <p className="text-xs text-slate-400">Supplier: {selectedPurchase.supplier_name}</p>
              </div>
              <button onClick={() => setSelectedPurchase(null)} className="p-1.5 text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Item Name</th>
                    <th className="px-3 py-2 text-center">Qty Received</th>
                    <th className="px-3 py-2 text-right">Unit Cost</th>
                    <th className="px-3 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPurchase.items?.map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium">{it.product_name} ({it.sku})</td>
                      <td className="px-3 py-2 text-center">{it.quantity_ordered || it.quantity_received}</td>
                      <td className="px-3 py-2 text-right font-mono">{settings.currency} {Number(it.unit_cost).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {settings.currency} {(it.quantity_ordered * it.unit_cost)?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center font-bold text-sm">
                <span>Total Purchase Cost:</span>
                <span className="font-mono text-emerald-600">
                  {settings.currency} {Number(selectedPurchase.total_amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

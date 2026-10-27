import React, { useState, useEffect } from 'react';
import {
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  Building2,
  Search,
  CheckCircle,
  Trash2,
  Download,
  Printer,
  FileSpreadsheet,
  PlusCircle,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { useCompany } from '../../../../context/CompanyContext';
import { exportToPdfA4, exportToExcel } from '../../../../utils/excelTemplates';

export const InventoryMovementView: React.FC = () => {
  const { companyName, companyAddress, companyPhone, currency } = useCompany();
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'levels' | 'movements'>('levels');
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [levelsRes, movRes] = await Promise.all([
        api.getStockLevels(),
        api.getAuditLogs({ limit: 100 }).catch(() => ({ data: [] })),
      ]);

      if (levelsRes && levelsRes.success) {
        setStockLevels(levelsRes.data?.levels || levelsRes.data || []);
      } else if (Array.isArray(levelsRes)) {
        setStockLevels(levelsRes);
      } else {
        setStockLevels([]);
      }

      setMovements(movRes?.data || []);
    } catch {
      setStockLevels([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteMovement = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this movement record? This will adjust audit logs.')) {
      return;
    }
    setIsDeleting(id);
    try {
      await api.deleteStockMovement(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete movement');
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredLevels = stockLevels.filter((s) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (s.product_name && s.product_name.toLowerCase().includes(term)) ||
      (s.sku && s.sku.toLowerCase().includes(term)) ||
      (s.category && s.category.toLowerCase().includes(term))
    );
  });

  const handleExportPdf = () => {
    const columns = [
      { header: 'SKU', dataKey: 'sku' },
      { header: 'Product Name', dataKey: 'name' },
      { header: 'Category', dataKey: 'category' },
      { header: 'Cost (GHS)', dataKey: 'cost' },
      { header: 'Price (GHS)', dataKey: 'price' },
      { header: 'Quantity in Stock', dataKey: 'qty' },
    ];

    const data = filteredLevels.map((s) => ({
      sku: s.sku || '-',
      name: s.product_name || s.name || '-',
      category: s.category || 'General Hardware',
      cost: Number(s.cost_price || 0).toFixed(2),
      price: Number(s.selling_price || 0).toFixed(2),
      qty: s.quantity ?? s.totalOnHand ?? s.quantity_on_hand ?? 0,
    }));

    exportToPdfA4({
      title: 'Company Inventory Ledger & Stock Report',
      companyName,
      companyAddress,
      companyPhone,
      dateRange: `Report Generated: ${new Date().toLocaleDateString('en-GB')}`,
      columns,
      data,
      filename: `${companyName.replace(/\s+/g, '_')}_Inventory_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const handleExportExcel = () => {
    const exportData = filteredLevels.map((s) => ({
      SKU: s.sku || '-',
      'Product Name': s.product_name || s.name || '-',
      Category: s.category || 'General Hardware',
      'Cost Price (GHS)': Number(s.cost_price || 0),
      'Selling Price (GHS)': Number(s.selling_price || 0),
      'Quantity in Stock': s.quantity ?? s.totalOnHand ?? s.quantity_on_hand ?? 0,
      Unit: s.unit || 'pcs',
    }));
    exportToExcel(exportData, `${companyName.replace(/\s+/g, '_')}_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Inventory Ledger &amp; Stock Levels</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time physical stock inventory and movement audit for {companyName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF (A4)</span>
          </button>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search product, SKU or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong>{filteredLevels.length}</strong> items in inventory
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading company stock inventory...</span>
          </div>
        ) : filteredLevels.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Inventory Ledger is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add products or import an Excel spreadsheet to start tracking stock quantities.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Cost Price ({currency})</th>
                  <th className="px-4 py-3 text-right">Selling Price ({currency})</th>
                  <th className="px-4 py-3 text-right">Physical Quantity</th>
                  <th className="px-4 py-3 text-right">Asset Value ({currency})</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLevels.map((s) => {
                  const qty = Number(s.quantity ?? s.totalOnHand ?? s.quantity_on_hand ?? 0);
                  const cost = Number(s.cost_price || 0);
                  const sell = Number(s.selling_price || 0);
                  const assetVal = qty * cost;
                  const isLow = qty <= 10;

                  return (
                    <tr key={s.product_id || s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {s.sku || `PRD-${s.id}`}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {s.product_name || s.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.category || 'General Hardware'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        GH₵ {cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        GH₵ {sell.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            qty === 0
                              ? 'bg-rose-100 text-rose-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {qty} {s.unit || 'pcs'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        GH₵ {assetVal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {qty === 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            Optimal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

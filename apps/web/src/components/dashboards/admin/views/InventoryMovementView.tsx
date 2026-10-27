import React, { useState, useEffect } from 'react';
import {
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  Building2,
  Search,
  CheckCircle,
} from 'lucide-react';
import { api } from '../../../../services/api';

export const InventoryMovementView: React.FC = () => {
  const [activeWarehouse, setActiveWarehouse] = useState<'all' | '1' | '2'>('all');
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadStock = async () => {
      setIsLoading(true);
      try {
        const res = await api.getStockLevels();
        if (res && res.success) {
          setStockLevels(res.data?.levels || res.data || []);
        } else if (Array.isArray(res)) {
          setStockLevels(res);
        } else {
          setStockLevels([]);
        }
      } catch {
        setStockLevels([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadStock();
  }, [activeWarehouse]);

  const filtered = stockLevels.filter((s) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (s.product_name && s.product_name.toLowerCase().includes(term)) ||
      (s.sku && s.sku.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Inventory Ledger &amp; Depot Stock</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-location stock tracking across Accra Showroom and Tema Bulk Depot.
          </p>
        </div>

        {/* Warehouse Filter */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveWarehouse('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeWarehouse === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Locations
          </button>
          <button
            onClick={() => setActiveWarehouse('1')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeWarehouse === '1'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Accra Showroom
          </button>
          <button
            onClick={() => setActiveWarehouse('2')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeWarehouse === '2'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tema Depot
          </button>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search product or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="text-xs text-slate-500">
            <strong>{filtered.length}</strong> items tracked
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading warehouse stock levels...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Inventory Ledger is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When products are created and purchase orders or stock inwards are received, their quantities in Accra and Tema will be tracked here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Physical Quantity</th>
                  <th className="px-4 py-3 text-right">Reorder Threshold</th>
                  <th className="px-4 py-3 text-center">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{row.sku}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.product_name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.warehouse_name || 'Accra Main Depot'}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {row.quantity_on_hand || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {row.reorder_threshold || 10}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        In Stock
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

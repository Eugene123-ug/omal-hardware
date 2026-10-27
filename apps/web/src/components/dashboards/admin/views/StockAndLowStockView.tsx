import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  Plus,
  LayoutGrid,
  List,
  Building,
  TrendingDown,
  Trash2,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { formatGHS } from '../../../../utils/currency';
import { PrintPreviewModal } from '../../common/PrintPreviewModal';

interface StockAndLowStockViewProps {
  initialFilter?: 'all' | 'low_stock' | 'out_of_stock';
  currentUser?: any;
  onAddProduct?: () => void;
  onRestock?: (product?: any) => void;
}

export const StockAndLowStockView: React.FC<StockAndLowStockViewProps> = ({
  initialFilter = 'all',
  currentUser,
  onAddProduct,
  onRestock,
}) => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canDelete = ['administrator', 'admin', 'owner'].includes((currentUser?.role || '').toLowerCase());

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete product "${name}"? Only Administrators and IT Managers can perform this action.`)) {
      return;
    }
    try {
      await api.deleteProduct(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete product.');
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>(
    initialFilter === 'low_stock' ? 'low_stock' : 'all'
  );
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes, branchRes] = await Promise.all([
        api.getProducts(),
        api.getCategories().catch(() => ({ data: [] })),
        api.getBranches().catch(() => ({ data: [] })),
      ]);

      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setBranches(branchRes.data || []);
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialFilter === 'low_stock') {
      setStatusFilter('low_stock');
    }
  }, [initialFilter]);

  // Derived Dynamic Computations
  const totalStockValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.totalOnHand || 0) * Number(p.cost_price || 0)), 0);
  }, [products]);

  const totalProductsCount = products.length;

  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      const onHand = Number(p.totalOnHand || 0);
      const alertThresh = Number(p.min_stock_alert || 10);
      return onHand > 0 && onHand <= alertThresh;
    }).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => Number(p.totalOnHand || 0) === 0).length;
  }, [products]);

  // Category Stock Level Breakdown
  const categoryStockBars = useMemo(() => {
    const map = new Map<string, { name: string; count: number; value: number }>();
    for (const p of products) {
      const catName = p.category_name || 'General Hardware';
      const prev = map.get(catName) || { name: catName, count: 0, value: 0 };
      const onHand = Number(p.totalOnHand || 0);
      prev.count += onHand;
      prev.value += onHand * Number(p.cost_price || 0);
      map.set(catName, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const catMatch = selectedCategory === 'all' || String(p.category_code) === selectedCategory || String(p.category_id) === selectedCategory;

      const onHand = Number(p.totalOnHand || 0);
      const thresh = Number(p.min_stock_alert || 10);

      let statusMatch = true;
      if (statusFilter === 'in_stock') {
        statusMatch = onHand > thresh;
      } else if (statusFilter === 'low_stock') {
        statusMatch = onHand > 0 && onHand <= thresh;
      } else if (statusFilter === 'out_of_stock') {
        statusMatch = onHand === 0;
      }

      return nameMatch && catMatch && statusMatch;
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  const exportCSV = () => {
    if (filteredProducts.length === 0) return;
    const headers = ['SKU', 'Product Name', 'Category', 'Current Stock', 'Unit', 'Cost Price (GHS)', 'Selling Price (GHS)', 'Stock Value (GHS)', 'Reorder Level', 'Status'];
    const rows = filteredProducts.map((p) => {
      const onHand = Number(p.totalOnHand || 0);
      const thresh = Number(p.min_stock_alert || 10);
      const status = onHand === 0 ? 'Out of Stock' : onHand <= thresh ? 'Low Stock' : 'In Stock';
      return [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.category_name || '').replace(/"/g, '""')}"`,
        onHand,
        p.base_unit || 'pcs',
        Number(p.cost_price || 0).toFixed(2),
        Number(p.selling_price || 0).toFixed(2),
        (onHand * Number(p.cost_price || 0)).toFixed(2),
        thresh,
        status,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `omal_stock_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
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
            <Package className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight">Stock View &amp; Inventory Levels</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time physical stock valuation across Accra Showroom, Tema Depot and Kumasi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh inventory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredProducts.length === 0}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            disabled={filteredProducts.length === 0}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
          {onAddProduct && (
            <button
              onClick={onAddProduct}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Dynamic Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Stock Value */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Stock Value</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Assets
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{formatGHS(totalStockValue)}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Calculated as SUM(stock × cost price)</p>
        </div>

        {/* Card 2: Total Products */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Products</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Active SKU
            </span>
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">{totalProductsCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Across {categories.length} store categories</p>
        </div>

        {/* Card 3: Low Stock Count */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Low Stock Warning</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{lowStockCount}</div>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Below reorder threshold (needs PO)</p>
        </div>

        {/* Card 4: Out of Stock Count */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Out of Stock</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">{outOfStockCount}</div>
          <p className="text-[11px] text-rose-600/80 mt-0.5">Zero physical units on shelf</p>
        </div>
      </div>

      {/* Category Stock Level Horizontal Bars */}
      {categoryStockBars.length > 0 && (
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Stock Distribution by Category
            </h3>
            <span className="text-[11px] text-slate-400">Total units on hand</span>
          </div>
          <div className="space-y-3">
            {categoryStockBars.map((cat) => {
              const maxCount = Math.max(...categoryStockBars.map((c) => c.count), 1);
              const percentage = Math.round((cat.count / maxCount) * 100);
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{cat.name}</span>
                    <span className="font-mono text-slate-500">
                      <strong>{cat.count}</strong> units ({formatGHS(cat.value)})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by product name, SKU or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.code || c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Branch Filter */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setStatusFilter('in_stock')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'in_stock' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Stock
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'low_stock' ? 'bg-amber-500 text-white shadow-2xs' : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              Low Stock ({lowStockCount})
            </button>
            <button
              onClick={() => setStatusFilter('out_of_stock')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'out_of_stock' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              Out of Stock ({outOfStockCount})
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
              title="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Stock Presentation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Querying hardware stock levels from database...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-800">No Inventory Records Found</h3>
            <p className="text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'No products matched your active search or stock filters. Try resetting the filters.'
                : 'Your database has been cleared of mock data. Click "Add Product" above to register your real stock items.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const onHand = Number(p.totalOnHand || 0);
              const thresh = Number(p.min_stock_alert || 10);
              const isOut = onHand === 0;
              const isLow = !isOut && onHand <= thresh;
              const stockValue = onHand * Number(p.cost_price || 0);

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500">{p.sku}</span>
                      {isOut ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Out of Stock
                        </span>
                      ) : isLow ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          In Stock
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 line-clamp-2">{p.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.category_name || 'Hardware'}</p>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Current Stock:</span>
                        <span className="font-bold text-slate-900">
                          {onHand} {p.base_unit || 'pcs'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Cost Price:</span>
                        <span className="font-mono text-slate-700">{formatGHS(p.cost_price)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Selling Price:</span>
                        <span className="font-mono font-bold text-emerald-600">{formatGHS(p.selling_price)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-600">Stock Value:</span>
                        <span className="font-mono font-bold text-slate-900">{formatGHS(stockValue)}</span>
                      </div>
                    </div>
                  </div>

                  {(isOut || isLow) && onRestock && (
                    <button
                      onClick={() => onRestock(p)}
                      className="mt-4 w-full py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      Restock Item
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Stock on Hand</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-right">Cost (GHS)</th>
                  <th className="py-3 px-4 text-right">Selling (GHS)</th>
                  <th className="py-3 px-4 text-right">Stock Value (GHS)</th>
                  <th className="py-3 px-4 text-center">Reorder Level</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map((p) => {
                  const onHand = Number(p.totalOnHand || 0);
                  const thresh = Number(p.min_stock_alert || 10);
                  const isOut = onHand === 0;
                  const isLow = !isOut && onHand <= thresh;
                  const stockValue = onHand * Number(p.cost_price || 0);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.sku}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 text-slate-500">{p.category_name || 'Hardware'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-black ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                          {onHand}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">{p.base_unit || 'pcs'}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">{Number(p.cost_price || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{Number(p.selling_price || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">{formatGHS(stockValue)}</td>
                      <td className="py-3 px-4 text-center text-slate-500 font-medium">{thresh}</td>
                      <td className="py-3 px-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3" />
                            Critical
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onRestock && (
                            <button
                              onClick={() => onRestock(p)}
                              className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-[11px] border border-orange-200 transition cursor-pointer"
                            >
                              Restock
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Admin: Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Universal Print & PDF Modal */}
      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="STOCK INVENTORY & VALUATION REPORT"
        period={`As of ${new Date().toLocaleDateString('en-GB')}`}
        dataRows={filteredProducts.map((p) => ({
          sku: p.sku,
          name: p.name,
          category: p.category_name,
          stock: p.totalOnHand || 0,
          unit: p.base_unit || 'pcs',
          costPrice: Number(p.cost_price || 0).toFixed(2),
          sellPrice: Number(p.selling_price || 0).toFixed(2),
          valuation: (Number(p.totalOnHand || 0) * Number(p.cost_price || 0)).toFixed(2),
        }))}
        columns={[
          { key: 'sku', header: 'SKU' },
          { key: 'name', header: 'Product Name' },
          { key: 'category', header: 'Department' },
          { key: 'stock', header: 'Current Stock' },
          { key: 'unit', header: 'Unit' },
          { key: 'costPrice', header: 'Cost (GHS)' },
          { key: 'sellPrice', header: 'Sell (GHS)' },
          { key: 'valuation', header: 'Valuation (GHS)' },
        ]}
        totals={[
          { label: 'Total Products', value: String(filteredProducts.length) },
          { label: 'Total Stock Value', value: formatGHS(totalStockValue) },
        ]}
      />
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Search,
  Download,
  Printer,
  RefreshCw,
  Plus,
  LayoutGrid,
  List,
  TrendingDown,
  Trash2,
  Edit2,
  FileSpreadsheet,
  FileText,
  Boxes,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { useCompany } from '../../../../context/CompanyContext';
import {
  downloadProductsTemplate,
  exportToExcel,
  exportToPdfA4,
} from '../../../../utils/excelTemplates';
import { ExcelImportModal } from '../../../common/ExcelImportModal';

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
  const { settings } = useCompany();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>(
    initialFilter === 'low_stock' ? 'low_stock' : 'all'
  );
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const canDelete = ['administrator', 'admin', 'owner'].includes((currentUser?.role || '').toLowerCase());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.getProducts(),
        api.getCategories().catch(() => ({ data: [] })),
      ]);

      if (prodRes && prodRes.success && prodRes.data) {
        // Sanitize any "Security Dooe" typo
        const cleanProds = (prodRes.data || []).map((p: any) => ({
          ...p,
          name: (p.name || '').replace(/Security Dooe/gi, 'Security Door'),
          category_name: (p.category_name || '').replace(/Security Dooe/gi, 'Security Door'),
        }));
        setProducts(cleanProds);
      } else {
        setProducts([]);
      }

      if (catRes && catRes.data) {
        const cleanCats = (catRes.data || []).map((c: any) => ({
          ...c,
          name: (c.name || '').replace(/Security Dooe/gi, 'Security Door'),
        }));
        setCategories(cleanCats);
      }
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete product "${name}"? Only administrators can perform this action.`)) {
      return;
    }
    try {
      const res = await api.deleteProduct(id);
      setMsg({ type: 'success', text: res.message || `Product "${name}" deleted.` });
      await loadData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete product.' });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  // Stock Metrics
  const { totalStockValue, lowStockCount, outOfStockCount, totalProductsCount } = useMemo(() => {
    let value = 0;
    let low = 0;
    let out = 0;

    products.forEach((p) => {
      const onHand = Number(p.quantity ?? p.totalOnHand ?? 0);
      const cost = Number(p.cost_price || 0);
      const thresh = Number(p.min_stock_alert || 10);

      value += onHand * cost;
      if (onHand === 0) out++;
      else if (onHand <= thresh) low++;
    });

    return {
      totalStockValue: value,
      lowStockCount: low,
      outOfStockCount: out,
      totalProductsCount: products.length,
    };
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const nameMatch =
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode || '').toLowerCase().includes(searchQuery.toLowerCase());

      const catMatch =
        selectedCategory === 'all' ||
        String(p.category_code) === selectedCategory ||
        String(p.category_id) === selectedCategory ||
        String(p.category_name).toLowerCase() === selectedCategory.toLowerCase();

      const onHand = Number(p.quantity ?? p.totalOnHand ?? 0);
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

  const formatMoney = (val: number) => {
    return `${settings.currency} ${Number(val || 0).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleExportExcel = () => {
    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Current Stock',
      'Unit',
      'Cost Price (GHS)',
      'Selling Price (GHS)',
      'Total Stock Value (GHS)',
      'Low Stock Reorder Level',
      'Status',
    ];
    const rows = filteredProducts.map((p) => {
      const onHand = Number(p.quantity ?? p.totalOnHand ?? 0);
      const thresh = Number(p.min_stock_alert || 10);
      const status = onHand === 0 ? 'Out of Stock' : onHand <= thresh ? 'Low Stock' : 'In Stock';
      return [
        p.sku,
        p.name,
        p.category_name || 'General Hardware',
        onHand,
        p.base_unit || 'pcs',
        Number(p.cost_price || 0),
        Number(p.selling_price || 0),
        onHand * Number(p.cost_price || 0),
        thresh,
        status,
      ];
    });

    exportToExcel(
      `${settings.companyName.replace(/[^A-Za-z0-9]+/g, '_')}_Stock_Report_${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows,
      'Stock Inventory'
    );
  };

  const handleExportPdf = () => {
    const headers = ['SKU', 'Product Name', 'Category', 'Stock Qty', 'Unit', 'Cost Price', 'Selling Price', 'Stock Value', 'Status'];
    const rows = filteredProducts.map((p) => {
      const onHand = Number(p.quantity ?? p.totalOnHand ?? 0);
      const thresh = Number(p.min_stock_alert || 10);
      const status = onHand === 0 ? 'Out of Stock' : onHand <= thresh ? 'Low Stock' : 'In Stock';
      return [
        p.sku,
        p.name,
        p.category_name || 'General Hardware',
        onHand,
        p.base_unit || 'pcs',
        Number(p.cost_price || 0).toFixed(2),
        Number(p.selling_price || 0).toFixed(2),
        (onHand * Number(p.cost_price || 0)).toFixed(2),
        status,
      ];
    });

    exportToPdfA4({
      title: initialFilter === 'low_stock' ? 'Low Stock & Reorder Alert Report' : 'Current Stock Inventory & Valuation Report',
      filename: `${settings.companyName.replace(/[^A-Za-z0-9]+/g, '_')}_Stock_Report_${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows,
      settings,
      userName: currentUser?.fullName || 'Inventory Officer',
      dateRange: `Total Items: ${filteredProducts.length} | Total Valuation: ${formatMoney(totalStockValue)}`,
      orientation: 'landscape',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {initialFilter === 'low_stock' ? 'Low Stock Alerts & Reordering' : 'Products & Stock Inventory'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Unified single-company inventory ledger, live unit valuations, and automated reorder alerts
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Import Excel file"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import Excel</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={filteredProducts.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            title="Export to Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={filteredProducts.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            title="Download PDF (A4)"
          >
            <FileText className="w-3.5 h-3.5 text-red-600" />
            <span>Download PDF (A4)</span>
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

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Stock Value */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Stock Value</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Assets
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">{formatMoney(totalStockValue)}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Asset valuation: qty &times; cost price</p>
        </div>

        {/* Card 2: Total Active Products */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Products</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Catalog
            </span>
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">{totalProductsCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Across {categories.length} store categories</p>
        </div>

        {/* Card 3: Low Stock Warning */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Low Stock Warning</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{lowStockCount}</div>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Below threshold (reorder needed)</p>
        </div>

        {/* Card 4: Out of Stock Count */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Out of Stock</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">{outOfStockCount}</div>
          <p className="text-[11px] text-rose-600/80 mt-0.5">0 physical units on shelf</p>
        </div>
      </div>

      {/* Filters Bar - Clean single category dropdown without duplicates */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Clean Single Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.code || c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setStatusFilter('in_stock')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'in_stock' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Stock
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'low_stock' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              Low Stock ({lowStockCount})
            </button>
            <button
              onClick={() => setStatusFilter('out_of_stock')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'out_of_stock' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              Out of Stock ({outOfStockCount})
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              title="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Stock Presentation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span>Loading unified inventory levels...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-800">No Inventory Records Found</h3>
            <p className="text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'No products matched your active search or stock filters. Try resetting the filters.'
                : 'Click "Add Product" or "Import Excel" above to register company stock.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const onHand = Number(p.quantity ?? p.totalOnHand ?? 0);
              const thresh = Number(p.min_stock_alert || 10);
              const isOut = onHand === 0;
              const isLow = !isOut && onHand <= thresh;
              const stockValue = onHand * Number(p.cost_price || 0);

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition flex flex-col justify-between"
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
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.category_name || 'General Hardware'}</p>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Stock on Hand:</span>
                        <span className={`font-black font-mono ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                          {onHand} {p.base_unit || 'pcs'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Cost Price:</span>
                        <span className="font-mono text-slate-700">{formatMoney(p.cost_price)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Selling Price:</span>
                        <span className="font-mono font-bold text-emerald-600">{formatMoney(p.selling_price)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-600">Stock Value:</span>
                        <span className="font-mono font-bold text-slate-900">{formatMoney(stockValue)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    {(isOut || isLow) && onRestock ? (
                      <button
                        onClick={() => onRestock(p)}
                        className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Reorder Stock
                      </button>
                    ) : (
                      <div />
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-center">Total Stock</th>
                  <th className="py-3.5 px-4 text-center">Unit</th>
                  <th className="py-3.5 px-4 text-right">Cost Price</th>
                  <th className="py-3.5 px-4 text-right">Selling Price</th>
                  <th className="py-3.5 px-4 text-right">Stock Valuation</th>
                  <th className="py-3.5 px-4 text-center">Threshold</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map((p) => {
                  const onHand = Number(p.quantity ?? p.totalOnHand ?? 0);
                  const thresh = Number(p.min_stock_alert || 10);
                  const isOut = onHand === 0;
                  const isLow = !isOut && onHand <= thresh;
                  const stockValue = onHand * Number(p.cost_price || 0);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{p.sku}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {p.name}
                        {p.barcode && (
                          <div className="text-[10px] text-slate-400 font-mono">Barcode: {p.barcode}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{p.category_name || 'General Hardware'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-black font-mono text-sm ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                          {onHand}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-500">{p.base_unit || 'pcs'}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">{Number(p.cost_price || 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">{Number(p.selling_price || 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">{formatMoney(stockValue)}</td>
                      <td className="py-3.5 px-4 text-center text-slate-500 font-mono">{thresh}</td>
                      <td className="py-3.5 px-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3" />
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(isOut || isLow) && onRestock && (
                            <button
                              onClick={() => onRestock(p)}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200 transition cursor-pointer"
                              title="Reorder item from supplier"
                            >
                              Reorder
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Delete Product"
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

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Products from Excel (.xlsx)"
        templateName="WONARK Products Template"
        onDownloadTemplate={() => downloadProductsTemplate(settings.companyName)}
        onImportRows={async (rows) => {
          return await api.bulkImportProducts(rows);
        }}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};

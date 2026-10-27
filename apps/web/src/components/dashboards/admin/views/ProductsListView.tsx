import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Tag,
  CheckCircle,
  Building,
} from 'lucide-react';
import { api } from '../../../../services/api';

interface ProductsListViewProps {
  onAddProduct: () => void;
}

export const ProductsListView: React.FC<ProductsListViewProps> = ({ onAddProduct }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await api.getProducts();
      if (res && res.success) {
        setProducts(res.data?.products || res.data || []);
      } else if (Array.isArray(res)) {
        setProducts(res);
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch =
      !searchTerm ||
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCat =
      selectedCategory === 'all' ||
      String(p.category_id) === selectedCategory ||
      (p.category_name && p.category_name.toLowerCase().includes(selectedCategory.toLowerCase()));
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Products &amp; Inventory Catalog</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage your tiles, security doors, sanitary ware, paints, and hardware stock in company inventory.
          </p>
        </div>

        <button
          onClick={onAddProduct}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="all">All Product Categories</option>
            <option value="tiles">Tiles &amp; Ceramics</option>
            <option value="doors">Security Doors</option>
            <option value="sanitary">Sanitary Ware</option>
            <option value="paints">Paints &amp; Wall Finishes</option>
            <option value="hardware">General Hardware</option>
          </select>

          <span className="text-xs text-slate-500">
            Total: <strong className="text-slate-900">{filtered.length}</strong> items
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading products catalog...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Products in Catalog</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your database catalog is clean. Click below to add your genuine enterprise inventory items with pricing and reorder thresholds.
            </p>
            <button
              onClick={onAddProduct}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Add First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Cost Price (GHS)</th>
                  <th className="px-4 py-3 text-right">Selling Price (GHS)</th>
                  <th className="px-4 py-3 text-center">Unit</th>
                  <th className="px-4 py-3 text-center">Stock Level</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.category_name || item.category || 'General'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      GH₵ {Number(item.cost_price || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      GH₵ {Number(item.selling_price || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 uppercase text-[10px]">
                      {item.base_unit || item.unit || 'pcs'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                        Number(item.stock_quantity || 0) <= Number(item.min_stock_alert || 5)
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {item.stock_quantity || item.quantity_on_hand || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        Active
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

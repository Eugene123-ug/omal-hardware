import React, { useState, useEffect } from 'react';
import { Layers, Plus, Search, Check, FolderPlus, Tag, Package, X, RefreshCw } from 'lucide-react';
import { api } from '../../../../services/api';

const HARDWARE_TEMPLATES = [
  { name: 'Security & Armoured Doors', code: 'SEC_DOORS', desc: 'Turkey & Israeli armoured security doors' },
  { name: 'Burglary Proof & Grilles', code: 'BURG_PROOF', desc: 'High-tensile steel burglary proof windows & gates' },
  { name: 'Cement & Bonding Aggregates', code: 'CEMENT', desc: 'Ghacem, Dangote cement bags & tile adhesives' },
  { name: 'Iron Rods & High-Tensile Steel', code: 'IRON_RODS', desc: '10mm, 12mm, 16mm high-tensile construction rods' },
  { name: 'Roofing Sheets & Trusses', code: 'ROOFING', desc: 'Aluzinc, aluminium & self-tapping roofing screws' },
  { name: 'Locks, Hinges & Handles', code: 'LOCKS_HINGES', desc: 'Mortise locks, heavy brass hinges, padlock sets' },
  { name: 'Plumbing & Water Tanks', code: 'PLUMBING', desc: 'Sintex tanks, PPR pipes, PVC fittings, brass valves' },
  { name: 'Electrical & Cable Accessories', code: 'ELECTRICAL', desc: 'Conduit pipes, wiring cables, breakers & switches' },
];

interface CategoriesManagementViewProps {
  currentUser?: any;
}

export const CategoriesManagementView: React.FC<CategoriesManagementViewProps> = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const res = await api.getCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      } else {
        setCategories([]);
      }
    } catch {
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!code) {
      setCode(val.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20));
    }
  };

  const handleQuickAdd = (template: { name: string; code: string; desc: string }) => {
    setName(template.name);
    setCode(template.code);
    setDescription(template.desc);
    setIsModalOpen(true);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createCategory({
        name: name.trim(),
        code: code.trim().toUpperCase() || undefined,
        description: description.trim() || undefined,
      });

      if (res.success) {
        setSuccessMsg(`Category "${name}" created successfully!`);
        setTimeout(() => setSuccessMsg(null), 3500);
        setName('');
        setCode('');
        setDescription('');
        setIsModalOpen(false);
        await loadCategories();
      } else {
        setError(res.message || 'Failed to create category.');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating category.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <Layers className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight">Product Categories &amp; Catalog Hierarchy</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize OMAL Hardware inventory across doors, burglary proof, cement, iron rods, roofing and fittings
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadCategories}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh categories"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Category</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Categories</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{categories.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Hardware departments</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Catalog</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {categories.filter((c) => c.is_active !== false).length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Ready for POS &amp; Stock</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Products Bound</span>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {categories.reduce((acc, c) => acc + (Number(c.productCount) || 0), 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Assigned to categories</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Subcategories</span>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {categories.reduce((acc, c) => acc + (c.subcategories?.length || 0), 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Granular segments</p>
        </div>
      </div>

      {/* Suggested 1-Click Hardware Categories if missing */}
      <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
        <div className="flex items-center gap-2 mb-2.5">
          <FolderPlus className="w-4 h-4 text-emerald-700" />
          <h3 className="text-xs font-bold text-emerald-900">Standard OMAL Hardware Departments (1-Click Setup)</h3>
        </div>
        <p className="text-[11px] text-emerald-700 mb-3">
          Click any preset department below to quickly add it to your catalog hierarchy:
        </p>
        <div className="flex flex-wrap gap-2">
          {HARDWARE_TEMPLATES.map((tmpl) => {
            const alreadyExists = categories.some((c) => c.code === tmpl.code || c.name.toLowerCase() === tmpl.name.toLowerCase());
            return (
              <button
                key={tmpl.code}
                onClick={() => !alreadyExists && handleQuickAdd(tmpl)}
                disabled={alreadyExists}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  alreadyExists
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-default'
                    : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-600 hover:text-white cursor-pointer shadow-2xs'
                }`}
              >
                {alreadyExists ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{tmpl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-400">
            Showing <strong>{filteredCategories.length}</strong> of {categories.length} categories
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Loading categories from database...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No categories found</p>
            <p className="text-slate-400 mt-1">Click "Add New Category" above or select one from the quick setup tags.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Products Bound</th>
                  <th className="py-3 px-4 text-center">Subcategories</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{cat.code}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {cat.description || 'General category'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Package className="w-3 h-3" />
                        {cat.productCount || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500 font-medium">
                      {cat.subcategories?.length || 0}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
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

      {/* Add Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Add Product Category</h3>
                  <p className="text-[11px] text-slate-500">Register category into OMAL catalog</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Turkey Security Doors"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category Code (Short Identifier)</label>
                <input
                  type="text"
                  placeholder="e.g. TURKEY_DOORS"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Hardware specifications, types, finishes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{submitting ? 'Creating...' : 'Save Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

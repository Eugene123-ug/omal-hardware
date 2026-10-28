import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  Check,
  FolderPlus,
  Tag,
  Package,
  X,
  RefreshCw,
  Trash2,
  Edit2,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { useCompany } from '../../../../context/CompanyContext';
import { downloadCategoriesTemplate, exportToExcel, exportToPdfA4 } from '../../../../utils/excelTemplates';

const INDUSTRY_PRESETS = [
  { name: 'Security Doors & Ironmongery', code: 'SEC_DOORS', desc: 'Armoured security doors, heavy locks & handles' },
  { name: 'Tiles, Ceramics & Adhesives', code: 'TILES', desc: 'Wall & floor tiles, adhesive cement, grout & trims' },
  { name: 'Cement & Aggregates', code: 'CEMENT', desc: 'Standard 42.5N, Rapid hardening cement & aggregates' },
  { name: 'Structural Steel & Iron Rods', code: 'STEEL', desc: 'High-tensile steel rods, binding wires, BRC mesh' },
  { name: 'Sanitary Ware & Bathrooms', code: 'SANITARY', desc: 'Toilets, vanity basins, bathtubs, faucets & mixers' },
  { name: 'Paints & Protective Coatings', code: 'PAINTS', desc: 'Interior emulsion, weather guard, gloss & primers' },
  { name: 'Plumbing & Water Systems', code: 'PLUMBING', desc: 'PPR, PVC pipes, water tanks, valves & fittings' },
  { name: 'Electrical & Power Distribution', code: 'ELECTRICAL', desc: 'Armoured cables, conduit, switches & circuit breakers' },
];

export const CategoriesManagementView: React.FC = () => {
  const { settings } = useCompany();
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      setCode(val.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 25));
    }
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setCode('');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name);
    setCode(cat.code);
    setDescription(cat.description || '');
    setIsModalOpen(true);
  };

  const handleQuickAdd = (template: { name: string; code: string; desc: string }) => {
    setEditingCategory(null);
    setName(template.name);
    setCode(template.code);
    setDescription(template.desc);
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined,
          description: description.trim() || undefined,
        });
        setMsg({ type: 'success', text: `Category "${name}" updated successfully.` });
      } else {
        await api.createCategory({
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined,
          description: description.trim() || undefined,
        });
        setMsg({ type: 'success', text: `Category "${name}" created successfully.` });
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Operation failed.' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleDeleteCategory = async (cat: any) => {
    if (Number(cat.productCount || 0) > 0) {
      alert(`Cannot delete category "${cat.name}": There are ${cat.productCount} product(s) assigned to it.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    try {
      await api.deleteCategory(cat.id);
      setMsg({ type: 'success', text: `Category "${cat.name}" deleted successfully.` });
      loadCategories();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete category.' });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  const filteredCategories = categories.filter((c) => {
    const term = searchQuery.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.code || '').toLowerCase().includes(term) ||
      (c.description || '').toLowerCase().includes(term)
    );
  });

  const handleExportExcel = () => {
    const headers = ['Category Code', 'Category Name', 'Description', 'Products Bound', 'Status'];
    const rows = filteredCategories.map((c) => [
      c.code,
      c.name,
      c.description || '',
      c.productCount || 0,
      c.is_active !== false ? 'Active' : 'Inactive',
    ]);
    exportToExcel(
      `${settings.companyName.replace(/[^A-Za-z0-9]+/g, '_')}_Categories_${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows,
      'Categories'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Product Categories</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Organize company catalog departments, tax codes, and inventory reporting segments
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => downloadCategoriesTemplate(settings.companyName)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Download Excel Template"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Template</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Category</span>
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

      {/* Quick Setup Tag Presets */}
      <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <FolderPlus className="w-4 h-4 text-blue-700" />
          <h3 className="text-xs font-bold text-blue-900">Standard Hardware &amp; Material Departments (1-Click Setup)</h3>
        </div>
        <p className="text-[11px] text-blue-700 mb-3">
          Click any preset department below to quickly add it to your catalog hierarchy:
        </p>
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_PRESETS.map((tmpl) => {
            const alreadyExists = categories.some(
              (c) => c.code === tmpl.code || c.name.toLowerCase() === tmpl.name.toLowerCase()
            );
            return (
              <button
                key={tmpl.code}
                onClick={() => !alreadyExists && handleQuickAdd(tmpl)}
                disabled={alreadyExists}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  alreadyExists
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-default'
                    : 'bg-white text-blue-800 border border-blue-300 hover:bg-blue-600 hover:text-white cursor-pointer shadow-xs'
                }`}
              >
                {alreadyExists ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{tmpl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-500">
            Showing <strong>{filteredCategories.length}</strong> of {categories.length} categories
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading categories...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No categories found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Category Name</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-center">Products Bound</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{cat.code}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {cat.description || 'General category'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Package className="w-3 h-3" />
                        {cat.productCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tiles &amp; Ceramics"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category Code / SKU Prefix</label>
                <input
                  type="text"
                  placeholder="e.g. TILES"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe items in this department..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition shadow-sm"
                >
                  {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

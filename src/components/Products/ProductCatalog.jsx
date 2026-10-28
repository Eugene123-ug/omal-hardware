import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import * as XLSX from 'xlsx';
import { 
  Package, Plus, Search, Filter, Edit, Trash2, 
  Upload, Download, AlertTriangle, Layers, X, Check, Eye, EyeOff,
  CheckCircle, XCircle, ArrowRight, ShieldCheck, Clock, Tag, 
  ChevronDown, ChevronRight, Sliders, RefreshCw, Info, AlertCircle,
  FileSpreadsheet
} from 'lucide-react';

const VALID_UNITS = [
  { value: 'box', label: 'Box (Tiles)' },
  { value: 'pcs', label: 'Pieces (Doors, Sanitary, Rods)' },
  { value: 'pallet', label: 'Pallet (Bulk Tiles / Bricks)' },
  { value: 'bucket', label: 'Bucket / Drum (Paints 20L)' },
  { value: 'gallon', label: 'Gallon (Paints 4L)' },
  { value: 'litre', label: 'Litre' },
  { value: 'bag', label: 'Bag (Cement, Grout 50kg)' },
  { value: 'sqm', label: 'Square Metre (m²)' },
  { value: 'length', label: 'Length (Pipes, Profiles)' },
  { value: 'roll', label: 'Roll (Membrane, Mesh)' },
  { value: 'bundle', label: 'Bundle (Rebars, Timber)' }
];

const CATEGORIES = [
  'All',
  'Tiles',
  'Security Doors',
  'Sanitary',
  'Paints',
  'General Hardware'
];

const SUBCATEGORIES = {
  'Tiles': ['Floor Tiles', 'Wall Tiles', 'Outdoor / Pavers', 'Porcelain', 'Ceramic', 'Marble & Granite', 'Mosaics'],
  'Security Doors': ['Turkish Armoured Doors', 'Israeli Multi-Lock', 'Double Leaf 4ft/5ft', 'Single Leaf 3ft', 'Internal Heavy Duty', 'Fire-Rated Doors'],
  'Sanitary': ['Water Closet (WC)', 'Washbasins & Vanities', 'Bathtubs & Jacuzzis', 'Mixers & Faucets', 'Shower Enclosures', 'Urinals & Bidets'],
  'Paints': ['Exterior WeatherShield', 'Interior Acrylic Silk', 'Emulsion Matt', 'Gloss & Enamel', 'Primer & Undercoat', 'Wood Varnish & Stains'],
  'General Hardware': ['Cement & Adhesives', 'Iron Rods & Steel Rebar', 'Roofing Sheets & Nails', 'Plumbing & PVC', 'Electrical & Lighting', 'Power Tools']
};

export default function ProductCatalog() {
  const { isSuperAdmin, isAdmin, isSales, user } = useAuth();
  
  // Data state
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pendingPriceChanges, setPendingPriceChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Pagination state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [subcategoryFilter, setSubcategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'active', 'discontinued'
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit'
  const [editingProduct, setEditingProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('basic'); // 'basic', 'attributes', 'conversions', 'pricing'

  // View Details & Variants Modal
  const [viewProduct, setViewProduct] = useState(null);
  const [viewProductDetails, setViewProductDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAddVariantModal, setShowAddVariantModal] = useState(false);

  // Pending Price Approvals Modal (Super Admin)
  const [showApprovalsModal, setShowApprovalsModal] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);

  // Batch Import Error Modal state
  const [importErrors, setImportErrors] = useState(null);
  const [importing, setImporting] = useState(false);

  // Product Form Data
  const defaultFormData = {
    name: '',
    category: 'Tiles',
    subcategory: 'Floor Tiles',
    sku: '',
    barcode: '',
    brand: '',
    description: '',
    unit: 'box',
    supplier_id: '',
    warehouse_location: 'Main Showroom',
    min_stock_alert: 10,
    status: 'active',
    image_url: '',
    cost_price: '',
    selling_price: '',
    wholesale_price: '',
    min_selling_price: '',
    price_change_reason: '',
    admin_pin: '',
    // Dynamic attributes
    attributes: {},
    // Hardware conversions
    conversions: {
      pieces_per_box: 4,
      sqm_per_box: 1.44,
      boxes_per_pallet: 64
    },
    // Initial Stock (for Add mode)
    initial_stock_showroom: 50,
    initial_stock_depot: 100
  };

  const [formData, setFormData] = useState(defaultFormData);

  // New Variant Form Data
  const defaultVariantData = {
    variant_name: '',
    sku: '',
    barcode: '',
    cost_price: '',
    selling_price: '',
    wholesale_price: '',
    min_selling_price: '',
    attributes: {},
    initial_stock_showroom: 20,
    initial_stock_depot: 50
  };
  const [variantForm, setVariantForm] = useState(defaultVariantData);

  // Custom Attribute key-value pair input
  const [customAttrKey, setCustomAttrKey] = useState('');
  const [customAttrValue, setCustomAttrValue] = useState('');

  // Load Products
  const loadProducts = async (page = 1) => {
    setLoading(true);
    try {
      let url = `/products?page=${page}&limit=${pagination.limit}`;
      if (categoryFilter !== 'All') url += `&category=${encodeURIComponent(categoryFilter)}`;
      if (subcategoryFilter !== 'All') url += `&subcategory=${encodeURIComponent(subcategoryFilter)}`;
      if (statusFilter !== 'All') url += `&status=${statusFilter}`;
      if (lowStockFilter) url += `&low_stock=true`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await apiRequest(url);
      if (Array.isArray(res)) {
        setProducts(res);
        if (res.pagination) setPagination(res.pagination);
      } else if (res && Array.isArray(res.items)) {
        setProducts(res.items);
        if (res.pagination) setPagination(res.pagination);
      } else {
        setProducts(res || []);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Suppliers
  const loadSuppliers = async () => {
    try {
      const data = await apiRequest('/purchasing/suppliers');
      if (Array.isArray(data)) setSuppliers(data);
    } catch (err) {
      console.warn('Suppliers could not be loaded:', err.message);
    }
  };

  // Load Pending Price Changes (for Admins / Super Admin)
  const loadPendingPriceChanges = async () => {
    if (!isAdmin && !isSuperAdmin) return;
    try {
      const data = await apiRequest('/products/price-changes/pending');
      if (Array.isArray(data)) setPendingPriceChanges(data);
    } catch (err) {
      console.warn('Pending price changes load error:', err.message);
    }
  };

  useEffect(() => {
    loadProducts(1);
    loadSuppliers();
    loadPendingPriceChanges();
  }, [categoryFilter, subcategoryFilter, statusFilter, lowStockFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadProducts(1);
  };

  // Open Add Product Modal
  const openAddModal = () => {
    setModalMode('add');
    setEditingProduct(null);
    setActiveTab('basic');
    setFormData({
      ...defaultFormData,
      sku: `OM-${Date.now().toString().slice(-6)}`,
      brand: 'OMAL'
    });
    setShowProductModal(true);
  };

  // Open Edit Product Modal
  const openEditModal = (p) => {
    setModalMode('edit');
    setEditingProduct(p);
    setActiveTab('basic');
    setFormData({
      name: p.name || '',
      category: p.category || 'Tiles',
      subcategory: p.subcategory || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      brand: p.brand || '',
      description: p.description || '',
      unit: p.unit || 'box',
      supplier_id: p.supplier_id || '',
      warehouse_location: p.warehouse_location || 'Main Showroom',
      min_stock_alert: p.min_stock_alert || 10,
      status: p.status || 'active',
      image_url: p.image_url || '',
      cost_price: p.cost_price !== undefined ? p.cost_price : '',
      selling_price: p.selling_price || '',
      wholesale_price: p.wholesale_price || '',
      min_selling_price: p.min_selling_price || '',
      price_change_reason: '',
      admin_pin: '',
      attributes: p.attributes || {},
      conversions: {
        pieces_per_box: p.pieces_per_box || (p.conversions?.pieces_per_box || 4),
        sqm_per_box: p.sqm_per_box || (p.conversions?.sqm_per_box || 1.44),
        boxes_per_pallet: p.conversions?.boxes_per_pallet || 64
      },
      initial_stock_showroom: 0,
      initial_stock_depot: 0
    });
    setShowProductModal(true);
  };

  // View Product Details with Full Variants & Audit History
  const openViewProduct = async (p) => {
    setViewProduct(p);
    setLoadingDetails(true);
    try {
      const details = await apiRequest(`/products/${p.id}`);
      setViewProductDetails(details);
    } catch (err) {
      alert(`Failed to load product details: ${err.message}`);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Toggle Product Status (Active / Discontinued)
  const handleToggleStatus = async (p) => {
    if (!isAdmin) return;
    const newStatus = p.status === 'discontinued' ? 'active' : 'discontinued';
    const actionName = newStatus === 'discontinued' ? 'deactivate (discontinue)' : 'reactivate';
    
    if (!confirm(`Are you sure you want to ${actionName} "${p.name}"? Discontinued products cannot be sold at the POS.`)) {
      return;
    }

    try {
      await apiRequest(`/products/${p.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      loadProducts(pagination.page);
      if (viewProduct && viewProduct.id === p.id) {
        openViewProduct({ ...viewProduct, status: newStatus });
      }
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  // Save Product (Create / Update)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        subcategory: formData.subcategory,
        sku: formData.sku.trim(),
        barcode: formData.barcode?.trim() || null,
        brand: formData.brand?.trim() || null,
        description: formData.description?.trim() || null,
        unit: formData.unit,
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
        warehouse_location: formData.warehouse_location || 'Main Showroom',
        min_stock_alert: parseInt(formData.min_stock_alert) || 10,
        status: formData.status || 'active',
        image_url: formData.image_url?.trim() || null,
        selling_price: parseFloat(formData.selling_price) || 0,
        wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : null,
        min_selling_price: formData.min_selling_price ? parseFloat(formData.min_selling_price) : null,
        attributes: formData.attributes,
        conversions: {
          pieces_per_box: parseFloat(formData.conversions?.pieces_per_box) || null,
          sqm_per_box: parseFloat(formData.conversions?.sqm_per_box) || null,
          boxes_per_pallet: parseFloat(formData.conversions?.boxes_per_pallet) || null
        }
      };

      if (formData.cost_price !== '' && formData.cost_price !== undefined) {
        payload.cost_price = parseFloat(formData.cost_price);
      }

      if (modalMode === 'add') {
        payload.initial_stock_showroom = parseFloat(formData.initial_stock_showroom) || 0;
        payload.initial_stock_depot = parseFloat(formData.initial_stock_depot) || 0;

        await apiRequest('/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        alert('Product registered successfully!');
      } else {
        payload.price_change_reason = formData.price_change_reason || 'Updated via Catalog Manager';
        if (formData.admin_pin) payload.admin_pin = formData.admin_pin;

        const res = await apiRequest(`/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        if (res && res.price_status === 'pending_approval') {
          alert('Note: The price change requested exceeds 10% reduction or is below cost. It has been submitted for Super Admin (Owner) approval before taking effect.');
        } else {
          alert('Product updated successfully!');
        }
      }

      setShowProductModal(false);
      loadProducts(pagination.page);
      loadPendingPriceChanges();
    } catch (err) {
      alert(`Error saving product: ${err.message}`);
    }
  };

  // Add Product Variant
  const handleAddVariant = async (e) => {
    e.preventDefault();
    if (!viewProduct) return;
    try {
      const payload = {
        variant_name: variantForm.variant_name.trim(),
        sku: variantForm.sku.trim(),
        barcode: variantForm.barcode?.trim() || null,
        selling_price: parseFloat(variantForm.selling_price) || 0,
        wholesale_price: variantForm.wholesale_price ? parseFloat(variantForm.wholesale_price) : null,
        min_selling_price: variantForm.min_selling_price ? parseFloat(variantForm.min_selling_price) : null,
        attributes: variantForm.attributes,
        initial_stock_showroom: parseFloat(variantForm.initial_stock_showroom) || 0,
        initial_stock_depot: parseFloat(variantForm.initial_stock_depot) || 0
      };

      if (variantForm.cost_price !== '' && variantForm.cost_price !== undefined) {
        payload.cost_price = parseFloat(variantForm.cost_price);
      }

      await apiRequest(`/products/${viewProduct.id}/variants`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert('Variant created with separate stock tracking!');
      setShowAddVariantModal(false);
      setVariantForm(defaultVariantData);
      openViewProduct(viewProduct);
      loadProducts(pagination.page);
    } catch (err) {
      alert(`Failed to add variant: ${err.message}`);
    }
  };

  // Approve Price Change (Super Admin)
  const handleApprovePrice = async (logId) => {
    if (!isSuperAdmin) return;
    setApprovingId(logId);
    try {
      await apiRequest(`/products/price-changes/${logId}/approve`, { method: 'POST' });
      alert('Price change approved and applied to active catalogue!');
      loadPendingPriceChanges();
      loadProducts(pagination.page);
      if (viewProduct) openViewProduct(viewProduct);
    } catch (err) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  // Reject Price Change (Super Admin)
  const handleRejectPrice = async (logId) => {
    if (!isSuperAdmin) return;
    if (!rejectReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    setRejectingId(logId);
    try {
      await apiRequest(`/products/price-changes/${logId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      alert('Price change proposal rejected.');
      setRejectReason('');
      loadPendingPriceChanges();
      loadProducts(pagination.page);
      if (viewProduct) openViewProduct(viewProduct);
    } catch (err) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setRejectingId(null);
    }
  };

  // Delete Product (Super Admin Only)
  const handleDeleteProduct = async (productId, name) => {
    if (!isSuperAdmin) {
      alert('Only Super Admin (Owner) can permanently delete products.');
      return;
    }
    if (confirm(`Are you sure you want to permanently delete "${name}"? This operation cannot be undone. If product has past sales, deletion will be blocked to preserve financial history.`)) {
      try {
        await apiRequest(`/products/${productId}`, { method: 'DELETE' });
        alert('Product deleted successfully.');
        loadProducts(pagination.page);
        if (viewProduct && viewProduct.id === productId) setViewProduct(null);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Export Full Catalogue to Excel
  const handleExportExcel = () => {
    const exportData = products.map(p => ({
      ID: p.id,
      Name: p.name,
      Category: p.category,
      Subcategory: p.subcategory || '',
      SKU: p.sku,
      Barcode: p.barcode || '',
      Brand: p.brand || '',
      Unit: p.unit,
      Cost_Price_GHS: isSuperAdmin ? p.cost_price : 'CONFIDENTIAL',
      Selling_Price_GHS: p.selling_price,
      Wholesale_Price_GHS: p.wholesale_price || '',
      Min_Selling_Price_GHS: p.min_selling_price || '',
      Total_Stock: p.total_stock || 0,
      Min_Alert_Threshold: p.min_stock_alert,
      Status: p.status,
      Storage_Location: p.warehouse_location || 'Main Showroom',
      SqM_Per_Box: p.sqm_per_box || p.conversions?.sqm_per_box || '',
      Pieces_Per_Box: p.pieces_per_box || p.conversions?.pieces_per_box || '',
      Variants_Count: p.variants?.length || 0,
      Attributes_JSON: JSON.stringify(p.attributes || {})
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OMAL Hardware Catalog');
    XLSX.writeFile(wb, `omal_hardware_catalog_${Date.now()}.xlsx`);
  };

  // Transactional Bulk Import with Error Reporting
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          alert('Uploaded file is empty.');
          setImporting(false);
          return;
        }

        const mappedProducts = data.map((row, idx) => {
          let parsedAttributes = {};
          if (row.Attributes_JSON) {
            try {
              parsedAttributes = typeof row.Attributes_JSON === 'string' ? JSON.parse(row.Attributes_JSON) : row.Attributes_JSON;
            } catch (e) {
              parsedAttributes = {};
            }
          }

          return {
            name: row.Name || row.name || `Imported Item ${idx + 1}`,
            category: row.Category || row.category || 'General Hardware',
            subcategory: row.Subcategory || row.subcategory || null,
            sku: String(row.SKU || row.sku || '').trim(),
            barcode: row.Barcode || row.barcode ? String(row.Barcode || row.barcode).trim() : null,
            brand: row.Brand || row.brand || null,
            unit: String(row.Unit || row.unit || 'pcs').toLowerCase(),
            cost_price: row.Cost_Price !== undefined ? parseFloat(row.Cost_Price) : (row.cost_price !== undefined ? parseFloat(row.cost_price) : undefined),
            selling_price: parseFloat(row.Selling_Price || row.selling_price) || 0,
            wholesale_price: row.Wholesale_Price ? parseFloat(row.Wholesale_Price) : (row.wholesale_price ? parseFloat(row.wholesale_price) : null),
            min_selling_price: row.Min_Selling_Price ? parseFloat(row.Min_Selling_Price) : null,
            min_stock_alert: parseInt(row.Min_Alert || row.min_stock_alert) || 10,
            warehouse_location: row.Storage_Location || row.warehouse_location || 'Main Showroom',
            status: row.Status || row.status || 'active',
            conversions: {
              sqm_per_box: parseFloat(row.SqM_Per_Box || row.sqm_per_box) || null,
              pieces_per_box: parseInt(row.Pieces_Per_Box || row.pieces_per_box) || null
            },
            attributes: parsedAttributes,
            initial_stock_showroom: parseFloat(row.Stock_Showroom || row.stock) || 0,
            initial_stock_depot: parseFloat(row.Stock_Depot) || 0
          };
        });

        // Send to backend batch import endpoint
        const res = await apiRequest('/products/import', {
          method: 'POST',
          body: JSON.stringify({ products: mappedProducts })
        });

        alert(`Success! ${res.imported_count || mappedProducts.length} products imported transactionally.`);
        loadProducts(1);
        setImportErrors(null);
      } catch (err) {
        if (err.response && err.response.error && err.response.error.details) {
          // Display atomic error report modal
          setImportErrors(err.response.error.details);
        } else {
          alert(`Batch Import Failed: ${err.message}`);
        }
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Category attribute helper
  const updateAttribute = (key, value) => {
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value
      }
    }));
  };

  const removeAttribute = (key) => {
    setFormData(prev => {
      const copy = { ...prev.attributes };
      delete copy[key];
      return { ...prev, attributes: copy };
    });
  };

  const addCustomAttribute = () => {
    if (!customAttrKey.trim()) return;
    updateAttribute(customAttrKey.trim(), customAttrValue.trim());
    setCustomAttrKey('');
    setCustomAttrValue('');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      {/* Pending Price Approvals Alert Banner for Super Admin */}
      {isSuperAdmin && pendingPriceChanges.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-amber-200 text-sm flex items-center gap-2">
                <span>Pending Price Approval Requests</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black">
                  {pendingPriceChanges.length}
                </span>
              </div>
              <div className="text-xs text-amber-300/80 mt-0.5">
                Staff submitted sensitive price reductions exceeding 10% or below cost. Your owner authorization is required.
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowApprovalsModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all">
            <Eye className="w-4 h-4" />
            <span>Review & Authorize ({pendingPriceChanges.length})</span>
          </button>
        </div>
      )}

      {/* Top Header & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            <span>Product Catalogue & Price Management</span>
          </h2>
          <div className="text-xs text-slate-400 mt-0.5">
            Tiles, Turkish Security Doors, Sanitary Ware, Paints & General Hardware
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Excel Upload */}
          {isAdmin && (
            <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm">
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>{importing ? 'Validating Batch...' : 'Import Excel / CSV'}</span>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                disabled={importing}
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>
          )}

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Catalogue</span>
          </button>

          {/* Add Product Button */}
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all">
              <Plus className="w-4 h-4" />
              <span>Register Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, brand, barcode, size, color..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </form>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setCategoryFilter(cat);
                  setSubcategoryFilter('All');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory, Status & Stock Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Subcategory select if category selected */}
            {categoryFilter !== 'All' && SUBCATEGORIES[categoryFilter] && (
              <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                <span className="text-slate-400 text-[11px]">Subcategory:</span>
                <select
                  value={subcategoryFilter}
                  onChange={(e) => setSubcategoryFilter(e.target.value)}
                  className="bg-transparent text-white text-[11px] font-semibold focus:outline-none cursor-pointer">
                  <option value="All" className="bg-slate-900">All Subcategories</option>
                  {SUBCATEGORIES[categoryFilter].map(sub => (
                    <option key={sub} value={sub} className="bg-slate-900">{sub}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-[11px]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-white text-[11px] font-semibold focus:outline-none cursor-pointer">
                <option value="All" className="bg-slate-900">All Statuses</option>
                <option value="active" className="bg-slate-900">Active Only</option>
                <option value="discontinued" className="bg-slate-900">Discontinued Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Low Stock Toggle */}
            <button
              onClick={() => setLowStockFilter(!lowStockFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                lowStockFilter
                  ? 'bg-red-500/20 text-red-300 border-red-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Low Stock Alerts</span>
            </button>

            <button
              onClick={() => loadProducts(pagination.page)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
              title="Refresh Catalogue">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Product Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Product Name & Hardware Specs</th>
                <th className="px-4 py-3">Category / Brand</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Unit Stock</th>
                <th className="px-4 py-3">Warehouses</th>
                {isSuperAdmin && <th className="px-4 py-3 text-right">Cost (Owner Only)</th>}
                <th className="px-4 py-3 text-right">Selling Price</th>
                <th className="px-4 py-3 text-right">Wholesale</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 9 : 8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                      <span>Loading OMAL hardware catalogue...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 9 : 8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="w-8 h-8 text-slate-600" />
                      <div className="font-semibold text-slate-400">No products match your criteria</div>
                      <div className="text-xs text-slate-600">Try adjusting your filters or register a new product.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map(p => {
                  const stock = p.total_stock || 0;
                  const isLow = stock <= (p.min_stock_alert || 10);
                  const isDiscontinued = p.status === 'discontinued';

                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isDiscontinued ? 'opacity-60 bg-slate-950/40' : ''
                      }`}>
                      {/* Name & Hardware Specs */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.image_url || 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=100'}
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0 border border-slate-700"
                          />
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white line-clamp-1">{p.name}</span>
                              {p.variants && p.variants.length > 0 && (
                                <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[9px] font-mono">
                                  {p.variants.length} variants
                                </span>
                              )}
                            </div>
                            
                            <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-2">
                              <span>SKU: {p.sku}</span>
                              {p.barcode && <span>• Barcode: {p.barcode}</span>}
                              {p.sqm_per_box > 0 && (
                                <span className="text-amber-400 font-bold">• {p.sqm_per_box} m²/box ({p.pieces_per_box || 4} pcs)</span>
                              )}
                              {p.subcategory && <span className="text-slate-400">• {p.subcategory}</span>}
                            </div>

                            {/* Render Category Specific Attribute Badges */}
                            {p.attributes && Object.keys(p.attributes).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(p.attributes).slice(0, 3).map(([k, v]) => (
                                  <span key={k} className="px-1.5 py-0.5 bg-slate-800/80 text-slate-300 rounded text-[9px]">
                                    <span className="text-slate-500">{k}:</span> {String(v)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category & Brand */}
                      <td className="px-4 py-3">
                        <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {p.category}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">{p.brand || '—'}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-red-500/20 text-red-400 border border-red-500/40'
                        }`}>
                          {p.status === 'active' ? 'Active' : 'Discontinued'}
                        </span>
                      </td>

                      {/* Unit Stock */}
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                          stock <= 0
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : isLow
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {stock} {p.unit}
                        </span>
                      </td>

                      {/* Warehouse Breakdown */}
                      <td className="px-4 py-3">
                        <div className="text-[10px] space-y-0.5 font-mono">
                          {p.warehouses && Object.entries(p.warehouses).map(([wName, qty]) => (
                            <div key={wName} className="text-slate-400 flex justify-between gap-2">
                              <span className="truncate max-w-[100px]">{wName.replace(' (Depot)', '')}:</span>
                              <span className="text-slate-200">{qty}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Cost Price (SUPER ADMIN ONLY) */}
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-400">
                          GH₵ {p.cost_price !== undefined && p.cost_price !== null ? p.cost_price.toFixed(2) : '—'}
                        </td>
                      )}

                      {/* Selling Price */}
                      <td className="px-4 py-3 text-right">
                        <div className="font-mono font-bold text-amber-400 text-xs">
                          GH₵ {p.selling_price?.toFixed(2)}
                        </div>
                        {p.min_selling_price > 0 && (
                          <div className="text-[9px] text-slate-500 font-mono">
                            Min: GH₵ {p.min_selling_price.toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* Wholesale Price */}
                      <td className="px-4 py-3 text-right font-mono text-slate-300 text-xs">
                        {p.wholesale_price ? `GH₵ ${p.wholesale_price.toFixed(2)}` : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View specs / variants */}
                          <button
                            onClick={() => openViewProduct(p)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                            title="View Details, Specs, Variants & History">
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                          </button>

                          {/* Edit (Admin/Super Admin only) */}
                          {isAdmin && (
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition-colors"
                              title="Edit Product & Prices">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Toggle Active / Discontinued (Admin/Super Admin) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleToggleStatus(p)}
                              className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${
                                p.status === 'active'
                                  ? 'text-slate-400 hover:text-red-400'
                                  : 'text-emerald-400 hover:text-emerald-300'
                              }`}
                              title={p.status === 'active' ? 'Deactivate (Discontinue)' : 'Reactivate Product'}>
                              {p.status === 'active' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Delete (Owner only) */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                              title="Delete Product (Owner Only)">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT PRODUCT MODAL (Tasks 1, 2, 3, 4)                                */}
      {/* ========================================================================= */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-500" />
                  <span>{modalMode === 'add' ? 'Register New Hardware / Tile Product' : `Edit: ${editingProduct?.name}`}</span>
                </h3>
                <div className="text-xs text-slate-400">
                  Configure hardware specifications, explicit conversions, and price floor controls
                </div>
              </div>
              <button 
                onClick={() => setShowProductModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('basic')}
                className={`py-3 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'basic' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}>
                1. Product Registration
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('attributes')}
                className={`py-3 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'attributes' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}>
                2. Hardware Specs & Attributes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('conversions')}
                className={`py-3 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'conversions' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}>
                3. Units & Conversions
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pricing')}
                className={`py-3 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'pricing' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}>
                4. Pricing & Controls
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* TAB 1: BASIC PRODUCT REGISTRATION */}
              {activeTab === 'basic' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-slate-300 block mb-1 font-semibold">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Spanish Porcelain Floor Tile 60x60 White Polished"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        const defaultSub = SUBCATEGORIES[newCat] ? SUBCATEGORIES[newCat][0] : '';
                        setFormData({ ...formData, category: newCat, subcategory: defaultSub });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                      {CATEGORIES.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Subcategory</label>
                    {SUBCATEGORIES[formData.category] ? (
                      <select
                        value={formData.subcategory}
                        onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                        {SUBCATEGORIES[formData.category].map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.subcategory}
                        onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                        placeholder="e.g. Iron Rods"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">SKU / Item Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g. TL-SP-6060-WHT"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Barcode</label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="Scan or enter barcode"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Brand / Manufacturer</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="e.g. Porcelanosa Spain / Kale Turkey"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Supplier Association</label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                      <option value="">-- Select Registered Supplier (Optional) --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.location || 'Ghana'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Storage Location</label>
                    <input
                      type="text"
                      value={formData.warehouse_location}
                      onChange={(e) => setFormData({ ...formData, warehouse_location: e.target.value })}
                      placeholder="e.g. Main Showroom Bay A-3"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                      <option value="active">Active (Available for POS sales)</option>
                      <option value="discontinued">Discontinued (Blocked from sales)</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-slate-300 block mb-1 font-semibold">Detailed Description</label>
                    <textarea
                      rows="2"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter specifications, material composition, warranty information, and installation notes..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-slate-300 block mb-1 font-semibold">Product Image URL</label>
                    <input
                      type="text"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: HARDWARE-SPECIFIC ATTRIBUTES (Dynamic by Category) */}
              {activeTab === 'attributes' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs text-slate-300">
                    <span className="font-bold text-amber-400">Category-Specific Specifications: </span>
                    Fields below are automatically tailored for <span className="underline font-semibold">{formData.category}</span> and stored in the database without altering existing tables.
                  </div>

                  {/* TILES ATTRIBUTES */}
                  {formData.category === 'Tiles' && (
                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
                      <div>
                        <label className="text-slate-400 block mb-1">Tile Size</label>
                        <input
                          type="text"
                          value={formData.attributes.size || ''}
                          onChange={(e) => updateAttribute('size', e.target.value)}
                          placeholder="e.g. 60x60 cm, 30x60 cm, 60x120 cm"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Colour</label>
                        <input
                          type="text"
                          value={formData.attributes.colour || ''}
                          onChange={(e) => updateAttribute('colour', e.target.value)}
                          placeholder="e.g. Super White, Carrara Grey, Anthracite"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Design / Pattern</label>
                        <input
                          type="text"
                          value={formData.attributes.design || ''}
                          onChange={(e) => updateAttribute('design', e.target.value)}
                          placeholder="e.g. Marble Vein, Wood Grain, Plain Monocolor"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Surface Finish</label>
                        <input
                          type="text"
                          value={formData.attributes.finish || ''}
                          onChange={(e) => updateAttribute('finish', e.target.value)}
                          placeholder="e.g. Polished Gloss, Matte, Anti-Slip R11"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Thickness</label>
                        <input
                          type="text"
                          value={formData.attributes.thickness || ''}
                          onChange={(e) => updateAttribute('thickness', e.target.value)}
                          placeholder="e.g. 9mm, 10mm, 12mm"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* SECURITY DOORS ATTRIBUTES */}
                  {formData.category === 'Security Doors' && (
                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
                      <div>
                        <label className="text-slate-400 block mb-1">Door Dimensions</label>
                        <input
                          type="text"
                          value={formData.attributes.dimensions || ''}
                          onChange={(e) => updateAttribute('dimensions', e.target.value)}
                          placeholder="e.g. 3ft (96x205cm), 4ft (120x210cm)"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Model / Security Grade</label>
                        <input
                          type="text"
                          value={formData.attributes.model || ''}
                          onChange={(e) => updateAttribute('model', e.target.value)}
                          placeholder="e.g. Turkish Grand Armoured 14-Lock"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Door Finish</label>
                        <input
                          type="text"
                          value={formData.attributes.finish || ''}
                          onChange={(e) => updateAttribute('finish', e.target.value)}
                          placeholder="e.g. Walnut Wood Veneer, Bronze Steel"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Opening Direction / Handedness</label>
                        <select
                          value={formData.attributes.opening_direction || 'Right Hand Inward'}
                          onChange={(e) => updateAttribute('opening_direction', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                          <option value="Right Hand Inward">Right Hand Inward</option>
                          <option value="Left Hand Inward">Left Hand Inward</option>
                          <option value="Right Hand Outward">Right Hand Outward</option>
                          <option value="Left Hand Outward">Left Hand Outward</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-slate-400 block mb-1">Included Accessories</label>
                        <input
                          type="text"
                          value={Array.isArray(formData.attributes.included_accessories) ? formData.attributes.included_accessories.join(', ') : (formData.attributes.included_accessories || '')}
                          onChange={(e) => updateAttribute('included_accessories', e.target.value.split(',').map(s => s.trim()))}
                          placeholder="e.g. Kale Monoblock Locks, Digital Peephole, Doorbell, Stainless Handles, Steel Subframe"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* SANITARY WARE ATTRIBUTES */}
                  {formData.category === 'Sanitary' && (
                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
                      <div>
                        <label className="text-slate-400 block mb-1">Sanitary Product Type</label>
                        <input
                          type="text"
                          value={formData.attributes.product_type || ''}
                          onChange={(e) => updateAttribute('product_type', e.target.value)}
                          placeholder="e.g. Water Closet (WC), Washbasin, Bathtub, Mixer Tap"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Colour</label>
                        <input
                          type="text"
                          value={formData.attributes.colour || ''}
                          onChange={(e) => updateAttribute('colour', e.target.value)}
                          placeholder="e.g. Alpine White, Matte Black, Brushed Gold"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Dimensions</label>
                        <input
                          type="text"
                          value={formData.attributes.dimensions || ''}
                          onChange={(e) => updateAttribute('dimensions', e.target.value)}
                          placeholder="e.g. 65x38x80 cm, 60cm Vanity"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Model / Flush Technology</label>
                        <input
                          type="text"
                          value={formData.attributes.model || ''}
                          onChange={(e) => updateAttribute('model', e.target.value)}
                          placeholder="e.g. Rimless Dual-Flush Tornado 3/4.5L"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* PAINTS ATTRIBUTES */}
                  {formData.category === 'Paints' && (
                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
                      <div>
                        <label className="text-slate-400 block mb-1">Colour / Shade</label>
                        <input
                          type="text"
                          value={formData.attributes.colour || ''}
                          onChange={(e) => updateAttribute('colour', e.target.value)}
                          placeholder="e.g. Brilliant White, Cream Silk, Charcoal Grey"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Paint Finish</label>
                        <input
                          type="text"
                          value={formData.attributes.finish || ''}
                          onChange={(e) => updateAttribute('finish', e.target.value)}
                          placeholder="e.g. WeatherShield Exterior Matt, Silk Acrylic, Gloss Enamel"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Volume</label>
                        <input
                          type="text"
                          value={formData.attributes.volume || ''}
                          onChange={(e) => updateAttribute('volume', e.target.value)}
                          placeholder="e.g. 20 Litres, 5 Litres, 1 Litre"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Pack Size / Container Type</label>
                        <input
                          type="text"
                          value={formData.attributes.pack_size || ''}
                          onChange={(e) => updateAttribute('pack_size', e.target.value)}
                          placeholder="e.g. 20L Bucket, Gallon, Metal Drum"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* CUSTOM DYNAMIC ATTRIBUTE BUILDER (Works for Any Category) */}
                  <div className="pt-3 border-t border-slate-800">
                    <div className="font-semibold text-slate-300 mb-2 flex items-center justify-between">
                      <span>Custom Hardware Attributes</span>
                      <span className="text-[11px] text-slate-500">JSONB Extensibility without Schema Migration</span>
                    </div>

                    {/* Existing Custom Attributes List */}
                    {Object.keys(formData.attributes || {}).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {Object.entries(formData.attributes).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-200">
                            <span className="text-amber-400 font-semibold">{k}:</span>
                            <span>{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                            <button
                              type="button"
                              onClick={() => removeAttribute(k)}
                              className="text-slate-400 hover:text-red-400 ml-1">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Custom Attribute Row */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customAttrKey}
                        onChange={(e) => setCustomAttrKey(e.target.value)}
                        placeholder="Attribute Name (e.g. Diameter, Steel Gauge, Warranty)"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        value={customAttrValue}
                        onChange={(e) => setCustomAttrValue(e.target.value)}
                        placeholder="Attribute Value (e.g. 12mm, 5 Years)"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={addCustomAttribute}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: UNITS & CONVERSIONS */}
              {activeTab === 'conversions' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-300 block mb-1 font-semibold">Primary Unit of Measurement *</label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                        {VALID_UNITS.map(u => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1 font-semibold">Low Stock Alert Min Qty *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.min_stock_alert}
                        onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3">
                    <div className="font-semibold text-amber-400 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      <span>Explicit Hardware Unit Conversions</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Configure precise conversions to enable automatic m² calculators at the POS and pallet logistics in the warehouse.
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="text-slate-300 block mb-1">Tiles / Units per Box</label>
                        <input
                          type="number"
                          step="1"
                          value={formData.conversions?.pieces_per_box || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            conversions: { ...formData.conversions, pieces_per_box: e.target.value }
                          })}
                          placeholder="e.g. 4"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Tile Coverage (m² per box)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.conversions?.sqm_per_box || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            conversions: { ...formData.conversions, sqm_per_box: e.target.value }
                          })}
                          placeholder="e.g. 1.44"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Boxes per Pallet</label>
                        <input
                          type="number"
                          step="1"
                          value={formData.conversions?.boxes_per_pallet || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            conversions: { ...formData.conversions, boxes_per_pallet: e.target.value }
                          })}
                          placeholder="e.g. 64"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Live Calculation Preview */}
                    {formData.conversions?.sqm_per_box > 0 && (
                      <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                        <span>Conversion Preview:</span>
                        <span className="font-mono text-amber-400 font-bold">
                          100 boxes = {(100 * formData.conversions.sqm_per_box).toFixed(2)} m²
                          {formData.conversions.pieces_per_box ? ` (${100 * formData.conversions.pieces_per_box} pieces)` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Initial Stock Inputs (for Add mode only) */}
                  {modalMode === 'add' && (
                    <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700 space-y-3">
                      <div className="font-semibold text-white">Initial Stock Provisioning</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-slate-400 block mb-1">Main Showroom Quantity ({formData.unit})</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.initial_stock_showroom}
                            onChange={(e) => setFormData({ ...formData, initial_stock_showroom: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1">Warehouse B (Depot) Quantity ({formData.unit})</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.initial_stock_depot}
                            onChange={(e) => setFormData({ ...formData, initial_stock_depot: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PRICING & PRICE CONTROLS (Task 4) */}
              {activeTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-3">
                    <div className="font-semibold text-white flex items-center justify-between">
                      <span>Price Structure (Ghana Cedis GH₵)</span>
                      <span className="text-[11px] text-amber-400 font-normal">Audited & Protected</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Cost Price (SUPER ADMIN ONLY or Authorized) */}
                      {isSuperAdmin ? (
                        <div>
                          <label className="text-slate-300 block mb-1 font-semibold">Purchase Cost Price (GH₵) *</label>
                          <input
                            type="number"
                            step="0.01"
                            required={modalMode === 'add'}
                            value={formData.cost_price}
                            onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                            placeholder="e.g. 135.00"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                          <span className="text-[10px] text-slate-500">Restricted to Super Admin (Owner).</span>
                        </div>
                      ) : (
                        <div>
                          <label className="text-slate-400 block mb-1 font-semibold">Purchase Cost Price</label>
                          <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-500 font-mono">
                            CONFIDENTIAL (Owner Only)
                          </div>
                        </div>
                      )}

                      {/* Selling Price */}
                      <div>
                        <label className="text-slate-300 block mb-1 font-semibold">Standard Selling Price (GH₵) *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.selling_price}
                          onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                          placeholder="e.g. 195.00"
                          className="w-full bg-slate-800 border border-amber-500/50 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500 font-bold"
                        />
                      </div>

                      {/* Wholesale Price */}
                      <div>
                        <label className="text-slate-300 block mb-1 font-semibold">Wholesale Price (GH₵)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.wholesale_price}
                          onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                          placeholder="e.g. 180.00"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Minimum Selling Price Floor */}
                      <div>
                        <label className="text-slate-300 block mb-1 font-semibold">Minimum Floor Price (GH₵)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.min_selling_price}
                          onChange={(e) => setFormData({ ...formData, min_selling_price: e.target.value })}
                          placeholder="e.g. 175.00 (Prevents POS under-pricing)"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-[10px] text-slate-500">POS strictly forbids sales below this floor.</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Change Reason & Sensitivity Notification (when editing existing product) */}
                  {modalMode === 'edit' && (
                    <div className="p-4 bg-amber-950/20 rounded-xl border border-amber-500/30 space-y-3">
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        <span>Price Change Audit & Approval Rules</span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        All price modifications are permanently audited. If an Admin reduces the selling price by more than 10% or below purchase cost, it requires Super Admin approval unless verified with Owner PIN.
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1 font-semibold">Reason for Price Change *</label>
                        <input
                          type="text"
                          required
                          value={formData.price_change_reason}
                          onChange={(e) => setFormData({ ...formData, price_change_reason: e.target.value })}
                          placeholder="e.g. Supplier promo discount / Currency rate adjustment"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {!isSuperAdmin && (
                        <div>
                          <label className="text-slate-300 block mb-1 font-semibold">Super Admin Authorization PIN (Optional)</label>
                          <input
                            type="password"
                            maxLength="6"
                            value={formData.admin_pin}
                            onChange={(e) => setFormData({ ...formData, admin_pin: e.target.value })}
                            placeholder="Enter Owner PIN (9999) to bypass approval queue"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Form Footer Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20">
                  {modalMode === 'add' ? 'Register Product' : 'Save & Apply Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW PRODUCT SPECS, VARIANTS & AUDIT HISTORY MODAL (Tasks 2, 3, 4)         */}
      {/* ========================================================================= */}
      {viewProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-500" />
                  <span>{viewProduct.name}</span>
                </h3>
                <div className="text-xs text-slate-400 font-mono">
                  SKU: {viewProduct.sku} • Category: {viewProduct.category} • Status: {viewProduct.status}
                </div>
              </div>
              <button 
                onClick={() => setViewProduct(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {loadingDetails ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
                  <span>Loading complete hardware specifications and audit history...</span>
                </div>
              ) : (
                <>
                  {/* Top Specs Overview Cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                      <div className="text-slate-400 text-[11px]">Total Stock</div>
                      <div className="text-base font-bold text-white font-mono mt-0.5">
                        {viewProductDetails?.total_stock || viewProduct.total_stock || 0} {viewProduct.unit}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Min Threshold: {viewProduct.min_stock_alert}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                      <div className="text-slate-400 text-[11px]">Selling Price</div>
                      <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                        GH₵ {viewProduct.selling_price?.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Wholesale: {viewProduct.wholesale_price ? `GH₵ ${viewProduct.wholesale_price.toFixed(2)}` : '—'}
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                        <div className="text-slate-400 text-[11px]">Purchase Cost</div>
                        <div className="text-base font-bold text-slate-300 font-mono mt-0.5">
                          GH₵ {viewProductDetails?.cost_price !== undefined ? viewProductDetails.cost_price.toFixed(2) : '—'}
                        </div>
                        <div className="text-[10px] text-emerald-400 mt-1">
                          Margin: GH₵ {(viewProduct.selling_price - (viewProductDetails?.cost_price || 0)).toFixed(2)}
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                      <div className="text-slate-400 text-[11px]">Floor Price</div>
                      <div className="text-base font-bold text-slate-300 font-mono mt-0.5">
                        {viewProduct.min_selling_price ? `GH₵ ${viewProduct.min_selling_price.toFixed(2)}` : 'None'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        POS Protected
                      </div>
                    </div>
                  </div>

                  {/* Hardware Attributes & Description */}
                  <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-2">
                    <div className="font-semibold text-white">Hardware Attributes & Specifications</div>
                    {viewProductDetails?.attributes && Object.keys(viewProductDetails.attributes).length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {Object.entries(viewProductDetails.attributes).map(([k, v]) => (
                          <div key={k} className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                            <span className="text-slate-400 block text-[10px] uppercase tracking-wide">{k}</span>
                            <span className="font-semibold text-white">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500 italic">No specific dynamic attributes configured.</div>
                    )}

                    {viewProductDetails?.description && (
                      <div className="pt-2 text-slate-300 border-t border-slate-800 mt-2">
                        <span className="text-slate-500 block mb-0.5 font-semibold">Description:</span>
                        {viewProductDetails.description}
                      </div>
                    )}
                  </div>

                  {/* Product Variants Section (Task 3) */}
                  <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-400" />
                          <span>Product Variants (Separate Stock Tracking)</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Track stock separately for colors, handedness, or dimension variations
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setVariantForm({
                              ...defaultVariantData,
                              sku: `${viewProduct.sku}-V${(viewProductDetails?.variants?.length || 0) + 1}`,
                              selling_price: viewProduct.selling_price,
                              wholesale_price: viewProduct.wholesale_price || '',
                              min_selling_price: viewProduct.min_selling_price || '',
                              cost_price: isSuperAdmin ? (viewProductDetails?.cost_price || '') : ''
                            });
                            setShowAddVariantModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all">
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Variant</span>
                        </button>
                      )}
                    </div>

                    {viewProductDetails?.variants && viewProductDetails.variants.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-slate-300">
                          <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                            <tr>
                              <th className="p-2">Variant Name</th>
                              <th className="p-2">SKU</th>
                              <th className="p-2 text-center">Stock</th>
                              <th className="p-2">Warehouses</th>
                              <th className="p-2 text-right">Selling Price</th>
                              {isSuperAdmin && <th className="p-2 text-right">Cost</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 font-mono">
                            {viewProductDetails.variants.map(v => (
                              <tr key={v.id} className="hover:bg-slate-800/40">
                                <td className="p-2 font-bold text-white font-sans">{v.variant_name}</td>
                                <td className="p-2 text-slate-400">{v.sku}</td>
                                <td className="p-2 text-center">
                                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-bold">
                                    {v.total_stock || 0}
                                  </span>
                                </td>
                                <td className="p-2 text-[10px] font-sans">
                                  {v.warehouses && Object.entries(v.warehouses).map(([w, q]) => (
                                    <span key={w} className="mr-2 text-slate-400">
                                      {w.replace(' (Depot)', '')}: <span className="text-white font-mono">{q}</span>
                                    </span>
                                  ))}
                                </td>
                                <td className="p-2 text-right text-amber-400 font-bold">
                                  GH₵ {v.selling_price?.toFixed(2)}
                                </td>
                                {isSuperAdmin && (
                                  <td className="p-2 text-right text-slate-400">
                                    GH₵ {v.cost_price?.toFixed(2)}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-slate-500 py-3 text-center italic bg-slate-900/50 rounded-lg">
                        No distinct variants configured. All stock is tracked at the parent product level.
                      </div>
                    )}
                  </div>

                  {/* Audit & Price History Table (Task 4) */}
                  <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-3">
                    <div className="font-semibold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>Audited Price History</span>
                    </div>

                    {viewProductDetails?.price_history && viewProductDetails.price_history.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-slate-300">
                          <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                            <tr>
                              <th className="p-2">Date & Time</th>
                              <th className="p-2">Changed By</th>
                              <th className="p-2 text-right">Old Price</th>
                              <th className="p-2 text-right">New Price</th>
                              <th className="p-2">Reason</th>
                              <th className="p-2 text-center">Approval Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-[11px]">
                            {viewProductDetails.price_history.map(h => (
                              <tr key={h.id} className="hover:bg-slate-800/40">
                                <td className="p-2 text-slate-400 font-mono">
                                  {new Date(h.created_at).toLocaleString()}
                                </td>
                                <td className="p-2 text-white font-semibold">
                                  {h.changed_by_name || 'System / Admin'}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-400 line-through">
                                  GH₵ {parseFloat(h.old_selling_price || 0).toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-mono text-amber-400 font-bold">
                                  GH₵ {parseFloat(h.new_selling_price || 0).toFixed(2)}
                                </td>
                                <td className="p-2 text-slate-300">{h.reason}</td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    h.status === 'approved'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : h.status === 'pending_approval'
                                      ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                                      : 'bg-red-500/20 text-red-300'
                                  }`}>
                                    {h.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-slate-500 py-3 text-center italic bg-slate-900/50 rounded-lg">
                        Original registration price has remained unchanged. No price adjustments logged.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD VARIANT SUB-MODAL (Task 3)                                            */}
      {/* ========================================================================= */}
      {showAddVariantModal && viewProduct && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-55">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Add Variant for {viewProduct.name}</span>
              </h4>
              <button onClick={() => setShowAddVariantModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVariant} className="p-6 space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Variant Name *</label>
                <input
                  type="text"
                  required
                  value={variantForm.variant_name}
                  onChange={(e) => setVariantForm({ ...variantForm, variant_name: e.target.value })}
                  placeholder="e.g. 60x60 Black Matte / Right Hand Inward 4ft"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Variant SKU *</label>
                  <input
                    type="text"
                    required
                    value={variantForm.sku}
                    onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Variant Barcode</label>
                  <input
                    type="text"
                    value={variantForm.barcode}
                    onChange={(e) => setVariantForm({ ...variantForm, barcode: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Selling Price (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={variantForm.selling_price}
                    onChange={(e) => setVariantForm({ ...variantForm, selling_price: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                {isSuperAdmin && (
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Cost Price (GH₵)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={variantForm.cost_price}
                      onChange={(e) => setVariantForm({ ...variantForm, cost_price: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-slate-400 block mb-1">Showroom Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={variantForm.initial_stock_showroom}
                    onChange={(e) => setVariantForm({ ...variantForm, initial_stock_showroom: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Depot Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={variantForm.initial_stock_depot}
                    onChange={(e) => setVariantForm({ ...variantForm, initial_stock_depot: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddVariantModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold">
                  Create Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUPER ADMIN PRICE APPROVALS MODAL (Task 4)                                */}
      {/* ========================================================================= */}
      {showApprovalsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-amber-300 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  <span>Owner Price Change Approvals Queue</span>
                </h3>
                <div className="text-xs text-slate-400">
                  Authorize or reject sensitive price reductions submitted by Ghanaian store managers
                </div>
              </div>
              <button onClick={() => setShowApprovalsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {pendingPriceChanges.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <div className="font-semibold text-slate-300">All price changes are approved!</div>
                  <div className="text-xs text-slate-500 mt-0.5">No pending approval requests in queue.</div>
                </div>
              ) : (
                pendingPriceChanges.map(change => (
                  <div 
                    key={change.id} 
                    className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white text-sm">{change.product_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          SKU: {change.sku} • Category: {change.category}
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        Requires Owner Approval
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900 rounded-lg font-mono">
                      <div>
                        <div className="text-slate-500 text-[10px]">CURRENT PRICE</div>
                        <div className="text-sm font-semibold text-slate-300">
                          GH₵ {parseFloat(change.old_selling_price).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-amber-400 text-[10px]">PROPOSED PRICE</div>
                        <div className="text-sm font-bold text-amber-400">
                          GH₵ {parseFloat(change.new_selling_price).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-red-400 text-[10px]">PRICE DROP</div>
                        <div className="text-sm font-bold text-red-400">
                          {change.change_percent}%
                        </div>
                      </div>
                    </div>

                    <div className="text-slate-300">
                      <span className="text-slate-500">Submitted by:</span> <span className="font-semibold text-white">{change.changed_by_name}</span>
                      <span className="text-slate-500 ml-3">Reason:</span> <span className="italic text-slate-200">"{change.reason}"</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
                      <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                        <input
                          type="text"
                          placeholder="Rejection reason..."
                          value={rejectingId === change.id ? rejectReason : ''}
                          onChange={(e) => {
                            setRejectingId(change.id);
                            setRejectReason(e.target.value);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-[11px]"
                        />
                        <button
                          onClick={() => handleRejectPrice(change.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold">
                          Reject
                        </button>
                      </div>

                      <button
                        onClick={() => handleApprovePrice(change.id)}
                        disabled={approvingId === change.id}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md shadow-emerald-600/20">
                        <Check className="w-3.5 h-3.5" />
                        <span>{approvingId === change.id ? 'Approving...' : 'Approve & Publish Price'}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ATOMIC BATCH IMPORT ERROR REPORT MODAL (Task 5)                            */}
      {/* ========================================================================= */}
      {importErrors && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-60">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-red-950/40 border-b border-red-500/40 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-red-300 text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span>Batch Import Rejected — Atomic Validation Guarantee</span>
                </h3>
                <div className="text-xs text-red-200/80 mt-0.5">
                  0 records were imported to protect database and accounting integrity. Fix the errors below and re-upload.
                </div>
              </div>
              <button onClick={() => setImportErrors(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-slate-300">
                Found <span className="font-bold text-red-400">{importErrors.length}</span> invalid rows or fields in your spreadsheet. Because OMAL enforces strict batch transactional integrity, no partial or corrupted records were added to your catalogue.
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Row #</th>
                      <th className="p-2.5">Invalid Field</th>
                      <th className="p-2.5">Error Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-[11px] font-mono">
                    {importErrors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-amber-400">Row {err.row}</td>
                        <td className="p-2.5 text-white font-semibold">{err.field}</td>
                        <td className="p-2.5 text-red-300 font-sans">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setImportErrors(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold">
                Dismiss and Fix Spreadsheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

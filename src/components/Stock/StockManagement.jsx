import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import AdminPinModal from '../POS/AdminPinModal';
import {
  Layers, ArrowDownLeft, ArrowLeftRight,
  AlertTriangle, History, DollarSign, Clock, Check, X, ShieldAlert,
  ClipboardList, PlusCircle, Search, RefreshCw, Lock, AlertCircle,
  Truck, Undo2, CheckCircle2, XCircle, FileText
} from 'lucide-react';

export default function StockManagement() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const canViewCost = isSuperAdmin || isAdmin;

  // Active sub-navigation tab
  const [activeSubTab, setActiveSubTab] = useState('inventory'); 
  // 'inventory', 'ledger', 'opening_stock', 'stock_counts', 'receipts', 'alerts_reports'

  // Data states
  const [products, setProducts] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [ledgerMovements, setLedgerMovements] = useState([]);
  const [ledgerPagination, setLedgerPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [openingRecords, setOpeningRecords] = useState([]);
  const [stockCounts, setStockCounts] = useState([]);
  const [activeCountSession, setActiveCountSession] = useState(null);
  const [valuationData, setValuationData] = useState(null);
  const [alertsData, setAlertsData] = useState({ summary: {}, out_of_stock: [], low_stock: [], overstock: [] });
  const [reorderData, setReorderData] = useState([]);
  const [damagedMissingData, setDamagedMissingData] = useState({ incidents: [], total_incidents: 0, total_cost_impact: 0 });
  const [deadStockData, setDeadStockData] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [warehouseFilter, setWarehouseFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerMovementFilter, setLedgerMovementFilter] = useState('ALL');

  // Modals
  const [inwardModal, setInwardModal] = useState(false);
  const [openingStockModal, setOpeningStockModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [reserveModal, setReserveModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [customerReturnModal, setCustomerReturnModal] = useState(false);
  const [supplierReturnModal, setSupplierReturnModal] = useState(false);
  const [newCountModal, setNewCountModal] = useState(false);
  const [approveCountModal, setApproveCountModal] = useState(false);
  const [countToApprove, setCountToApprove] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState(null); // callback for pin verification

  // Forms
  const [inwardForm, setInwardForm] = useState({
    supplier_id: '',
    supplier_name: '',
    supplier_invoice_no: '',
    delivery_note_no: '',
    warehouse_name: 'Main Showroom',
    notes: '',
    product_id: '',
    variant_id: null,
    ordered_quantity: '',
    received_quantity: '',
    cost_price: '',
    discrepancy_notes: ''
  });

  const [openingForm, setOpeningForm] = useState({
    product_id: '',
    variant_id: null,
    warehouse_name: 'Main Showroom',
    quantity: '',
    unit: 'pcs',
    unit_cost: '',
    valuation_basis: 'cost_price',
    notes: '',
    is_correction: false,
    correction_notes: '',
    admin_pin: ''
  });

  const [transferForm, setTransferForm] = useState({
    product_id: '',
    variant_id: null,
    from_warehouse: 'Main Showroom',
    to_warehouse: 'Warehouse B (Depot)',
    quantity: '',
    notes: 'Stock rebalance between locations'
  });

  const [reserveForm, setReserveForm] = useState({
    action: 'reserve', // 'reserve' or 'release'
    product_id: '',
    variant_id: null,
    warehouse_name: 'Main Showroom',
    quantity: '',
    reference_no: '',
    notes: 'Reserved for building contractor project'
  });

  const [adjustForm, setAdjustForm] = useState({
    type: 'DAMAGE', // 'DAMAGE' or 'LOSS'
    product_id: '',
    variant_id: null,
    warehouse_name: 'Main Showroom',
    quantity: '',
    reason: ''
  });

  const [customerReturnForm, setCustomerReturnForm] = useState({
    product_id: '',
    variant_id: null,
    warehouse_name: 'Main Showroom',
    quantity: '',
    condition: 'resellable', // 'resellable' or 'damaged'
    receipt_no: '',
    reason: 'Customer ordered surplus tiles / project design change',
    refund_amount: ''
  });

  const [supplierReturnForm, setSupplierReturnForm] = useState({
    supplier_id: '',
    product_id: '',
    variant_id: null,
    warehouse_name: 'Main Showroom',
    quantity: '',
    reason: 'Factory glaze defect / damaged packaging upon delivery',
    invoice_reference: ''
  });

  const [newCountForm, setNewCountForm] = useState({
    warehouse_name: 'Main Showroom',
    category: 'All',
    notes: 'Routine physical stock audit'
  });

  const [countItemsInput, setCountItemsInput] = useState({});

  // Fetch all primary stock data
  const loadAllStockData = async () => {
    setLoading(true);
    try {
      const [
        prods,
        summary,
        ledgerRes,
        openings,
        counts,
        val,
        alerts,
        reorders,
        damaged,
        dead,
        supps
      ] = await Promise.all([
        apiRequest('/products').catch(() => []),
        apiRequest('/inventory/stock-summary').catch(() => []),
        apiRequest('/inventory/movements?page=1&limit=50').catch(() => ({ movements: [], pagination: {} })),
        apiRequest('/inventory/opening-stock').catch(() => []),
        apiRequest('/inventory/stock-counts').catch(() => []),
        apiRequest('/inventory/reports/valuation').catch(() => null),
        apiRequest('/inventory/alerts').catch(() => ({ summary: {}, out_of_stock: [], low_stock: [], overstock: [] })),
        apiRequest('/inventory/reports/reorder-suggestions').catch(() => ({ suggestions: [] })),
        apiRequest('/inventory/reports/damaged-missing').catch(() => ({ incidents: [], total_incidents: 0, total_cost_impact: 0 })),
        apiRequest('/inventory/reports/slow-moving').catch(() => []),
        apiRequest('/purchasing/suppliers').catch(() => [])
      ]);

      setProducts(prods || []);
      setStockSummary(summary || []);
      if (ledgerRes && ledgerRes.data) {
        setLedgerMovements(ledgerRes.data);
        if (ledgerRes.pagination) setLedgerPagination(ledgerRes.pagination);
      } else if (Array.isArray(ledgerRes)) {
        setLedgerMovements(ledgerRes);
      }
      setOpeningRecords(openings || []);
      setStockCounts(counts || []);
      setValuationData(val);
      setAlertsData(alerts || { summary: {}, out_of_stock: [], low_stock: [], overstock: [] });
      setReorderData((reorders && reorders.suggestions) || []);
      setDamagedMissingData(damaged || { incidents: [], total_incidents: 0, total_cost_impact: 0 });
      setDeadStockData(dead || []);
      setSuppliers(supps || []);

      if (prods && prods.length > 0) {
        const firstP = prods[0];
        setInwardForm(prev => ({ ...prev, product_id: firstP.id, cost_price: firstP.cost_price }));
        setOpeningForm(prev => ({ ...prev, product_id: firstP.id, unit_cost: firstP.cost_price, unit: firstP.unit }));
        setTransferForm(prev => ({ ...prev, product_id: firstP.id }));
        setReserveForm(prev => ({ ...prev, product_id: firstP.id }));
        setAdjustForm(prev => ({ ...prev, product_id: firstP.id }));
        setCustomerReturnForm(prev => ({ ...prev, product_id: firstP.id }));
        setSupplierReturnForm(prev => ({ ...prev, product_id: firstP.id }));
      }
      if (supps && supps.length > 0) {
        setInwardForm(prev => ({ ...prev, supplier_id: supps[0].id, supplier_name: supps[0].name }));
        setSupplierReturnForm(prev => ({ ...prev, supplier_id: supps[0].id }));
      }
    } catch (err) {
      console.error('Failed to load stock data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllStockData();
  }, []);

  // Filtered Ledger Fetch
  const refreshLedger = async (page = 1) => {
    try {
      let url = `/inventory/movements?page=${page}&limit=50`;
      if (ledgerMovementFilter !== 'ALL') url += `&movement_type=${ledgerMovementFilter}`;
      if (warehouseFilter !== 'All') url += `&warehouse_name=${encodeURIComponent(warehouseFilter)}`;
      const res = await apiRequest(url);
      if (res && res.data) {
        setLedgerMovements(res.data);
        if (res.pagination) setLedgerPagination(res.pagination);
      } else if (Array.isArray(res)) {
        setLedgerMovements(res);
      }
    } catch (err) {
      console.error('Error refreshing ledger:', err);
    }
  };

  // Handle Inward Receipt Submit (Task 2)
  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedProd = products.find(p => String(p.id) === String(inwardForm.product_id));
      const receivedQty = parseFloat(inwardForm.received_quantity);
      const orderedQty = inwardForm.ordered_quantity ? parseFloat(inwardForm.ordered_quantity) : receivedQty;
      const unitCost = parseFloat(inwardForm.cost_price || selectedProd?.cost_price || 0);

      const payload = {
        supplier_id: inwardForm.supplier_id ? parseInt(inwardForm.supplier_id) : null,
        supplier_name: inwardForm.supplier_name || 'Direct Supplier Delivery',
        supplier_invoice_no: inwardForm.supplier_invoice_no,
        delivery_note_no: inwardForm.delivery_note_no,
        warehouse_name: inwardForm.warehouse_name,
        notes: inwardForm.notes,
        items: [
          {
            product_id: parseInt(inwardForm.product_id),
            variant_id: inwardForm.variant_id ? parseInt(inwardForm.variant_id) : null,
            ordered_quantity: orderedQty,
            received_quantity: receivedQty,
            unit: selectedProd?.unit || 'pcs',
            cost_price: unitCost,
            discrepancy_notes: inwardForm.discrepancy_notes || undefined
          }
        ]
      };

      await apiRequest('/inventory/receipts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert('Stock receipt recorded successfully. Inventory ledger & AVCO cost updated.');
      setInwardModal(false);
      loadAllStockData();
    } catch (err) {
      alert(`Stock receipt failed: ${err.message}`);
    }
  };

  // Handle Opening Stock Submit (Task 1)
  const handleOpeningSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        product_id: parseInt(openingForm.product_id),
        variant_id: openingForm.variant_id ? parseInt(openingForm.variant_id) : null,
        warehouse_name: openingForm.warehouse_name,
        quantity: parseFloat(openingForm.quantity),
        unit: openingForm.unit,
        unit_cost: parseFloat(openingForm.unit_cost || 0),
        valuation_basis: openingForm.valuation_basis,
        notes: openingForm.notes,
        is_correction: openingForm.is_correction,
        correction_notes: openingForm.correction_notes || undefined,
        admin_pin: openingForm.admin_pin || undefined
      };

      await apiRequest('/inventory/opening-stock', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert(openingForm.is_correction ? 'Opening stock correction recorded successfully.' : 'Verified opening stock registered and locked in ledger.');
      setOpeningStockModal(false);
      loadAllStockData();
    } catch (err) {
      alert(`Opening stock entry failed: ${err.message}`);
    }
  };

  // Handle Inter-Warehouse Transfer (Task 3)
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/inventory/transfer', {
        method: 'POST',
        body: JSON.stringify({
          product_id: parseInt(transferForm.product_id),
          variant_id: transferForm.variant_id ? parseInt(transferForm.variant_id) : null,
          from_warehouse: transferForm.from_warehouse,
          to_warehouse: transferForm.to_warehouse,
          quantity: parseFloat(transferForm.quantity),
          notes: transferForm.notes
        })
      });

      alert('Inter-warehouse stock transfer executed and ledger updated.');
      setTransferModal(false);
      loadAllStockData();
    } catch (err) {
      alert(`Transfer failed: ${err.message}`);
    }
  };

  // Handle Reservation / Release (Task 4)
  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = reserveForm.action === 'reserve' ? '/inventory/reserve' : '/inventory/release-reservation';
      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          product_id: parseInt(reserveForm.product_id),
          variant_id: reserveForm.variant_id ? parseInt(reserveForm.variant_id) : null,
          warehouse_name: reserveForm.warehouse_name,
          quantity: parseFloat(reserveForm.quantity),
          reference_no: reserveForm.reference_no,
          notes: reserveForm.notes
        })
      });

      alert(`Stock ${reserveForm.action === 'reserve' ? 'reserved' : 'released'} successfully.`);
      setReserveModal(false);
      loadAllStockData();
    } catch (err) {
      alert(`Reservation update failed: ${err.message}`);
    }
  };

  // Trigger Damage/Loss with Admin PIN (Task 3)
  const handleAdjustSubmit = (e) => {
    e.preventDefault();
    if (!adjustForm.product_id || !adjustForm.quantity || !adjustForm.reason) {
      alert('Please fill all required fields');
      return;
    }
    setPinAction(() => async (approver, pin) => {
      try {
        await apiRequest('/inventory/damage-loss', {
          method: 'POST',
          body: JSON.stringify({
            type: adjustForm.type,
            product_id: parseInt(adjustForm.product_id),
            variant_id: adjustForm.variant_id ? parseInt(adjustForm.variant_id) : null,
            warehouse_name: adjustForm.warehouse_name,
            quantity: parseFloat(adjustForm.quantity),
            reason: adjustForm.reason,
            admin_pin: pin
          })
        });
        alert(`${adjustForm.type} write-off authorized by ${approver.name} and logged in ledger.`);
        setAdjustModal(false);
        loadAllStockData();
      } catch (err) {
        alert(`Write-off failed: ${err.message}`);
      }
    });
    setShowPinModal(true);
  };

  // Handle Customer Return (Task 3)
  const handleCustomerReturnSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/inventory/customer-returns', {
        method: 'POST',
        body: JSON.stringify({
          product_id: parseInt(customerReturnForm.product_id),
          variant_id: customerReturnForm.variant_id ? parseInt(customerReturnForm.variant_id) : null,
          warehouse_name: customerReturnForm.warehouse_name,
          quantity: parseFloat(customerReturnForm.quantity),
          condition: customerReturnForm.condition,
          receipt_no: customerReturnForm.receipt_no || undefined,
          reason: customerReturnForm.reason,
          refund_amount: customerReturnForm.refund_amount ? parseFloat(customerReturnForm.refund_amount) : undefined
        })
      });

      alert('Customer return processed and inventory ledger updated.');
      setCustomerReturnModal(false);
      loadAllStockData();
    } catch (err) {
      alert(`Return failed: ${err.message}`);
    }
  };

  // Handle Supplier Return (Task 3)
  const handleSupplierReturnSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/inventory/supplier-returns', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: supplierReturnForm.supplier_id ? parseInt(supplierReturnForm.supplier_id) : null,
          product_id: parseInt(supplierReturnForm.product_id),
          variant_id: supplierReturnForm.variant_id ? parseInt(supplierReturnForm.variant_id) : null,
          warehouse_name: supplierReturnForm.warehouse_name,
          quantity: parseFloat(supplierReturnForm.quantity),
          reason: supplierReturnForm.reason,
          invoice_reference: supplierReturnForm.invoice_reference || undefined
        })
      });

      alert('Supplier return processed and ledger updated.');
      setSupplierReturnModal(false);
      loadAllStockData();
    } catch (err) {
      alert(`Supplier return failed: ${err.message}`);
    }
  };

  // Physical Stock Count: Initiate Session (Task 5)
  const handleStartStockCount = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/inventory/stock-counts', {
        method: 'POST',
        body: JSON.stringify(newCountForm)
      });
      alert(`Physical stock count session ${res.count_number} initiated.`);
      setNewCountModal(false);
      loadAllStockData();
      loadCountSessionDetails(res.id);
    } catch (err) {
      alert(`Failed to start count session: ${err.message}`);
    }
  };

  // Load single count session details
  const loadCountSessionDetails = async (sessionId) => {
    try {
      const session = await apiRequest(`/inventory/stock-counts/${sessionId}`);
      setActiveCountSession(session);
      const inputs = {};
      session.items?.forEach(item => {
        inputs[item.id] = {
          counted_quantity: item.counted_quantity,
          discrepancy_reason: item.discrepancy_reason || ''
        };
      });
      setCountItemsInput(inputs);
    } catch (err) {
      alert(`Failed to load count session: ${err.message}`);
    }
  };

  // Save count input quantities (Task 5)
  const handleSaveCountItems = async () => {
    if (!activeCountSession) return;
    try {
      const itemsPayload = activeCountSession.items.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        counted_quantity: parseFloat(countItemsInput[item.id]?.counted_quantity ?? item.counted_quantity),
        discrepancy_reason: countItemsInput[item.id]?.discrepancy_reason || undefined
      }));

      await apiRequest(`/inventory/stock-counts/${activeCountSession.id}/items`, {
        method: 'PUT',
        body: JSON.stringify({ items: itemsPayload })
      });

      alert('Counted quantities saved. Variances updated.');
      loadCountSessionDetails(activeCountSession.id);
    } catch (err) {
      alert(`Failed to save items: ${err.message}`);
    }
  };

  // Submit count for approval (Task 5)
  const handleSubmitCountSession = async () => {
    if (!activeCountSession) return;
    try {
      await apiRequest(`/inventory/stock-counts/${activeCountSession.id}/submit`, {
        method: 'POST'
      });
      alert('Stock count session submitted for authorization.');
      loadCountSessionDetails(activeCountSession.id);
      loadAllStockData();
    } catch (err) {
      alert(`Submit failed: ${err.message}`);
    }
  };

  // Approve count with separation of duties (Task 5)
  const handleApproveCountSession = async (approvalNotes, pin) => {
    if (!countToApprove) return;
    try {
      await apiRequest(`/inventory/stock-counts/${countToApprove.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approval_notes: approvalNotes || 'Physical count approved and ledger reconciled',
          admin_pin: pin || undefined
        })
      });
      alert(`Stock count ${countToApprove.count_number} approved. Warehouse inventory reconciled in ledger!`);
      setApproveCountModal(false);
      setCountToApprove(null);
      if (activeCountSession?.id === countToApprove.id) {
        loadCountSessionDetails(countToApprove.id);
      }
      loadAllStockData();
    } catch (err) {
      alert(`Approval rejected: ${err.message}`);
    }
  };

  // Filtered live stock items
  const filteredStock = products.filter(p => {
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      {/* Top Header & Fast Action Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            <span>Inventory Ledger & Multi-Warehouse Control</span>
          </h2>
          <div className="text-xs text-slate-400">
            Showroom vs Depot, immutable ledger, verified opening stock, physical count audits & AVCO costing
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Stock Inward / GRN (Task 2) */}
          <button
            onClick={() => setInwardModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md">
            <ArrowDownLeft className="w-4 h-4" />
            <span>Receive Stock (GRN)</span>
          </button>

          {/* Opening Stock (Task 1) */}
          <button
            onClick={() => setOpeningStockModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md">
            <Lock className="w-4 h-4" />
            <span>Opening Stock</span>
          </button>

          {/* Inter-Warehouse Transfer */}
          <button
            onClick={() => setTransferModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md">
            <ArrowLeftRight className="w-4 h-4" />
            <span>Transfer Warehouses</span>
          </button>

          {/* Stock Reservation (Task 4) */}
          <button
            onClick={() => setReserveModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md">
            <ClipboardList className="w-4 h-4" />
            <span>Reserve Stock</span>
          </button>

          {/* Customer / Supplier Returns */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setCustomerReturnModal(true)}
              className="px-2.5 py-1.5 hover:bg-slate-800 text-amber-300 rounded-lg text-xs font-semibold transition-all"
              title="Customer Return (Resellable vs Damaged)">
              <Undo2 className="w-3.5 h-3.5 inline mr-1" />
              <span>Cust Return</span>
            </button>
            <button
              onClick={() => setSupplierReturnModal(true)}
              className="px-2.5 py-1.5 hover:bg-slate-800 text-red-300 rounded-lg text-xs font-semibold transition-all"
              title="Return Defective Stock to Supplier">
              <Truck className="w-3.5 h-3.5 inline mr-1" />
              <span>Supp Return</span>
            </button>
          </div>

          {/* Damage / Loss Write-Off */}
          <button
            onClick={() => setAdjustModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all shadow-md">
            <AlertTriangle className="w-4 h-4" />
            <span>Damage / Loss</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-800 text-xs font-semibold space-x-2 pb-1 scrollbar-none">
        {[
          { id: 'inventory', label: 'Live Stock & Warehouses', icon: Layers },
          { id: 'ledger', label: 'Movement Ledger', icon: History },
          { id: 'opening_stock', label: 'Opening Stock Records', icon: Lock },
          { id: 'stock_counts', label: 'Physical Stock Counts', icon: ClipboardList },
          { id: 'alerts_reports', label: 'Alerts & Valuation Reports', icon: AlertCircle }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 py-2.5 px-3.5 rounded-xl transition-all whitespace-nowrap ${
                activeSubTab === tab.id
                  ? 'bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}>
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: LIVE WAREHOUSE STOCK & RESERVATIONS (Tasks 3 & 4) */}
      {/* ==================================================================== */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
              <span className="text-[11px] text-slate-400 block font-medium">Catalog Products</span>
              <div className="text-xl font-bold text-white font-mono mt-0.5">{products.length}</div>
              <span className="text-[10px] text-slate-500">Active hardware items</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
              <span className="text-[11px] text-slate-400 block font-medium">Out of Stock Alert</span>
              <div className="text-xl font-bold text-red-400 font-mono mt-0.5">
                {alertsData?.summary?.out_of_stock_count || 0}
              </div>
              <span className="text-[10px] text-red-400/80">Immediate reorder required</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
              <span className="text-[11px] text-slate-400 block font-medium">Low Stock Warning</span>
              <div className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                {alertsData?.summary?.low_stock_count || 0}
              </div>
              <span className="text-[10px] text-amber-400/80">Below minimum threshold</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
              <span className="text-[11px] text-slate-400 block font-medium">Overstock Notice</span>
              <div className="text-xl font-bold text-blue-400 font-mono mt-0.5">
                {alertsData?.summary?.overstock_count || 0}
              </div>
              <span className="text-[10px] text-blue-400/80">Exceeds 3x min buffer</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by product name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-48 sm:w-64 text-xs"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs">
                <option value="All">All Categories</option>
                <option value="Tiles">Tiles</option>
                <option value="Security Doors">Security Doors</option>
                <option value="Sanitary Ware">Sanitary Ware</option>
                <option value="Paints">Paints</option>
                <option value="General Hardware">General Hardware</option>
              </select>
            </div>

            <button
              onClick={loadAllStockData}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800/80 rounded-xl transition-all">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Stock Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Product Name & SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-center">Main Showroom (Avail/Res)</th>
                    <th className="px-4 py-3 text-center">Depot (Avail/Res)</th>
                    <th className="px-4 py-3 text-center">Total Available</th>
                    <th className="px-4 py-3 text-center">Min Alert</th>
                    <th className="px-4 py-3 text-right">Selling Price</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">
                        No products match your search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map(p => {
                      const showroom = p.warehouses?.['Main Showroom'] || 0;
                      const depot = p.warehouses?.['Warehouse B (Depot)'] || 0;
                      const totalOnHands = showroom + depot;
                      const isOutOfStock = totalOnHands <= 0;
                      const isLowStock = totalOnHands > 0 && totalOnHands <= (p.min_stock_alert || 10);
                      const isOverstock = totalOnHands >= ((p.min_stock_alert || 10) * 3) && totalOnHands > 30;

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{p.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.sku}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                              {p.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono">
                            <span className="font-semibold text-white">{showroom}</span>
                            <span className="text-[10px] text-slate-500 ml-1">{p.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono">
                            <span className="font-semibold text-blue-300">{depot}</span>
                            <span className="text-[10px] text-slate-500 ml-1">{p.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              isOutOfStock
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : isLowStock
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {totalOnHands} {p.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500 font-mono">
                            {p.min_stock_alert || 10}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                            GH₵ {parseFloat(p.selling_price || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isOutOfStock ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/20 text-red-400 border border-red-600/30">
                                OUT OF STOCK
                              </span>
                            ) : isLowStock ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                LOW STOCK
                              </span>
                            ) : isOverstock ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                                OVERSTOCK
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                                HEALTHY
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: IMMUTABLE MOVEMENT LEDGER (Task 3) */}
      {/* ==================================================================== */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Movement Type</label>
                <select
                  value={ledgerMovementFilter}
                  onChange={(e) => {
                    setLedgerMovementFilter(e.target.value);
                    setTimeout(() => refreshLedger(1), 50);
                  }}
                  className="bg-slate-800 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs">
                  <option value="ALL">All Movements</option>
                  <option value="PURCHASE_RECEIPT">Receipts (Purchases / GRN)</option>
                  <option value="SALE">POS Sales</option>
                  <option value="CUSTOMER_RETURN">Customer Returns</option>
                  <option value="SUPPLIER_RETURN">Supplier Returns</option>
                  <option value="DAMAGE">Damages & Breakages</option>
                  <option value="LOSS">Approved Losses</option>
                  <option value="COUNT_ADJUSTMENT">Stock Count Adjustments</option>
                  <option value="TRANSFER_OUT">Warehouse Transfers Out</option>
                  <option value="TRANSFER_IN">Warehouse Transfers In</option>
                  <option value="OPENING_STOCK">Opening Stock Records</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Warehouse</label>
                <select
                  value={warehouseFilter}
                  onChange={(e) => {
                    setWarehouseFilter(e.target.value);
                    setTimeout(() => refreshLedger(1), 50);
                  }}
                  className="bg-slate-800 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs">
                  <option value="All">All Warehouses</option>
                  <option value="Main Showroom">Main Showroom</option>
                  <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-mono">
                Showing {ledgerMovements.length} records
              </span>
              <button
                onClick={() => refreshLedger(1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all">
                Refresh Ledger
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Product & Variant</th>
                    <th className="px-4 py-3 text-center">Movement Type</th>
                    <th className="px-4 py-3 text-center">Qty Change</th>
                    <th className="px-4 py-3 text-center">Balance After</th>
                    <th className="px-4 py-3">From &rarr; To</th>
                    <th className="px-4 py-3">Reference / Reason</th>
                    {canViewCost && <th className="px-4 py-3 text-right">Cost (AVCO)</th>}
                    <th className="px-4 py-3">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ledgerMovements.length === 0 ? (
                    <tr>
                      <td colSpan={canViewCost ? 9 : 8} className="py-10 text-center text-slate-500">
                        No inventory movements recorded under current filters.
                      </td>
                    </tr>
                  ) : (
                    ledgerMovements.map(m => {
                      const isPositive = parseFloat(m.quantity) > 0;
                      let badgeBg = 'bg-slate-800 text-slate-300';
                      if (m.movement_type === 'PURCHASE_RECEIPT' || m.movement_type === 'IN') {
                        badgeBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                      } else if (m.movement_type === 'SALE' || m.movement_type === 'OUT') {
                        badgeBg = 'bg-blue-500/20 text-blue-300';
                      } else if (m.movement_type === 'CUSTOMER_RETURN') {
                        badgeBg = 'bg-amber-500/20 text-amber-300';
                      } else if (m.movement_type === 'SUPPLIER_RETURN') {
                        badgeBg = 'bg-red-500/20 text-red-300';
                      } else if (m.movement_type === 'DAMAGE' || m.movement_type === 'LOSS') {
                        badgeBg = 'bg-red-600/30 text-red-300 border border-red-500/40';
                      } else if (m.movement_type === 'COUNT_ADJUSTMENT') {
                        badgeBg = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
                      } else if (m.movement_type === 'OPENING_STOCK') {
                        badgeBg = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
                      } else if (m.movement_type.includes('TRANSFER')) {
                        badgeBg = 'bg-purple-500/20 text-purple-300';
                      }

                      return (
                        <tr key={m.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-[10px]">
                            {new Date(m.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{m.product_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {m.product_sku || m.sku} {m.variant_name ? `• ${m.variant_name}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeBg}`}>
                              {m.movement_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold">
                            <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
                              {isPositive ? `+${m.quantity}` : m.quantity} {m.unit || 'pcs'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-200">
                            {m.balance_after !== undefined && m.balance_after !== null ? `${m.balance_after} ${m.unit || 'pcs'}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-400">
                            {m.from_location && <span className="text-slate-500">{m.from_location} &rarr; </span>}
                            <span className="text-slate-200 font-medium">{m.to_location || 'Checkout'}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-300 max-w-xs">
                            <div className="truncate">{m.reason}</div>
                            {m.reference_no && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                Ref: {m.reference_no}
                              </div>
                            )}
                          </td>
                          {canViewCost && (
                            <td className="px-4 py-3 text-right font-mono text-slate-400">
                              {m.cost_price ? `GH₵ ${parseFloat(m.cost_price).toFixed(2)}` : '—'}
                            </td>
                          )}
                          <td className="px-4 py-3 text-slate-400 text-[11px]">
                            {m.created_by_name || 'System'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: OPENING STOCK WORKFLOW (Task 1) */}
      {/* ==================================================================== */}
      {activeSubTab === 'opening_stock' && (
        <div className="space-y-4">
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 text-xs text-indigo-200 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white text-sm mb-1">Controlled Opening Stock Ledger</h4>
                <p className="text-indigo-200/80 leading-relaxed">
                  Initial verified physical inventory is recorded once per product, variant and warehouse location.
                  Once committed, records are permanently locked. Repeated entries are prevented without an authorised Super Admin correction workflow.
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpeningStockModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shrink-0 transition-all shadow-md">
              <PlusCircle className="w-4 h-4 inline mr-1.5" />
              <span>Record Verified Opening Stock</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Product Name & SKU</th>
                    <th className="px-4 py-3">Warehouse</th>
                    <th className="px-4 py-3 text-center">Verified Qty</th>
                    <th className="px-4 py-3 text-center">Valuation Basis</th>
                    {canViewCost && <th className="px-4 py-3 text-right">Unit Cost</th>}
                    {canViewCost && <th className="px-4 py-3 text-right">Total Valuation</th>}
                    <th className="px-4 py-3">Operator / Approver</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    {isSuperAdmin && <th className="px-4 py-3 text-center">Correction</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {openingRecords.length === 0 ? (
                    <tr>
                      <td colSpan={canViewCost ? 9 : 7} className="py-10 text-center text-slate-500">
                        No opening stock records yet. Click "Record Verified Opening Stock" to initialize shop balances.
                      </td>
                    </tr>
                  ) : (
                    openingRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{r.product_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {r.product_sku} {r.variant_name ? `• ${r.variant_name}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-300">{r.warehouse_name}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-indigo-300">
                          {r.quantity} {r.unit}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[10px] uppercase text-slate-400">
                          {r.valuation_basis || 'cost_price'}
                        </td>
                        {canViewCost && (
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            GH₵ {parseFloat(r.unit_cost || 0).toFixed(2)}
                          </td>
                        )}
                        {canViewCost && (
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                            GH₵ {parseFloat(r.total_valuation || 0).toFixed(2)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-400 text-[11px]">
                          <div>Entered: {r.created_by_name || 'Admin'}</div>
                          {r.approved_by_name && (
                            <div className="text-[10px] text-emerald-400">Approved: {r.approved_by_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.is_corrected ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              SUPERSEDED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              LOCKED & VERIFIED
                            </span>
                          )}
                        </td>
                        {isSuperAdmin && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setOpeningForm({
                                  product_id: r.product_id,
                                  variant_id: r.variant_id,
                                  warehouse_name: r.warehouse_name,
                                  quantity: r.quantity,
                                  unit: r.unit,
                                  unit_cost: r.unit_cost || '',
                                  valuation_basis: r.valuation_basis || 'cost_price',
                                  notes: '',
                                  is_correction: true,
                                  correction_notes: `Correction of opening record #${r.id}`,
                                  admin_pin: ''
                                });
                                setOpeningStockModal(true);
                              }}
                              className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-lg text-[10px] font-bold transition-all">
                              Correct Entry
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: PHYSICAL STOCK COUNTS & VARIANCE RECONCILIATION (Task 5) */}
      {/* ==================================================================== */}
      {activeSubTab === 'stock_counts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                <span>Physical Stock Count Audit Sessions</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Initiate snapshot counts, input physical stock, verify variances, and reconcile ledger under Separation of Duties policy.
              </p>
            </div>
            <button
              onClick={() => setNewCountModal(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md">
              <PlusCircle className="w-4 h-4 inline mr-1" />
              <span>Start Physical Stock Count</span>
            </button>
          </div>

          {/* Active Count Session Detailed View */}
          {activeCountSession && (
            <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 space-y-4 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full font-bold">
                      {activeCountSession.count_number}
                    </span>
                    <span className="text-xs text-slate-400">
                      {activeCountSession.warehouse_name} ({activeCountSession.category})
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      activeCountSession.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : activeCountSession.status === 'submitted'
                        ? 'bg-blue-500/20 text-blue-300'
                        : activeCountSession.status === 'rejected'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {activeCountSession.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Counted by: <strong>{activeCountSession.counted_by_name || 'Staff'}</strong> | 
                    Total Variance Qty: <strong className="text-white font-mono">{activeCountSession.total_variance_qty || 0}</strong>
                    {canViewCost && (
                      <span> | Variance Cost: <strong className="text-amber-400 font-mono">GH₵ {parseFloat(activeCountSession.total_variance_cost || 0).toFixed(2)}</strong></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeCountSession.status === 'in_progress' && (
                    <>
                      <button
                        onClick={handleSaveCountItems}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold">
                        Save Count Progress
                      </button>
                      <button
                        onClick={handleSubmitCountSession}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold">
                        Submit for Approval
                      </button>
                    </>
                  )}

                  {activeCountSession.status === 'submitted' && (
                    <button
                      onClick={() => {
                        setCountToApprove(activeCountSession);
                        setApproveCountModal(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md">
                      Review & Approve Count
                    </button>
                  )}

                  <button
                    onClick={() => setActiveCountSession(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items in active count */}
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-center">System On-Hand</th>
                      <th className="px-3 py-2 text-center">Physical Count</th>
                      <th className="px-3 py-2 text-center">Variance Qty</th>
                      {canViewCost && <th className="px-3 py-2 text-right">Variance Cost</th>}
                      <th className="px-3 py-2">Discrepancy Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {activeCountSession.items?.map(item => {
                      const countedVal = countItemsInput[item.id]?.counted_quantity ?? item.counted_quantity;
                      const variance = parseFloat(countedVal) - parseFloat(item.system_quantity);
                      const isNegative = variance < 0;
                      const isPositive = variance > 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2">
                            <div className="font-semibold text-white">{item.product_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{item.product_sku}</div>
                          </td>
                          <td className="px-3 py-2 text-center font-mono font-semibold">
                            {item.system_quantity} {item.unit}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {activeCountSession.status === 'in_progress' ? (
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={countedVal}
                                onChange={(e) => {
                                  setCountItemsInput({
                                    ...countItemsInput,
                                    [item.id]: {
                                      ...countItemsInput[item.id],
                                      counted_quantity: e.target.value
                                    }
                                  });
                                }}
                                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-white text-xs focus:ring-1 focus:ring-amber-500"
                              />
                            ) : (
                              <span className="font-mono font-bold text-white">{item.counted_quantity}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-mono font-bold">
                            <span className={isNegative ? 'text-red-400' : isPositive ? 'text-emerald-400' : 'text-slate-400'}>
                              {isPositive ? `+${variance}` : variance} {item.unit}
                            </span>
                          </td>
                          {canViewCost && (
                            <td className="px-4 py-2 text-right font-mono text-slate-300">
                              GH₵ {((variance * parseFloat(item.unit_cost || 0))).toFixed(2)}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            {activeCountSession.status === 'in_progress' ? (
                              <input
                                type="text"
                                placeholder="Reason for variance..."
                                value={countItemsInput[item.id]?.discrepancy_reason ?? (item.discrepancy_reason || '')}
                                onChange={(e) => {
                                  setCountItemsInput({
                                    ...countItemsInput,
                                    [item.id]: {
                                      ...countItemsInput[item.id],
                                      discrepancy_reason: e.target.value
                                    }
                                  });
                                }}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                              />
                            ) : (
                              <span className="text-slate-400">{item.discrepancy_reason || '—'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Past Sessions List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Session #</th>
                    <th className="px-4 py-3">Warehouse & Dept</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Items Counted</th>
                    <th className="px-4 py-3 text-center">Total Variance</th>
                    {canViewCost && <th className="px-4 py-3 text-right">Cost Impact</th>}
                    <th className="px-4 py-3">Counter / Approver</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {stockCounts.length === 0 ? (
                    <tr>
                      <td colSpan={canViewCost ? 8 : 7} className="py-10 text-center text-slate-500">
                        No physical stock count sessions recorded. Start a session to audit physical inventory.
                      </td>
                    </tr>
                  ) : (
                    stockCounts.map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-mono font-bold text-amber-400">
                          {s.count_number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{s.warehouse_name}</div>
                          <div className="text-[10px] text-slate-500">{s.category}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            s.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : s.status === 'submitted'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : s.status === 'rejected'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {s.total_items_counted || 0}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold">
                          <span className={s.total_variance_qty < 0 ? 'text-red-400' : s.total_variance_qty > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                            {s.total_variance_qty > 0 ? `+${s.total_variance_qty}` : s.total_variance_qty || 0}
                          </span>
                        </td>
                        {canViewCost && (
                          <td className="px-4 py-3 text-right font-mono text-slate-300 font-semibold">
                            GH₵ {parseFloat(s.total_variance_cost || 0).toFixed(2)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-400 text-[11px]">
                          <div>Counted: {s.counted_by_name || 'Staff'}</div>
                          {s.approved_by_name && (
                            <div className="text-emerald-400 text-[10px]">Approved: {s.approved_by_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1">
                          <button
                            onClick={() => loadCountSessionDetails(s.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold">
                            View Items
                          </button>
                          {s.status === 'submitted' && (
                            <button
                              onClick={() => {
                                setCountToApprove(s);
                                setApproveCountModal(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold">
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: ALERTS & VALUATION REPORTS (Task 6) */}
      {/* ==================================================================== */}
      {activeSubTab === 'alerts_reports' && (
        <div className="space-y-5">
          {/* Top Valuation Summary Cards */}
          {valuationData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {canViewCost && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block font-medium">Total Cost Valuation (AVCO)</span>
                  <div className="text-2xl font-bold text-white font-mono mt-1">
                    GH₵ {valuationData.total_cost_valuation?.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-500">Capital tied up at weighted average cost</span>
                </div>
              )}

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400 block font-medium">Total Retail Valuation</span>
                <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
                  GH₵ {valuationData.total_selling_valuation?.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-500">Projected shop revenue if sold</span>
              </div>

              {canViewCost && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block font-medium">Projected Gross Profit</span>
                  <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                    GH₵ {valuationData.projected_gross_profit?.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    Expected Margin: {valuationData.projected_margin_percent}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reorder Recommendations */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 font-bold text-xs text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Reorder Recommendations (Below Minimum Safety Stock)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {reorderData.length} items to replenish
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Product Name & SKU</th>
                    <th className="px-4 py-3">Warehouse</th>
                    <th className="px-4 py-3 text-center">Available Stock</th>
                    <th className="px-4 py-3 text-center">Min Threshold</th>
                    <th className="px-4 py-3 text-center">Suggested Order</th>
                    {canViewCost && <th className="px-4 py-3 text-right">Est. Cost (GH₵)</th>}
                    <th className="px-4 py-3">Preferred Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {reorderData.length === 0 ? (
                    <tr>
                      <td colSpan={canViewCost ? 7 : 6} className="py-8 text-center text-slate-500">
                        All products are currently stocked safely above minimum threshold limits.
                      </td>
                    </tr>
                  ) : (
                    reorderData.map(r => (
                      <tr key={`${r.product_id}-${r.warehouse_name}`} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{r.product_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{r.sku}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{r.warehouse_name}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-red-400">
                          {r.current_stock} {r.unit}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-400">
                          {r.min_stock_alert} {r.unit}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                          +{r.suggested_order_qty} {r.unit}
                        </td>
                        {canViewCost && (
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                            GH₵ {r.estimated_cost?.toFixed(2)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-300 text-[11px]">
                          {r.preferred_supplier ? (
                            <div>
                              <div className="font-medium text-white">{r.preferred_supplier.name}</div>
                              <div className="text-[10px] text-slate-500">{r.preferred_supplier.phone}</div>
                            </div>
                          ) : (
                            <span className="text-slate-500">Direct Import</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Damaged and Missing Stock Incidents */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 font-bold text-xs text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>Damaged & Missing Stock Report (Losses & Breakages)</span>
              </span>
              {canViewCost && (
                <span className="text-xs text-red-400 font-mono font-semibold">
                  Total Financial Impact: GH₵ {parseFloat(damagedMissingData.total_cost_impact || 0).toFixed(2)}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Product Name & SKU</th>
                    <th className="px-4 py-3 text-center">Loss Type</th>
                    <th className="px-4 py-3 text-center">Written-Off Qty</th>
                    {canViewCost && <th className="px-4 py-3 text-right">Cost Loss</th>}
                    <th className="px-4 py-3">Mandatory Reason</th>
                    <th className="px-4 py-3">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {damagedMissingData.incidents?.length === 0 ? (
                    <tr>
                      <td colSpan={canViewCost ? 7 : 6} className="py-8 text-center text-slate-500">
                        Zero damage or loss write-offs recorded.
                      </td>
                    </tr>
                  ) : (
                    damagedMissingData.incidents?.map(inc => (
                      <tr key={inc.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-[10px]">
                          {new Date(inc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{inc.product_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{inc.product_sku}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inc.movement_type === 'DAMAGE' ? 'bg-red-500/20 text-red-300' : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {inc.movement_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-red-400">
                          {Math.abs(inc.quantity)} {inc.unit}
                        </td>
                        {canViewCost && (
                          <td className="px-4 py-3 text-right font-mono text-red-400 font-bold">
                            GH₵ {parseFloat(Math.abs(inc.total_cost || 0)).toFixed(2)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-300 text-[11px]">{inc.reason}</td>
                        <td className="px-4 py-3 text-slate-400 text-[11px]">
                          {inc.authorized_by_name || inc.reported_by_name}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dead Stock Report (60+ Days No Sales) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 font-bold text-xs text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Dead Stock (60+ Days Without POS Sales)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {deadStockData.length} stagnant items
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Product Name & SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-center">Unsold Units in Stock</th>
                    {canViewCost && <th className="px-4 py-3 text-right">Tied-Up Capital (Cost)</th>}
                    <th className="px-4 py-3 text-right">Retail Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {deadStockData.length === 0 ? (
                    <tr>
                      <td colSpan={canViewCost ? 5 : 4} className="py-8 text-center text-slate-500">
                        Excellent inventory velocity! No dead stock found in the last 60 days.
                      </td>
                    </tr>
                  ) : (
                    deadStockData.map(d => (
                      <tr key={d.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{d.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{d.sku}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{d.category}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-400 font-mono">
                          {d.current_stock} {d.unit}
                        </td>
                        {canViewCost && (
                          <td className="px-4 py-3 text-right font-mono text-slate-400 font-semibold">
                            GH₵ {d.tied_up_cost?.toFixed(2)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                          GH₵ {(d.current_stock * d.selling_price).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. STOCK RECEIPT / GRN MODAL (Task 2) */}
      {/* ==================================================================== */}
      {inwardModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                  <span>Receive Stock (Goods Received Note - GRN)</span>
                </h3>
                <span className="text-[10px] text-slate-400">
                  Receiving stock commits to inventory, recalculates AVCO cost & logs in ledger
                </span>
              </div>
              <button onClick={() => setInwardModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleInwardSubmit} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Select Product *</label>
                <select
                  value={inwardForm.product_id}
                  onChange={(e) => {
                    const p = products.find(x => String(x.id) === e.target.value);
                    setInwardForm({
                      ...inwardForm,
                      product_id: e.target.value,
                      cost_price: p ? p.cost_price : ''
                    });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Destination Warehouse *</label>
                  <select
                    value={inwardForm.warehouse_name}
                    onChange={(e) => setInwardForm({ ...inwardForm, warehouse_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="Main Showroom">Main Showroom</option>
                    <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Supplier</label>
                  <select
                    value={inwardForm.supplier_id}
                    onChange={(e) => {
                      const sup = suppliers.find(s => String(s.id) === e.target.value);
                      setInwardForm({
                        ...inwardForm,
                        supplier_id: e.target.value,
                        supplier_name: sup ? sup.name : ''
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="">Direct Supplier / Local Delivery</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Supplier Invoice #</label>
                  <input
                    type="text"
                    value={inwardForm.supplier_invoice_no}
                    onChange={(e) => setInwardForm({ ...inwardForm, supplier_invoice_no: e.target.value })}
                    placeholder="e.g. INV-2026-88"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Delivery Note #</label>
                  <input
                    type="text"
                    value={inwardForm.delivery_note_no}
                    onChange={(e) => setInwardForm({ ...inwardForm, delivery_note_no: e.target.value })}
                    placeholder="e.g. DN-5401"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Ordered Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={inwardForm.ordered_quantity}
                    onChange={(e) => setInwardForm({ ...inwardForm, ordered_quantity: e.target.value })}
                    placeholder="e.g. 100"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Received Qty *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={inwardForm.received_quantity}
                    onChange={(e) => setInwardForm({ ...inwardForm, received_quantity: e.target.value })}
                    placeholder="e.g. 100"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Unit Cost (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inwardForm.cost_price}
                    onChange={(e) => setInwardForm({ ...inwardForm, cost_price: e.target.value })}
                    placeholder="e.g. 125.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              {/* Live discrepancy note helper */}
              {inwardForm.ordered_quantity && inwardForm.received_quantity && (
                parseFloat(inwardForm.ordered_quantity) !== parseFloat(inwardForm.received_quantity) && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-amber-300">
                    Discrepancy detected: Ordered {inwardForm.ordered_quantity}, Received {inwardForm.received_quantity} (Difference: {parseFloat(inwardForm.received_quantity) - parseFloat(inwardForm.ordered_quantity)})
                  </div>
                )
              )}

              <div>
                <label className="text-slate-400 block mb-1">Discrepancy / Inward Notes</label>
                <input
                  type="text"
                  value={inwardForm.discrepancy_notes}
                  onChange={(e) => setInwardForm({ ...inwardForm, discrepancy_notes: e.target.value })}
                  placeholder="e.g. 2 boxes broken during offloading; supplier promised credit note"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setInwardModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md">
                  Process Stock Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. OPENING STOCK MODAL (Task 1) */}
      {/* ==================================================================== */}
      {openingStockModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-400" />
                  <span>{openingForm.is_correction ? 'Authorized Opening Stock Correction' : 'Record Initial Verified Opening Stock'}</span>
                </h3>
                <span className="text-[10px] text-slate-400">
                  Permanent initial physical inventory valuation and ledger lock
                </span>
              </div>
              <button onClick={() => setOpeningStockModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleOpeningSubmit} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Product *</label>
                <select
                  value={openingForm.product_id}
                  disabled={openingForm.is_correction}
                  onChange={(e) => {
                    const p = products.find(x => String(x.id) === e.target.value);
                    setOpeningForm({
                      ...openingForm,
                      product_id: e.target.value,
                      unit: p ? p.unit : 'pcs',
                      unit_cost: p ? p.cost_price : ''
                    });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Warehouse *</label>
                  <select
                    value={openingForm.warehouse_name}
                    disabled={openingForm.is_correction}
                    onChange={(e) => setOpeningForm({ ...openingForm, warehouse_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="Main Showroom">Main Showroom</option>
                    <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Valuation Basis</label>
                  <select
                    value={openingForm.valuation_basis}
                    onChange={(e) => setOpeningForm({ ...openingForm, valuation_basis: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="cost_price">Cost Price (Supplier)</option>
                    <option value="market_replacement">Market Replacement Value</option>
                    <option value="physical_verified">Physical Verified Audit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Physical Verified Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={openingForm.quantity}
                    onChange={(e) => setOpeningForm({ ...openingForm, quantity: e.target.value })}
                    placeholder="e.g. 250"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Unit Cost Basis (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingForm.unit_cost}
                    onChange={(e) => setOpeningForm({ ...openingForm, unit_cost: e.target.value })}
                    placeholder="e.g. 130.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Audit Verification Notes</label>
                <input
                  type="text"
                  value={openingForm.notes}
                  onChange={(e) => setOpeningForm({ ...openingForm, notes: e.target.value })}
                  placeholder="e.g. Opening stock count by inventory team at store launch"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* Super Admin Correction Mode */}
              {openingForm.is_correction && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl space-y-2">
                  <div className="text-amber-300 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Super Admin Correction Authorization Required</span>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Mandatory Correction Reason *</label>
                    <input
                      type="text"
                      required
                      value={openingForm.correction_notes}
                      onChange={(e) => setOpeningForm({ ...openingForm, correction_notes: e.target.value })}
                      placeholder="e.g. Original count omitted pallets stored in depot rear bay"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  {!isSuperAdmin && (
                    <div>
                      <label className="text-slate-400 block mb-1">Super Admin PIN Code *</label>
                      <input
                        type="password"
                        maxLength="6"
                        required
                        value={openingForm.admin_pin}
                        onChange={(e) => setOpeningForm({ ...openingForm, admin_pin: e.target.value })}
                        placeholder="Enter Super Admin PIN"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setOpeningStockModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md">
                  {openingForm.is_correction ? 'Commit Correction' : 'Commit Opening Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. INTER-WAREHOUSE TRANSFER MODAL */}
      {/* ==================================================================== */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-400" />
                <span>Inter-Warehouse Stock Transfer</span>
              </h3>
              <button onClick={() => setTransferModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Select Product *</label>
                <select
                  value={transferForm.product_id}
                  onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">From Location *</label>
                  <select
                    value={transferForm.from_warehouse}
                    onChange={(e) => setTransferForm({ ...transferForm, from_warehouse: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="Main Showroom">Main Showroom</option>
                    <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">To Location *</label>
                  <select
                    value={transferForm.to_warehouse}
                    onChange={(e) => setTransferForm({ ...transferForm, to_warehouse: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                    <option value="Main Showroom">Main Showroom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Transfer Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                  placeholder="e.g. 50"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reason / Reference Note</label>
                <input
                  type="text"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  placeholder="e.g. Restock showroom display from central depot"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setTransferModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md">
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. STOCK RESERVATION / RELEASE MODAL (Task 4) */}
      {/* ==================================================================== */}
      {reserveModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-purple-400" />
                  <span>Reserve or Release Stock</span>
                </h3>
                <span className="text-[10px] text-slate-400">
                  Protects stock from being sold at the cash register while awaiting project delivery
                </span>
              </div>
              <button onClick={() => setReserveModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleReserveSubmit} className="space-y-3">
              <div className="flex gap-2 bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setReserveForm({ ...reserveForm, action: 'reserve' })}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    reserveForm.action === 'reserve' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}>
                  Hold / Reserve Stock
                </button>
                <button
                  type="button"
                  onClick={() => setReserveForm({ ...reserveForm, action: 'release' })}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    reserveForm.action === 'release' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}>
                  Release Reserved Stock
                </button>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Product *</label>
                <select
                  value={reserveForm.product_id}
                  onChange={(e) => setReserveForm({ ...reserveForm, product_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Warehouse *</label>
                  <select
                    value={reserveForm.warehouse_name}
                    onChange={(e) => setReserveForm({ ...reserveForm, warehouse_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="Main Showroom">Main Showroom</option>
                    <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Quantity to {reserveForm.action} *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={reserveForm.quantity}
                    onChange={(e) => setReserveForm({ ...reserveForm, quantity: e.target.value })}
                    placeholder="e.g. 15"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Customer / Project Reference #</label>
                <input
                  type="text"
                  value={reserveForm.reference_no}
                  onChange={(e) => setReserveForm({ ...reserveForm, reference_no: e.target.value })}
                  placeholder="e.g. PRJ-ACCRA-CHURCH-01"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notes</label>
                <input
                  type="text"
                  value={reserveForm.notes}
                  onChange={(e) => setReserveForm({ ...reserveForm, notes: e.target.value })}
                  placeholder="e.g. Customer deposit paid; awaiting truck dispatch"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setReserveModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md">
                  Confirm {reserveForm.action === 'reserve' ? 'Reservation' : 'Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. DAMAGE & LOSS WRITE-OFF MODAL (Task 3) */}
      {/* ==================================================================== */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                <ShieldAlert className="w-5 h-5" />
                <span>Write Off Damage / Breakage / Loss</span>
              </div>
              <button onClick={() => setAdjustModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg text-red-300 text-[11px]">
              Security Policy: Stock damage and loss write-offs require supervisor Admin PIN authorization and write directly to the immutable ledger.
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Write-off Type *</label>
                  <select
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold">
                    <option value="DAMAGE">DAMAGE (Physical Breakage / Scrap)</option>
                    <option value="LOSS">LOSS (Missing / Theft / Approved Loss)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Warehouse *</label>
                  <select
                    value={adjustForm.warehouse_name}
                    onChange={(e) => setAdjustForm({ ...adjustForm, warehouse_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="Main Showroom">Main Showroom</option>
                    <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Product *</label>
                <select
                  value={adjustForm.product_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, product_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Quantity to Write Off *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                  placeholder="e.g. 4"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Detailed Reason for Write-Off *</label>
                <textarea
                  required
                  rows={2}
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="e.g. Ceramic glaze fractured during truck offloading from Tema port"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAdjustModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-md">
                  Verify PIN & Write Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. CUSTOMER RETURN MODAL (Task 3) */}
      {/* ==================================================================== */}
      {customerReturnModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-amber-400" />
                <span>Process Customer Return</span>
              </h3>
              <button onClick={() => setCustomerReturnModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleCustomerReturnSubmit} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Product *</label>
                <select
                  value={customerReturnForm.product_id}
                  onChange={(e) => setCustomerReturnForm({ ...customerReturnForm, product_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Item Condition *</label>
                  <select
                    value={customerReturnForm.condition}
                    onChange={(e) => setCustomerReturnForm({ ...customerReturnForm, condition: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold">
                    <option value="resellable">Resellable (Restock to Showroom)</option>
                    <option value="damaged">Damaged (Move to Damaged Hold)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Warehouse *</label>
                  <select
                    value={customerReturnForm.warehouse_name}
                    onChange={(e) => setCustomerReturnForm({ ...customerReturnForm, warehouse_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="Main Showroom">Main Showroom</option>
                    <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Returned Units *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={customerReturnForm.quantity}
                    onChange={(e) => setCustomerReturnForm({ ...customerReturnForm, quantity: e.target.value })}
                    placeholder="e.g. 5"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Original Receipt #</label>
                  <input
                    type="text"
                    value={customerReturnForm.receipt_no}
                    onChange={(e) => setCustomerReturnForm({ ...customerReturnForm, receipt_no: e.target.value })}
                    placeholder="e.g. REC-173000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reason for Return *</label>
                <input
                  type="text"
                  required
                  value={customerReturnForm.reason}
                  onChange={(e) => setCustomerReturnForm({ ...customerReturnForm, reason: e.target.value })}
                  placeholder="e.g. Surplus unopened tile cartons from tiling contractor"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCustomerReturnModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md">
                  Process Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. SUPPLIER RETURN MODAL (Task 3) */}
      {/* ==================================================================== */}
      {supplierReturnModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-red-400" />
                <span>Return Defective Stock to Supplier</span>
              </h3>
              <button onClick={() => setSupplierReturnModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleSupplierReturnSubmit} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Supplier *</label>
                <select
                  value={supplierReturnForm.supplier_id}
                  onChange={(e) => setSupplierReturnForm({ ...supplierReturnForm, supplier_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  <option value="">Select Vendor</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Product *</label>
                <select
                  value={supplierReturnForm.product_id}
                  onChange={(e) => setSupplierReturnForm({ ...supplierReturnForm, product_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Source Warehouse *</label>
                  <select
                    value={supplierReturnForm.warehouse_name}
                    onChange={(e) => setSupplierReturnForm({ ...supplierReturnForm, warehouse_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="Main Showroom">Main Showroom</option>
                    <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Return Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={supplierReturnForm.quantity}
                    onChange={(e) => setSupplierReturnForm({ ...supplierReturnForm, quantity: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reason for Supplier Return *</label>
                <input
                  type="text"
                  required
                  value={supplierReturnForm.reason}
                  onChange={(e) => setSupplierReturnForm({ ...supplierReturnForm, reason: e.target.value })}
                  placeholder="e.g. Turkish door latch mechanisms misaligned; returned for factory replacement"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSupplierReturnModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-md">
                  Execute Supplier Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. INITIATE PHYSICAL STOCK COUNT MODAL (Task 5) */}
      {/* ==================================================================== */}
      {newCountModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-amber-400" />
                  <span>Start Physical Stock Count Session</span>
                </h3>
                <span className="text-[10px] text-slate-400">
                  Freezes current system quantities as an audit baseline
                </span>
              </div>
              <button onClick={() => setNewCountModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleStartStockCount} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Warehouse to Count *</label>
                <select
                  value={newCountForm.warehouse_name}
                  onChange={(e) => setNewCountForm({ ...newCountForm, warehouse_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  <option value="Main Showroom">Main Showroom</option>
                  <option value="Warehouse B (Depot)">Warehouse B (Depot)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Department / Category</label>
                <select
                  value={newCountForm.category}
                  onChange={(e) => setNewCountForm({ ...newCountForm, category: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  <option value="All">All Categories (Full Store Audit)</option>
                  <option value="Tiles">Tiles Only</option>
                  <option value="Security Doors">Security Doors Only</option>
                  <option value="Sanitary Ware">Sanitary Ware Only</option>
                  <option value="Paints">Paints Only</option>
                  <option value="General Hardware">General Hardware Only</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Session Notes / Instructions</label>
                <input
                  type="text"
                  value={newCountForm.notes}
                  onChange={(e) => setNewCountForm({ ...newCountForm, notes: e.target.value })}
                  placeholder="e.g. End of month physical verification by audit team"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setNewCountModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md">
                  Create Audit Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 9. APPROVE COUNT MODAL WITH SEPARATION OF DUTIES (Task 5) */}
      {/* ==================================================================== */}
      {approveCountModal && countToApprove && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Approve Physical Stock Reconciliation</h3>
                <span className="text-[10px] text-slate-400">
                  Session #{countToApprove.count_number} ({countToApprove.warehouse_name})
                </span>
              </div>
              <button onClick={() => setApproveCountModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            {/* Separation of Duties Rule Check */}
            {countToApprove.counted_by_id === user?.id && !isSuperAdmin ? (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl space-y-1.5 text-red-300">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>Separation of Duties Policy Enforced</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  You conducted this physical count session. As the counter, you cannot approve your own adjustments.
                  Another manager or the Super Admin must review and approve this session to safeguard audit integrity.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-slate-800 p-3 rounded-xl space-y-1 font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span>Total Items Counted:</span>
                    <strong className="text-white">{countToApprove.total_items_counted || 0}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Net Quantity Variance:</span>
                    <strong className={countToApprove.total_variance_qty < 0 ? 'text-red-400' : 'text-emerald-400'}>
                      {countToApprove.total_variance_qty > 0 ? `+${countToApprove.total_variance_qty}` : countToApprove.total_variance_qty || 0}
                    </strong>
                  </div>
                  {canViewCost && (
                    <div className="flex justify-between text-slate-300">
                      <span>Total Financial Impact:</span>
                      <strong className="text-amber-400">
                        GH₵ {parseFloat(countToApprove.total_variance_cost || 0).toFixed(2)}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setApproveCountModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveCountSession('Count approved & stock reconciled')}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md">
                    Confirm & Reconcile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin PIN Verification Modal */}
      {showPinModal && (
        <AdminPinModal
          title="Stock Adjustment PIN Authorization"
          message="Please enter Super Admin or IT Manager PIN code to authorize this stock change."
          onApproved={(approver, pin) => {
            setShowPinModal(false);
            if (pinAction) pinAction(approver, pin);
          }}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Truck, Plus, FileText, CheckCircle2, 
  DollarSign, Phone, MapPin, X, ArrowDownLeft,
  AlertTriangle, Clock, ShieldAlert, Eye, EyeOff,
  Receipt, CreditCard, Search, Filter, Check, Ban,
  RefreshCw, ChevronRight, BarChart3, HelpCircle,
  PackageCheck, Building, Tag, ShieldCheck, Lock
} from 'lucide-react';

export default function SupplierManagement() {
  const { user, isSuperAdmin, isAdmin, isSales } = useAuth();

  // Active Navigation Tab
  // 'suppliers' | 'po' | 'grn' | 'invoices' | 'reports'
  const [activeTab, setActiveTab] = useState('suppliers');

  // Core Data States
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [grnList, setGrnList] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [grnModalOpen, setGrnModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [activeStatement, setActiveStatement] = useState(null);
  const [poDetailModalOpen, setPoDetailModalOpen] = useState(false);
  const [activePoDetails, setActivePoDetails] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [poToApprove, setPoToApprove] = useState(null);
  const [approvalPin, setApprovalPin] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [poToCancel, setPoToCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Sensitive Info Visibility Toggle (Owner / Admin)
  const [showSensitiveBank, setShowSensitiveBank] = useState(false);

  // Reports Sub-tab
  const [reportSubTab, setReportSubTab] = useState('history'); // 'history' | 'balances' | 'outstanding' | 'discrepancies' | 'price_comparison'
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Form State: Supplier
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    email: '',
    contact_person: '',
    location: '',
    address: '',
    tax_id: '',
    payment_terms: 'COD',
    status: 'active',
    products_supplied: '',
    bank_name: '',
    account_name: '',
    account_number: '',
    routing_or_branch: '',
    mobile_money_number: '',
    balance_owed: 0
  });

  // Form State: Purchase Order
  const [poForm, setPoForm] = useState({
    supplier_id: '',
    warehouse_name: 'Main Showroom',
    expected_delivery_date: '',
    supplier_reference: '',
    notes: '',
    items: [
      { product_id: '', variant_id: null, ordered_quantity: 1, unit: 'box', unit_cost: 0, notes: '' }
    ]
  });

  // Form State: GRN Delivery
  const [grnForm, setGrnForm] = useState({
    po_id: '',
    supplier_delivery_note: '',
    supplier_invoice_no: '',
    warehouse_name: 'Main Showroom',
    notes: '',
    items: []
  });

  // Form State: Supplier Invoice
  const [invoiceForm, setInvoiceForm] = useState({
    supplier_id: '',
    po_id: '',
    grn_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    subtotal: 0,
    tax_amount: 0,
    notes: ''
  });

  // Form State: Supplier Payment
  const [paymentForm, setPaymentForm] = useState({
    supplier_id: '',
    invoice_id: '',
    amount: '',
    payment_method: 'BANK_TRANSFER',
    reference_no: '',
    bank_account_used: 'Ecobank GH Main - 0192',
    notes: '',
    payment_date: new Date().toISOString().split('T')[0]
  });

  // Auto-dismiss alerts
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 7000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Load Main Data
  const loadAllData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [sups, pos, grns, prods] = await Promise.all([
        apiRequest('/purchasing/suppliers').catch(() => []),
        apiRequest('/purchasing/purchase-orders').catch(() => []),
        apiRequest('/purchasing/grn').catch(() => []),
        apiRequest('/products').catch(() => [])
      ]);

      setSuppliers(Array.isArray(sups) ? sups : []);
      setPurchaseOrders(Array.isArray(pos) ? pos : []);
      setGrnList(Array.isArray(grns) ? grns : []);
      setProducts(Array.isArray(prods) ? prods : []);

      // Load invoices & payments if authorized
      if (!isSales) {
        try {
          const invList = await apiRequest('/purchasing/invoices');
          setInvoices(Array.isArray(invList) ? invList : []);
          const payList = await apiRequest('/purchasing/payments');
          setPayments(Array.isArray(payList) ? payList : []);
        } catch {
          // Cashier or limited permission
        }
      }
    } catch (err) {
      setErrorMsg(`Failed to load purchasing data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Load Reports when Report Tab is active
  const loadReportData = async (subTab) => {
    setReportLoading(true);
    try {
      let endpoint = '';
      if (subTab === 'history') endpoint = '/purchasing/reports/history';
      else if (subTab === 'balances') endpoint = '/purchasing/reports/supplier-balances';
      else if (subTab === 'outstanding') endpoint = '/purchasing/reports/outstanding-pos';
      else if (subTab === 'discrepancies') endpoint = '/purchasing/reports/delivery-discrepancies';
      else if (subTab === 'price_comparison') endpoint = '/purchasing/reports/price-comparisons';

      if (endpoint) {
        const data = await apiRequest(endpoint);
        setReportData(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setErrorMsg(`Report fetch error: ${err.message}`);
      setReportData([]);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReportData(reportSubTab);
    }
  }, [activeTab, reportSubTab]);

  // Total Payables calculation
  const totalPayables = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (parseFloat(s.balance_owed) || 0), 0);
  }, [suppliers]);

  // Open Add/Edit Supplier Modal
  const handleOpenSupplierModal = (sup = null) => {
    if (sup) {
      setEditingSupplier(sup);
      let bank = sup.bank_details;
      if (typeof bank === 'string') {
        try { bank = JSON.parse(bank); } catch { bank = {}; }
      }
      setSupplierForm({
        name: sup.name || '',
        phone: sup.phone || '',
        email: sup.email || '',
        contact_person: sup.contact_person || '',
        location: sup.location || '',
        address: sup.address || '',
        tax_id: sup.tax_id || '',
        payment_terms: sup.payment_terms || 'COD',
        status: sup.status || 'active',
        products_supplied: Array.isArray(sup.products_supplied) ? sup.products_supplied.join(', ') : '',
        bank_name: bank?.bank_name || '',
        account_name: bank?.account_name || '',
        account_number: bank?.account_number || '',
        routing_or_branch: bank?.routing_or_branch || '',
        mobile_money_number: bank?.mobile_money_number || '',
        balance_owed: parseFloat(sup.balance_owed) || 0
      });
    } else {
      setEditingSupplier(null);
      setSupplierForm({
        name: '',
        phone: '',
        email: '',
        contact_person: '',
        location: '',
        address: '',
        tax_id: '',
        payment_terms: 'COD',
        status: 'active',
        products_supplied: '',
        bank_name: '',
        account_name: '',
        account_number: '',
        routing_or_branch: '',
        mobile_money_number: '',
        balance_owed: 0
      });
    }
    setSupplierModalOpen(true);
  };

  // Submit Supplier
  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const prodArray = supplierForm.products_supplied
        ? supplierForm.products_supplied.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const bankPayload = (supplierForm.bank_name || supplierForm.account_number || supplierForm.mobile_money_number) ? {
        bank_name: supplierForm.bank_name,
        account_name: supplierForm.account_name,
        account_number: supplierForm.account_number,
        routing_or_branch: supplierForm.routing_or_branch,
        mobile_money_number: supplierForm.mobile_money_number
      } : null;

      const payload = {
        name: supplierForm.name.trim(),
        phone: supplierForm.phone.trim(),
        email: supplierForm.email ? supplierForm.email.trim() : null,
        contact_person: supplierForm.contact_person ? supplierForm.contact_person.trim() : null,
        location: supplierForm.location ? supplierForm.location.trim() : null,
        address: supplierForm.address ? supplierForm.address.trim() : null,
        tax_id: supplierForm.tax_id ? supplierForm.tax_id.trim() : null,
        payment_terms: supplierForm.payment_terms,
        status: supplierForm.status,
        products_supplied: prodArray,
        bank_details: bankPayload,
        balance_owed: parseFloat(supplierForm.balance_owed) || 0
      };

      if (editingSupplier) {
        await apiRequest(`/purchasing/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setSuccessMsg(`Supplier "${payload.name}" updated successfully`);
      } else {
        await apiRequest('/purchasing/suppliers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setSuccessMsg(`Supplier "${payload.name}" registered successfully`);
      }

      setSupplierModalOpen(false);
      loadAllData();
    } catch (err) {
      setErrorMsg(`Supplier save failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Supplier Status (active / suspended / blacklisted)
  const handleToggleSupplierStatus = async (supplierId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change this supplier status to "${newStatus}"?`)) return;
    try {
      await apiRequest(`/purchasing/suppliers/${supplierId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, reason: `Status updated to ${newStatus} via manager console` })
      });
      setSuccessMsg(`Supplier status updated to ${newStatus}`);
      loadAllData();
    } catch (err) {
      setErrorMsg(`Failed to update status: ${err.message}`);
    }
  };

  // View 4-Pillar Financial Statement
  const handleViewStatement = async (supplierId) => {
    try {
      const data = await apiRequest(`/purchasing/supplier-statement/${supplierId}`);
      setActiveStatement(data);
      setStatementModalOpen(true);
    } catch (err) {
      setErrorMsg(`Unable to load supplier statement: ${err.message}`);
    }
  };

  // =========================================================================
  // PURCHASE ORDER HANDLERS
  // =========================================================================

  const handleOpenPoModal = () => {
    setPoForm({
      supplier_id: suppliers.length > 0 ? suppliers[0].id : '',
      warehouse_name: 'Main Showroom',
      expected_delivery_date: '',
      supplier_reference: '',
      notes: '',
      items: [
        { product_id: products.length > 0 ? products[0].id : '', variant_id: null, ordered_quantity: 10, unit: 'box', unit_cost: products.length > 0 ? (products[0].cost_price || 0) : 0, notes: '' }
      ]
    });
    setPoModalOpen(true);
  };

  const handlePoItemChange = (index, field, value) => {
    const updated = [...poForm.items];
    updated[index][field] = value;

    if (field === 'product_id') {
      const prod = products.find(p => p.id === parseInt(value));
      if (prod) {
        updated[index].unit = prod.unit || 'pcs';
        updated[index].unit_cost = prod.cost_price || 0;
      }
    }
    setPoForm({ ...poForm, items: updated });
  };

  const handleAddPoItem = () => {
    setPoForm({
      ...poForm,
      items: [
        ...poForm.items,
        { product_id: products.length > 0 ? products[0].id : '', variant_id: null, ordered_quantity: 10, unit: 'box', unit_cost: products.length > 0 ? (products[0].cost_price || 0) : 0, notes: '' }
      ]
    });
  };

  const handleRemovePoItem = (index) => {
    if (poForm.items.length <= 1) return;
    const updated = poForm.items.filter((_, i) => i !== index);
    setPoForm({ ...poForm, items: updated });
  };

  const calculatePoTotal = useMemo(() => {
    return poForm.items.reduce((sum, item) => {
      const qty = parseFloat(item.ordered_quantity) || 0;
      const cost = parseFloat(item.unit_cost) || 0;
      return sum + (qty * cost);
    }, 0);
  }, [poForm.items]);

  const handleSavePurchaseOrder = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        supplier_id: parseInt(poForm.supplier_id),
        warehouse_name: poForm.warehouse_name,
        expected_delivery_date: poForm.expected_delivery_date || null,
        supplier_reference: poForm.supplier_reference || '',
        notes: poForm.notes || '',
        items: poForm.items.map(it => ({
          product_id: parseInt(it.product_id),
          variant_id: it.variant_id ? parseInt(it.variant_id) : null,
          ordered_quantity: parseFloat(it.ordered_quantity),
          unit: it.unit || 'pcs',
          unit_cost: parseFloat(it.unit_cost),
          notes: it.notes || ''
        }))
      };

      const res = await apiRequest('/purchasing/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccessMsg(`Draft Purchase Order ${res.po_number || ''} created successfully! (Stock unaffected)`);
      setPoModalOpen(false);
      loadAllData();
    } catch (err) {
      setErrorMsg(`PO creation failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitPoForApproval = async (poId) => {
    try {
      await apiRequest(`/purchasing/purchase-orders/${poId}/submit`, {
        method: 'POST'
      });
      setSuccessMsg('Purchase order submitted for authorization');
      loadAllData();
    } catch (err) {
      setErrorMsg(`Submit failed: ${err.message}`);
    }
  };

  const handleOpenApprovalModal = (po) => {
    setPoToApprove(po);
    setApprovalPin('');
    setApprovalNotes('Authorized for procurement');
    setApprovalModalOpen(true);
  };

  const handleAuthorizePo = async (status) => {
    if (!poToApprove) return;
    setActionLoading(true);
    try {
      const payload = {
        status,
        approval_notes: approvalNotes,
        ...(approvalPin ? { admin_pin: approvalPin } : {})
      };

      await apiRequest(`/purchasing/purchase-orders/${poToApprove.id}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccessMsg(`Purchase order ${poToApprove.po_number} ${status === 'approved' ? 'Formally Approved' : 'Rejected'}`);
      setApprovalModalOpen(false);
      loadAllData();
    } catch (err) {
      setErrorMsg(`Approval failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenCancelModal = (po) => {
    setPoToCancel(po);
    setCancellationReason('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancelPo = async () => {
    if (!poToCancel || !cancellationReason.trim()) {
      alert('Please specify a cancellation reason');
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest(`/purchasing/purchase-orders/${poToCancel.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancellationReason.trim() })
      });
      setSuccessMsg(`Purchase order ${poToCancel.po_number} has been cancelled`);
      setCancelModalOpen(false);
      loadAllData();
    } catch (err) {
      setErrorMsg(`Cancellation failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewPoDetails = async (poId) => {
    try {
      const details = await apiRequest(`/purchasing/purchase-orders/${poId}`);
      setActivePoDetails(details);
      setPoDetailModalOpen(true);
    } catch (err) {
      setErrorMsg(`Failed to retrieve order items: ${err.message}`);
    }
  };

  // =========================================================================
  // GOODS RECEIVED NOTES (GRN) HANDLERS
  // =========================================================================

  const handleOpenGrnModal = async (po = null) => {
    let targetPo = po;
    if (!targetPo) {
      // Find approved or partially received POs
      const eligible = purchaseOrders.filter(p => p.status === 'approved' || p.status === 'partially_received');
      if (eligible.length === 0) {
        alert('No approved purchase orders are currently open for delivery receipt.');
        return;
      }
      targetPo = eligible[0];
    }

    try {
      const details = await apiRequest(`/purchasing/purchase-orders/${targetPo.id}`);
      const itemsToReceive = (details.items || [])
        .map(it => {
          const remaining = Math.max(0, (parseFloat(it.ordered_quantity) || 0) - (parseFloat(it.received_quantity) || 0));
          return {
            po_item_id: it.id,
            product_id: it.product_id,
            product_name: it.product_name,
            sku: it.sku,
            variant_id: it.variant_id || null,
            ordered_quantity: parseFloat(it.ordered_quantity),
            previously_received: parseFloat(it.received_quantity) || 0,
            remaining_quantity: remaining,
            received_quantity: remaining,
            rejected_quantity: 0,
            damaged_quantity: 0,
            unit: it.unit || 'pcs',
            unit_cost: parseFloat(it.unit_cost) || 0,
            discrepancy_reason: ''
          };
        })
        .filter(it => it.remaining_quantity > 0);

      setGrnForm({
        po_id: targetPo.id,
        supplier_delivery_note: '',
        supplier_invoice_no: '',
        warehouse_name: targetPo.warehouse_name || 'Main Showroom',
        notes: '',
        items: itemsToReceive
      });
      setGrnModalOpen(true);
    } catch (err) {
      setErrorMsg(`Unable to load PO for delivery: ${err.message}`);
    }
  };

  const handleGrnItemChange = (index, field, value) => {
    const updated = [...grnForm.items];
    updated[index][field] = value;
    setGrnForm({ ...grnForm, items: updated });
  };

  const handleSaveGrn = async (e) => {
    e.preventDefault();
    if (!grnForm.supplier_delivery_note.trim()) {
      alert('Supplier delivery note number is required for verification.');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        po_id: parseInt(grnForm.po_id),
        supplier_delivery_note: grnForm.supplier_delivery_note.trim(),
        supplier_invoice_no: grnForm.supplier_invoice_no ? grnForm.supplier_invoice_no.trim() : null,
        warehouse_name: grnForm.warehouse_name,
        notes: grnForm.notes || null,
        items: grnForm.items.map(it => ({
          po_item_id: it.po_item_id,
          product_id: parseInt(it.product_id),
          variant_id: it.variant_id ? parseInt(it.variant_id) : null,
          ordered_quantity: parseFloat(it.ordered_quantity),
          received_quantity: parseFloat(it.received_quantity) || 0,
          rejected_quantity: parseFloat(it.rejected_quantity) || 0,
          damaged_quantity: parseFloat(it.damaged_quantity) || 0,
          unit: it.unit || 'pcs',
          unit_cost: parseFloat(it.unit_cost) || 0,
          discrepancy_reason: it.discrepancy_reason ? it.discrepancy_reason.trim() : null
        }))
      };

      const res = await apiRequest('/purchasing/grn', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccessMsg(`GRN ${res.grn_number} processed! Stock increased exactly once for confirmed items.`);
      setGrnModalOpen(false);
      loadAllData();
    } catch (err) {
      setErrorMsg(`Receipt processing failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================================================
  // SUPPLIER INVOICE & PAYMENT HANDLERS
  // =========================================================================

  const handleOpenInvoiceModal = () => {
    setInvoiceForm({
      supplier_id: suppliers.length > 0 ? suppliers[0].id : '',
      po_id: '',
      grn_id: '',
      invoice_number: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      subtotal: 0,
      tax_amount: 0,
      notes: ''
    });
    setInvoiceModalOpen(true);
  };

  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceForm.invoice_number.trim()) {
      alert('Invoice number is required');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        supplier_id: parseInt(invoiceForm.supplier_id),
        po_id: invoiceForm.po_id ? parseInt(invoiceForm.po_id) : null,
        grn_id: invoiceForm.grn_id ? parseInt(invoiceForm.grn_id) : null,
        invoice_number: invoiceForm.invoice_number.trim(),
        invoice_date: invoiceForm.invoice_date,
        due_date: invoiceForm.due_date || null,
        subtotal: parseFloat(invoiceForm.subtotal) || 0,
        tax_amount: parseFloat(invoiceForm.tax_amount) || 0,
        notes: invoiceForm.notes || ''
      };

      await apiRequest('/purchasing/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccessMsg(`Supplier invoice ${payload.invoice_number} recorded. Balance owed updated.`);
      setInvoiceModalOpen(false);
      loadAllData();
    } catch (err) {
      setErrorMsg(`Invoice registration failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPaymentModal = (invoice = null) => {
    setPaymentForm({
      supplier_id: invoice ? invoice.supplier_id : (suppliers.length > 0 ? suppliers[0].id : ''),
      invoice_id: invoice ? invoice.id : '',
      amount: invoice ? (parseFloat(invoice.balance_due) || '') : '',
      payment_method: 'BANK_TRANSFER',
      reference_no: '',
      bank_account_used: 'Ecobank GH Main - 0192',
      notes: '',
      payment_date: new Date().toISOString().split('T')[0]
    });
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    const payAmt = parseFloat(paymentForm.amount);
    if (!payAmt || payAmt <= 0) {
      alert('Please specify a positive payment amount');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        supplier_id: parseInt(paymentForm.supplier_id),
        invoice_id: paymentForm.invoice_id ? parseInt(paymentForm.invoice_id) : null,
        amount: payAmt,
        payment_method: paymentForm.payment_method,
        reference_no: paymentForm.reference_no.trim() || 'REF-' + Date.now().toString().slice(-6),
        bank_account_used: paymentForm.bank_account_used || null,
        notes: paymentForm.notes || '',
        payment_date: paymentForm.payment_date
      };

      const res = await apiRequest('/purchasing/payments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccessMsg(`Payment ${res.payment_number} recorded. Reconciled remaining liability: GH₵ ${parseFloat(res.new_supplier_balance || 0).toFixed(2)}`);
      setPaymentModalOpen(false);
      loadAllData();
    } catch (err) {
      setErrorMsg(`Payment recording failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper status badge styles
  const getPoStatusBadge = (st) => {
    switch (st) {
      case 'draft':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">Draft</span>;
      case 'pending_approval':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Pending Approval</span>;
      case 'approved':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Approved / Open</span>;
      case 'partially_received':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Partially Received</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Fully Received / Complete</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">{st}</span>;
    }
  };

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchesSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone || '').includes(searchQuery) ||
        (s.contact_person || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.tax_id || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [suppliers, searchQuery, statusFilter]);

  // Filtered POs
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter(p => {
      const matchesSearch = (p.po_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.supplier_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.supplier_reference || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, searchQuery, statusFilter]);

  // Cashier Restricted View Guard
  if (isSales) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Purchasing & Vendor Administration Restricted</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Per company security policies, Cashier & Sales staff cannot access purchasing administration, purchase cost figures, or supplier payment details.
          </p>
          <div className="pt-2 text-xs text-slate-500">
            To view stock balances or search available tiles & security doors, please use the Point of Sale or Inventory Catalog screen.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Top Banner & Alert Feedback */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-amber-500" />
            <span>Procurement & Supplier Subsystem</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end supply chain: vendor profiles, purchase orders, goods received notes (GRN), invoice matching & 4-pillar financial reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Total Payables Card */}
          <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl text-right shadow-md">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Total Accounts Payable</span>
            <span className="text-lg font-bold text-red-400 font-mono">
              GH₵ {totalPayables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <button
            onClick={() => handleOpenPoModal()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg hover:shadow-amber-500/20 active:scale-95">
            <Plus className="w-4 h-4" />
            <span>New Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold gap-2 overflow-x-auto pb-1">
        {[
          { id: 'suppliers', label: 'Supplier Profiles & Balances', icon: Building, badge: suppliers.length },
          { id: 'po', label: 'Purchase Orders Lifecycle', icon: FileText, badge: purchaseOrders.length },
          { id: 'grn', label: 'Goods Received Notes (GRN)', icon: ArrowDownLeft, badge: grnList.length },
          { id: 'invoices', label: 'Invoices & Payments', icon: Receipt, badge: invoices.length },
          { id: 'reports', label: 'Purchasing Reports & Audit', icon: BarChart3 }
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 py-3 px-3.5 rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}>
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SUPPLIERS PROFILES & BALANCES */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by vendor name, phone, contact person, or TIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500">
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSensitiveBank(!showSensitiveBank)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition-colors">
                {showSensitiveBank ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                <span>{showSensitiveBank ? 'Mask Bank Info' : 'Show Bank Info'}</span>
              </button>

              <button
                onClick={() => handleOpenSupplierModal()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow">
                <Plus className="w-4 h-4" />
                <span>Register Supplier</span>
              </button>
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Supplier / Company</th>
                  <th className="px-4 py-3.5">Contact Details</th>
                  <th className="px-4 py-3.5">Terms & TIN</th>
                  <th className="px-4 py-3.5">Products Supplied</th>
                  {showSensitiveBank && <th className="px-4 py-3.5">Bank / MoMo Details</th>}
                  <th className="px-4 py-3.5 text-right">Balance Owed</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={showSensitiveBank ? 8 : 7} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                      Loading verified suppliers...
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={showSensitiveBank ? 8 : 7} className="py-12 text-center text-slate-500">
                      No suppliers matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map(s => {
                    let bank = s.bank_details;
                    if (typeof bank === 'string') {
                      try { bank = JSON.parse(bank); } catch { bank = {}; }
                    }
                    let prods = s.products_supplied;
                    if (typeof prods === 'string') {
                      try { prods = JSON.parse(prods); } catch { prods = []; }
                    }

                    return (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-white text-sm">{s.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span>{s.location || s.address || 'Location unrecorded'}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-200">{s.contact_person || '—'}</div>
                          <div className="font-mono text-slate-400 text-[11px] mt-0.5">{s.phone}</div>
                          {s.email && <div className="text-[10px] text-slate-500">{s.email}</div>}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="inline-block px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono font-bold text-amber-400">
                            {s.payment_terms || 'COD'}
                          </span>
                          <div className="font-mono text-[10px] text-slate-500 mt-1">
                            TIN: {s.tax_id || 'N/A'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {Array.isArray(prods) && prods.length > 0 ? (
                              prods.map((p, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px]">
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 text-[10px]">General Hardware</span>
                            )}
                          </div>
                        </td>

                        {showSensitiveBank && (
                          <td className="px-4 py-3.5 font-mono text-[11px]">
                            {bank?.bank_name ? (
                              <div>
                                <span className="text-slate-300 font-bold">{bank.bank_name}</span>: {bank.account_number}
                                <div className="text-[10px] text-slate-500">{bank.account_name}</div>
                              </div>
                            ) : bank?.mobile_money_number ? (
                              <div className="text-amber-400">MoMo: {bank.mobile_money_number}</div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        )}

                        <td className="px-4 py-3.5 text-right font-mono font-bold text-red-400 text-sm">
                          GH₵ {parseFloat(s.balance_owed || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : s.status === 'suspended'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            {s.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleViewStatement(s.id)}
                              title="4-Pillar Financial Statement"
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-[11px] font-semibold transition-colors border border-slate-700">
                              Statement
                            </button>

                            <button
                              onClick={() => handleOpenSupplierModal(s)}
                              title="Edit Supplier Profile"
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-colors border border-slate-700">
                              Edit
                            </button>

                            {s.status === 'active' ? (
                              <button
                                onClick={() => handleToggleSupplierStatus(s.id, 'blacklisted')}
                                title="Blacklist Supplier"
                                className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[11px] border border-red-500/20">
                                Blacklist
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleSupplierStatus(s.id, 'active')}
                                title="Activate Supplier"
                                className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[11px] border border-emerald-500/20">
                                Activate
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
      )}

      {/* TAB 2: PURCHASE ORDERS LIFECYCLE */}
      {activeTab === 'po' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by PO number, vendor name, or quotation reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500">
                <option value="all">All Statuses</option>
                <option value="draft">Draft Only</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved / Open</option>
                <option value="partially_received">Partially Received</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              onClick={() => handleOpenPoModal()}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow">
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          </div>

          {/* PO Notice Banner */}
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span><strong>Acceptance Rule:</strong> Creating or approving a purchase order does NOT increase warehouse stock. Stock increases solely upon formal Goods Received Note (GRN) verification.</span>
            </div>
          </div>

          {/* POs Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">PO Number</th>
                  <th className="px-4 py-3.5">Supplier</th>
                  <th className="px-4 py-3.5">Warehouse</th>
                  <th className="px-4 py-3.5">Order Date / Expected</th>
                  <th className="px-4 py-3.5 text-right">Order Valuation</th>
                  <th className="px-4 py-3.5 text-center">Lifecycle Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                      Loading purchase orders...
                    </td>
                  </tr>
                ) : filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      No purchase orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-white text-sm">{p.po_number}</div>
                        {p.supplier_reference && (
                          <div className="text-[10px] text-slate-400 font-mono">Ref: {p.supplier_reference}</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-200">{p.supplier_name}</div>
                        <div className="text-[10px] text-slate-500">By {p.created_by_name || 'Staff'}</div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-300">
                        {p.warehouse_name || 'Main Showroom'}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono text-slate-300">{new Date(p.created_at).toLocaleDateString()}</div>
                        {p.expected_delivery_date ? (
                          <div className="text-[10px] text-amber-400 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>Exp: {new Date(p.expected_delivery_date).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">No ETA set</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-400 text-sm">
                        GH₵ {parseFloat(p.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {getPoStatusBadge(p.status)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewPoDetails(p.id)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition-colors">
                            Items
                          </button>

                          {/* Draft State Actions */}
                          {p.status === 'draft' && (
                            <button
                              onClick={() => handleSubmitPoForApproval(p.id)}
                              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[11px] font-semibold border border-amber-500/40">
                              Submit
                            </button>
                          )}

                          {/* Approval Actions (for draft or pending_approval) */}
                          {(p.status === 'draft' || p.status === 'pending_approval') && (
                            <button
                              onClick={() => handleOpenApprovalModal(p)}
                              className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-semibold border border-emerald-500/40">
                              Approve
                            </button>
                          )}

                          {/* Receive Delivery (for approved or partially received) */}
                          {(p.status === 'approved' || p.status === 'partially_received') && (
                            <button
                              onClick={() => handleOpenGrnModal(p)}
                              className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg text-[11px] font-semibold border border-cyan-500/40 flex items-center gap-1">
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>Receive</span>
                            </button>
                          )}

                          {/* Cancel Order */}
                          {p.status !== 'completed' && p.status !== 'cancelled' && (
                            <button
                              onClick={() => handleOpenCancelModal(p)}
                              className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[11px] border border-red-500/20">
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GOODS RECEIVED NOTES (GRN) */}
      {activeTab === 'grn' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Recorded Deliveries & Warehouse Inward Notes:</span>
              <span className="font-mono text-xs font-bold text-emerald-400">{grnList.length} total receipts</span>
            </div>

            <button
              onClick={() => handleOpenGrnModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow">
              <ArrowDownLeft className="w-4 h-4" />
              <span>Receive Delivery Against Approved PO</span>
            </button>
          </div>

          {/* GRN Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">GRN Number</th>
                  <th className="px-4 py-3.5">Date & Time</th>
                  <th className="px-4 py-3.5">Supplier / Delivery Note</th>
                  <th className="px-4 py-3.5">Destination Warehouse</th>
                  <th className="px-4 py-3.5 text-right">Landed Inward Value</th>
                  <th className="px-4 py-3.5 text-center">Discrepancy Status</th>
                  <th className="px-4 py-3.5">Verified By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {grnList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      No goods received notes recorded yet.
                    </td>
                  </tr>
                ) : (
                  grnList.map(g => (
                    <tr key={g.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-amber-400 text-sm">{g.grn_number}</div>
                        {g.po_number && (
                          <div className="text-[10px] text-slate-400 font-mono">PO: {g.po_number}</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-300 text-[11px]">
                        {new Date(g.created_at).toLocaleDateString()} {new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white">{g.supplier_name || 'Direct Supplier'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Delivery Note: {g.supplier_delivery_note || g.delivery_note_no || '—'}</div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-300">
                        {g.warehouse_name}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                        GH₵ {parseFloat(g.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {parseInt(g.discrepancies_count || 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{g.discrepancies_count} Issue(s)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                            100% Inward Match
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-slate-400">
                        {g.received_by_name || 'Warehouse Staff'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: INVOICES & PAYMENTS */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {/* Header & Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
            <div>
              <h3 className="font-bold text-white text-sm">Supplier Invoices & Disbursement Ledger</h3>
              <p className="text-[11px] text-slate-400">Reconcile supplier bills against confirmed deliveries and disburse bank/cash payments.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenInvoiceModal()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs transition-colors">
                <Receipt className="w-4 h-4 text-amber-400" />
                <span>Register Supplier Invoice</span>
              </button>

              <button
                onClick={() => handleOpenPaymentModal()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow">
                <CreditCard className="w-4 h-4" />
                <span>Record Supplier Payment</span>
              </button>
            </div>
          </div>

          {/* Invoices List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registered Supplier Invoices</h4>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Invoice Date</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3 text-right">Amount Paid</th>
                    <th className="px-4 py-3 text-right">Balance Due</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-slate-500">
                        No supplier invoices recorded.
                      </td>
                    </tr>
                  ) : (
                    invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono font-bold text-white">{inv.invoice_number}</td>
                        <td className="px-4 py-3 font-semibold text-slate-200">{inv.supplier_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-mono text-amber-400">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'Immediate'}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">
                          GH₵ {parseFloat(inv.total_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          GH₵ {parseFloat(inv.amount_paid || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-red-400">
                          GH₵ {parseFloat(inv.balance_due || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'paid'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : inv.status === 'partially_paid'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {parseFloat(inv.balance_due || 0) > 0 && (
                            <button
                              onClick={() => handleOpenPaymentModal(inv)}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded text-[11px] font-semibold border border-amber-500/30">
                              Pay Balance
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

          {/* Payments History */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disbursement History (Payments Made)</h4>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Payment Number</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Reference / TxID</th>
                    <th className="px-4 py-3">Account Used</th>
                    <th className="px-4 py-3 text-right">Amount Disbursed</th>
                    <th className="px-4 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">
                        No supplier payment transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono font-bold text-amber-400">{p.payment_number}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-semibold text-white">{p.supplier_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-300">{p.payment_method}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{p.reference_no}</td>
                        <td className="px-4 py-3 text-slate-400">{p.bank_account_used || 'Default'}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 text-sm">
                          GH₵ {parseFloat(p.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{p.recorded_by_name || 'Accounts Staff'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PURCHASING REPORTS & AUDIT */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {/* Sub-tab Selectors */}
          <div className="flex border-b border-slate-800 gap-2 pb-2 overflow-x-auto text-xs">
            {[
              { id: 'history', label: 'Purchasing History' },
              { id: 'balances', label: 'Supplier Balances & Aging' },
              { id: 'outstanding', label: 'Outstanding Purchase Orders' },
              { id: 'discrepancies', label: 'Delivery Discrepancies & Rejections' },
              { id: 'price_comparison', label: 'Supplier Price Comparisons' }
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setReportSubTab(sub.id)}
                className={`px-3 py-2 rounded-xl font-semibold transition-all whitespace-nowrap ${
                  reportSubTab === sub.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}>
                {sub.label}
              </button>
            ))}
          </div>

          {/* Report Content Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-4">
            {reportLoading ? (
              <div className="py-16 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-3" />
                Compiling procurement intelligence report...
              </div>
            ) : reportData.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                No entries available for this report type.
              </div>
            ) : (
              <div className="overflow-x-auto">
                {reportSubTab === 'history' && (
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">PO Number</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Warehouse</th>
                        <th className="px-4 py-3 text-right">Total Cost</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3">Creator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {reportData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-white">{r.po_number}</td>
                          <td className="px-4 py-3 font-mono text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-semibold text-slate-200">{r.supplier_name}</td>
                          <td className="px-4 py-3 text-slate-400">{r.warehouse_name}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">GH₵ {parseFloat(r.total_amount).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">{getPoStatusBadge(r.status)}</td>
                          <td className="px-4 py-3 text-slate-400">{r.created_by_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportSubTab === 'balances' && (
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Supplier Name</th>
                        <th className="px-4 py-3">Payment Terms</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Total Outstanding Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {reportData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-bold text-white">{r.name}</td>
                          <td className="px-4 py-3 font-mono text-amber-400">{r.payment_terms}</td>
                          <td className="px-4 py-3 font-mono text-slate-300">{r.phone}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">{r.status}</span></td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-red-400 text-sm">GH₵ {parseFloat(r.balance_owed).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportSubTab === 'outstanding' && (
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">PO Number</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3 text-right">Ordered</th>
                        <th className="px-4 py-3 text-right">Received</th>
                        <th className="px-4 py-3 text-right">Pending Backorder</th>
                        <th className="px-4 py-3 text-right">Unit Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {reportData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-white">{r.po_number}</td>
                          <td className="px-4 py-3 font-semibold text-slate-200">{r.supplier_name}</td>
                          <td className="px-4 py-3 text-white">{r.product_name}</td>
                          <td className="px-4 py-3 font-mono text-slate-400">{r.sku}</td>
                          <td className="px-4 py-3 text-right font-mono">{r.ordered_quantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400">{r.received_quantity}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">{r.pending_quantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">GH₵ {parseFloat(r.unit_cost).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportSubTab === 'discrepancies' && (
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">GRN Number</th>
                        <th className="px-4 py-3">Delivery Date</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Ordered</th>
                        <th className="px-4 py-3 text-right">Accepted</th>
                        <th className="px-4 py-3 text-right">Rejected</th>
                        <th className="px-4 py-3 text-right">Damaged</th>
                        <th className="px-4 py-3">Discrepancy Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {reportData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-amber-400">{r.grn_number}</td>
                          <td className="px-4 py-3 font-mono text-slate-400">{new Date(r.delivery_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-white font-semibold">{r.product_name}</td>
                          <td className="px-4 py-3 text-right font-mono">{r.ordered_quantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400">{r.received_quantity}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-red-400">{r.rejected_quantity}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">{r.damaged_quantity}</td>
                          <td className="px-4 py-3 text-slate-300 italic">{r.discrepancy_reason || 'Discrepancy flagged'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportSubTab === 'price_comparison' && (
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Supplier Name</th>
                        <th className="px-4 py-3 text-right">PO Unit Cost</th>
                        <th className="px-4 py-3 text-right">Current Catalog Cost</th>
                        <th className="px-4 py-3">Last Ordered Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {reportData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-bold text-white">{r.product_name}</td>
                          <td className="px-4 py-3 text-slate-400">{r.category}</td>
                          <td className="px-4 py-3 font-mono text-slate-300">{r.sku}</td>
                          <td className="px-4 py-3 font-semibold text-amber-400">{r.supplier_name}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">GH₵ {parseFloat(r.unit_cost).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">GH₵ {parseFloat(r.catalog_cost_price).toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono text-slate-400">{r.last_ordered_at ? new Date(r.last_ordered_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: ADD / EDIT SUPPLIER PROFILE */}
      {/* =================================================================== */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Building className="w-5 h-5 text-amber-500" />
                <span>{editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Register New Vendor / Supplier'}</span>
              </h3>
              <button onClick={() => setSupplierModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Company / Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    placeholder="e.g. Istanbul Steel Doors Ltd"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Primary Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="e.g. +233 24 555 7788"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={supplierForm.contact_person}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                    placeholder="e.g. Mr. Murat Kaya"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Official Email</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="e.g. sales@istanbuldoors.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Location / City / Port</label>
                  <input
                    type="text"
                    value={supplierForm.location}
                    onChange={(e) => setSupplierForm({ ...supplierForm, location: e.target.value })}
                    placeholder="e.g. Tema Industrial Area"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">TIN / Tax Identification No.</label>
                  <input
                    type="text"
                    value={supplierForm.tax_id}
                    onChange={(e) => setSupplierForm({ ...supplierForm, tax_id: e.target.value })}
                    placeholder="e.g. C0004581299"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Agreed Payment Terms</label>
                  <select
                    value={supplierForm.payment_terms}
                    onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                    <option value="COD">Cash On Delivery (COD)</option>
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                    <option value="ADVANCE">Advance / Upfront Payment</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Status</label>
                  <select
                    value={supplierForm.status}
                    onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                    <option value="active">Active Vendor</option>
                    <option value="suspended">Suspended</option>
                    <option value="blacklisted">Blacklisted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Products Supplied (Comma separated tags)</label>
                <input
                  type="text"
                  value={supplierForm.products_supplied}
                  onChange={(e) => setSupplierForm({ ...supplierForm, products_supplied: e.target.value })}
                  placeholder="e.g. Turkish Security Doors, Locksets, Handles, Armoured Doors"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Sensitive Payment / Bank Information */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sensitive Banking & Disbursement Information</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={supplierForm.bank_name}
                      onChange={(e) => setSupplierForm({ ...supplierForm, bank_name: e.target.value })}
                      placeholder="e.g. Ecobank Ghana"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Account Name</label>
                    <input
                      type="text"
                      value={supplierForm.account_name}
                      onChange={(e) => setSupplierForm({ ...supplierForm, account_name: e.target.value })}
                      placeholder="e.g. Istanbul Steel Doors GH Ltd"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Account Number</label>
                    <input
                      type="text"
                      value={supplierForm.account_number}
                      onChange={(e) => setSupplierForm({ ...supplierForm, account_number: e.target.value })}
                      placeholder="e.g. 019283746501"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">MoMo Number (Optional)</label>
                    <input
                      type="text"
                      value={supplierForm.mobile_money_number}
                      onChange={(e) => setSupplierForm({ ...supplierForm, mobile_money_number: e.target.value })}
                      placeholder="e.g. 0244112233 (MTN MoMo)"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Opening Payable Balance (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  value={supplierForm.balance_owed}
                  onChange={(e) => setSupplierForm({ ...supplierForm, balance_owed: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-lg">
                  {actionLoading ? 'Saving...' : 'Save Supplier Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: 4-PILLAR RECONCILIATION STATEMENT */}
      {/* =================================================================== */}
      {statementModalOpen && activeStatement && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">4-Pillar Financial Statement</h3>
                <p className="text-xs text-amber-400 font-medium">{activeStatement.supplier?.name}</p>
              </div>
              <button onClick={() => setStatementModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">1. Ordered Value (POs)</span>
                <span className="text-lg font-bold font-mono text-blue-400">
                  GH₵ {parseFloat(activeStatement.pillars?.ordered_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Total value contracted across POs</span>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">2. Received Value (GRN)</span>
                <span className="text-lg font-bold font-mono text-cyan-400">
                  GH₵ {parseFloat(activeStatement.pillars?.received_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Confirmed inward inventory received</span>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">3. Invoiced Value (Bills)</span>
                <span className="text-lg font-bold font-mono text-amber-400">
                  GH₵ {parseFloat(activeStatement.pillars?.invoiced_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Formal bills accepted from supplier</span>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">4. Amount Paid (Disbursed)</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  GH₵ {parseFloat(activeStatement.pillars?.amount_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Total bank/cash payments disbursed</span>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-center">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-bold">Reconciled Outstanding Liability</span>
              <span className="text-2xl font-black font-mono text-red-400">
                GH₵ {parseFloat(activeStatement.pillars?.outstanding_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              onClick={() => setStatementModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs">
              Close Statement
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: CREATE PURCHASE ORDER */}
      {/* =================================================================== */}
      {poModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  <span>Create Formal Purchase Order</span>
                </h3>
                <p className="text-xs text-slate-400">Issue purchase requisitions to tile importers & hardware factories.</p>
              </div>
              <button onClick={() => setPoModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleSavePurchaseOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="text-slate-400 block mb-1">Select Supplier *</label>
                  <select
                    required
                    value={poForm.supplier_id}
                    onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id} disabled={s.status === 'blacklisted'}>
                        {s.name} ({s.payment_terms}) {s.status === 'blacklisted' ? '[BLACKLISTED]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Destination Warehouse</label>
                  <select
                    value={poForm.warehouse_name}
                    onChange={(e) => setPoForm({ ...poForm, warehouse_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                    <option value="Main Showroom">Main Showroom</option>
                    <option value="Tema Warehouse">Tema Warehouse</option>
                    <option value="Spintex Depot">Spintex Depot</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={poForm.expected_delivery_date}
                    onChange={(e) => setPoForm({ ...poForm, expected_delivery_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Supplier Proforma Quote / Reference</label>
                  <input
                    type="text"
                    value={poForm.supplier_reference}
                    onChange={(e) => setPoForm({ ...poForm, supplier_reference: e.target.value })}
                    placeholder="e.g. PROFORMA-TRK-9901"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Order Notes / Container Specs</label>
                  <input
                    type="text"
                    value={poForm.notes}
                    onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                    placeholder="e.g. 40ft High Cube Container; Turkish Security Doors"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Order Items Section */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-amber-500" />
                    <span>Purchase Line Items</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddPoItem}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Product</span>
                  </button>
                </div>

                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-700">
                      <tr>
                        <th className="px-3 py-2.5">Product</th>
                        <th className="px-3 py-2.5 w-24">Unit</th>
                        <th className="px-3 py-2.5 w-24">Quantity</th>
                        <th className="px-3 py-2.5 w-28">Unit Cost (GH₵)</th>
                        <th className="px-3 py-2.5 text-right w-28">Line Total</th>
                        <th className="px-3 py-2.5">Notes</th>
                        <th className="px-3 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {poForm.items.map((item, idx) => {
                        const lineTotal = (parseFloat(item.ordered_quantity) || 0) * (parseFloat(item.unit_cost) || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2">
                              <select
                                required
                                value={item.product_id}
                                onChange={(e) => handlePoItemChange(idx, 'product_id', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white">
                                <option value="">-- Choose Item --</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.category}) - SKU: {p.sku}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handlePoItemChange(idx, 'unit', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="number"
                                required
                                min="1"
                                step="1"
                                value={item.ordered_quantity}
                                onChange={(e) => handlePoItemChange(idx, 'ordered_quantity', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono text-right"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={item.unit_cost}
                                onChange={(e) => handlePoItemChange(idx, 'unit_cost', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono text-right"
                              />
                            </td>

                            <td className="px-3 py-2 text-right font-mono font-bold text-amber-400">
                              GH₵ {lineTotal.toFixed(2)}
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => handlePoItemChange(idx, 'notes', e.target.value)}
                                placeholder="Color / Size / Finish"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                              />
                            </td>

                            <td className="px-3 py-2 text-center">
                              {poForm.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePoItem(idx)}
                                  className="text-red-400 hover:text-red-300">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                  <span className="text-xs font-semibold text-slate-300">Total Purchase Order Estimate</span>
                  <span className="text-lg font-bold font-mono text-amber-400">
                    GH₵ {calculatePoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setPoModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-lg">
                  {actionLoading ? 'Creating Order...' : 'Generate Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: GOODS RECEIVED NOTE (GRN) */}
      {/* =================================================================== */}
      {grnModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                  <span>Record Inward Goods Received Note (GRN)</span>
                </h3>
                <p className="text-xs text-slate-400">Verify items delivered against approved purchase orders to increment inventory.</p>
              </div>
              <button onClick={() => setGrnModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleSaveGrn} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Supplier Delivery Note No. *</label>
                  <input
                    type="text"
                    required
                    value={grnForm.supplier_delivery_note}
                    onChange={(e) => setGrnForm({ ...grnForm, supplier_delivery_note: e.target.value })}
                    placeholder="e.g. DLV-9921-A"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">Must be unique to prevent duplicate delivery processing.</span>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Supplier Invoice No. (Optional)</label>
                  <input
                    type="text"
                    value={grnForm.supplier_invoice_no}
                    onChange={(e) => setGrnForm({ ...grnForm, supplier_invoice_no: e.target.value })}
                    placeholder="e.g. INV-TRK-4412"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Receiving Warehouse Location</label>
                  <input
                    type="text"
                    readOnly
                    value={grnForm.warehouse_name}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-slate-300"
                  />
                </div>
              </div>

              {/* Delivery Items Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                  Itemized Verification & Discrepancies Check
                </h4>

                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-700">
                      <tr>
                        <th className="px-3 py-2.5">Product & SKU</th>
                        <th className="px-3 py-2.5 text-right w-20">Ordered</th>
                        <th className="px-3 py-2.5 text-right w-20">Pending</th>
                        <th className="px-3 py-2.5 text-right w-24">Accepted Qty</th>
                        <th className="px-3 py-2.5 text-right w-20">Rejected</th>
                        <th className="px-3 py-2.5 text-right w-20">Damaged</th>
                        <th className="px-3 py-2.5">Discrepancy Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {grnForm.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2">
                            <div className="font-semibold text-white">{item.product_name}</div>
                            <div className="font-mono text-[10px] text-slate-400">{item.sku} ({item.unit})</div>
                          </td>

                          <td className="px-3 py-2 text-right font-mono text-slate-400">
                            {item.ordered_quantity}
                          </td>

                          <td className="px-3 py-2 text-right font-mono font-bold text-amber-400">
                            {item.remaining_quantity}
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={item.remaining_quantity}
                              step="1"
                              value={item.received_quantity}
                              onChange={(e) => handleGrnItemChange(idx, 'received_quantity', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-emerald-400 font-mono font-bold text-right"
                            />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.rejected_quantity}
                              onChange={(e) => handleGrnItemChange(idx, 'rejected_quantity', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-red-400 font-mono text-right"
                            />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.damaged_quantity}
                              onChange={(e) => handleGrnItemChange(idx, 'damaged_quantity', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-amber-400 font-mono text-right"
                            />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.discrepancy_reason}
                              onChange={(e) => handleGrnItemChange(idx, 'discrepancy_reason', e.target.value)}
                              placeholder="e.g. Broken tiles; supplier short shipped"
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setGrnModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-lg">
                  {actionLoading ? 'Processing Inward Stock...' : 'Confirm Goods Received Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: REGISTER SUPPLIER INVOICE */}
      {/* =================================================================== */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Register Supplier Invoice</h3>
              <button onClick={() => setInvoiceModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Select Supplier *</label>
                <select
                  required
                  value={invoiceForm.supplier_id}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, supplier_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Supplier Invoice Number *</label>
                <input
                  type="text"
                  required
                  value={invoiceForm.invoice_number}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                  placeholder="e.g. INV-99021"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.invoice_date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Subtotal (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={invoiceForm.subtotal}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">VAT / Tax (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceForm.tax_amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, tax_amount: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
                  {actionLoading ? 'Saving...' : 'Register Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 6: RECORD SUPPLIER PAYMENT */}
      {/* =================================================================== */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Record Supplier Payment Disbursement</h3>
              <button onClick={() => setPaymentModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Supplier *</label>
                <select
                  required
                  value={paymentForm.supplier_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, supplier_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Balance: GH₵ {parseFloat(s.balance_owed).toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Payment Amount (GH₵) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold text-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Disbursement Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium">
                    <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="MOMO">Mobile Money</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Payment Reference / TxID</label>
                  <input
                    type="text"
                    value={paymentForm.reference_no}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })}
                    placeholder="e.g. TX-9921 / CHQ 00192"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Funding Account Used</label>
                <input
                  type="text"
                  value={paymentForm.bank_account_used}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_account_used: e.target.value })}
                  placeholder="e.g. Ecobank Ghana Main Corporate Account"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
                  {actionLoading ? 'Disbursing...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 7: PO AUTHORIZATION / APPROVAL (WITH PIN RULE) */}
      {/* =================================================================== */}
      {approvalModalOpen && poToApprove && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Purchase Order Authorization</h3>
              <button onClick={() => setApprovalModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Order Reference:</span>
                <span className="font-mono font-bold text-white">{poToApprove.po_number}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Supplier:</span>
                <span className="text-white font-semibold">{poToApprove.supplier_name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Commitment:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  GH₵ {parseFloat(poToApprove.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Threshold Rule Warning */}
            {parseFloat(poToApprove.total_amount) >= 10000 && !isSuperAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>High-Value Purchase Order (&ge; GH₵ 10,000)</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Requires Owner Super Admin authorization or verified Admin PIN verification.
                </p>
                <div>
                  <label className="text-slate-400 block mb-1">Enter Master Admin PIN *</label>
                  <input
                    type="password"
                    maxLength="6"
                    value={approvalPin}
                    onChange={(e) => setApprovalPin(e.target.value)}
                    placeholder="Enter 4-6 digit PIN"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-base"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-slate-400 block mb-1 text-xs">Authorization Notes</label>
              <input
                type="text"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Approved after price quotation verification"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleAuthorizePo('rejected')}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/40">
                Reject Order
              </button>
              <button
                type="button"
                onClick={() => handleAuthorizePo('approved')}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg">
                Authorize & Open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 8: CANCEL PURCHASE ORDER */}
      {/* =================================================================== */}
      {cancelModalOpen && poToCancel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Cancel Purchase Order</h3>
              <button onClick={() => setCancelModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to cancel order <span className="font-mono font-bold text-amber-400">{poToCancel.po_number}</span>?
            </p>

            <div>
              <label className="text-slate-400 block mb-1 text-xs">Reason for Cancellation *</label>
              <textarea
                required
                rows="3"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g. Supplier out of stock; revised order issued instead"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs">
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelPo}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs shadow-lg">
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 9: PO DETAIL & ITEMS BREAKDOWN */}
      {/* =================================================================== */}
      {poDetailModalOpen && activePoDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  <span>Order Details: {activePoDetails.po_number}</span>
                </h3>
                <p className="text-xs text-slate-400">Supplier: {activePoDetails.supplier_name} | Warehouse: {activePoDetails.warehouse_name}</p>
              </div>
              <button onClick={() => setPoDetailModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <div className="border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-700">
                  <tr>
                    <th className="px-3 py-2.5">Product Name</th>
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5 text-right">Ordered</th>
                    <th className="px-3 py-2.5 text-right">Received</th>
                    <th className="px-3 py-2.5 text-right">Unit Cost</th>
                    <th className="px-3 py-2.5 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(activePoDetails.items || []).map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-semibold text-white">{it.product_name}</td>
                      <td className="px-3 py-2 font-mono text-slate-400">{it.sku}</td>
                      <td className="px-3 py-2 text-right font-mono">{it.ordered_quantity} {it.unit}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">{it.received_quantity} {it.unit}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">GH₵ {parseFloat(it.unit_cost).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-amber-400">GH₵ {parseFloat(it.total_cost).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-800/80 p-3 rounded-2xl border border-slate-700 text-xs">
              <span className="text-slate-300 font-semibold">Total Order Valuation:</span>
              <span className="font-mono font-bold text-amber-400 text-base">
                GH₵ {parseFloat(activePoDetails.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              onClick={() => setPoDetailModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs">
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
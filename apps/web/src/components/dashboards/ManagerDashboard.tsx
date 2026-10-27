import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Truck,
  ArrowRightLeft,
  CheckCircle,
  PlusCircle,
  AlertTriangle,
  RefreshCw,
  Building,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { api } from '../../services/api';
import { User, Branch } from '../../types';

export const ManagerDashboard: React.FC<{ currentUser: User; currentBranch?: Branch | null }> = ({
  currentUser,
  currentBranch,
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'transfers' | 'grn'>('inventory');
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferPayload, setTransferPayload] = useState({
    sourceBranchId: 2, // Tema Depot
    sourceWarehouseId: 2,
    destBranchId: 1, // Accra Showroom
    destWarehouseId: 1,
    productId: 1,
    quantity: 10,
    driverName: 'Kwesi Mensah',
    vehicleNumber: 'GE-4421-24',
    notes: 'Urgent showroom replenishment for weekend tile sales',
  });

  // Stock Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustPayload, setAdjustPayload] = useState({
    warehouseId: 1,
    productId: 1,
    quantity: -1,
    movementType: 'damage_breakage',
    reason: 'Chipped edge during offloading',
  });

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [stockRes, trfRes, suppRes, prodRes] = await Promise.all([
        api.getStockLevels(),
        api.getTransfers(),
        api.getSuppliers(),
        api.getProducts(),
      ]);
      setStockLevels(stockRes.data || []);
      setTransfers(trfRes.data || []);
      setSuppliers(suppRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load logistics & inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.requestTransfer({
        sourceBranchId: Number(transferPayload.sourceBranchId),
        sourceWarehouseId: Number(transferPayload.sourceWarehouseId),
        destBranchId: Number(transferPayload.destBranchId),
        destWarehouseId: Number(transferPayload.destWarehouseId),
        driverName: transferPayload.driverName,
        vehicleNumber: transferPayload.vehicleNumber,
        notes: transferPayload.notes,
        items: [
          {
            productId: Number(transferPayload.productId),
            quantity: Number(transferPayload.quantity),
          },
        ],
      });
      setShowTransferModal(false);
      fetchData();
      alert('Inter-branch transfer requested successfully!');
    } catch (err: any) {
      alert(err.message || 'Transfer request failed');
    }
  };

  const handleDispatchTransfer = async (id: number) => {
    try {
      await api.dispatchTransfer(id);
      fetchData();
      alert('Transfer dispatched! Stock deducted from source warehouse.');
    } catch (err: any) {
      alert(err.message || 'Dispatch failed');
    }
  };

  const handleReceiveTransfer = async (id: number) => {
    try {
      await api.receiveTransfer(id);
      fetchData();
      alert('Transfer received! Inventory updated at destination warehouse.');
    } catch (err: any) {
      alert(err.message || 'Receipt confirmation failed');
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adjustStock({
        warehouseId: Number(adjustPayload.warehouseId),
        productId: Number(adjustPayload.productId),
        quantity: Number(adjustPayload.quantity),
        movementType: adjustPayload.movementType,
        reason: adjustPayload.reason,
      });
      setShowAdjustModal(false);
      fetchData();
      alert('Stock adjustment recorded and movement ledger updated.');
    } catch (err: any) {
      alert(err.message || 'Adjustment failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Operations &amp; Logistics Control
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Warehouse Inventory &amp; Inter-Branch Transfers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinate physical stock movements between Tema Depot (Wholesale Hub) and Accra Showroom (Retail Center).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdjustModal(true)}
            leftIcon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          >
            Record Adjustment
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowTransferModal(true)}
            leftIcon={<ArrowRightLeft className="w-4 h-4" />}
          >
            New Transfer Request
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'inventory', label: 'Multi-Branch Inventory Levels' },
          { id: 'transfers', label: `Inter-Branch Transfers (${transfers.length})` },
          { id: 'grn', label: 'Suppliers & Goods Inward' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-4 font-semibold text-xs border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Inventory Levels Table */}
      {activeTab === 'inventory' && (
        <Card className="border-slate-200">
          <CardHeader className="py-3 px-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-slate-900">
                Warehouse Stock Balances ({stockLevels.length} Lines)
              </h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Warehouse</th>
                  <th className="py-2.5 px-4">SKU</th>
                  <th className="py-2.5 px-4">Product Name &amp; Category</th>
                  <th className="py-2.5 px-4 text-right">On Hand</th>
                  <th className="py-2.5 px-4 text-right">Reserved</th>
                  <th className="py-2.5 px-4 text-right">Available</th>
                  <th className="py-2.5 px-4 text-center">Reorder Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockLevels.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-900">{s.warehouse_name}</span>
                      <div className="text-[11px] text-slate-400 font-mono">{s.warehouse_code}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{s.sku}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{s.product_name}</div>
                      <div className="text-[11px] text-slate-500">{s.category_name}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                      {s.quantity_on_hand} {s.base_unit}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500">{s.quantity_reserved}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-blue-700">
                      {s.quantity_available} {s.base_unit}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant={s.is_low_stock ? 'danger' : 'success'} size="sm">
                        {s.is_low_stock ? 'LOW STOCK ALERT' : 'OPTIMAL'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Inter-branch Transfers */}
      {activeTab === 'transfers' && (
        <Card className="border-slate-200">
          <CardHeader className="py-3 px-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-sm text-slate-900">
                Tema Depot ↔ Accra Showroom Transfers
              </h3>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Transfer #</th>
                  <th className="py-2.5 px-4">Source Warehouse</th>
                  <th className="py-2.5 px-4">Destination</th>
                  <th className="py-2.5 px-4">Driver &amp; Vehicle</th>
                  <th className="py-2.5 px-4">Items / Qty</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No transfer orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{t.transfer_number}</td>
                      <td className="py-2.5 px-4">{t.source_warehouse_name}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{t.dest_warehouse_name}</td>
                      <td className="py-2.5 px-4">
                        {t.driver_name || 'Assigned Driver'}
                        <div className="text-[11px] text-slate-400 font-mono">{t.vehicle_number}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        {(t.items || []).map((i: any, idx: number) => (
                          <div key={idx} className="font-medium text-slate-800">
                            {i.product_name}: <strong>{i.quantity_requested} {i.unit}</strong>
                          </div>
                        ))}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant={
                            t.status === 'received'
                              ? 'success'
                              : t.status === 'dispatched'
                              ? 'warning'
                              : 'info'
                          }
                          size="sm"
                        >
                          {t.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {t.status === 'requested' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleDispatchTransfer(t.id)}
                          >
                            Dispatch Goods
                          </Button>
                        )}
                        {t.status === 'dispatched' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReceiveTransfer(t.id)}
                          >
                            Confirm Receipt
                          </Button>
                        )}
                        {t.status === 'received' && (
                          <span className="text-emerald-600 font-semibold text-[11px] flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Received
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Suppliers Directory */}
      {activeTab === 'grn' && (
        <Card className="border-slate-200">
          <CardHeader className="py-3 px-4 flex items-center justify-between border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-900">
              Approved Suppliers in Ghana ({suppliers.length})
            </h3>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Supplier Name</th>
                  <th className="py-2.5 px-4">Contact Person</th>
                  <th className="py-2.5 px-4">Phone</th>
                  <th className="py-2.5 px-4">Address</th>
                  <th className="py-2.5 px-4">Payment Terms</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{s.name}</td>
                    <td className="py-2.5 px-4">{s.contact_person}</td>
                    <td className="py-2.5 px-4 font-mono">{s.phone}</td>
                    <td className="py-2.5 px-4 max-w-xs truncate">{s.address}</td>
                    <td className="py-2.5 px-4 uppercase text-[11px] font-medium text-slate-600">
                      {s.payment_terms.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant="success" size="sm">
                        {s.status.toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Request Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Request Inter-Branch Transfer</h3>
            <form onSubmit={handleRequestTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Source Warehouse</label>
                <select
                  value={transferPayload.sourceWarehouseId}
                  onChange={(e) => setTransferPayload({ ...transferPayload, sourceWarehouseId: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded p-2 bg-white"
                >
                  <option value={2}>Tema Depot (TEM-DEPOT)</option>
                  <option value={1}>Accra Showroom (ACC-SHOWROOM)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Destination Warehouse</label>
                <select
                  value={transferPayload.destWarehouseId}
                  onChange={(e) => setTransferPayload({ ...transferPayload, destWarehouseId: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded p-2 bg-white"
                >
                  <option value={1}>Accra Showroom (ACC-SHOWROOM)</option>
                  <option value={2}>Tema Depot (TEM-DEPOT)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Product Item</label>
                <select
                  value={transferPayload.productId}
                  onChange={(e) => setTransferPayload({ ...transferPayload, productId: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded p-2 bg-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Transfer Quantity"
                type="number"
                min="1"
                required
                value={transferPayload.quantity}
                onChange={(e) => setTransferPayload({ ...transferPayload, quantity: Number(e.target.value) })}
              />

              <Input
                label="Driver Name"
                value={transferPayload.driverName}
                onChange={(e) => setTransferPayload({ ...transferPayload, driverName: e.target.value })}
              />

              <Input
                label="Vehicle Registration Number"
                value={transferPayload.vehicleNumber}
                onChange={(e) => setTransferPayload({ ...transferPayload, vehicleNumber: e.target.value })}
              />

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowTransferModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  Authorize Transfer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Record Stock Adjustment</h3>
            <form onSubmit={handleStockAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Warehouse</label>
                <select
                  value={adjustPayload.warehouseId}
                  onChange={(e) => setAdjustPayload({ ...adjustPayload, warehouseId: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded p-2 bg-white"
                >
                  <option value={1}>Accra Showroom (ACC-SHOWROOM)</option>
                  <option value={2}>Tema Depot (TEM-DEPOT)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Product</label>
                <select
                  value={adjustPayload.productId}
                  onChange={(e) => setAdjustPayload({ ...adjustPayload, productId: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded p-2 bg-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustPayload.movementType}
                  onChange={(e) => setAdjustPayload({ ...adjustPayload, movementType: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 bg-white"
                >
                  <option value="damage_breakage">Damage / Breakage</option>
                  <option value="approved_loss">Approved Loss</option>
                  <option value="stock_count_adjustment">Physical Count Variance</option>
                </select>
              </div>

              <Input
                label="Quantity Adjustment (negative for deduction, e.g. -2)"
                type="number"
                required
                value={adjustPayload.quantity}
                onChange={(e) => setAdjustPayload({ ...adjustPayload, quantity: Number(e.target.value) })}
              />

              <Input
                label="Detailed Reason & Bin Location"
                required
                value={adjustPayload.reason}
                onChange={(e) => setAdjustPayload({ ...adjustPayload, reason: e.target.value })}
              />

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAdjustModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  Save Adjustment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

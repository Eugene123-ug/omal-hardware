import React, { useState, useEffect } from 'react';
import { X, Truck, Plus, Check } from 'lucide-react';
import { api } from '../../../services/api';

interface PurchaseStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PurchaseStockModal: React.FC<PurchaseStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [unitCost, setUnitCost] = useState('');
  const [poNumber, setPoNumber] = useState(`PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('Stock replenishment');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSuppliers().then((res) => {
        if (res.data) setSuppliers(res.data);
      }).catch(() => {});

      api.getProducts().then((res) => {
        if (res.data) setProducts(res.data);
      }).catch(() => {});
    }
  }, [isOpen]);

  // Auto-calculate total invoice amount if product and quantity/unitCost change
  useEffect(() => {
    if (productId && Number(quantity) > 0 && Number(unitCost) > 0) {
      setAmount((Number(quantity) * Number(unitCost)).toFixed(2));
    }
  }, [productId, quantity, unitCost]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = products.find((p) => String(p.id) === id);
    if (prod) {
      setUnitCost(String(prod.cost_price || ''));
      if (prod.cost_price && Number(quantity) > 0) {
        setAmount((Number(quantity) * Number(prod.cost_price)).toFixed(2));
      }
      setNotes(`Received ${quantity} ${prod.base_unit || 'pcs'} of ${prod.name}`);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierId || !amount) {
      setError('Please select supplier and enter purchase total amount.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        poNumber,
        supplierId: Number(supplierId),
        warehouseId: 1,
        totalAmount: Number(amount),
        notes,
        autoReceive: true,
      };

      if (productId) {
        payload.items = [
          {
            productId: Number(productId),
            quantityOrdered: Number(quantity) || 1,
            unitCost: Number(unitCost) || Number(amount) / (Number(quantity) || 1),
            unit: 'pcs',
          },
        ];
      }

      const res = await api.createPurchaseOrder(payload);

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || 'Failed to create purchase order');
      }
    } catch (err: any) {
      setError(err.message || 'Error recording purchase order');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 md:left-64 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Purchase Stock Order</h3>
              <p className="text-[11px] text-slate-500">Record supplier purchase and receive new hardware items</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">PO Reference Number</label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Supplier *</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              required
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.contact_person || 'Contact'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Restock Product (Optional)</label>
            <select
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="">General Stock / Multiple Items</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — Available: {p.totalAvailable || 0}
                </option>
              ))}
            </select>
          </div>

          {productId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity Received</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Cost (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Total Invoice Cost (GH₵) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Order Notes / Items Summary</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 15 items received: Porcelain tiles, cement bags and adhesive"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-md shadow-orange-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isLoading ? 'Saving...' : 'Record Purchase'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

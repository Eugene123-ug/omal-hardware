import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Printer,
  CheckCircle2,
  Banknote,
  Smartphone,
  CreditCard,
  Building,
  ScanBarcode,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../../services/api';
import { A5ReceiptModal } from '../../common/A5ReceiptModal';

interface PosSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentBranch?: any;
  onSuccess: () => void;
}

export const PosSaleModal: React.FC<PosSaleModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentBranch,
  onSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo' | 'bank_transfer'>('cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [showA5Receipt, setShowA5Receipt] = useState(false);

  // Search products only when typed (Per Section 6: Do not display long list of all products when screen first opens)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.getProducts({ search: searchQuery.trim() });
        if (res.data) setSearchResults(res.data);
      } catch {}
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isOpen) return null;

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit || product.base_unit || 'pcs',
          costPrice: Number(product.cost_price || 0),
          price: Number(product.selling_price || 0),
          qty: 1,
          available: Number(product.quantity ?? product.totalAvailable ?? 100),
        },
      ];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as any[],
    );
  };

  const setItemQty = (id: number, qty: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, qty) } : item)),
    );
  };

  const updateItemPrice = (id: number, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, price: Math.max(0, newPrice) } : item)),
    );
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = cart.reduce((acc, curr) => acc + curr.price * curr.qty, 0);
  const totalCogs = cart.reduce((acc, curr) => acc + curr.costPrice * curr.qty, 0);
  const totalProfit = subtotal - totalCogs;
  const hasBelowCost = cart.some((item) => item.price < item.costPrice);
  const tax = 0;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setError(null);
    setIsLoading(true);

    try {
      const normalizedPm = paymentMethod === 'momo' ? 'momo_mtn' : (paymentMethod || 'cash');
      const tender = Number(amountTendered) > 0 ? Number(amountTendered) : total;

      const payload = {
        branchId: 1,
        warehouseId: 1,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod: normalizedPm,
        amountTendered: tender,
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.qty,
          unit: item.unit || 'pcs',
          unitPrice: item.price,
          discountAmount: 0,
        })),
        payments: [
          {
            paymentMethod: normalizedPm,
            amount: total,
          },
        ],
      };

      const res = await api.confirmSale(payload);
      if (res.success && res.data) {
        const saleInfo = {
          ...res.data,
          items: cart.map((c) => ({
            product_name: c.name,
            quantity: c.qty,
            unit_price: c.price,
            total_price: c.price * c.qty,
          })),
          receipt_no: res.data.receiptNumber || `REC-${res.data.id || Math.floor(1000 + Math.random() * 9000)}`,
          customer_name: customerName.trim() || 'Walk-in Customer',
          cashier_name: currentUser?.fullName || currentUser?.name || 'Counter Cashier',
          total_amount: total,
          subtotal: subtotal,
          tax_amount: tax,
          payment_method: paymentMethod.toUpperCase(),
          created_at: new Date().toISOString(),
        };
        setCompletedSale(saleInfo);
        setShowA5Receipt(true);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        onSuccess();
      } else {
        setError(res.message || 'Transaction submission failed');
      }
    } catch (err: any) {
      setError(err.message || 'Error processing POS transaction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
          {/* Top Modal Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">New Counter Sale (POS Till)</h3>
                <p className="text-[11px] text-slate-500">
                  Cashier: {currentUser?.fullName || currentUser?.name} &bull; Register Active
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setCompletedSale(null);
                onClose();
              }}
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

          {/* POS Workspace Layout */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left 7 Cols: Product Lookup & Shopping Cart */}
            <div className="md:col-span-7 space-y-4">
              {/* Search Box with Barcode Icon */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Scan barcode or type product name/SKU to add to cart..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  autoFocus
                />
                <button
                  type="button"
                  title="Barcode Scanner Ready"
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-emerald-600 cursor-pointer"
                >
                  <ScanBarcode className="w-4 h-4" />
                </button>

                {/* Instant Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-30 max-h-56 overflow-y-auto text-xs">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="w-full px-4 py-2 text-left hover:bg-emerald-50/80 transition flex items-center justify-between cursor-pointer border-b border-slate-50 last:border-0"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{product.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            SKU: {product.sku} &bull; Stock: {product.quantity ?? product.totalAvailable ?? 0}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-700">GH₵ {Number(product.selling_price).toFixed(2)}</div>
                          <span className="text-[10px] text-emerald-600 font-semibold">+ Add to cart</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart Items Table */}
              <div className="bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Cart Items ({cart.length})</span>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-[10px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                    <ShoppingCart className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-medium text-slate-600">Register Cart is Empty</p>
                    <p className="text-[11px] text-slate-400">Search products above or scan a barcode</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
                    {cart.map((item) => (
                      <div key={item.id} className="p-3 bg-white flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cost: GH₵ {item.costPrice.toFixed(2)} &bull; Price: GH₵ {item.price.toFixed(2)}
                          </div>
                        </div>

                        {/* Qty +/- */}
                        <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          <button
                            onClick={() => updateQty(item.id, -1)}
                            className="p-1 hover:bg-white rounded text-slate-600 transition cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => setItemQty(item.id, Number(e.target.value))}
                            className="w-10 text-center font-bold bg-transparent text-xs text-slate-900 focus:outline-none"
                          />
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className="p-1 hover:bg-white rounded text-slate-600 transition cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Line Total & Remove */}
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-slate-900">
                            GH₵ {(item.price * item.qty).toFixed(2)}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-500 hover:text-red-700 text-[10px] mt-0.5 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Profit & COGS Real-Time Summary */}
              {cart.length > 0 && (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Real-time Margin:</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className="text-slate-600">COGS: GH₵ {totalCogs.toFixed(2)}</span>
                    <span className="font-bold text-emerald-700">
                      Profit: GH₵ {totalProfit.toFixed(2)} ({subtotal > 0 ? ((totalProfit / subtotal) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right 5 Cols: Customer, Payment & Checkout */}
            <div className="md:col-span-5 space-y-4">
              {/* Optional Customer info */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-700 block">Customer Information (Optional)</span>
                <input
                  type="text"
                  placeholder="Customer Name (e.g. Samuel Mensah)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Customer Phone (e.g. 0244123456)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* Payment Method Selector */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-700 block">Payment Method</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 transition cursor-pointer border ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span className="text-[10px]">Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('momo')}
                    className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 transition cursor-pointer border ${
                      paymentMethod === 'momo'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-[10px]">MoMo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 transition cursor-pointer border ${
                      paymentMethod === 'bank_transfer'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="text-[10px]">Bank / POS</span>
                  </button>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="pt-2">
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">
                      Cash Tendered (GH₵)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={total.toFixed(2)}
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    {Number(amountTendered) > total && (
                      <div className="mt-1 text-right text-[11px] font-bold text-emerald-700">
                        Change: GH₵ {(Number(amountTendered) - total).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Total Breakdown */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono">GH₵ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>VAT / Tax (0%):</span>
                  <span className="font-mono">GH₵ 0.00</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span>Total Due:</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    GH₵ {total.toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={cart.length === 0 || isLoading}
                  onClick={handleCheckout}
                  className={`w-full mt-3 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                    cart.length === 0 || isLoading
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>{isLoading ? 'Processing Sale...' : 'Complete Sale &amp; Print A5 Receipt'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* A5 Client Receipt Modal */}
      {showA5Receipt && completedSale && (
        <A5ReceiptModal
          isOpen={showA5Receipt}
          onClose={() => {
            setShowA5Receipt(false);
            setCompletedSale(null);
            onClose();
          }}
          sale={completedSale}
        />
      )}
    </>
  );
};

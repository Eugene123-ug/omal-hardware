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
} from 'lucide-react';
import { api } from '../../../services/api';

interface PosSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentBranch: any;
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo' | 'bank_transfer'>('cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<any | null>(null);

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
          available: Number(product.totalAvailable ?? product.quantity_on_hand ?? 100),
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
  const tax = 0; // Tax configuration
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setError(null);
    setIsLoading(true);

    try {
      const normalizedPm = paymentMethod === 'momo' ? 'momo_mtn' : (paymentMethod || 'cash');
      const tender = Number(amountTendered) > 0 ? Number(amountTendered) : total;

      const payload = {
        branchId: currentBranch?.id || 1,
        warehouseId: 1,
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
        setCompletedSale({
          ...res.data,
          items: cart,
          totalAmount: total,
          tendered: Number(amountTendered || total),
          change: Math.max(0, Number(amountTendered || total) - total),
          date: new Date().toLocaleString('en-GH'),
        });
        setCart([]);
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">New Sale (Till Point)</h3>
              <p className="text-[11px] text-slate-500">
                Cashier: {currentUser?.fullName} &bull; Till: {currentBranch?.name || 'Accra Showroom'}
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

        {completedSale ? (
          /* Receipt Screen */
          <div className="p-8 max-w-md mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Sale Completed Successfully!</h3>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left font-mono text-xs space-y-2">
              <div className="text-center font-bold pb-2 border-b border-slate-200">
                OMAL HARDWARE LTD
                <div className="text-[10px] text-slate-500 font-normal">Accra Showroom &bull; +233 24 000 0000</div>
              </div>
              <div className="flex justify-between text-slate-600 pt-1">
                <span>Receipt:</span>
                <span className="font-bold text-slate-900">{completedSale.receiptNumber || 'REC-0001245'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Date:</span>
                <span>{completedSale.date}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cashier:</span>
                <span>{currentUser?.fullName}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 space-y-1">
                {completedSale.items.map((it: any) => (
                  <div key={it.id} className="flex justify-between">
                    <span>{it.qty}x {it.name.split(' / ')[0]}</span>
                    <span>GH₵ {(it.price * it.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                <span>Total Paid:</span>
                <span>GH₵ {completedSale.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-900 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 cursor-pointer"
              >
                Next Sale
              </button>
            </div>
          </div>
        ) : (
          /* Main POS Screen (Search + Cart) */
          <div className="grid grid-cols-1 md:grid-cols-5 flex-1 overflow-hidden">
            {/* Left 3 Cols: Search & Product Selection */}
            <div className="md:col-span-3 p-6 border-r border-slate-100 flex flex-col overflow-y-auto">
              <div className="relative mb-4">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan barcode or type product name/SKU..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  autoFocus
                />
              </div>

              {/* Search Results Dropdown / Grid */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {searchQuery.trim() && searchResults.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No matching hardware products found for &ldquo;{searchQuery}&rdquo;.
                  </div>
                )}

                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 flex items-center justify-between cursor-pointer transition"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        SKU: {p.sku} &bull; Unit: {p.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs text-blue-600">GH₵ {Number(p.selling_price).toFixed(2)}</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">
                        In Stock: {p.totalAvailable || 100}
                      </div>
                    </div>
                  </div>
                ))}

                {!searchQuery && (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-6 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Search className="w-8 h-8 text-slate-300 mb-2" />
                    <span>Search above or scan a barcode to add items to cart.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right 2 Cols: Cart & Checkout */}
            <div className="md:col-span-2 p-6 bg-slate-50/50 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <span className="font-bold text-xs text-slate-900">Current Order ({cart.length} items)</span>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-[11px] text-red-600 hover:underline font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Cart Items List */}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">Cart is empty</div>
                  ) : (
                    cart.map((item) => {
                      const itemIncome = item.price * item.qty;
                      const itemCogs = item.costPrice * item.qty;
                      const itemProfit = itemIncome - itemCogs;
                      const isBelowCost = item.price < item.costPrice;

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl bg-white border transition shadow-2xs text-xs space-y-2 ${
                            isBelowCost ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-900 truncate">{item.name}</div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                <span className="text-slate-400">SKU: {item.sku}</span>
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                  Cost: GH₵ {item.costPrice.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Editable Controls: Price & Qty */}
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                                Unit Sell (GH₵)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.price}
                                onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                                className={`w-full px-2 py-1 rounded-lg border font-mono font-bold text-xs ${
                                  isBelowCost
                                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                                    : 'border-slate-200 text-slate-900 focus:border-blue-500'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                                Quantity ({item.unit})
                              </label>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateQty(item.id, -1)}
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.qty}
                                  onChange={(e) => setItemQty(item.id, parseInt(e.target.value, 10) || 1)}
                                  className="w-10 text-center font-bold text-xs border border-slate-200 rounded py-0.5"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQty(item.id, 1)}
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Live item economics: Income & Profit */}
                          <div className="flex items-center justify-between text-[11px] pt-1 bg-slate-50 p-2 rounded-lg font-mono">
                            <div>
                              <span className="text-slate-400">Income: </span>
                              <span className="font-bold text-slate-900">GH₵ {itemIncome.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Profit: </span>
                              <span className={`font-bold ${itemProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {itemProfit >= 0 ? '+' : ''}GH₵ {itemProfit.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Warning Banner if selling below cost */}
              {hasBelowCost && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-medium leading-relaxed">
                  ⚠️ <strong>Warning:</strong> Selling below cost price detected. Profit will be negative on discounted items.
                </div>
              )}

              {/* Totals & Live Economics Section */}
              <div className="pt-3 border-t border-slate-200 space-y-2 mt-2">
                <div className="bg-slate-100/70 p-3 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Income (Revenue)</span>
                    <span className="font-bold font-mono text-slate-900">GH₵ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Cost (COGS)</span>
                    <span className="font-mono text-slate-700">GH₵ {totalCogs.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                    <span>Estimated Net Profit</span>
                    <span className={`font-mono ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {totalProfit >= 0 ? '+' : ''}GH₵ {totalProfit.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                  <span>Payable Total</span>
                  <span className="text-base text-blue-600 font-mono">GH₵ {total.toFixed(2)}</span>
                </div>

                {/* Tender options */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('momo')}
                    className={`py-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      paymentMethod === 'momo'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    MTN / MoMo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`py-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      paymentMethod === 'bank_transfer'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Bank Transfer
                  </button>
                </div>

                {/* Confirm Sale Button */}
                <button
                  type="button"
                  disabled={cart.length === 0 || isLoading}
                  onClick={handleCheckout}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>{isLoading ? 'Processing...' : `Complete Sale (GH₵ ${total.toFixed(2)})`}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

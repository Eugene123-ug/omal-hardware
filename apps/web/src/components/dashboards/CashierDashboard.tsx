import React, { useState, useEffect } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  X,
  Package,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { api } from '../../services/api';
import { User, Branch } from '../../types';

interface CartItem {
  productId: number;
  variantId?: number;
  productName: string;
  variantName?: string;
  sku: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  availableStock: number;
  discountAmount: number;
}

export interface CashierDashboardProps {
  currentUser: User;
  currentBranch?: Branch | null;
}

export const CashierDashboard: React.FC<CashierDashboardProps> = ({ currentUser, currentBranch }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(null);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Payment inputs
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo_mtn' | 'momo_telecel' | 'bank_transfer' | 'credit'>('cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Load products & shift
  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const res = await api.getProducts({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        search: searchQuery || undefined,
      });
      setProducts(res.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const fetchShift = async () => {
    try {
      const res = await api.getCurrentShift();
      setActiveShift(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchProducts();
    fetchShift();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const addToCart = (product: any, variant?: any) => {
    const productId = product.id;
    const variantId = variant?.id;
    const unitPrice = variant ? variant.selling_price : product.selling_price;
    const availableStock = product.totalAvailable;

    if (availableStock <= 0) {
      alert('This product is out of stock in this branch.');
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === productId && item.variantId === variantId,
      );

      if (existingIndex > -1 && prev[existingIndex]) {
        const item = prev[existingIndex]!;
        if (item.quantity + 1 > availableStock) {
          alert(`Cannot add more: only ${availableStock} units available.`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...item, quantity: item.quantity + 1 };
        return updated;
      }

      return [
        ...prev,
        {
          productId,
          variantId,
          productName: product.name,
          variantName: variant?.name,
          sku: variant?.sku_variant || product.sku,
          unit: product.base_unit || 'pcs',
          unitPrice,
          quantity: 1,
          availableStock,
          discountAmount: 0,
        },
      ];
    });
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    setCart((prev) => {
      const item = prev[index];
      if (!item) return prev;
      if (newQty > item.availableStock) {
        alert(`Cannot exceed available stock of ${item.availableStock} units.`);
        return prev;
      }
      const updated = [...prev];
      updated[index] = { ...item, quantity: newQty };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = Math.max(0, subtotal - discountAmount);

  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setAmountTendered(total.toFixed(2));
    setPaymentReference('');
    setSaleError(null);
    setShowPaymentModal(true);
  };

  const handleConfirmSale = async () => {
    setSaleError(null);
    setIsSubmittingSale(true);

    try {
      const branchId = currentBranch ? Number(currentBranch.id) || 1 : 1;
      const warehouseId = 1;

      const payload = {
        branchId,
        warehouseId,
        discountAmount,
        taxAmount: 0,
        items: cart.map((c) => ({
          productId: c.productId,
          variantId: c.variantId,
          quantity: c.quantity,
          unit: c.unit,
          unitPrice: c.unitPrice,
          discountAmount: c.discountAmount,
        })),
        payments: [
          {
            paymentMethod,
            amount: total,
            referenceNumber: paymentReference || undefined,
          },
        ],
      };

      const res = await api.confirmSale(payload);
      setCompletedSale({
        ...res.data,
        items: [...cart],
        cashierName: currentUser.fullName,
        branchName: currentBranch?.name || 'Accra Showroom',
        date: new Date(),
        paymentMethod,
      });

      setCart([]);
      setShowPaymentModal(false);
      setShowReceiptModal(true);
      fetchProducts();
      fetchShift();
    } catch (err: any) {
      setSaleError(err.message || 'Sale confirmation failed.');
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const formatGHS = (val: number) => {
    return `GH₵ ${Number(val || 0).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-4">
      {/* Shift status banner */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Badge variant="success" size="md">
            Cashier Register Active
          </Badge>
          <span className="text-xs text-slate-600">
            Cashier: <strong className="text-slate-800">{currentUser.fullName}</strong> &bull; Location:{' '}
            <strong className="text-slate-800">{currentBranch?.name || 'Accra Showroom'}</strong>
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-500">
            Shift Drawer Cash:{' '}
            <strong className="text-slate-900 font-semibold">{formatGHS(activeShift?.expected_cash || 0)}</strong>
          </span>
        </div>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Search & Catalogue Table */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <Card className="border-slate-200">
            <CardContent className="p-4 space-y-3">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search hardware by Name, SKU, Brand or Barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                  />
                </div>
                <Button type="submit" variant="secondary" size="md">
                  Search
                </Button>
              </form>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { code: 'all', name: 'All Hardware' },
                  { code: 'tiles', name: 'Tiles & Ceramics' },
                  { code: 'security_doors', name: 'Security Doors' },
                  { code: 'sanitary_ware', name: 'Sanitary Ware' },
                  { code: 'paints', name: 'Paints & Finishes' },
                  { code: 'hardware', name: 'General Hardware' },
                ].map((cat) => (
                  <button
                    key={cat.code}
                    onClick={() => setSelectedCategory(cat.code)}
                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === cat.code
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 flex items-center justify-between border-b border-slate-100">
              <span className="text-xs font-semibold uppercase text-slate-600 tracking-wider">
                Product Catalogue ({products.length} Items)
              </span>
              <span className="text-xs text-slate-400">Click item to add to register</span>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">SKU / Code</th>
                    <th className="py-2.5 px-4">Product Details &amp; Hardware Spec</th>
                    <th className="py-2.5 px-4">Unit</th>
                    <th className="py-2.5 px-4 text-right">Available Stock</th>
                    <th className="py-2.5 px-4 text-right">Price (GH₵)</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingProducts ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Loading verified hardware catalog...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No products found matching your search.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <React.Fragment key={p.id}>
                        <tr className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                            {p.sku}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900">{p.name}</div>
                            <div className="text-[11px] text-slate-500">
                              Brand: <span className="text-slate-700">{p.brand || 'OMAL'}</span> &bull; Category:{' '}
                              <span className="text-slate-700">{p.category_name}</span>
                              {p.storage_location && ` • Loc: ${p.storage_location}`}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 uppercase text-slate-500">{p.base_unit}</td>
                          <td className="py-2.5 px-4 text-right">
                            <Badge
                              variant={p.totalAvailable > 10 ? 'success' : p.totalAvailable > 0 ? 'warning' : 'danger'}
                              size="sm"
                            >
                              {p.totalAvailable} in stock
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                            {formatGHS(p.selling_price)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {(!p.variants || p.variants.length === 0) && (
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={p.totalAvailable <= 0}
                                onClick={() => addToCart(p)}
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add
                              </Button>
                            )}
                          </td>
                        </tr>

                        {p.variants &&
                          p.variants.map((v: any) => (
                            <tr key={v.id} className="bg-slate-50/50 hover:bg-blue-50/60 transition-colors">
                              <td className="py-2 px-4 pl-8 font-mono text-[11px] text-slate-500">
                                └ {v.sku_variant}
                              </td>
                              <td className="py-2 px-4 text-slate-700">
                                <span className="font-medium text-blue-900">{v.name}</span>
                                {v.conversion_ratio && (
                                  <span className="ml-2 text-[11px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    Ratio: {v.conversion_ratio} {v.conversion_unit || ''}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-slate-500 text-[11px] uppercase">
                                {v.conversion_unit || p.base_unit}
                              </td>
                              <td className="py-2 px-4 text-right text-[11px] text-slate-500">
                                Uses base inventory
                              </td>
                              <td className="py-2 px-4 text-right font-semibold text-slate-800 text-xs">
                                {formatGHS(v.selling_price)}
                              </td>
                              <td className="py-2 px-4 text-center">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={p.totalAvailable <= 0}
                                  onClick={() => addToCart(p, v)}
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Active Cart / Checkout Register */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <Card className="border-slate-200 sticky top-20 shadow-md">
            <CardHeader className="py-4 px-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-base">Current Sale Register</h2>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-medium">Cart is currently empty</p>
                  <p className="text-xs">Search and add hardware products to proceed</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
                  {cart.map((item, index) => (
                    <div key={`${item.productId}-${item.variantId || 'base'}`} className="py-3 first:pt-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-xs text-slate-900">{item.productName}</div>
                          {item.variantName && (
                            <div className="text-[11px] text-blue-600">{item.variantName}</div>
                          )}
                          <div className="text-[11px] text-slate-500">
                            {formatGHS(item.unitPrice)} / {item.unit}
                          </div>
                        </div>
                        <div className="text-right font-bold text-xs text-slate-900">
                          {formatGHS(item.quantity * item.unitPrice)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-slate-200 rounded-md">
                          <button
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                            className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-3 text-xs font-semibold text-slate-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                            className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-900">{formatGHS(subtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span>Discount (GH₵):</span>
                    <input
                      type="number"
                      min="0"
                      value={discountAmount || ''}
                      onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-24 text-right border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                    <span>Total Payable:</span>
                    <span className="text-lg text-blue-700">{formatGHS(total)}</span>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full font-bold shadow-md"
                      onClick={handleOpenPayment}
                    >
                      Confirm Sale &amp; Pay
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Confirm Sale &amp; Payment</h3>
                <p className="text-xs text-slate-500">Process authorized payment method</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {saleError && <Alert variant="error">{saleError}</Alert>}

              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-500 uppercase">Amount Due</span>
                <div className="text-3xl font-extrabold text-blue-700 mt-1">{formatGHS(total)}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'cash', label: 'Cash (Drawer)', icon: <Banknote className="w-4 h-4" /> },
                    { id: 'momo_mtn', label: 'MTN MoMo', icon: <Smartphone className="w-4 h-4 text-yellow-600" /> },
                    { id: 'momo_telecel', label: 'Telecel Cash', icon: <Smartphone className="w-4 h-4 text-red-600" /> },
                    { id: 'bank_transfer', label: 'Bank Transfer', icon: <CreditCard className="w-4 h-4 text-blue-600" /> },
                    { id: 'credit', label: 'Customer Credit', icon: <CreditCard className="w-4 h-4 text-purple-600" /> },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                        paymentMethod === m.id
                          ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <Input
                    label="Cash Amount Tendered (GH₵)"
                    type="number"
                    step="0.01"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                  />
                  {Number(amountTendered) > total && (
                    <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold pt-1">
                      <span>Change to Return:</span>
                      <span className="text-sm">{formatGHS(Number(amountTendered) - total)}</span>
                    </div>
                  )}
                </div>
              )}

              {['momo_mtn', 'momo_telecel', 'bank_transfer'].includes(paymentMethod) && (
                <Input
                  label="Transaction / Reference ID"
                  placeholder="e.g. 1928374652 or Bank Slip #"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  required
                />
              )}

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full font-bold shadow-md"
                  isLoading={isSubmittingSale}
                  onClick={handleConfirmSale}
                >
                  Finalize Sale &amp; Print Receipt
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {showReceiptModal && completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="text-center pb-3 border-b border-slate-200">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg">OMAL ERP</h3>
              <p className="text-xs text-slate-600 font-medium">Accra Showroom &bull; Tema Depot</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Receipt: {completedSale.receiptNumber}</p>
            </div>

            <div className="text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-medium text-slate-900">
                  {new Date(completedSale.date).toLocaleString('en-GB')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="font-medium text-slate-900">{completedSale.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Branch:</span>
                <span className="font-medium text-slate-900">{completedSale.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-medium uppercase text-blue-700">{completedSale.paymentMethod}</span>
              </div>
            </div>

            <div className="border-t border-b border-slate-200 py-2 divide-y divide-slate-100 text-xs">
              {(completedSale.items || []).map((item: any, i: number) => (
                <div key={i} className="py-1.5 flex justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{item.productName}</div>
                    <div className="text-[11px] text-slate-400">
                      {item.quantity} x {formatGHS(item.unitPrice)}
                    </div>
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatGHS(item.quantity * item.unitPrice)}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs space-y-1">
              <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
                <span>Total Amount:</span>
                <span className="text-blue-700">{formatGHS(completedSale.totalAmount)}</span>
              </div>
            </div>

            <div className="pt-2 text-center text-[11px] text-slate-400 leading-tight">
              Thank you for your business!<br />
              Goods once sold in good condition are not returnable without authorization.
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                size="md"
                className="flex-1"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1 font-semibold"
                onClick={() => setShowReceiptModal(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

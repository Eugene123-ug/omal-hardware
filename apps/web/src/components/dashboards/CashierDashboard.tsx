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
  ScanBarcode,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../../services/api';
import { User, Branch } from '../../types';
import { useCompany } from '../../context/CompanyContext';
import { A5ReceiptModal } from '../common/A5ReceiptModal';

interface CartItem {
  productId: number;
  variantId?: number;
  productName: string;
  variantName?: string;
  sku: string;
  unit: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  availableStock: number;
  discountAmount: number;
}

export interface CashierDashboardProps {
  currentUser: User;
  currentBranch?: Branch | null;
}

export const CashierDashboard: React.FC<CashierDashboardProps> = ({ currentUser }) => {
  const { companyName } = useCompany();
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Modals & Receipts
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showA5ReceiptModal, setShowA5ReceiptModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Payment inputs
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo_mtn' | 'momo_telecel' | 'bank_transfer'>('cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');

  // Load products
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

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const addToCart = (product: any, variant?: any) => {
    const productId = product.id;
    const variantId = variant?.id;
    const unitPrice = variant ? variant.selling_price : Number(product.selling_price || 0);
    const costPrice = Number(product.cost_price || 0);
    const availableStock = Number(product.quantity ?? product.totalAvailable ?? 100);

    if (availableStock <= 0) {
      alert('This product is out of stock in inventory.');
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
          sku: product.sku,
          unit: product.unit || product.base_unit || 'pcs',
          unitPrice,
          costPrice,
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
    const item = cart[index];
    if (item && newQty > item.availableStock) {
      alert(`Cannot exceed available stock (${item.availableStock} units).`);
      return;
    }
    setCart((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index]!, quantity: newQty };
      }
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const totalCogs = cart.reduce((acc, item) => acc + item.quantity * item.costPrice, 0);
  const totalProfit = subtotal - totalCogs;
  const total = subtotal;

  const handleConfirmSale = async () => {
    if (cart.length === 0) return;
    setIsSubmittingSale(true);
    setSaleError(null);

    try {
      const tender = Number(amountTendered) > 0 ? Number(amountTendered) : total;
      const payload = {
        branchId: 1,
        warehouseId: 1,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        amountTendered: tender,
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
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
      const receiptData = {
        ...res.data,
        items: cart.map((c) => ({
          product_name: c.productName,
          quantity: c.quantity,
          unit_price: c.unitPrice,
          total_price: c.quantity * c.unitPrice,
        })),
        receipt_no: res.data?.receiptNumber || `REC-${res.data?.id || Math.floor(1000 + Math.random() * 9000)}`,
        cashier_name: currentUser.fullName || 'Counter Cashier',
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim() || undefined,
        payment_method: paymentMethod.toUpperCase(),
        total_amount: total,
        subtotal: subtotal,
        tax_amount: 0,
        created_at: new Date().toISOString(),
      };

      setCompletedSale(receiptData);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setShowPaymentModal(false);
      setShowA5ReceiptModal(true);
      fetchProducts();
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
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Badge variant="success" size="md">
            Cashier Till Active
          </Badge>
          <span className="text-xs text-slate-600">
            Cashier: <strong className="text-slate-800">{currentUser.fullName}</strong> &bull; Company Store:{' '}
            <strong className="text-emerald-700">{companyName}</strong>
          </span>
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Terminal Status: <span className="text-emerald-600">Online &bull; Ready</span>
        </div>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Search & Catalogue Table */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <Card className="border-slate-200">
            <CardContent className="p-4 space-y-3">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Search hardware by Name, SKU or Scan Barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                  />
                  <ScanBarcode className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
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
                        ? 'bg-emerald-600 text-white shadow-xs'
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
                    <th className="py-2.5 px-4">Product Details &amp; Spec</th>
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
                        Loading product catalogue...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No products found matching &quot;{searchQuery}&quot;
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const avail = Number(p.quantity ?? p.totalAvailable ?? 0);
                      const isOut = avail <= 0;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => !isOut && addToCart(p)}
                          className={`transition cursor-pointer ${
                            isOut ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{p.sku}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900">{p.name}</div>
                            {p.category && <div className="text-[11px] text-slate-400">{p.category}</div>}
                          </td>
                          <td className="py-2.5 px-4">{p.unit || 'pcs'}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                avail <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {avail}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {formatGHS(p.selling_price)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={isOut}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p);
                              }}
                            >
                              Add
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Register Till Cart */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-800 text-sm">Active Till Register</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">{cart.length} items</span>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Optional customer info */}
              <div className="space-y-1.5 text-xs">
                <input
                  type="text"
                  placeholder="Customer Name (Optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Customer Phone (Optional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* Cart List */}
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Package className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs">No items in till. Select hardware from catalogue.</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{item.productName}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatGHS(item.unitPrice)} / {item.unit}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(idx, item.quantity - 1)}
                          className="p-1 hover:bg-white rounded text-slate-600 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-800 text-xs">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(idx, item.quantity + 1)}
                          className="p-1 hover:bg-white rounded text-slate-600 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <div className="font-mono font-bold text-slate-900">
                          {formatGHS(item.quantity * item.unitPrice)}
                        </div>
                        <button
                          onClick={() => removeFromCart(idx)}
                          className="text-[10px] text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Profit & COGS Real-Time Summary */}
              {cart.length > 0 && (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-emerald-800 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Margin:</span>
                  </div>
                  <div className="text-[11px] font-mono">
                    <span className="font-bold text-emerald-700">Profit: {formatGHS(totalProfit)}</span>
                  </div>
                </div>
              )}

              {/* Totals Summary */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">{formatGHS(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>VAT / Tax (0%):</span>
                  <span className="font-mono font-medium">{formatGHS(0)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                  <span>Total Due:</span>
                  <span className="text-xl font-extrabold text-emerald-700 font-mono">
                    {formatGHS(total)}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={cart.length === 0}
                onClick={() => setShowPaymentModal(true)}
              >
                Proceed to Checkout ({cart.length})
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Select Payment Method</h3>
                <p className="text-xs text-slate-500">Payable: {formatGHS(total)}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saleError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {saleError}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'cash'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs">Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('momo_mtn')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'momo_mtn'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-yellow-600" />
                  <span className="text-xs">MoMo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'bank_transfer'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span className="text-xs">Card / POS</span>
                </button>
              </div>

              {paymentMethod === 'cash' && (
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <Input
                    label="Amount Tendered (GH₵)"
                    type="number"
                    step="0.01"
                    placeholder={total.toFixed(2)}
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                  />
                  {Number(amountTendered) > total && (
                    <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold pt-1">
                      <span>Change to Return:</span>
                      <span className="text-sm font-bold">{formatGHS(Number(amountTendered) - total)}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod !== 'cash' && (
                <Input
                  label="Transaction / Reference ID"
                  placeholder="e.g. 1928374652 or Bank Slip #"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              )}

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
                  isLoading={isSubmittingSale}
                  onClick={handleConfirmSale}
                >
                  Finalize Sale &amp; Print A5 Receipt
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A5 Client Receipt Modal */}
      {showA5ReceiptModal && completedSale && (
        <A5ReceiptModal
          isOpen={showA5ReceiptModal}
          onClose={() => {
            setShowA5ReceiptModal(false);
            setCompletedSale(null);
          }}
          sale={completedSale}
        />
      )}
    </div>
  );
};

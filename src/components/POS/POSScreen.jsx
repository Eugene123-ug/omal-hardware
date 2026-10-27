import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { cacheProductsLocally, cacheCustomersLocally, saveOfflineSale, offlineDb } from '../../db/offlineDb';
import TileCalculatorModal from './TileCalculatorModal';
import AdminPinModal from './AdminPinModal';
import PaymentModal from './PaymentModal';
import ReceiptModal from './ReceiptModal';
import confetti from 'canvas-confetti';
import { 
  Search, Barcode, ShoppingCart, Trash2, Plus, Minus, 
  Tag, Percent, Calculator, CheckCircle2, AlertTriangle, 
  Box, CreditCard, RefreshCw, Zap
} from 'lucide-react';

export default function POSScreen() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [adminPinApproved, setAdminPinApproved] = useState(null); // approver object if PIN verified
  const [supervisorPin, setSupervisorPin] = useState(null);
  
  // Modals
  const [showTileCalc, setShowTileCalc] = useState(null); // product for sqm calc
  const [showPinModal, setShowPinModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [completedReceiptData, setCompletedReceiptData] = useState(null);

  const searchInputRef = useRef(null);

  const categories = ['All', 'Tiles', 'Security Doors', 'Sanitary', 'Paints', 'General Hardware'];

  // Sound effect generator using Web Audio API
  const playBeep = (freq = 800, type = 'sine') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  // Load products and customers
  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsData, custsData] = await Promise.all([
        apiRequest('/products'),
        apiRequest('/customers')
      ]);
      setProducts(prodsData);
      setCustomers(custsData);
      // Cache locally for offline mode
      cacheProductsLocally(prodsData);
      cacheCustomersLocally(custsData);
    } catch (err) {
      console.warn('Network fetch failed, loading from offline database...', err);
      // Fallback to offline IndexedDB
      const offlineProds = await offlineDb.products.toArray();
      const offlineCusts = await offlineDb.customers.toArray();
      if (offlineProds.length > 0) setProducts(offlineProds);
      if (offlineCusts.length > 0) setCustomers(offlineCusts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-focus search for instant barcode scanning
    searchInputRef.current?.focus();
  }, []);

  // Filter products by category and search (exclude discontinued products from POS)
  const filteredProducts = products.filter(p => {
    if (p.status === 'discontinued') return false;
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q) || 
      (p.barcode && p.barcode.includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // Handle barcode scanner Enter key event
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchQuery.trim();
      if (!query) return;

      // Exact barcode or SKU match
      const exactMatch = products.find(p => p.barcode === query || p.sku.toLowerCase() === query.toLowerCase());
      if (exactMatch) {
        addToCart(exactMatch);
        setSearchQuery('');
        playBeep(950);
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        setSearchQuery('');
        playBeep(950);
      }
    }
  };

  // Add product to cart
  const addToCart = (product, customQty = 1, sqmCoverage = 0) => {
    // Check if product is discontinued
    if (product.status === 'discontinued') {
      alert(`Cannot sell "${product.name}". This product has been discontinued.`);
      playBeep(250, 'sawtooth');
      return;
    }

    // Check stock
    const currentStock = product.total_stock || 0;
    if (currentStock <= 0) {
      alert(`Cannot add "${product.name}". Stock is 0!`);
      playBeep(250, 'sawtooth');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        const newQty = existing.quantity + customQty;
        if (newQty > currentStock) {
          alert(`Cannot exceed available stock (${currentStock} units).`);
          return prev;
        }
        return prev.map(item => item.product_id === product.id 
          ? { 
              ...item, 
              quantity: newQty, 
              sqm_coverage: product.sqm_per_box ? product.sqm_per_box * newQty : 0 
            } 
          : item
        );
      } else {
        if (customQty > currentStock) {
          alert(`Cannot exceed available stock (${currentStock} units).`);
          return prev;
        }
        return [...prev, {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          brand: product.brand,
          category: product.category,
          unit: product.unit,
          cost_price: product.cost_price, // for validation check
          unit_price: product.selling_price,
          quantity: customQty,
          sqm_coverage: sqmCoverage || (product.sqm_per_box ? product.sqm_per_box * customQty : 0),
          sqm_per_box: product.sqm_per_box || 0,
          total_stock: currentStock
        }];
      }
    });

    playBeep(850);
  };

  // Update quantity in cart
  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > item.total_stock) {
          alert(`Cannot exceed available stock of ${item.total_stock}`);
          return item;
        }
        return {
          ...item,
          quantity: newQty,
          sqm_coverage: item.sqm_per_box ? item.sqm_per_box * newQty : 0
        };
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  // Cart calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount;

  // Handle discount change with Supervisor PIN check
  const handleDiscountChange = (newPct) => {
    const pct = Math.max(0, Math.min(100, parseFloat(newPct) || 0));

    // Spec rule: Cannot give discount > 2% without Admin PIN code
    if (pct > 2 && !adminPinApproved) {
      setShowPinModal(true);
      return;
    }

    setDiscountPercent(pct);
  };

  // Complete sale checkout
  const handleProcessSale = async (paymentDetails) => {
    const salePayload = {
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        sqm_coverage: item.sqm_coverage
      })),
      discount_percent: discountPercent,
      admin_pin: supervisorPin || undefined,
      ...paymentDetails
    };

    try {
      let res;
      if (navigator.onLine) {
        res = await apiRequest('/sales', {
          method: 'POST',
          body: JSON.stringify(salePayload)
        });
      } else {
        // Offline mode: save locally to IndexedDB
        console.log('[POS] Saving sale in offline storage...');
        const offlineSale = await saveOfflineSale(salePayload);
        res = {
          success: true,
          receipt_no: offlineSale.offline_client_id,
          sale_id: offlineSale.offline_client_id,
          total_amount: grandTotal,
          change_given: paymentDetails.change_given,
          is_offline: true
        };
      }

      if (res.success) {
        // Confetti celebration
        try {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        } catch (e) {}

        // Fetch full receipt data for printing
        let receiptPayload;
        if (navigator.onLine && res.receipt_no && !res.is_offline) {
          receiptPayload = await apiRequest(`/sales/receipt/${res.receipt_no}`);
        } else {
          // Offline mock receipt
          receiptPayload = {
            sale: {
              receipt_no: res.receipt_no,
              customer_name: paymentDetails.customer_name,
              customer_phone: paymentDetails.customer_phone,
              staff_name: user?.name,
              subtotal,
              discount_percent: discountPercent,
              discount_amount: discountAmount,
              total_amount: grandTotal,
              payment_method: paymentDetails.payment_method,
              momo_network: paymentDetails.momo_network,
              momo_reference: paymentDetails.momo_reference,
              cash_tendered: paymentDetails.cash_tendered,
              change_given: paymentDetails.change_given,
              created_at: new Date().toISOString()
            },
            items: cart.map(i => ({
              product_name: i.product_name,
              sku: i.sku,
              quantity: i.quantity,
              unit: i.unit,
              selling_price: i.unit_price,
              total_price: i.unit_price * i.quantity,
              sqm_coverage: i.sqm_coverage
            })),
            store_info: {
              name: 'OMAL TILES & HARDWARE DEPOT',
              tin: 'C0028914567',
              phone: '+233 24 456 7890',
              address: 'Spintex Road, Accra, Ghana',
              footer: 'Goods once sold are not returnable after 48 hours. Valid offline receipt.'
            }
          };
        }

        setCompletedReceiptData(receiptPayload);
        setShowPaymentModal(false);
        // Clear cart
        setCart([]);
        setDiscountPercent(0);
        setAdminPinApproved(null);
        setSupervisorPin(null);
        // Reload products stock in background
        loadData();
      }
    } catch (err) {
      alert(`Sale failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-100px)]">
      {/* LEFT: PRODUCTS CATALOG & SEARCH (< 10 seconds sale target) */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Search Bar + Barcode Scanner input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Scan barcode or type tile / door / hardware name... (Press Enter to add)"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-12 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 shadow-inner"
            />
            <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
              <Barcode className="w-3 h-3 text-amber-400" />
              <span>SCAN</span>
            </div>
          </div>

          <button
            onClick={loadData}
            title="Refresh Product Catalog"
            className="p-2.5 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto max-h-[600px] pr-1">
          {loading ? (
            <div className="text-center py-20 text-slate-500 text-sm">Loading product catalog...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-sm">
              No products found matching "{searchQuery}"
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(p => {
                const stock = p.total_stock || 0;
                const isOutOfStock = stock <= 0;
                const isLowStock = stock > 0 && stock <= p.min_stock_alert;

                return (
                  <div
                    key={p.id}
                    className={`bg-slate-900 border rounded-xl overflow-hidden flex flex-col justify-between transition-all group ${
                      isOutOfStock 
                        ? 'border-red-900/40 opacity-60' 
                        : isLowStock 
                        ? 'border-amber-500/40 hover:border-amber-500' 
                        : 'border-slate-800 hover:border-slate-700'
                    }`}>
                    {/* Image & Badges */}
                    <div className="relative h-28 bg-slate-950 overflow-hidden">
                      {p.image_url ? (
                        <img 
                          src={p.image_url} 
                          alt={p.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-700">
                          <Box className="w-8 h-8" />
                        </div>
                      )}

                      {/* Stock Pill */}
                      <span className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded shadow ${
                        isOutOfStock 
                          ? 'bg-red-600 text-white' 
                          : isLowStock 
                          ? 'bg-amber-500 text-slate-950' 
                          : 'bg-slate-900/80 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm'
                      }`}>
                        {stock} {p.unit}
                      </span>

                      {/* Tile Coverage badge */}
                      {p.category === 'Tiles' && p.sqm_per_box > 0 && (
                        <span className="absolute bottom-2 left-2 text-[10px] bg-slate-900/90 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {p.sqm_per_box} m²/box
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                          {p.category} • {p.brand}
                        </div>
                        <h4 className="font-semibold text-xs text-slate-100 line-clamp-2 leading-snug mt-0.5" title={p.name}>
                          {p.name}
                        </h4>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sku}</div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-amber-400">
                            GH₵ {p.selling_price.toFixed(2)}
                          </div>
                          <span className="text-[10px] text-slate-500">per {p.unit}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* SqM calculator shortcut for tiles */}
                          {p.category === 'Tiles' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowTileCalc(p);
                              }}
                              title="Calculate SqM to Boxes"
                              className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-slate-700 hover:border-amber-500/40 rounded-lg transition-colors">
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => addToCart(p)}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-all">
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: POS CART & CHECKOUT PANEL */}
      <div className="w-full lg:w-96 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-2xl">
        <div className="space-y-4">
          {/* Cart Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm text-white">Current Cart</h3>
              <span className="text-xs bg-slate-800 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                {cart.length}
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="overflow-y-auto max-h-[320px] space-y-2.5 pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2">
                <ShoppingCart className="w-8 h-8 stroke-[1.5] text-slate-700" />
                <span>Cart is empty. Scan barcode or click product to add.</span>
              </div>
            ) : (
              cart.map(item => (
                <div 
                  key={item.product_id}
                  className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-200 line-clamp-1">{item.product_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.sku} • GH₵ {item.unit_price.toFixed(2)}/{item.unit}
                      </div>
                      {item.sqm_coverage > 0 && (
                        <div className="text-[10px] text-amber-400/90">
                          Coverage: {item.sqm_coverage.toFixed(2)} m²
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-slate-500 hover:text-red-400 p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Qty and Line Total */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-700/40">
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5">
                      <button
                        onClick={() => updateQuantity(item.product_id, -1)}
                        className="text-slate-400 hover:text-white p-0.5">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-white font-mono px-1">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product_id, 1)}
                        className="text-slate-400 hover:text-white p-0.5">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-sm font-bold text-white">
                      GH₵ {(item.unit_price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Totals & Checkout Summary */}
        <div className="border-t border-slate-800 pt-4 space-y-3 mt-4">
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono text-white">GH₵ {subtotal.toFixed(2)}</span>
            </div>

            {/* Discount with Supervisor PIN Guard */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-slate-400">
                <Percent className="w-3.5 h-3.5" />
                <span>Discount:</span>
                {adminPinApproved && (
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1 rounded">
                    Auth: {adminPinApproved.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={discountPercent}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  className="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-right text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-400">%</span>
              </div>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount Value:</span>
                <span className="font-mono">-GH₵ {discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold text-white border-t border-slate-800 pt-2">
              <span>Grand Total:</span>
              <span className="text-amber-400 font-mono text-xl">
                GH₵ {grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Pay Button */}
          <button
            disabled={cart.length === 0}
            onClick={() => setShowPaymentModal(true)}
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all">
            <CreditCard className="w-4 h-4" />
            <span>Pay & Print Receipt (GH₵ {grandTotal.toFixed(2)})</span>
          </button>
        </div>
      </div>

      {/* MODALS */}
      {/* 1. Tile SqM Calculator Modal */}
      {showTileCalc && (
        <TileCalculatorModal
          product={showTileCalc}
          onApply={(boxes, coverage) => addToCart(showTileCalc, boxes, coverage)}
          onClose={() => setShowTileCalc(null)}
        />
      )}

      {/* 2. Admin PIN Approval Modal (> 2% discount) */}
      {showPinModal && (
        <AdminPinModal
          title="Manager Discount Approval"
          message="Cashiers cannot give discounts above 2% without IT Manager or Super Admin PIN."
          onApproved={(approver, pin) => {
            setAdminPinApproved(approver);
            setSupervisorPin(pin);
            setDiscountPercent(5); // default manager discount
          }}
          onClose={() => setShowPinModal(false)}
        />
      )}

      {/* 3. Payment Checkout Modal */}
      {showPaymentModal && (
        <PaymentModal
          totalAmount={grandTotal}
          subtotal={subtotal}
          discountPercent={discountPercent}
          discountAmount={discountAmount}
          customers={customers}
          isOffline={!navigator.onLine}
          onCompleteSale={handleProcessSale}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* 4. Thermal Receipt Print Modal */}
      {completedReceiptData && (
        <ReceiptModal
          receiptData={completedReceiptData}
          onClose={() => setCompletedReceiptData(null)}
          onNewSale={() => {
            setCompletedReceiptData(null);
            searchInputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

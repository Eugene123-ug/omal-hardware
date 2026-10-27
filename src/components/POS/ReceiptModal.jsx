import React from 'react';
import { Printer, Check, X, Building2 } from 'lucide-react';

export default function ReceiptModal({ receiptData, onClose, onNewSale }) {
  if (!receiptData) return null;

  const { sale, items, store_info } = receiptData;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Controls Header */}
        <div className="px-5 py-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            <Check className="w-4 h-4" />
            <span>Sale Completed Successfully</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Paper Preview Container */}
        <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-slate-950/60">
          <div 
            id="thermal-receipt-area"
            className="w-full max-w-[340px] bg-white text-black p-5 rounded-lg shadow-lg font-mono text-xs leading-tight border border-slate-300">
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-gray-400">
              <div className="flex items-center justify-center gap-1 font-black text-sm uppercase tracking-wide">
                <Building2 className="w-4 h-4 text-gray-800" />
                <span>{store_info?.name || 'OMAL TILES & HARDWARE'}</span>
              </div>
              <div className="text-[10px] text-gray-600">{store_info?.address}</div>
              <div className="text-[10px] text-gray-600">Tel: {store_info?.phone}</div>
              <div className="text-[10px] font-bold text-gray-800">GRA TIN: {store_info?.tin}</div>
              <div className="text-[11px] font-semibold bg-gray-100 py-0.5 rounded mt-1">OFFICIAL SALES RECEIPT</div>
            </div>

            {/* Metadata */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-600">Receipt No:</span>
                <span className="font-bold text-black">{sale.receipt_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span>{new Date(sale.created_at || Date.now()).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cashier:</span>
                <span className="font-semibold">{sale.staff_name || 'Counter Staff'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-semibold">{sale.customer_name || 'Walk-in'}</span>
              </div>
              {sale.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Contact:</span>
                  <span>{sale.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="py-2 border-b border-dashed border-gray-400">
              <div className="flex justify-between text-[10px] font-bold uppercase text-gray-600 pb-1 border-b border-gray-200">
                <span className="w-1/2">Item Description</span>
                <span className="w-1/4 text-center">Qty x Price</span>
                <span className="w-1/4 text-right">Total</span>
              </div>

              <div className="divide-y divide-gray-100">
                {items?.map((item, idx) => (
                  <div key={idx} className="py-1 text-[11px]">
                    <div className="font-medium text-gray-900 leading-none">{item.product_name}</div>
                    <div className="flex justify-between text-[10px] text-gray-500 pt-0.5">
                      <span className="text-[9px] text-gray-400">{item.sku}</span>
                      <span>{item.quantity} {item.unit} @ GH₵ {item.selling_price.toFixed(2)}</span>
                      <span className="font-semibold text-gray-900">GH₵ {item.total_price.toFixed(2)}</span>
                    </div>
                    {item.sqm_coverage > 0 && (
                      <div className="text-[9px] text-gray-500">Coverage: {item.sqm_coverage} m²</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span>GH₵ {sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({sale.discount_percent}%):</span>
                  <span>-GH₵ {sale.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black border-t border-gray-300 pt-1 text-black">
                <span>TOTAL AMOUNT:</span>
                <span>GH₵ {sale.total_amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-bold uppercase">{sale.payment_method}</span>
              </div>
              {sale.payment_method === 'CASH' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cash Tendered:</span>
                    <span>GH₵ {(sale.cash_tendered || sale.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-600">Change Given:</span>
                    <span>GH₵ {(sale.change_given || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
              {sale.payment_method === 'MOMO' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">MoMo Ref / Network:</span>
                  <span className="font-mono">{sale.momo_network} - {sale.momo_reference}</span>
                </div>
              )}
              {sale.payment_method === 'CREDIT' && (
                <div className="text-amber-800 font-semibold bg-amber-50 p-1 rounded text-center">
                  * CHARGED TO CUSTOMER CREDIT ACCOUNT *
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 text-center space-y-1 text-[9px] text-gray-500">
              <p>{store_info?.footer || 'Thank you for your patronage! All goods once inspected and sold are subject to store policy.'}</p>
              <div className="font-mono text-[8px] text-gray-400">Powered by OMAL Business Cloud ERP</div>
              <div className="border-t border-gray-200 pt-1 flex justify-center">
                {/* Simulated Barcode */}
                <div className="h-6 w-44 bg-gray-900 rounded-sm opacity-80 flex items-center justify-center text-[7px] text-white font-mono tracking-widest">
                  ||| | | |||| || ||| || |||
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="px-5 py-3.5 bg-slate-800 border-t border-slate-700 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all">
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onNewSale}
            className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700 font-medium text-xs transition-colors">
            Start New Sale
          </button>
        </div>
      </div>
    </div>
  );
}

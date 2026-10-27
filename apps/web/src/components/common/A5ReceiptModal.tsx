import React, { useRef } from 'react';
import { X, Printer, Download, Receipt, Building2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCompany } from '../../context/CompanyContext';

interface A5ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any;
  currentUser?: any;
}

export const A5ReceiptModal: React.FC<A5ReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  currentUser,
}) => {
  const { settings } = useCompany();
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !sale) return null;

  const companyName = settings.companyName || 'WONARK COMPANY LIMITED';
  const companyAddress = settings.address || 'Commercial Industrial Area, Greater Accra, Ghana';
  const companyPhone = [settings.phone1, settings.phone2].filter(Boolean).join(' / ') || '+233 30 281 1200';
  const companyEmail = settings.email || 'info@wonark.com';
  const tinNumber = settings.tin || 'C0001234567';
  const currency = settings.currency || 'GHS';
  const receiptFooter = settings.receiptFooter || 'Thank you for your business!';

  const receiptNumber = sale.receipt_number || sale.receipt_no || `REC-${sale.id}`;
  const saleDate = sale.sale_date
    ? new Date(sale.sale_date).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('en-GB');

  const cashierName = sale.cashier_name || currentUser?.fullName || 'Cashier';
  const customerName = sale.customer_name || 'Walk-In Customer';
  const paymentMethod = (sale.payment_method || sale.payments?.[0]?.payment_method || 'CASH').toUpperCase();

  const items = sale.items || [];
  const subtotal = Number(sale.subtotal || sale.total_amount || 0);
  const taxAmount = Number(sale.tax_amount || 0);
  const totalAmount = Number(sale.total_amount || 0);

  const formatMoney = (val: number) => {
    return `${currency} ${Number(val || 0).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5',
    });

    // Header
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(companyName, 10, 12);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(companyAddress, 10, 16);
    doc.text(`Tel: ${companyPhone} | Email: ${companyEmail} | TIN: ${tinNumber}`, 10, 20);

    doc.setDrawColor(203, 213, 225);
    doc.line(10, 23, doc.internal.pageSize.getWidth() - 10, 23);

    // Receipt Meta
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(`OFFICIAL SALES RECEIPT: ${receiptNumber}`, 10, 29);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`Date & Time: ${saleDate}`, 10, 34);
    doc.text(`Cashier: ${cashierName}`, 10, 38);
    doc.text(`Customer: ${customerName}`, doc.internal.pageSize.getWidth() / 2, 34);
    doc.text(`Payment: ${paymentMethod}`, doc.internal.pageSize.getWidth() / 2, 38);

    // Items Table
    const tableRows = items.map((i: any) => [
      i.product_name || i.name || 'Product Item',
      Number(i.quantity).toLocaleString(),
      formatMoney(Number(i.unit_price || i.price || 0)),
      formatMoney(Number(i.line_total || (i.quantity * i.unit_price) || 0)),
    ]);

    autoTable(doc, {
      head: [['Item Description', 'Qty', 'Unit Price', 'Total']],
      body: tableRows,
      startY: 42,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
      },
      margin: { top: 42, left: 10, right: 10, bottom: 35 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 80;

    // Totals Box
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`Subtotal: ${formatMoney(subtotal)}`, doc.internal.pageSize.getWidth() - 50, finalY + 6);
    if (taxAmount > 0) {
      doc.text(`VAT / Tax: ${formatMoney(taxAmount)}`, doc.internal.pageSize.getWidth() - 50, finalY + 11);
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL PAID: ${formatMoney(totalAmount)}`, doc.internal.pageSize.getWidth() - 50, finalY + 18);

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(receiptFooter, doc.internal.pageSize.getWidth() / 2, footerY - 4, { align: 'center' });
    doc.text('Thank you for choosing us!', doc.internal.pageSize.getWidth() / 2, footerY, { align: 'center' });

    doc.save(`${companyName.replace(/[^A-Za-z0-9]+/g, '_')}_Receipt_${receiptNumber}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls (Not printed) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">Client Receipt (A5 Standard)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Print A5 Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Content (A5 format preview) */}
        <div
          ref={receiptRef}
          className="p-6 bg-white text-slate-800 font-sans print:p-0 print:m-0 print:w-full"
          id="receipt-print-area"
        >
          <style dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: A5 portrait;
                  margin: 8mm;
                }
                body * {
                  visibility: hidden;
                }
                #receipt-print-area, #receipt-print-area * {
                  visibility: visible;
                }
                #receipt-print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                }
              }
            `
          }} />

          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                {companyName}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{companyAddress}</p>
              <p className="text-[10px] text-slate-500">
                Tel: {companyPhone} &bull; Email: {companyEmail}
              </p>
              <p className="text-[10px] text-slate-500">TIN: {tinNumber}</p>
            </div>
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={companyName} className="w-14 h-14 object-contain rounded-lg" />
            ) : (
              <div className="w-12 h-12 bg-slate-900 text-amber-400 font-black text-sm rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
            )}
          </div>

          {/* Receipt Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Receipt Number</span>
              <span className="font-bold font-mono text-slate-900">{receiptNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Date & Time</span>
              <span className="font-medium text-slate-800">{saleDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Served By</span>
              <span className="font-semibold text-slate-800">{cashierName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer</span>
              <span className="font-semibold text-slate-800">{customerName}</span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-xs mb-3 border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-800 text-slate-900 font-bold">
                <th className="py-1.5">Item</th>
                <th className="py-1.5 text-center">Qty</th>
                <th className="py-1.5 text-right">Price</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-slate-400 italic">
                    Sales items recorded in transaction
                  </td>
                </tr>
              ) : (
                items.map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-1.5 font-medium text-slate-800">{it.product_name || it.name}</td>
                    <td className="py-1.5 text-center">{it.quantity}</td>
                    <td className="py-1.5 text-right font-mono">{formatMoney(it.unit_price || it.price || 0)}</td>
                    <td className="py-1.5 text-right font-mono font-bold">
                      {formatMoney(it.line_total || it.quantity * it.unit_price || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t-2 border-slate-800 pt-2.5 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono">{formatMoney(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>VAT / Tax:</span>
                <span className="font-mono">{formatMoney(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-dashed border-slate-300">
              <span>Total Paid:</span>
              <span className="font-mono">{formatMoney(totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
              <span>Payment Method:</span>
              <span className="font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                {paymentMethod}
              </span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-4 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-500">
            <p className="font-medium">{receiptFooter}</p>
            <p className="mt-0.5 text-[9px] text-slate-400">{settings.termsAndConditions}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

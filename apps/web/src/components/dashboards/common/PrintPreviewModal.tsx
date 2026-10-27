import React from 'react';
import { X, Printer, Download, Shield } from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { exportToPdfA4 } from '../../../utils/excelTemplates';

interface ColumnDef {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
}

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  period?: string;
  branchName?: string;
  columns: ColumnDef[];
  dataRows: Record<string, any>[];
  totals?: { label: string; value: string }[];
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  period = `Generated on ${new Date().toLocaleDateString('en-GB')}`,
  branchName,
  columns,
  dataRows,
  totals,
  companyName: propCompanyName,
  companyAddress: propCompanyAddress,
  companyPhone: propCompanyPhone,
}) => {
  const companyContext = useCompany();
  const activeCompanyName = propCompanyName || companyContext.companyName;
  const activeCompanyAddress = propCompanyAddress || companyContext.companyAddress;
  const activeCompanyPhone = propCompanyPhone || companyContext.companyPhone;
  const activeLogo = companyContext.companyLogo;

  if (!isOpen) return null;

  const docId = `DOC-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowStr = new Date().toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' });

  const handleDownloadPdf = () => {
    const pdfCols = columns.map((c) => ({
      header: c.header,
      dataKey: c.key,
    }));

    exportToPdfA4({
      title,
      companyName: activeCompanyName,
      companyAddress: activeCompanyAddress,
      companyPhone: activeCompanyPhone,
      dateRange: period,
      columns: pdfCols,
      data: dataRows,
      summary: totals,
      filename: `${activeCompanyName.replace(/\s+/g, '_')}_${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar (Hidden in physical print) */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">A4 Live Print / PDF Preview</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
              Standard A4 Document
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet (Standard A4 Format Layout) */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 text-slate-900 bg-white printable-area">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  {activeLogo ? (
                    <img
                      src={activeLogo}
                      alt={activeCompanyName}
                      className="h-10 max-w-[120px] object-contain rounded"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold">
                      <Shield className="w-5 h-5 text-amber-300" />
                    </div>
                  )}
                  <h1 className="text-xl font-black tracking-tight text-emerald-950 uppercase">{activeCompanyName}</h1>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-md">{activeCompanyAddress}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Tel: {activeCompanyPhone}</p>
              </div>

              <div className="text-right text-xs">
                <div className="font-mono font-bold text-slate-700">{docId}</div>
                <div className="text-[11px] text-slate-500 mt-1">Generated: {nowStr}</div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-black tracking-wider uppercase text-slate-900">{title}</h2>
              <span className="text-xs text-slate-600 font-medium">Period: {period}</span>
            </div>
          </div>

          {/* Table */}
          {dataRows.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 italic">
              No records available for this period.
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] font-bold uppercase text-slate-700">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`py-2 px-2.5 ${
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dataRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`py-2 px-2.5 ${
                          c.align === 'right'
                            ? 'text-right font-mono'
                            : c.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Summary / Totals */}
          {totals && totals.length > 0 && (
            <div className="mt-6 pt-4 border-t-2 border-slate-900 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {totals.map((t, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-slate-500">{t.label}</div>
                  <div className="text-base font-black text-slate-900 mt-0.5">{t.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Document Footer */}
          <div className="mt-12 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
            <span>Official Commercial Statement &bull; {activeCompanyName}</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
};

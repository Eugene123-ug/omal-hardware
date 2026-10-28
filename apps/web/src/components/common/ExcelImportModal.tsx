import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  templateName: string;
  onDownloadTemplate: () => void;
  onImportRows: (rows: any[]) => Promise<{ importedCount: number; errorCount: number; errors?: string[] }>;
  onSuccess: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  title,
  templateName,
  onDownloadTemplate,
  onImportRows,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setValidationErrors([]);
    setResultMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          setValidationErrors(['No readable worksheets found in this workbook.']);
          return;
        }
        const ws = wb.Sheets[sheetName];
        if (!ws) {
          setValidationErrors(['Worksheet could not be parsed.']);
          return;
        }
        const json = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        if (json.length < 2) {
          setValidationErrors(['The file contains no data rows (only headers or empty).']);
          return;
        }

        const rawHeaders = (json[0] as string[]).map((h) => String(h || '').trim());
        setPreviewHeaders(rawHeaders);

        // Normalize data rows
        const rows: any[] = [];
        for (let i = 1; i < json.length; i++) {
          const rowArr = json[i] as any[];
          if (!rowArr || rowArr.length === 0 || rowArr.every((v) => v === undefined || v === '')) {
            continue; // skip blank rows
          }
          const rowObj: Record<string, any> = {};
          rawHeaders.forEach((header, colIdx) => {
            // Strip asterisk and trailing spaces from header keys
            const cleanKey = header.replace(/\*/g, '').trim();
            rowObj[cleanKey] = rowArr[colIdx];
          });
          rows.push(rowObj);
        }

        setParsedRows(rows);
      } catch (err: any) {
        setValidationErrors([`Failed to parse spreadsheet: ${err.message || 'Corrupted file'}`]);
      }
    };
    reader.readAsBinaryString(selected);
  };

  const handleStartImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    setValidationErrors([]);
    setResultMsg(null);

    try {
      // Map normalized fields for products/suppliers
      const prepared = parsedRows.map((r) => ({
        sku: r['SKU'] || r['sku'],
        name: r['Product Name'] || r['Supplier Name'] || r['Category Name'] || r['name'],
        category: r['Category'] || r['category'],
        costPrice: Number(r['Cost Price (GHS)'] || r['cost_price'] || 0),
        sellingPrice: Number(r['Selling Price (GHS)'] || r['selling_price'] || 0),
        quantity: Number(r['Current Quantity'] || r['quantity'] || 0),
        lowStockThreshold: Number(r['Low Stock Threshold'] || r['low_stock'] || 10),
        unit: r['Unit (pcs/bag/sqm)'] || r['unit'] || 'pcs',
        barcode: r['Barcode'] || r['barcode'] || '',
        description: r['Description'] || r['Notes'] || '',
        contactPerson: r['Contact Person'] || r['contact_person'] || '',
        phone: r['Phone Number'] || r['phone'] || '',
        email: r['Email'] || r['email'] || '',
        address: r['Address'] || r['address'] || '',
        tin: r['TIN'] || r['tin'] || '',
      }));

      const res = await onImportRows(prepared);

      if (res.errorCount > 0 && res.errors) {
        setValidationErrors(res.errors);
      }

      setResultMsg({
        type: 'success',
        text: `Successfully imported ${res.importedCount} record(s). ${res.errorCount > 0 ? `${res.errorCount} skipped with warnings.` : ''}`,
      });

      if (res.importedCount > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setResultMsg({
        type: 'error',
        text: err.message || 'Import failed. Please check spreadsheet format.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setParsedRows([]);
    setPreviewHeaders([]);
    setValidationErrors([]);
    setResultMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 md:left-64 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="font-bold text-base">{title}</h3>
              <p className="text-xs text-slate-400">Import bulk records directly from standard Excel (.xlsx) file</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Step 1: Download Official Template */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-blue-900">Need the official format?</h4>
                <p className="text-xs text-blue-700">
                  Download the official {templateName} with all pre-formatted columns and instructions.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDownloadTemplate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>

          {/* Step 2: Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
              file
                ? 'border-emerald-400 bg-emerald-50/40'
                : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                <span className="font-bold text-sm text-slate-800">{file.name}</span>
                <span className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB &bull; {parsedRows.length} data rows found
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetAll();
                  }}
                  className="mt-1 text-xs text-red-600 hover:underline font-semibold"
                >
                  Choose a different file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-slate-400" />
                <span className="font-bold text-sm text-slate-700">
                  Click to select Excel file (.xlsx, .xls)
                </span>
                <span className="text-xs text-slate-500">Supports up to 1,000 rows per batch</span>
              </div>
            )}
          </div>

          {/* Result Message */}
          {resultMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
                resultMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-red-50 border-red-300 text-red-800'
              }`}
            >
              {resultMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span>{resultMsg.text}</span>
            </div>
          )}

          {/* Validation Warnings List */}
          {validationErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h5 className="font-bold text-xs text-amber-900 flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Validation Warnings ({validationErrors.length})
              </h5>
              <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-amber-800 font-mono">
                {validationErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <span>&bull;</span>
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold">File Preview (First 5 of {parsedRows.length} rows)</span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-48">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      {previewHeaders.slice(0, 6).map((h, i) => (
                        <th key={i} className="px-3 py-2 border-b border-slate-200 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {previewHeaders.slice(0, 6).map((h, cIdx) => {
                          const cleanKey = h.replace(/\*/g, '').trim();
                          return (
                            <td key={cIdx} className="px-3 py-2 whitespace-nowrap text-slate-700">
                              {String(row[cleanKey] ?? row[h] ?? '')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartImport}
            disabled={parsedRows.length === 0 || isProcessing}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Import...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Import {parsedRows.length > 0 ? `(${parsedRows.length} rows)` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

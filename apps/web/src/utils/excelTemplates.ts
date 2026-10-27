import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompanySettings } from '../context/CompanyContext';

/**
 * 1. PRODUCTS TEMPLATE
 * Sheet 1: Products Import
 * Headers: SKU* | Product Name* | Category* | Cost Price (GHS)* | Selling Price (GHS)* | Current Quantity* | Low Stock Threshold | Unit (pcs/bag/sqm) | Barcode | Description
 * Sheet 2: INSTRUCTIONS - READ
 */
export function downloadProductsTemplate(companyName = 'WONARK') {
  const wb = XLSX.utils.book_new();

  const headers = [
    'SKU*',
    'Product Name*',
    'Category*',
    'Cost Price (GHS)*',
    'Selling Price (GHS)*',
    'Current Quantity*',
    'Low Stock Threshold',
    'Unit (pcs/bag/sqm)',
    'Barcode',
    'Description',
  ];

  const sampleRows = [
    [
      'TIL-200',
      'Security Door 4ft',
      'Doors',
      450,
      600,
      49,
      10,
      'pcs',
      '123456789012',
      'Metal door heavy gauge finish',
    ],
    [
      'TIL-201',
      'Porcelain Floor Tiles 60x60',
      'Tiles',
      120,
      175,
      150,
      20,
      'sqm',
      '123456789013',
      'High gloss Spanish porcelain',
    ],
    [
      'CEM-001',
      'Ghacem Super Rapid 42.5N',
      'Cement',
      95,
      115,
      500,
      50,
      'bag',
      '123456789014',
      '50kg Portland limestone cement',
    ],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Products Import');

  const instructions = [
    ['INSTRUCTIONS - READ CAREFULLY BEFORE IMPORTING'],
    [''],
    ['1. Do NOT modify, delete, or re-order the column header names in row 1.'],
    ['2. Columns marked with (*) are strictly REQUIRED: SKU, Product Name, Category, Cost Price, Selling Price, Current Quantity.'],
    ['3. SKU must be UNIQUE across all products. If an SKU already exists, its prices and stock will be UPDATED.'],
    ['4. If a Category does not exist, the system will AUTO-CREATE it automatically.'],
    ['5. Selling Price must be GREATER than Cost Price.'],
    ['6. Quantity and Low Stock Threshold must be positive numbers (0 or higher).'],
    ['7. Maximum 1,000 rows per import file for optimal speed.'],
    ['8. DELETE the sample example rows before importing your real business inventory!'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, wsInstr, 'INSTRUCTIONS - READ');

  const prefix = companyName.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
  XLSX.writeFile(wb, `${prefix}_Products_Import_Template.xlsx`);
}

/**
 * 2. SUPPLIERS TEMPLATE
 * Headers: Supplier Name* | Contact Person | Phone Number* | Email | Address | TIN | Category | Notes
 */
export function downloadSuppliersTemplate(companyName = 'WONARK') {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Supplier Name*',
    'Contact Person',
    'Phone Number*',
    'Email',
    'Address',
    'TIN',
    'Category',
    'Notes',
  ];

  const sampleRows = [
    [
      'Ghacem Ltd',
      'Kwame Mensah',
      '0302811200',
      'sales@ghacem.com.gh',
      'Tema Industrial Area',
      'C0001234567',
      'Cement',
      'Primary cement distributor',
    ],
    [
      'B5 Plus Steel Ltd',
      'Rajesh Patel',
      '0303301122',
      'info@b5plus.com',
      'Kpone Barrier, Tema',
      'C0009876543',
      'Iron Rods & Steel',
      'Wholesale structural steel',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Suppliers Import');

  const prefix = companyName.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
  XLSX.writeFile(wb, `${prefix}_Suppliers_Import_Template.xlsx`);
}

/**
 * 3. CATEGORIES TEMPLATE
 * Headers: Category Name* | Description
 */
export function downloadCategoriesTemplate(companyName = 'WONARK') {
  const wb = XLSX.utils.book_new();

  const headers = ['Category Name*', 'Description'];
  const sampleRows = [
    ['Tiles & Ceramics', 'Wall and floor tiles, porcelain, adhesive and grout'],
    ['Security Doors', 'Armoured steel and Turkish exterior security doors'],
    ['Sanitary Ware', 'Toilets, sinks, faucets, and bathroom fittings'],
    ['Paints & Finishes', 'Interior emulsion, exterior weather guard, primers'],
    ['General Hardware', 'Fasteners, locks, tools, pipes and building materials'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Categories Import');

  const prefix = companyName.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
  XLSX.writeFile(wb, `${prefix}_Categories_Import_Template.xlsx`);
}

/**
 * Generic Export to Excel (.xlsx)
 * Supports both signatures:
 * 1. exportToExcel(data: Record<string, any>[], filename: string, sheetName?: string)
 * 2. exportToExcel(filename: string, headers: string[], rows: (string | number)[][], sheetName?: string)
 */
export function exportToExcel(
  arg1: string | Record<string, any>[],
  arg2: string | string[],
  arg3?: (string | number)[][] | string,
  arg4?: string
) {
  const wb = XLSX.utils.book_new();

  if (Array.isArray(arg1) && typeof arg2 === 'string') {
    // Called with: exportToExcel(data, filename, sheetName)
    const data = arg1;
    const filename = arg2;
    const sheetName = (typeof arg3 === 'string' ? arg3 : 'Sheet1') || 'Sheet1';

    if (data.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([['No Data Available']]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    } else {
      const headers = Object.keys(data[0] || {});
      const rows = data.map((item) => headers.map((h) => item[h] ?? ''));
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, cleanFilename);
  } else if (typeof arg1 === 'string' && Array.isArray(arg2) && Array.isArray(arg3)) {
    // Called with: exportToExcel(filename, headers, rows, sheetName)
    const filename = arg1;
    const headers = arg2;
    const rows = arg3;
    const sheetName = arg4 || 'Sheet1';

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, cleanFilename);
  }
}

export interface ExportPdfColumn {
  header: string;
  dataKey?: string;
  key?: string;
}

export interface ExportPdfOptions {
  title: string;
  filename: string;
  headers?: string[];
  rows?: (string | number)[][];
  columns?: ExportPdfColumn[];
  data?: Record<string, any>[];
  settings?: Partial<CompanySettings>;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  userName?: string;
  dateRange?: string;
  orientation?: 'portrait' | 'landscape';
  summary?: { label: string; value: string }[];
}

/**
 * Generic A4 PDF Export using jsPDF + jspdf-autotable
 * Ensures Header on every page (Logo, Company Name, Address, Phone, Title, Date Range)
 * and Footer on every page (Page X of Y, Printed by User, Date/Time).
 */
export function exportToPdfA4(options: ExportPdfOptions) {
  const {
    title,
    filename,
    settings,
    companyName: propCompanyName,
    companyAddress: propCompanyAddress,
    companyPhone: propCompanyPhone,
    userName = 'System User',
    dateRange = new Date().toLocaleDateString('en-GB'),
    orientation = 'portrait',
    summary,
  } = options;

  let headers: string[] = [];
  let rows: (string | number)[][] = [];

  if (options.columns && options.data) {
    headers = options.columns.map((c) => c.header);
    rows = options.data.map((d) =>
      options.columns!.map((c) => {
        const k = c.dataKey || c.key || '';
        return d[k] !== undefined ? String(d[k]) : '';
      })
    );
  } else if (options.headers && options.rows) {
    headers = options.headers;
    rows = options.rows;
  }

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const resolvedCompanyName =
    propCompanyName || settings?.companyName || 'WONARK COMPANY LIMITED';
  const resolvedCompanyAddress =
    propCompanyAddress || settings?.address || 'Commercial Industrial Area, Greater Accra, Ghana';
  const resolvedCompanyPhone =
    propCompanyPhone ||
    (settings ? [settings.phone1, settings.phone2].filter(Boolean).join(' / ') : '') ||
    '+233 30 281 1200';

  const printTimestamp = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 42,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 78, 59], // Emerald-900
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 42, left: 10, right: 10, bottom: 20 },
    didDrawPage: (data) => {
      // Top Header on Every Page
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.text(resolvedCompanyName.toUpperCase(), 10, 13);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${resolvedCompanyAddress} | Tel: ${resolvedCompanyPhone} | TIN: ${settings?.tin || 'C0001234567'}`,
        10,
        18
      );

      // Report Title & Date Range Banner
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(title.toUpperCase(), 10, 26);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Period / Filter: ${dateRange}`, 10, 31);

      // Top dividing rule
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(10, 35, doc.internal.pageSize.getWidth() - 10, 35);

      // Footer on Every Page
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageCurrent = data.pageNumber;
      const footerY = doc.internal.pageSize.getHeight() - 10;

      doc.line(10, footerY - 4, doc.internal.pageSize.getWidth() - 10, footerY - 4);
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Printed by: ${userName} on ${printTimestamp}`, 10, footerY);
      doc.text(
        `Page ${pageCurrent} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 25,
        footerY
      );
    },
  });

  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(cleanFilename);
}

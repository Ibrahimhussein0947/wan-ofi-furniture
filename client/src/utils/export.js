import { getCurrency } from './format';

const cellValue = (row, col) => {
  const v = col.exportValue ? col.exportValue(row) : row[col.key];
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
};

/** Downloads rows as a CSV file that opens cleanly in Excel. */
export function exportCSV(filename, columns, rows) {
  const escape = (v) => {
    const s = String(v);
    // Guard against spreadsheet formula injection.
    const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [columns.map((c) => escape(c.header)).join(','), ...rows.map((r) => columns.map((c) => escape(cellValue(r, c))).join(','))];
  // The byte-order mark makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${filename}.csv`);
}

/** Downloads rows as a real Excel workbook (.xlsx) with typed number cells and a bold header. */
export async function exportXLSX(filename, columns, rows) {
  const { default: writeXlsxFile } = await import('write-excel-file');
  const header = columns.map((c) => ({ value: String(c.header), fontWeight: 'bold', backgroundColor: '#f2e9df' }));
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = cellValue(r, c);
      if (typeof v === 'number' && Number.isFinite(v)) return { type: Number, value: v, format: Number.isInteger(v) ? '#,##0' : '#,##0.00' };
      return { type: String, value: v === '' ? '' : String(v) };
    })
  );
  const widths = columns.map((c, i) => ({ width: Math.min(45, Math.max(10, String(c.header).length + 2, ...rows.slice(0, 200).map((r) => String(cellValue(r, columns[i])).length + 2))) }));
  await writeXlsxFile([header, ...body], { columns: widths, fileName: `${filename}.xlsx`, stickyRowsCount: 1 });
}

/** Generates a branded PDF report with a table and optional summary lines. */
export async function exportPDF({ filename, title, subtitle, columns, rows, summary = [], company = 'Wan Ofi Furniture' }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'pt' });
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(63, 42, 33);
  doc.rect(0, 0, width, 64, 'F');
  doc.setTextColor(217, 165, 49);
  doc.setFontSize(16);
  doc.text(company, 40, 30);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(title, 40, 48);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, width - 40, 48, { align: 'right' });

  let y = 84;
  doc.setTextColor(80, 80, 80);
  if (subtitle) {
    doc.text(subtitle, 40, y);
    y += 14;
  }
  summary.forEach(([k, v]) => {
    doc.text(`${k}: ${v}`, 40, y);
    y += 13;
  });

  autoTable(doc, {
    startY: y + 6,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(cellValue(r, c)))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [116, 72, 50], textColor: 255 },
    alternateRowStyles: { fillColor: [250, 246, 242] },
    columnStyles: Object.fromEntries(columns.map((c, i) => [i, c.align === 'right' ? { halign: 'right' } : {}])),
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.text(`Page ${doc.internal.getNumberOfPages()} · Amounts in ${getCurrency()}`, width - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
    },
  });
  doc.save(`${filename}.pdf`);
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

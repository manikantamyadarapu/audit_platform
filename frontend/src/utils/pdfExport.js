import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const EMPTY_EXPORT_MESSAGE = 'No eligible suppliers found.';

function cellText(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * @param {string} filename
 * @param {string} title
 * @param {{ header: string, accessor: (row: object) => unknown }[]} columnDefs
 * @param {object[]} rows
 */
export function exportRowsToPdf(filename, title, columnDefs, rows) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 40, 36);

  const head = [columnDefs.map((c) => c.header)];
  const body = rows.length
    ? rows.map((row) => columnDefs.map((c) => cellText(c.accessor(row))))
    : [[EMPTY_EXPORT_MESSAGE]];

  autoTable(doc, {
    head,
    body,
    startY: 48,
    styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40, bottom: 36 },
  });

  doc.save(filename);
}

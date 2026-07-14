import * as XLSX from 'xlsx';

/**
 * Reusable multi-sheet audit Excel export (browser).
 *
 * Mirrors python-service/app/utils/audit_excel_exporter.py so Sales, Purchase,
 * Cash Ledger, and future audits can share one client-side download path.
 */

export const EMPTY_AUDIT_SHEET_MESSAGE = 'No report for this audit rule.';

const EXCEL_SHEET_FORBIDDEN = /[\\/?*[\]:]/g;
const EXCEL_SHEET_MAX_LEN = 31;

/**
 * @param {string} name
 * @param {Set<string>} [used]
 */
export function sanitizeExcelSheetName(name, used = new Set()) {
  let cleaned = String(name || 'Sheet').replace(EXCEL_SHEET_FORBIDDEN, '_').trim() || 'Sheet';
  cleaned = cleaned.slice(0, EXCEL_SHEET_MAX_LEN);

  let candidate = cleaned;
  let suffix = 1;
  while (used.has(candidate)) {
    const tail = `_${suffix}`;
    candidate = `${cleaned.slice(0, EXCEL_SHEET_MAX_LEN - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ key: string, header: string }[]} columns
 */
function mapRow(row, columns) {
  const out = {};
  for (const col of columns) {
    const value = row?.[col.key];
    if (value == null || value === '') {
      out[col.header] = '';
    } else if (Array.isArray(value)) {
      out[col.header] = value.join('; ');
    } else {
      out[col.header] = value;
    }
  }
  return out;
}

/**
 * @param {{
 *   filename: string,
 *   sheets: Record<string, Record<string, unknown>[] | null | undefined>,
 *   columns: { key: string, header: string }[],
 *   emptyMessage?: string,
 * }} options
 */
export function downloadAuditMultiSheetXlsx({
  filename,
  sheets,
  columns,
  emptyMessage = EMPTY_AUDIT_SHEET_MESSAGE,
}) {
  if (!sheets || !Object.keys(sheets).length) {
    throw new Error('At least one worksheet definition is required');
  }
  if (!Array.isArray(columns) || !columns.length) {
    throw new Error('Export columns are required');
  }

  const wb = XLSX.utils.book_new();
  const used = new Set();
  const headers = columns.map((col) => col.header);

  for (const [rawName, rows] of Object.entries(sheets)) {
    const sheetName = sanitizeExcelSheetName(rawName, used);
    const list = Array.isArray(rows) ? rows : [];

    if (!list.length) {
      const ws = XLSX.utils.aoa_to_sheet([[emptyMessage]]);
      ws['!cols'] = [{ wch: Math.max(emptyMessage.length + 4, 40) }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      continue;
    }

    const exportRows = list.map((row) => mapRow(row, columns));
    const ws = XLSX.utils.json_to_sheet(exportRows, { header: headers });
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });
    ws['!cols'] = headers.map((header) => ({
      wch: Math.min(
        60,
        Math.max(
          header.length + 2,
          ...exportRows.map((row) => String(row[header] ?? '').length + 2)
        )
      ),
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, filename || `audit-report-${Date.now()}.xlsx`);
}

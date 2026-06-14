import * as XLSX from 'xlsx';
import {
  columnHeaderLabel,
  recordsToExportRows,
  resolveAuditColumnOrder,
} from './auditTableColumns';

/**
 * Resolve export column order (display headers) from API metadata + row keys.
 * @param {Record<string, unknown>[]} records
 * @param {string[] | undefined} exportColumns
 * @param {Record<string, string> | undefined} columnDisplayHeaders
 */
export function resolveSalesReturnExportColumns(records, exportColumns, columnDisplayHeaders) {
  const internalOrder = resolveAuditColumnOrder(records, exportColumns, columnDisplayHeaders);
  return internalOrder.map((key) => columnHeaderLabel(key));
}

/**
 * @param {Record<string, unknown>[]} records
 * @param {string[]} columnOrder
 * @param {string[] | undefined} exportColumns
 * @param {Record<string, string> | undefined} columnDisplayHeaders
 */
function toExportRows(records, columnOrder, exportColumns, columnDisplayHeaders) {
  const internalOrder = columnOrder?.length
    ? columnOrder
    : resolveAuditColumnOrder(records, exportColumns, columnDisplayHeaders);

  return recordsToExportRows(records, internalOrder);
}

/**
 * Download exception table as a single-sheet workbook (matches on-screen table).
 * @param {Record<string, unknown>[]} records
 * @param {string[]} columnOrder
 * @param {string} [filename]
 * @param {string} [sheetName]
 */
export function downloadSalesReturnExceptionXlsx(
  records,
  columnOrder,
  filename,
  sheetName = 'Final Exception Report',
  exportColumns,
  columnDisplayHeaders
) {
  if (!Array.isArray(records) || records.length === 0) return;

  const name = filename || `sales-return-exceptions-${Date.now()}.xlsx`;
  const rows = toExportRows(records, columnOrder, exportColumns, columnDisplayHeaders);
  const headers = rows.length ? Object.keys(rows[0]) : [];

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, name);
}

/**
 * @param {string} filename
 * @param {{ header: string, accessor: (row: object) => unknown }[]} columnDefs
 * @param {object[]} rows
 * @param {string} [sheetName]
 */
export function downloadRowsXlsx(filename, columnDefs, rows, sheetName = 'Report') {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const columns = columnDefs.map((col) => col.header);
  const exportRows = rows.map((row) => {
    const out = {};
    for (const col of columnDefs) {
      out[col.header] = col.accessor(row) ?? '';
    }
    return out;
  });

  const ws = XLSX.utils.json_to_sheet(exportRows, { header: columns });
  XLSX.utils.sheet_add_aoa(ws, [columns], { origin: 'A1' });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** Generic aliases used by Rate & Ledger and Sales Return audits. */
export const resolveAuditExportColumns = resolveSalesReturnExportColumns;
export const downloadAuditExceptionXlsx = downloadSalesReturnExceptionXlsx;

import * as XLSX from 'xlsx';
import { recordsToExportRows, resolveAuditColumnOrder } from './auditTableColumns';

/**
 * Export workbook rows with all upload columns + Message last.
 * @param {Record<string, unknown>[]} records
 * @param {string} [filename]
 * @param {string[]} [columnOrder]
 */
export function downloadPanRecordsXlsx(records, filename, columnOrder) {
  if (!Array.isArray(records) || records.length === 0) return;

  const name = filename || `pan-rows-${Date.now()}.xlsx`;
  const order = columnOrder?.length ? columnOrder : resolveAuditColumnOrder(records);
  const rows = recordsToExportRows(records, order);
  const headers = rows.length ? Object.keys(rows[0]) : [];

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PAN rows');
  XLSX.writeFile(wb, name);
}

import * as XLSX from 'xlsx';
import { recordsToExportRows } from './auditTableColumns';
import { resolveGrossWeightColumnOrder } from './grossTableColumns';

/**
 * @param {Record<string, unknown>[]} records
 * @param {string} [filename]
 * @param {string[]} [columnOrder]
 */
export function downloadGrossWeightRecordsXlsx(records, filename, columnOrder) {
  if (!Array.isArray(records) || records.length === 0) return;

  const name = filename || `gross-weight-rows-${Date.now()}.xlsx`;
  const order = columnOrder?.length ? columnOrder : resolveGrossWeightColumnOrder(records);
  const rows = recordsToExportRows(records, order);
  const headers = rows.length ? Object.keys(rows[0]) : [];

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gross weight rows');
  XLSX.writeFile(wb, name);
}

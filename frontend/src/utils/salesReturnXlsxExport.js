import * as XLSX from 'xlsx';

/**
 * Resolve export column order (display headers) from API metadata + row keys.
 * @param {Record<string, unknown>[]} records
 * @param {string[] | undefined} exportColumns
 * @param {Record<string, string> | undefined} columnDisplayHeaders
 */
export function resolveSalesReturnExportColumns(records, exportColumns, columnDisplayHeaders) {
  if (!records?.length) return [];
  const recordKeys = Object.keys(records[0]);
  const headers = columnDisplayHeaders ?? {};
  const internal = exportColumns ?? [];

  if (internal.length) {
    const mapped = internal.map((col) => headers[col] || col);
    const ordered = mapped.filter((col) => recordKeys.includes(col));
    const extras = recordKeys.filter((key) => key !== 'Message' && !ordered.includes(key));
    const withExtras = [...ordered, ...extras];
    if (recordKeys.includes('Message') && !withExtras.includes('Message')) {
      withExtras.push('Message');
    }
    return withExtras.length ? withExtras : recordKeys;
  }

  const withoutMessage = recordKeys.filter((key) => key !== 'Message');
  return recordKeys.includes('Message') ? [...withoutMessage, 'Message'] : recordKeys;
}

/**
 * @param {Record<string, unknown>[]} records
 * @param {string[]} columnOrder
 */
function toExportRows(records, columnOrder) {
  return records.map((record) => {
    const row = {};
    for (const column of columnOrder) {
      const value = record[column];
      row[column] = value == null ? '' : value;
    }
    return row;
  });
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
  sheetName = 'Final Exception Report'
) {
  if (!Array.isArray(records) || records.length === 0) return;

  const columns =
    columnOrder?.length > 0 ? columnOrder : resolveSalesReturnExportColumns(records);
  const name = filename || `sales-return-exceptions-${Date.now()}.xlsx`;
  const rows = toExportRows(records, columns);

  const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
  XLSX.utils.sheet_add_aoa(ws, [columns], { origin: 'A1' });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, name);
}

/** Generic aliases used by Rate & Ledger and Sales Return audits. */
export const resolveAuditExportColumns = resolveSalesReturnExportColumns;
export const downloadAuditExceptionXlsx = downloadSalesReturnExceptionXlsx;

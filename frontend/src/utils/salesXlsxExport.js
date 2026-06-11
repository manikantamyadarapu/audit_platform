import * as XLSX from 'xlsx';

/** Matches python-service `SALES_AUDIT_OUTPUT_COLUMNS` */
const SALES_XLSX_HEADERS = [
  { key: 'rowNumber', header: 'Row Num' },
  { key: 'voucherNo', header: 'Voucher No' },
  { key: 'partyName', header: 'Party / Customer' },
  { key: 'salesAccount', header: 'sales account' },
  { key: 'product', header: 'product' },
  { key: 'unitRate', header: 'unit rate' },
  { key: 'issues', header: 'Issues' },
  { key: 'messages', header: 'Messages' },
];

function formatMessages(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('; ') || '';
  return value ?? '';
}

function toExportRow(record) {
  const row = {};
  for (const { key } of SALES_XLSX_HEADERS) {
    if (key === 'issues') {
      row[key] = Array.isArray(record.issues) ? record.issues.join('; ') : (record.issues ?? '');
    } else if (key === 'messages') {
      row[key] = formatMessages(record.messages ?? record.rateMessage);
    } else if (key === 'salesAccount') {
      row[key] = record.originalExcelSalesAccount ?? record.salesAccount ?? '';
    } else if (key === 'product') {
      row[key] = record.originalExcelProduct ?? record.product ?? '';
    } else if (key === 'unitRate') {
      row[key] =
        record.originalExcelUnitRate ??
        record.unitRate ??
        record.uploadedUnitRate ??
        '';
    } else {
      row[key] = record[key] ?? '';
    }
  }
  return row;
}

/**
 * @param {Record<string, unknown>[]} records
 * @param {string} [filename]
 */
export function downloadSalesRecordsXlsx(records, filename) {
  if (!Array.isArray(records) || records.length === 0) {
    return;
  }
  const name = filename || `sales-rows-${Date.now()}.xlsx`;
  const keys = SALES_XLSX_HEADERS.map((c) => c.key);
  const headers = SALES_XLSX_HEADERS.map((c) => c.header);
  const rows = records.map(toExportRow);
  const ws = XLSX.utils.json_to_sheet(rows, { header: keys });
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales audit');
  XLSX.writeFile(wb, name);
}

export { SALES_XLSX_HEADERS, toExportRow, formatMessages };

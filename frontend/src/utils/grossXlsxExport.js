import * as XLSX from 'xlsx';

/** Matches python-service `GROSS_EXPORT_COLUMNS` with display headers */
const GROSS_XLSX_COLUMNS = [
  { key: 'rowNumber', header: 'SNo' },
  { key: 'voucherNo', header: 'Voucher No' },
  { key: 'manualGrossWeight', header: 'Manual Gross Wt.' },
  { key: 'autoGrossWeight', header: 'Auto Gross Wt.' },
  { key: 'difference', header: 'Difference in Gross Wt.' },
  { key: 'issues', header: 'Issue' },
];

/**
 * @param {Record<string, unknown>[]} records
 * @param {string} [filename]
 */
export function downloadGrossWeightRecordsXlsx(records, filename) {
  if (!Array.isArray(records) || records.length === 0) {
    return;
  }
  const name = filename || `gross-weight-rows-${Date.now()}.xlsx`;
  const rows = records.map((r) => {
    const o = {};
    for (const col of GROSS_XLSX_COLUMNS) {
      const c = col.key;
      if (c === 'issues') {
        o[col.header] = Array.isArray(r.issues) ? r.issues.join('; ') : (r.issues ?? '');
      } else {
        const v = r[c];
        o[col.header] = v === undefined || v === null ? '' : v;
      }
    }
    return o;
  });
  const headers = GROSS_XLSX_COLUMNS.map((c) => c.header);
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gross weight rows');
  XLSX.writeFile(wb, name);
}

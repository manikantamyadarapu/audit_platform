import * as XLSX from 'xlsx';

/** Matches python-service `GROSS_EXPORT_COLUMNS` */
const GROSS_XLSX_COLUMNS = [
  'rowNumber',
  'manualGrossWeight',
  'autoGrossWeight',
  'difference',
  'issues',
  'messages',
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
    for (const c of GROSS_XLSX_COLUMNS) {
      if (c === 'issues') {
        o[c] = Array.isArray(r.issues) ? r.issues.join('; ') : (r.issues ?? '');
      } else if (c === 'messages') {
        o[c] = Array.isArray(r.messages) ? r.messages.join('; ') : (r.messages ?? '');
      } else {
        const v = r[c];
        o[c] = v === undefined || v === null ? '' : v;
      }
    }
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(rows, { header: GROSS_XLSX_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gross weight rows');
  XLSX.writeFile(wb, name);
}

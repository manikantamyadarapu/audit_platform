import * as XLSX from 'xlsx';

/** Matches python-service `PAN_EXPORT_COLUMNS` order and fields */
const PAN_XLSX_COLUMNS = [
  'rowNumber',
  'date',
  'voucherNo',
  'party',
  'totalValue',
  'pan',
  'pan1',
  'addProof',
  'addProof2',
  'issues',
  'messages',
];

/**
 * @param {Record<string, unknown>[]} records
 * @param {string} [filename]
 */
export function downloadPanRecordsXlsx(records, filename) {
  if (!Array.isArray(records) || records.length === 0) {
    return;
  }
  const name = filename || `pan-rows-${Date.now()}.xlsx`;
  const rows = records.map((r) => {
    const o = {};
    for (const c of PAN_XLSX_COLUMNS) {
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
  const ws = XLSX.utils.json_to_sheet(rows, { header: PAN_XLSX_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PAN rows');
  XLSX.writeFile(wb, name);
}

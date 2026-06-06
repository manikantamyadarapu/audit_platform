import * as XLSX from 'xlsx';

/** Export workbook rows in the same column order as the uploaded file.
 *  Pass `columnOrder` (array of keys) to control order. `issues` will be skipped
 *  and `messages` will always be appended as the last column when present.
 */

/**
 * @param {Record<string, unknown>[]} records
 * @param {string} [filename]
 */
export function downloadPanRecordsXlsx(records, filename, columnOrder) {
  if (!Array.isArray(records) || records.length === 0) {
    return;
  }
  const name = filename || `pan-rows-${Date.now()}.xlsx`;
  // Determine column order: prefer caller-supplied, else first-record ordering.
  let cols = Array.isArray(columnOrder) && columnOrder.length ? Array.from(columnOrder) : Object.keys(records[0] || {});
  // Remove issues if present
  cols = cols.filter((c) => c !== 'issues');
  // Ensure messages is last
  const hasMessages = cols.includes('messages');
  cols = cols.filter((c) => c !== 'messages');
  if (hasMessages) cols.push('messages');

  const rows = records.map((r) => {
    const o = {};
    for (const c of cols) {
      if (c === 'messages') {
        o[c] = Array.isArray(r.messages) ? r.messages.join('; ') : (r.messages ?? '');
      } else {
        const v = r[c];
        o[c] = v === undefined || v === null ? '' : v;
      }
    }
    return o;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: cols });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PAN rows');
  XLSX.writeFile(wb, name);
}

import * as XLSX from 'xlsx';

/** Matches python-service `SALES_EXPORT_COLUMNS` */
const SALES_XLSX_COLUMNS = [
  'rowNumber',
  'voucherNo',
  'partyName',
  'sourceExcelRowNumber',
  'originalExcelSalesAccount',
  'originalExcelProduct',
  'originalExcelUnitRate',
  'validationSalesAccount',
  'validationProduct',
  'salesAccount',
  'product',
  'expectedSalesAccountCategory',
  'predictedCategory',
  'usedFuzzyClassification',
  'manualGrossWt',
  'autoGrossWt',
  'issues',
  'messages',
];

/**
 * @param {Record<string, unknown>[]} records
 * @param {string} [filename]
 */
export function downloadSalesRecordsXlsx(records, filename) {
  if (!Array.isArray(records) || records.length === 0) {
    return;
  }
  const name = filename || `sales-rows-${Date.now()}.xlsx`;
  const rows = records.map((r) => {
    const o = {};
    for (const c of SALES_XLSX_COLUMNS) {
      if (c === 'issues') {
        o[c] = Array.isArray(r.issues) ? r.issues.join('; ') : (r.issues ?? '');
      } else if (c === 'messages') {
        o[c] = Array.isArray(r.messages) ? r.messages.join('; ') : (r.messages ?? '');
      } else if (c === 'usedFuzzyClassification') {
        const v = r[c];
        if (v === true || v === false) {
          o[c] = v;
        } else {
          o[c] = v === undefined || v === null ? '' : v;
        }
      } else {
        const v = r[c];
        o[c] = v === undefined || v === null ? '' : v;
      }
    }
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(rows, { header: SALES_XLSX_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales rows');
  XLSX.writeFile(wb, name);
}

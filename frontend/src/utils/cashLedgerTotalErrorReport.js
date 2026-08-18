import {
  CASH_LEDGER_DISPLAY_HEADERS,
  CASH_LEDGER_TABLE_COLUMNS,
} from './cashLedgerTableColumns';
import {
  CASH_LEDGER_FILTER_LABELS,
  CASH_LEDGER_ISSUE_CODES,
  enrichCashLedgerRecord,
  filterCashLedgerRecords,
} from './cashLedgerRecordFilters';
import { downloadAuditMultiSheetXlsx } from './auditMultiSheetExcelExport';

const CASH_LEDGER_TOTAL_ERROR_SHEETS = [
  { sheetName: CASH_LEDGER_FILTER_LABELS.negativeCash, filter: 'negativeCash' },
  { sheetName: CASH_LEDGER_FILTER_LABELS.cashPayment, filter: 'cashPayment' },
  { sheetName: CASH_LEDGER_FILTER_LABELS.cashReceipt, filter: 'cashReceipt' },
];

/**
 * Download Cash_Ledger_Audit_Report.xlsx with one worksheet per audit rule.
 * @param {Record<string, unknown>[] | undefined} records
 */
export function downloadCashLedgerTotalErrorReport(records) {
  const enriched = (Array.isArray(records) ? records : []).map(enrichCashLedgerRecord);

  const sheets = {};
  for (const { sheetName, filter } of CASH_LEDGER_TOTAL_ERROR_SHEETS) {
    sheets[sheetName] = filterCashLedgerRecords(enriched, filter);
  }

  const columns = CASH_LEDGER_TABLE_COLUMNS.map((key) => ({
    key,
    header: CASH_LEDGER_DISPLAY_HEADERS[key] || key,
  }));

  downloadAuditMultiSheetXlsx({
    filename: 'Cash_Ledger_Audit_Report.xlsx',
    sheets,
    columns,
  });

  return {
    sheetCount: Object.keys(sheets).length,
    issueCodes: Object.values(CASH_LEDGER_ISSUE_CODES),
  };
}

import { columnHeaderLabel } from './auditTableColumns';

export const CASH_LEDGER_TABLE_COLUMNS = [
  'rowNumber',
  'date',
  'voucher_no',
  'branch',
  'contra_account',
  'debit',
  'credit',
  'balance',
  'Message',
];

export const CASH_LEDGER_DISPLAY_HEADERS = {
  rowNumber: 'Row No',
  date: 'Date',
  voucher_no: 'Voucher No',
  branch: 'Branch',
  contra_account: 'Contra Account',
  debit: 'Debit',
  credit: 'Credit',
  balance: 'Balance',
  Message: 'Message',
};

const HIDDEN_COLUMNS = new Set([
  'sno',
  'remarks',
  'division',
  'issues',
  'issueCode',
  'message',
  'severity',
  'messages',
  'source_excel_row_number',
  '__excel_row_number__',
]);

/**
 * Fixed column order for Cash Ledger audit results table and exports.
 * @param {Record<string, unknown>[]} records
 */
export function resolveCashLedgerColumnOrder(records) {
  if (!records?.length) return [...CASH_LEDGER_TABLE_COLUMNS];

  const keys = new Set();
  for (const row of records) {
    Object.keys(row ?? {}).forEach((key) => {
      if (!HIDDEN_COLUMNS.has(key) && !key.startsWith('__')) {
        keys.add(key);
      }
    });
  }

  return CASH_LEDGER_TABLE_COLUMNS.filter((key) => keys.has(key) || key === 'Message');
}

/**
 * @param {string} key
 */
export function cashLedgerColumnHeaderLabel(key) {
  return CASH_LEDGER_DISPLAY_HEADERS[key] ?? columnHeaderLabel(key);
}

/**
 * @param {string[]} columnOrder
 * @param {Record<string, unknown>[]} records
 */
export function buildCashLedgerExportColumnDefs(columnOrder, records) {
  const order = columnOrder?.length ? columnOrder : resolveCashLedgerColumnOrder(records);
  return order.map((key) => ({
    header: cashLedgerColumnHeaderLabel(key),
    accessor: (row) => {
      if (key === 'Message') {
        return row.Message ?? '';
      }
      const value = row[key];
      if (value == null || value === '') return '';
      if (Array.isArray(value)) return value.join('; ');
      return String(value);
    },
  }));
}

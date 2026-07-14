import { columnHeaderLabel } from './auditTableColumns';

export const NEGATIVE_BANK_TABLE_COLUMNS = [
  'rowNumber',
  'date',
  'voucher_no',
  'branch',
  'contra_account',
  'debit',
  'credit',
  'balance',
  'tillDate',
  'Message',
];

export const NEGATIVE_BANK_DISPLAY_HEADERS = {
  rowNumber: 'Row No',
  date: 'Date',
  voucher_no: 'Voucher No',
  branch: 'Branch',
  contra_account: 'Contra Account',
  debit: 'Debit',
  credit: 'Credit',
  balance: 'Balance',
  tillDate: 'Till Date',
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
 * @param {Record<string, unknown>[]} records
 */
export function resolveNegativeBankColumnOrder(records) {
  if (!records?.length) return [...NEGATIVE_BANK_TABLE_COLUMNS];

  const keys = new Set();
  for (const row of records) {
    Object.keys(row ?? {}).forEach((key) => {
      if (!HIDDEN_COLUMNS.has(key) && !key.startsWith('__')) {
        keys.add(key);
      }
    });
  }

  return NEGATIVE_BANK_TABLE_COLUMNS.filter((key) => keys.has(key) || key === 'Message');
}

/**
 * @param {string} key
 */
export function negativeBankColumnHeaderLabel(key) {
  return NEGATIVE_BANK_DISPLAY_HEADERS[key] ?? columnHeaderLabel(key);
}

/**
 * @param {string[]} columnOrder
 * @param {Record<string, unknown>[]} records
 */
export function buildNegativeBankExportColumnDefs(columnOrder, records) {
  const order = columnOrder?.length ? columnOrder : resolveNegativeBankColumnOrder(records);
  return order.map((key) => ({
    header: negativeBankColumnHeaderLabel(key),
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

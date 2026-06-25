import { resolveAuditColumnOrder } from './auditTableColumns';

const GROSS_HIDDEN_COLUMNS = new Set([
  'date',
  'party',
  'sno',
  'valueRowIndex',
  'voucherRowIndex',
  'value_row_index',
  'voucher_row_index',
  'issues',
  '_issues',
  'messages',
  '_rowNumber',
]);

const GROSS_COLUMN_PRIORITY = [
  'rowNumber',
  'voucherNo',
  'manualGrossWeight',
  'autoGrossWeight',
  'difference',
  'Message',
];

/**
 * Table/export columns for gross-weight audit rows.
 * @param {Record<string, unknown>[]} records
 */
export function resolveGrossWeightColumnOrder(records) {
  const order = resolveAuditColumnOrder(records).filter((key) => !GROSS_HIDDEN_COLUMNS.has(key));

  const priority = GROSS_COLUMN_PRIORITY.filter((key) => order.includes(key));
  const rest = order.filter((key) => !GROSS_COLUMN_PRIORITY.includes(key));

  return [...priority, ...rest];
}

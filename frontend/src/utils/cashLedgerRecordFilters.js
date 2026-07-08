/** Cash Ledger audit — issue codes, display messages, and table filters. */

export const CASH_LEDGER_ISSUE_CODES = {
  negativeCash: 'NEGATIVE_CASH_BALANCE',
  cashPayment: 'CASH_PAYMENT_GT_10000',
  cashReceipt: 'CASH_RECEIPT_GT_200000',
};

export const CASH_LEDGER_MESSAGES = {
  NEGATIVE_CASH_BALANCE: 'Negative Cash',
  CASH_PAYMENT_GT_10000: 'Cash Payments>=Rs. 10,000/-',
  CASH_RECEIPT_GT_200000: 'Cash Receipts>=Rs. 2,00,000/-',
};

export const CASH_LEDGER_FILTER_LABELS = {
  total: 'All rows',
  negativeCash: 'Negative Cash',
  cashPayment: 'Cash Payments >= ₹10,000',
  cashReceipt: 'Cash Receipts >= ₹2,00,000',
};

/**
 * @param {string[]} issueCodes
 */
export function cashLedgerMessageFromIssues(issueCodes) {
  if (!Array.isArray(issueCodes) || !issueCodes.length) return '';
  return issueCodes
    .map((code) => CASH_LEDGER_MESSAGES[code])
    .filter(Boolean)
    .join('; ');
}

/**
 * @param {Record<string, unknown>} row
 */
export function enrichCashLedgerRecord(row) {
  if (!row || typeof row !== 'object') return row;
  const issues = Array.isArray(row.issues)
    ? row.issues
    : row.issueCode
      ? [row.issueCode]
      : [];
  const message =
    (typeof row.Message === 'string' && row.Message) ||
    cashLedgerMessageFromIssues(issues) ||
    (typeof row.message === 'string' ? row.message : '');

  return {
    ...row,
    Message: message,
  };
}

/**
 * @param {Record<string, unknown>[] | undefined} records
 * @param {string} issueCode
 */
export function countCashLedgerRecordsByIssue(records, issueCode) {
  const list = Array.isArray(records) ? records : [];
  return list.filter((row) => {
    const issues = Array.isArray(row?.issues) ? row.issues : [];
    return issues.includes(issueCode) || row?.issueCode === issueCode;
  }).length;
}

/**
 * @param {Record<string, unknown>[] | undefined} records
 * @param {string | null} filter
 */
export function filterCashLedgerRecords(records, filter) {
  const list = Array.isArray(records) ? records.map(enrichCashLedgerRecord) : [];
  if (filter == null || filter === 'total') {
    return list;
  }

  const issueCode = CASH_LEDGER_ISSUE_CODES[filter];
  if (!issueCode) return list;

  const targetMessage = CASH_LEDGER_MESSAGES[issueCode];
  return list.filter((row) => {
    const issues = Array.isArray(row.issues) ? row.issues : [];
    if (issues.includes(issueCode) || row.issueCode === issueCode) return true;
    return String(row.Message || '').includes(targetMessage);
  });
}

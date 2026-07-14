/** Negative Bank audit — issue codes, display messages, and table filters. */

export const NEGATIVE_BANK_ISSUE_CODES = {
  negativeBank: 'NEGATIVE_BANK',
};

export const NEGATIVE_BANK_MESSAGES = {
  NEGATIVE_BANK: 'Negative Bank',
};

export const NEGATIVE_BANK_FILTER_LABELS = {
  total: 'All rows',
  errors: 'Error rows',
  negativeBank: 'Negative Bank',
};

/**
 * @param {string[]} issueCodes
 */
export function negativeBankMessageFromIssues(issueCodes) {
  if (!Array.isArray(issueCodes) || !issueCodes.length) return '';
  return issueCodes
    .map((code) => NEGATIVE_BANK_MESSAGES[code])
    .filter(Boolean)
    .join('; ');
}

/**
 * @param {Record<string, unknown>} row
 */
export function enrichNegativeBankRecord(row) {
  if (!row || typeof row !== 'object') return row;
  const issues = Array.isArray(row.issues)
    ? row.issues
    : row.issueCode
      ? [row.issueCode]
      : [];
  const message =
    (typeof row.Message === 'string' && row.Message) ||
    negativeBankMessageFromIssues(issues) ||
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
export function countNegativeBankRecordsByIssue(records, issueCode) {
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
export function filterNegativeBankRecords(records, filter) {
  const list = Array.isArray(records) ? records.map(enrichNegativeBankRecord) : [];
  if (filter == null || filter === 'total' || filter === 'errors') {
    return list;
  }

  const issueCode = NEGATIVE_BANK_ISSUE_CODES[filter];
  if (!issueCode) return list;

  const targetMessage = NEGATIVE_BANK_MESSAGES[issueCode];
  return list.filter((row) => {
    const issues = Array.isArray(row.issues) ? row.issues : [];
    if (issues.includes(issueCode) || row.issueCode === issueCode) return true;
    return String(row.Message || '').includes(targetMessage);
  });
}

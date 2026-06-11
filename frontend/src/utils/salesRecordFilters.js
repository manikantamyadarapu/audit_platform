/** Issue codes: python sales_audit_processor.py */

export const SALES_FILTER_LABELS = {
  total: 'All rows',
  errors: 'Error rows',
  accountVsProduct: 'Account vs product',
  mixedLedgers: 'Range deviations',
  accessoriesUnitRate: 'Accessories Unit Rate Check',
  caratGemErrors: 'Unit of measurement deviations',
  compliance: 'Compliance (no issues)',
};

const ACCOUNT_VS_PRODUCT_ISSUES = new Set([
  'INVALID_PRODUCT_MAPPING',
  'INVALID_LEDGER_MAPPING',
  'MISSING_PRODUCT_CATEGORY_FOR_VALIDATION',
  'PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT',
]);

const RATE_DEVIATION_ISSUES = new Set([
  'INVALID_RATE_DEVIATION',
  'INVALID_PRODUCT_PATTERN',
  'MISSING_UNIT_RATE',
  'MISSING_RATE_RULE',
  'RATE_DEVIATION_VIOLATION',
]);

const ACCESSORIES_UNIT_RATE_ISSUES = new Set(['INVALID_UNIT_RATE_RANGE', 'INVALID_FREE_QUANTITY']);

const CARAT_GEM_ISSUES = new Set(['INVALID_UOM']);

const HIGHER_RETURN_RATE_ISSUES = new Set([
  'HIGHER_SALES_RETURN_RATE',
  'PRODUCT_NOT_FOUND_IN_SALES',
]);

/**
 * @param {Record<string, unknown>} record
 * @returns {string[]}
 */
export function recordIssueCodes(record) {
  if (Array.isArray(record?.issues) && record.issues.length) {
    return record.issues.map((code) => String(code).trim()).filter(Boolean);
  }
  const message = record?.Message;
  if (message == null || message === '') return [];
  return String(message)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown>[] | undefined} records
 * @param {keyof typeof SALES_FILTER_LABELS | null | 'total'} filter
 * @returns {Record<string, unknown>[]}
 */
export function filterSalesRecords(records, filter) {
  const list = Array.isArray(records) ? records : [];
  if (filter == null || filter === 'total') {
    return list;
  }
  if (filter === 'errors' || filter === 'exceptions') {
    return list.filter((r) => recordIssueCodes(r).length > 0);
  }
  if (filter === 'accountVsProduct') {
    return list.filter((r) => recordIssueCodes(r).some((code) => ACCOUNT_VS_PRODUCT_ISSUES.has(code)));
  }
  if (filter === 'mixedLedgers') {
    return list.filter((r) => recordIssueCodes(r).some((code) => RATE_DEVIATION_ISSUES.has(code)));
  }
  if (filter === 'accessoriesUnitRate') {
    return list.filter((r) =>
      recordIssueCodes(r).some((code) => ACCESSORIES_UNIT_RATE_ISSUES.has(code))
    );
  }
  if (filter === 'caratGemErrors') {
    return list.filter((r) => recordIssueCodes(r).some((code) => CARAT_GEM_ISSUES.has(code)));
  }
  if (filter === 'compliance') {
    return list.filter((r) => recordIssueCodes(r).length === 0);
  }
  if (filter === 'validationErrors') {
    return list.filter((r) => {
      const codes = recordIssueCodes(r);
      return codes.length > 0 && codes.some((code) => !HIGHER_RETURN_RATE_ISSUES.has(code));
    });
  }
  if (filter === 'higherReturnRate') {
    return list.filter((r) =>
      recordIssueCodes(r).some((code) => HIGHER_RETURN_RATE_ISSUES.has(code))
    );
  }
  return list;
}

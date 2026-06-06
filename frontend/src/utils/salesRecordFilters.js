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

const ACCESSORIES_UNIT_RATE_ISSUES = new Set(['INVALID_UNIT_RATE_RANGE']);

const CARAT_GEM_ISSUES = new Set(['INVALID_UOM']);

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
  if (filter === 'errors') {
    return list.filter((r) => (Array.isArray(r.issues) ? r.issues.length : 0) > 0);
  }
  if (filter === 'accountVsProduct') {
    return list.filter(
      (r) =>
        Array.isArray(r.issues) &&
        r.issues.some((code) => ACCOUNT_VS_PRODUCT_ISSUES.has(code))
    );
  }
  if (filter === 'mixedLedgers') {
    return list.filter(
      (r) =>
        Array.isArray(r.issues) &&
        r.issues.some((code) => RATE_DEVIATION_ISSUES.has(code))
    );
  }
  if (filter === 'accessoriesUnitRate') {
    return list.filter(
      (r) =>
        Array.isArray(r.issues) &&
        r.issues.some((code) => ACCESSORIES_UNIT_RATE_ISSUES.has(code))
    );
  }
  if (filter === 'caratGemErrors') {
    return list.filter(
      (r) =>
        Array.isArray(r.issues) &&
        r.issues.some((code) => CARAT_GEM_ISSUES.has(code))
    );
  }
  if (filter === 'compliance') {
    return list.filter((r) => !Array.isArray(r.issues) || r.issues.length === 0);
  }
  return list;
}

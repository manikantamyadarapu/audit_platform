/** Issue codes: python gross_weight_processor.py */

export const GROSS_FILTER_LABELS = {
  total: 'All rows',
  errors: 'Error rows',
  grossMismatch: 'Manual ≠ auto',
  differenceViolation: 'Difference ≠ 0',
  negativeWeight: 'Negative values',
  compliance: 'Compliance (no issues)',
};

/**
 * @param {Record<string, unknown>[] | undefined} records
 * @param {string | null} filter
 * @returns {Record<string, unknown>[]}
 */
export function filterGrossWeightRecords(records, filter) {
  const list = Array.isArray(records) ? records : [];
  if (filter == null || filter === 'total') {
    return list;
  }
  if (filter === 'errors') {
    return list.filter((r) => (Array.isArray(r.issues) ? r.issues.length : 0) > 0);
  }
  if (filter === 'grossMismatch') {
    return list.filter((r) => Array.isArray(r.issues) && r.issues.includes('GROSS_WEIGHT_MISMATCH'));
  }
  if (filter === 'differenceViolation') {
    return list.filter(
      (r) => Array.isArray(r.issues) && r.issues.includes('GROSS_WEIGHT_DIFFERENCE_VIOLATION')
    );
  }
  if (filter === 'negativeWeight') {
    return list.filter((r) => Array.isArray(r.issues) && r.issues.includes('NEGATIVE_WEIGHT_VALUES'));
  }
  if (filter === 'compliance') {
    return list.filter((r) => !Array.isArray(r.issues) || r.issues.length === 0);
  }
  return list;
}

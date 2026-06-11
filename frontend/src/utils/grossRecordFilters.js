/** Issue codes: python gross_weight_processor.py */

export const GROSS_FILTER_LABELS = {
  total: 'All rows',
  mismatch: 'Weight mismatches',
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
  if (filter === 'mismatch') {
    return list.filter((r) => (Array.isArray(r.issues) ? r.issues.length : 0) > 0);
  }
  if (filter === 'compliance') {
    return list.filter((r) => !Array.isArray(r.issues) || r.issues.length === 0);
  }
  return list;
}

/** Issue codes: python gross_weight_processor.py */

export const GROSS_FILTER_LABELS = {
  total: 'All rows',
  mismatch: 'gross weight mismatch',
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
    return list
      .filter((r) => (Array.isArray(r.issues) ? r.issues.length : 0) > 0)
      .map((row) => ({
        ...row,
        Message: GROSS_FILTER_LABELS.mismatch,
        messages: [GROSS_FILTER_LABELS.mismatch],
      }));
  }
  if (filter === 'compliance') {
    return list.filter((r) => !Array.isArray(r.issues) || r.issues.length === 0);
  }
  return list;
}

/** Issue codes: python gross_weight_processor.py */

export const GROSS_FILTER_LABELS = {
  total: 'All rows',
  errors: 'Error rows',
  positiveValues: 'Positive values',
  negativeWeight: 'Negative values',
  compliance: 'Compliance (no issues)',
};

function isNegativeDifference(record) {
  const difference = Number(record?.difference);
  return Number.isFinite(difference) && difference < 0;
}

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
  if (filter === 'positiveValues') {
    return list.filter((r) => !isNegativeDifference(r));
  }
  if (filter === 'negativeWeight') {
    return list.filter((r) => isNegativeDifference(r));
  }
  if (filter === 'compliance') {
    return list.filter((r) => !Array.isArray(r.issues) || r.issues.length === 0);
  }
  return list;
}

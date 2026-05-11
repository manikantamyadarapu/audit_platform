/** @typedef {'total' | 'errors' | 'missingPan' | 'invalidPan' | 'missingAddress' | 'compliance' | null} PanCardFilter */

/** @type {Record<NonNullable<PanCardFilter>, string>} */
export const PAN_FILTER_LABELS = {
  total: 'All rows',
  errors: 'Error rows',
  missingPan: 'Missing PAN (> ₹2L)',
  invalidPan: 'Invalid PAN format',
  missingAddress: 'Missing address (> ₹50k)',
  compliance: 'Compliance (no issues)',
};

/**
 * @param {Record<string, unknown>[] | undefined} records
 * @param {PanCardFilter} filter
 * @returns {Record<string, unknown>[]}
 */
export function filterPanRecords(records, filter) {
  const list = Array.isArray(records) ? records : [];
  if (filter == null || filter === 'total') {
    return list;
  }
  if (filter === 'errors') {
    return list.filter((r) => (Array.isArray(r.issues) ? r.issues.length : 0) > 0);
  }
  if (filter === 'missingPan') {
    return list.filter((r) => Array.isArray(r.issues) && r.issues.includes('MISSING_PAN_ABOVE_2L'));
  }
  if (filter === 'invalidPan') {
    return list.filter((r) => Array.isArray(r.issues) && r.issues.includes('INVALID_PAN_FORMAT'));
  }
  if (filter === 'missingAddress') {
    return list.filter((r) => Array.isArray(r.issues) && r.issues.includes('MISSING_ADDRESS_PROOF_ABOVE_50K'));
  }
  if (filter === 'compliance') {
    return list.filter((r) => !Array.isArray(r.issues) || r.issues.length === 0);
  }
  return list;
}

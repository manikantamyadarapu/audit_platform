/** @typedef {'total' | 'validPan' | 'invalidPan' | 'noPanNoForm60' | 'noPanForm60Available' | 'noPanInvalidForm60' | 'gst50kAddressMissing' | 'incorrectAddressFormat' | 'validAddressFormat' | null} PanCardFilter */

/** @type {Record<NonNullable<PanCardFilter>, string>} */
export const PAN_FILTER_LABELS = {
  total: 'Eligible PAN rows',
  validPan: 'valid pan',
  invalidPan: 'incorrect pan format',
  noPanNoForm60: 'no pan & no form 60',
  noPanForm60Available: 'form 60 available',
  noPanInvalidForm60: 'no pan & invalid form 60',
  gst50kAddressMissing: 'addressing missing',
  incorrectAddressFormat: 'incorrect address format',
  validAddressFormat: 'valid address format',
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
  if (filter === 'validPan') {
    return list.filter((r) => r.panReport === 'validPan');
  }
  if (filter === 'invalidPan') {
    return list.filter((r) => r.panReport === 'invalidPan');
  }
  if (filter === 'noPanNoForm60') {
    return list.filter((r) => r.panReport === 'noPanNoForm60');
  }
  if (filter === 'noPanForm60Available') {
    return list.filter((r) => r.panReport === 'noPanForm60Available');
  }
  if (filter === 'noPanInvalidForm60') {
    return list.filter((r) => r.panReport === 'noPanInvalidForm60');
  }
  if (filter === 'gst50kAddressMissing') {
    return list.filter((r) => r.addressReport === 'gst50kAddressMissing');
  }
  if (filter === 'incorrectAddressFormat') {
    return list.filter((r) => r.addressReport === 'incorrectAddressFormat');
  }
  if (filter === 'validAddressFormat') {
    return list.filter((r) => r.addressReport === 'validAddressFormat');
  }

  return list;
}

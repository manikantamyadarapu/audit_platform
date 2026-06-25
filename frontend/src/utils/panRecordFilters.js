/** @typedef {'total' | 'validPan' | 'invalidPan' | 'noPanNoForm60' | 'noPanForm60Available' | 'noPanInvalidForm60' | 'gst50kAddressMissing' | 'incorrectAddressFormat' | 'validAddressFormat' | null} PanCardFilter */

/** Business-approved row messages keyed by PAN report type. */
export const PAN_REPORT_MESSAGES = {
  validPan: 'valid pan',
  invalidPan: 'incorrect pan format',
  noPanNoForm60: 'no pan & no form 60',
  noPanForm60Available: 'no pan and form 60 available',
  noPanInvalidForm60: 'no pan & invalid form 60',
};

/** Business-approved row messages keyed by address report type. */
export const ADDRESS_REPORT_MESSAGES = {
  gst50kAddressMissing: 'gst >= 50k address missing',
  incorrectAddressFormat: 'incorrect address format',
  validAddressFormat: 'valid address format',
};

/** Widget filter key → exact Message column text. */
export const PAN_WIDGET_MESSAGES = {
  ...PAN_REPORT_MESSAGES,
  ...ADDRESS_REPORT_MESSAGES,
};

/** @type {Record<NonNullable<PanCardFilter>, string>} */
export const PAN_FILTER_LABELS = {
  total: 'Eligible PAN rows',
  ...PAN_WIDGET_MESSAGES,
};

/**
 * @param {Record<string, unknown> | undefined} record
 * @returns {string}
 */
export function panMessageForRecord(record) {
  if (!record) return '';
  const panReport = record.panReport;
  const addressReport = record.addressReport;
  if (typeof panReport === 'string' && PAN_REPORT_MESSAGES[panReport]) {
    return PAN_REPORT_MESSAGES[panReport];
  }
  if (typeof addressReport === 'string' && ADDRESS_REPORT_MESSAGES[addressReport]) {
    return ADDRESS_REPORT_MESSAGES[addressReport];
  }
  return '';
}

/**
 * @param {Record<string, unknown> | undefined} record
 * @param {PanCardFilter} filter
 * @returns {string}
 */
export function panMessageForActiveFilter(record, filter) {
  if (filter && filter !== 'total' && PAN_WIDGET_MESSAGES[filter]) {
    return PAN_WIDGET_MESSAGES[filter];
  }
  return panMessageForRecord(record);
}

/**
 * @param {Record<string, unknown>[] | undefined} records
 * @param {PanCardFilter} filter
 * @returns {Record<string, unknown>[]}
 */
export function applyPanFilterDisplayMessage(records, filter) {
  const list = Array.isArray(records) ? records : [];
  if (!filter || filter === 'total') {
    return list.map((row) => ({
      ...row,
      Message: panMessageForRecord(row),
    }));
  }
  return list.map((row) => ({
    ...row,
    Message: panMessageForActiveFilter(row, filter),
  }));
}

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

/**
 * @param {Record<string, unknown>[] | undefined} records
 * @param {PanCardFilter} filter
 * @returns {Record<string, unknown>[]}
 */
export function filterPanRecordsForDisplay(records, filter) {
  return applyPanFilterDisplayMessage(filterPanRecords(records, filter), filter);
}

const { validateExportInvalidBody } = require('./panExport.validator');

/**
 * @param {unknown} body
 * @returns {{ ok: true, records: object[] } | { ok: false, detail: string }}
 */
function validateCashLedgerExportInvalidBody(body) {
  return validateExportInvalidBody(body);
}

module.exports = { validateCashLedgerExportInvalidBody, validateExportInvalidBody };

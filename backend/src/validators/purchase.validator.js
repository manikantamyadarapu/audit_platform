const { validateExportInvalidBody } = require('./panExport.validator');

/**
 * @param {unknown} body
 * @returns {{ ok: true, records: object[] } | { ok: false, detail: string }}
 */
function validatePurchaseExportInvalidBody(body) {
  return validateExportInvalidBody(body);
}

module.exports = { validatePurchaseExportInvalidBody, validateExportInvalidBody };

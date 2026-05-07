/**
 * Python service facade — delegates to the shared Axios client.
 * Gross-weight and other processors can be routed here for clarity in controllers.
 */
const pythonClient = require('./pythonClient.service');

/**
 * @param {Buffer} fileBuffer
 * @param {string} originalname
 * @param {string} [mimetype]
 * @param {{ requestId?: string }} [options]
 */
async function validateGrossWeight(fileBuffer, originalname, mimetype, options = {}) {
  return pythonClient.postGrossWeightValidate(fileBuffer, originalname, mimetype, options);
}

/**
 * @param {Array<Record<string, unknown>>} records
 * @param {{ requestId?: string }} [options]
 */
async function exportInvalidGrossWeightRows(records, options = {}) {
  return pythonClient.postGrossWeightExportInvalid(records, options);
}

/**
 * @param {Buffer} fileBuffer
 * @param {string} originalname
 * @param {string} [mimetype]
 * @param {{ requestId?: string }} [options]
 */
async function validateSalesAudit(fileBuffer, originalname, mimetype, options = {}) {
  return pythonClient.postSalesAuditValidate(fileBuffer, originalname, mimetype, options);
}

/**
 * @param {Array<Record<string, unknown>>} records
 * @param {{ requestId?: string }} [options]
 */
async function exportInvalidSalesAuditRows(records, options = {}) {
  return pythonClient.postSalesAuditExportInvalid(records, options);
}

module.exports = {
  validateGrossWeight,
  exportInvalidGrossWeightRows,
  validateSalesAudit,
  exportInvalidSalesAuditRows,
};

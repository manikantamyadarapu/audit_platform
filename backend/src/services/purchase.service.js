/**
 * Purchase ledger audit currently thin-wraps the same Python/sales process
 * endpoints used for sales ledgers (purchase uses the sales API today).
 */
const pythonClient = require('./pythonClient.service');

/**
 * @param {Buffer} fileBuffer
 * @param {string} originalname
 * @param {string} [mimetype]
 * @param {{ requestId?: string }} [options]
 */
async function validatePurchase(fileBuffer, originalname, mimetype, options = {}) {
  return pythonClient.postSalesValidate(fileBuffer, originalname, mimetype, options);
}

/**
 * @param {object[]} records
 * @param {{ requestId?: string }} [options]
 */
async function exportInvalidPurchase(records, options = {}) {
  return pythonClient.postSalesExportInvalid(records, options);
}

module.exports = { validatePurchase, exportInvalidPurchase };

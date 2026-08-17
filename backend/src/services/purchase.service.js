/**
 * Purchase Rate & Ledger — uses dedicated purchase Python endpoint and
 * persists product averages under the PURCHASE audit type (baseline for Purchase Return).
 */
const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const { AUDIT_KEYS } = require('../constants/notifications');
const salesProductAverageRepository = require('../repositories/salesProductAverage.repository');
const logger = require('../utils/logger');

/**
 * @param {import('express').Request} req
 * @returns {Promise<{ data: object, auditRunId: number | null }>}
 */
async function validatePurchase(req) {
  const { file, requestId, user } = req;

  const data = await pythonClient.postPurchaseValidate(
    file.buffer,
    file.originalname,
    file.mimetype,
    { requestId }
  );

  let auditRunId = null;
  if (user?.id) {
    try {
      auditRunId = await persistPurchaseAuditProductAverages({
        userId: user.id,
        fileName: file.originalname,
        pythonResult: data,
      });
    } catch (persistError) {
      logger.error('Purchase audit product averages persist failed', {
        requestId,
        userId: user.id,
        message: persistError.message,
      });
    }
  }

  if (user?.id) {
    auditNotification
      .notifyAuditCompleted(user.id, AUDIT_KEYS.PURCHASE, file.originalname, data)
      .catch(() => {});
  }

  return { data, auditRunId };
}

/**
 * Legacy buffer-based entry used by thin controller callers.
 * @param {Buffer} fileBuffer
 * @param {string} originalname
 * @param {string} [mimetype]
 * @param {{ requestId?: string }} [options]
 */
async function validatePurchaseBuffer(fileBuffer, originalname, mimetype, options = {}) {
  return pythonClient.postPurchaseValidate(fileBuffer, originalname, mimetype, options);
}

/**
 * @param {object[]} records
 * @param {{ requestId?: string }} [options]
 */
async function exportInvalidPurchase(records, options = {}) {
  return pythonClient.postPurchaseExportInvalid(records, options);
}

async function persistPurchaseAuditProductAverages({ userId, fileName, pythonResult }) {
  if (!userId) return null;

  const productAverages = pythonResult?.productAverages ?? [];
  const auditRun = await salesProductAverageRepository.createAuditRunWithProductAverages({
    uploadedBy: userId,
    fileName,
    totalRows: pythonResult?.totalRows ?? 0,
    invalidRows: pythonResult?.errorRows ?? 0,
    productAverages,
    pythonResult,
    auditCode: 'PURCHASE',
  });

  return auditRun.id;
}

module.exports = {
  validatePurchase,
  validatePurchaseBuffer,
  exportInvalidPurchase,
  persistPurchaseAuditProductAverages,
};

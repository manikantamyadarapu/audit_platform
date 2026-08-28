const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const auditRunPersistence = require('./auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');

/**
 * Process Financials Sales & Purchases pivots.
 *
 * @param {import('express').Request} req
 * @param {object} salesFile
 * @param {object} purchasesFile
 * @returns {Promise<{ data: object, auditRunId: number | null }>}
 */
async function processFinancialsPivot(req, salesFile, purchasesFile) {
  const { requestId, user } = req;

  const data = await pythonClient.postFinancialsPivot(salesFile, purchasesFile, { requestId });

  const fileNames = [salesFile.originalname, purchasesFile.originalname].filter(Boolean).join(', ');
  const fileMetadata = {
    originalName: fileNames,
    storagePath: null,
    fileHash: null,
    fileSize: (salesFile.size || 0) + (purchasesFile.size || 0),
  };

  const performanceMetrics = {
    processingTimeMs: data.processingTimeMs || data.executionTiming?.loadMs || null,
    memoryUsageMb: data.memoryUsageMb || null,
    rowsPerSecond: data.rowsPerSecond || null,
    cpuUsagePercent: data.cpuUsagePercent || null,
  };

  const auditRunId = await auditRunPersistence.tryPersistAuditRun(
    req,
    AUDIT_KEYS.FINANCIALS_PIVOT,
    fileNames,
    data,
    fileMetadata,
    performanceMetrics
  );

  if (user?.id) {
    auditNotification
      .notifyAuditCompleted(user.id, AUDIT_KEYS.FINANCIALS_PIVOT, fileNames, data)
      .catch(() => {});
  }

  return { data, auditRunId };
}

/**
 * @param {import('express').Request} req
 * @param {Error} err
 */
function notifyFinancialsPivotFailure(req, err) {
  if (!req.user?.id) return;
  const fileNames = [
    req.files?.salesFile?.[0]?.originalname,
    req.files?.purchasesFile?.[0]?.originalname,
  ]
    .filter(Boolean)
    .join(', ');
  auditNotification
    .notifyAuditFailed(req.user.id, AUDIT_KEYS.FINANCIALS_PIVOT, fileNames, err.message)
    .catch(() => {});
}

async function exportFinancialsPivots(req, payload) {
  return pythonClient.postFinancialsExportPivots(payload, { requestId: req.requestId });
}

async function exportClosingStockTemplate(req, payload) {
  return pythonClient.postFinancialsExportClosingStock(payload, { requestId: req.requestId });
}

module.exports = {
  processFinancialsPivot,
  notifyFinancialsPivotFailure,
  exportFinancialsPivots,
  exportClosingStockTemplate,
};

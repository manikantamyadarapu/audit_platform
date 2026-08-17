const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const auditRunPersistence = require('./auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');

/**
 * Validate a Cash Ledger workbook: forward to Python, persist the audit
 * run, and fire completion/failure notifications.
 *
 * @param {import('express').Request} req
 * @returns {Promise<{ data: object, auditRunId: number | null }>}
 */
async function validateCashLedger(req) {
  const { file, requestId, user } = req;

  const data = await pythonClient.postCashLedgerValidate(
    file.buffer,
    file.originalname,
    file.mimetype,
    { requestId }
  );

  const fileMetadata = {
    originalName: file.originalname,
    storagePath: null,
    fileHash: null,
    fileSize: file.size,
  };

  const performanceMetrics = {
    processingTimeMs: data.processingTimeMs || null,
    memoryUsageMb: data.memoryUsageMb || null,
    rowsPerSecond: data.rowsPerSecond || null,
    cpuUsagePercent: data.cpuUsagePercent || null,
  };

  const auditRunId = await auditRunPersistence.tryPersistAuditRun(
    req,
    AUDIT_KEYS.CASH_LEDGER,
    file.originalname,
    data,
    fileMetadata,
    performanceMetrics
  );

  if (user?.id) {
    auditNotification
      .notifyAuditCompleted(user.id, AUDIT_KEYS.CASH_LEDGER, file.originalname, data)
      .catch(() => {});
  }

  return { data, auditRunId };
}

/**
 * @param {import('express').Request} req
 * @param {Error} err
 */
function notifyCashLedgerFailure(req, err) {
  if (!req.user?.id) return;
  auditNotification
    .notifyAuditFailed(req.user.id, AUDIT_KEYS.CASH_LEDGER, req.file?.originalname, err.message)
    .catch(() => {});
}

/**
 * @param {object[]} records
 * @param {{ requestId?: string }} [options]
 */
async function exportInvalidCashLedger(records, options = {}) {
  return pythonClient.postCashLedgerExportInvalid(records, options);
}

module.exports = { validateCashLedger, notifyCashLedgerFailure, exportInvalidCashLedger };

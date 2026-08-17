const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const auditRunPersistence = require('./auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');

/**
 * Validate Section 44AB Cash & Bank files: forward to Python, persist the audit
 * run, and fire completion/failure notifications.
 *
 * @param {import('express').Request} req
 * @param {Array} cashFiles
 * @param {Array} bankFiles
 * @returns {Promise<{ data: object, auditRunId: number | null }>}
 */
async function validateSection44AB(req, cashFiles, bankFiles) {
  const { requestId, user } = req;

  const data = await pythonClient.postSection44ABValidate(
    cashFiles,
    bankFiles,
    { requestId }
  );

  // Build file metadata from all files
  const allFiles = [...cashFiles, ...bankFiles];
  const totalFileSize = allFiles.reduce((sum, file) => sum + (file.size || 0), 0);
  const fileNames = allFiles.map(f => f.originalname).join(', ');

  const fileMetadata = {
    originalName: fileNames,
    storagePath: null,
    fileHash: null,
    fileSize: totalFileSize,
  };

  const performanceMetrics = {
    processingTimeMs: data.processingTimeMs || data.executionTiming?.loadMs || null,
    memoryUsageMb: data.memoryUsageMb || null,
    rowsPerSecond: data.rowsPerSecond || null,
    cpuUsagePercent: data.cpuUsagePercent || null,
  };

  const auditRunId = await auditRunPersistence.tryPersistAuditRun(
    req,
    AUDIT_KEYS.SECTION44AB,
    fileNames,
    data,
    fileMetadata,
    performanceMetrics
  );

  if (user?.id) {
    auditNotification
      .notifyAuditCompleted(user.id, AUDIT_KEYS.SECTION44AB, fileNames, data)
      .catch(() => {});
  }

  return { data, auditRunId };
}

/**
 * @param {import('express').Request} req
 * @param {Error} err
 */
function notifySection44ABFailure(req, err) {
  if (!req.user?.id) return;
  const fileNames = [
    ...(req.files?.cashFiles || []).map(f => f.originalname),
    ...(req.files?.bankFiles || []).map(f => f.originalname),
  ].join(', ');
  auditNotification
    .notifyAuditFailed(req.user.id, AUDIT_KEYS.SECTION44AB, fileNames, err.message)
    .catch(() => {});
}

module.exports = { validateSection44AB, notifySection44ABFailure };

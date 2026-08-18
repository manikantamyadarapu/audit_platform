const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const auditRunPersistence = require('./auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');

/**
 * Validate a PAN workbook: forward to Python, persist the audit run, and
 * fire completion/failure notifications.
 *
 * @param {import('express').Request} req
 * @returns {Promise<{ data: object, auditRunId: number | null }>}
 */
async function validatePan(req) {
  const { file, requestId, user } = req;

  const data = await pythonClient.postPanValidate(file.buffer, file.originalname, file.mimetype, {
    requestId,
  });

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
    AUDIT_KEYS.PAN,
    file.originalname,
    data,
    fileMetadata,
    performanceMetrics
  );

  if (user?.id) {
    auditNotification.notifyAuditCompleted(user.id, AUDIT_KEYS.PAN, file.originalname, data).catch(() => {});
  }

  return { data, auditRunId };
}

/**
 * @param {import('express').Request} req
 * @param {Error} err
 */
function notifyPanFailure(req, err) {
  if (!req.user?.id) return;
  auditNotification
    .notifyAuditFailed(req.user.id, AUDIT_KEYS.PAN, req.file?.originalname, err.message)
    .catch(() => {});
}

/**
 * @param {object[]} records
 * @param {{ requestId?: string }} [options]
 */
async function exportInvalidPan(records, options = {}) {
  return pythonClient.postPanExportInvalid(records, options);
}

module.exports = { validatePan, notifyPanFailure, exportInvalidPan };

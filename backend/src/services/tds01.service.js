const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const auditRunPersistence = require('./auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');

/**
 * @param {import('express').Request} req
 * @returns {Promise<{ data: object, auditRunId: number | null }>}
 */
async function validateTds01(req) {
  const { file, requestId, user } = req;

  const data = await pythonClient.postTds01Validate(
    file.buffer,
    file.originalname,
    file.mimetype,
    { requestId }
  );

  const auditRunId = await auditRunPersistence.tryPersistAuditRun(
    req,
    AUDIT_KEYS.TDS_01,
    file.originalname,
    data
  );

  if (user?.id) {
    auditNotification
      .notifyAuditCompleted(user.id, AUDIT_KEYS.TDS_01, file.originalname, data)
      .catch(() => {});
  }

  return { data, auditRunId };
}

/**
 * @param {import('express').Request} req
 * @param {Error} err
 */
function notifyTds01Failure(req, err) {
  if (!req.user?.id) return;
  auditNotification
    .notifyAuditFailed(req.user.id, AUDIT_KEYS.TDS_01, req.file?.originalname, err.message)
    .catch(() => {});
}

/**
 * @param {{ detailedRecords: object[], summaryRecords: object[] }} payload
 * @param {{ requestId?: string }} [options]
 */
async function exportTds01(payload, options = {}) {
  return pythonClient.postTds01Export(payload, options);
}

module.exports = { validateTds01, notifyTds01Failure, exportTds01 };

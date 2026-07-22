const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const auditRunPersistence = require('./auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');

function pickFile(files, field) {
  const list = files?.[field];
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

/**
 * Validate Party Wise TDS Summary: forward dual uploads to Python, persist
 * the audit run, and fire completion notifications.
 *
 * @param {import('express').Request} req
 * @returns {Promise<{ data: object, auditRunId: number | null }>}
 */
async function validatePartyWiseTds(req) {
  const purchaseFile = pickFile(req.files, 'purchaseGoodsFile');
  const payableFile = pickFile(req.files, 'tdsPayableFile');
  const { requestId, user } = req;

  const data = await pythonClient.postPartyWiseTdsValidate(
    purchaseFile.buffer,
    purchaseFile.originalname,
    purchaseFile.mimetype,
    payableFile.buffer,
    payableFile.originalname,
    payableFile.mimetype,
    { requestId }
  );

  const displayName = `${purchaseFile.originalname} + ${payableFile.originalname}`;
  const auditRunId = await auditRunPersistence.tryPersistAuditRun(
    req,
    AUDIT_KEYS.PARTY_WISE_TDS,
    displayName,
    data
  );

  if (user?.id) {
    auditNotification
      .notifyAuditCompleted(user.id, AUDIT_KEYS.PARTY_WISE_TDS, displayName, data)
      .catch(() => {});
  }

  return { data, auditRunId };
}

/**
 * @param {import('express').Request} req
 * @param {Error} err
 */
function notifyPartyWiseTdsFailure(req, err) {
  if (!req.user?.id) return;
  auditNotification
    .notifyAuditFailed(
      req.user.id,
      AUDIT_KEYS.PARTY_WISE_TDS,
      req.files?.purchaseGoodsFile?.[0]?.originalname,
      err.message
    )
    .catch(() => {});
}

/**
 * @param {{ purchaseSummary: object[], payableSummary: object[] }} payload
 * @param {{ requestId?: string }} [options]
 */
async function exportPartyWiseTds(payload, options = {}) {
  return pythonClient.postPartyWiseTdsExport(payload, options);
}

module.exports = {
  pickFile,
  validatePartyWiseTds,
  notifyPartyWiseTdsFailure,
  exportPartyWiseTds,
};

const pythonClient = require('../services/pythonClient.service');
const auditNotification = require('../services/auditNotification.service');
const auditRunPersistence = require('../services/auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');
const { validateExportInvalidBody } = require('../validators/panExport.validator');
const logger = require('../utils/logger');

async function validateNegativeBank(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file"',
        requestId: req.requestId,
      });
    }

    logger.info('Negative Bank: forwarding to Python', {
      requestId: req.requestId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    const data = await pythonClient.postNegativeBankValidate(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      { requestId: req.requestId }
    );

    const auditRunId = await auditRunPersistence.tryPersistAuditRun(
      req,
      AUDIT_KEYS.NEGATIVE_BANK,
      req.file.originalname,
      data
    );

    if (req.user?.id) {
      auditNotification
        .notifyAuditCompleted(req.user.id, AUDIT_KEYS.NEGATIVE_BANK, req.file.originalname, data)
        .catch(() => {});
    }

    return res.json({ ...data, auditRunId });
  } catch (err) {
    if (req.user?.id) {
      auditNotification
        .notifyAuditFailed(
          req.user.id,
          AUDIT_KEYS.NEGATIVE_BANK,
          req.file?.originalname,
          err.message
        )
        .catch(() => {});
    }
    return next(err);
  }
}

async function exportInvalidNegativeBank(req, res, next) {
  try {
    const parsed = validateExportInvalidBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('Negative Bank export-invalid: forwarding to Python', {
      requestId: req.requestId,
      recordCount: parsed.records.length,
    });

    const { buffer, contentDisposition, contentType } = await pythonClient.postNegativeBankExportInvalid(
      parsed.records,
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="negative-bank-invalid-rows.xlsx"');
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  validateNegativeBank,
  exportInvalidNegativeBank,
};

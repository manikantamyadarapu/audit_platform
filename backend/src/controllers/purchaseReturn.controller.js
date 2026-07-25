const purchaseReturnService = require('../services/purchaseReturn.service');
const {
  validateRateComparisonExportBody,
  validateExceptionsExportBody,
} = require('../validators/salesReturn.validator');
const logger = require('../utils/logger');

async function validate(req, res, next) {
  try {
    const returnFile = req.file ?? req.files?.purchaseReturnFile?.[0];

    if (!returnFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file" (Purchase Return Audit File)',
        requestId: req.requestId,
      });
    }

    logger.info('Purchase return audit: forwarding to Python', {
      requestId: req.requestId,
      returnFilename: returnFile.originalname,
      returnSize: returnFile.size,
    });

    const data = await purchaseReturnService.runAudit(
      returnFile.buffer,
      returnFile.originalname,
      returnFile.mimetype,
      { requestId: req.requestId }
    );
    return res.json(data);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({
        success: false,
        detail: err.message,
        code: err.code,
        requestId: req.requestId,
      });
    }
    return next(err);
  }
}

async function runAudit(req, res, next) {
  try {
    const returnFile = req.file;

    if (!returnFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file" (Purchase Return Audit File)',
        requestId: req.requestId,
      });
    }

    logger.info('Purchase return run-audit: forwarding to Python', {
      requestId: req.requestId,
      returnFilename: returnFile.originalname,
      returnSize: returnFile.size,
    });

    const { data, auditRunId } = await purchaseReturnService.runAuditWithPersistence(req);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    purchaseReturnService.notifyPurchaseReturnFailure(req, err);

    if (err.status === 400) {
      return res.status(400).json({
        success: false,
        detail: err.message,
        code: err.code,
        requestId: req.requestId,
      });
    }
    return next(err);
  }
}

async function getRateComparison(req, res, next) {
  try {
    const data = purchaseReturnService.getRateComparison();
    if (!data) {
      return res.status(404).json({
        success: false,
        detail: 'No purchase return rate comparison available. Run the audit first.',
        requestId: req.requestId,
      });
    }
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function exportRateComparison(req, res, next) {
  try {
    const parsed = validateRateComparisonExportBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    const { buffer, contentDisposition, contentType } =
      await purchaseReturnService.exportRateComparison(parsed.records, {
        requestId: req.requestId,
      });

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
    else {
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="purchase-return-rate-comparison.xlsx"'
      );
    }
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

async function exportExceptions(req, res, next) {
  try {
    const parsed = validateExceptionsExportBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    const { buffer, contentDisposition, contentType } =
      await purchaseReturnService.exportExceptions(parsed.payload, {
        requestId: req.requestId,
      });

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
    else {
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="purchase-return-audit-report.xlsx"'
      );
    }
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  validate,
  runAudit,
  getRateComparison,
  exportRateComparison,
  exportExceptions,
};

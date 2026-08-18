const salesReturnService = require('../services/salesReturn.service');
const {
  validateRateComparisonExportBody,
  validateExceptionsExportBody,
} = require('../validators/salesReturn.validator');
const logger = require('../utils/logger');

/**
 * Thin proxy validate — runs the sales-return audit without persisting an
 * audit run or firing notifications. Kept for parity under
 * /process/sales-return/validate.
 */
async function validate(req, res, next) {
  try {
    const returnFile = req.file ?? req.files?.salesReturnFile?.[0];

    if (!returnFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file" (Sales Return Audit File)',
        requestId: req.requestId,
      });
    }

    logger.info('Sales return audit: forwarding to Python', {
      requestId: req.requestId,
      returnFilename: returnFile.originalname,
      returnSize: returnFile.size,
    });

    const data = await salesReturnService.runAudit(
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

/**
 * Primary sales-return audit endpoint: persists the audit run and fires
 * completion/failure notifications.
 *
 * Full path: POST /api/v1/process/sales-return/run-audit
 * Legacy compat: POST /api/sales-return/run-audit
 */
async function runAudit(req, res, next) {
  try {
    const returnFile = req.file;

    if (!returnFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file" (Sales Return Audit File)',
        requestId: req.requestId,
      });
    }

    logger.info('Sales return run-audit: forwarding to Python', {
      requestId: req.requestId,
      returnFilename: returnFile.originalname,
      returnSize: returnFile.size,
    });

    const { data, auditRunId } = await salesReturnService.runAuditWithPersistence(req);

    return res.json({ ...data, auditRunId });
  } catch (err) {
    salesReturnService.notifySalesReturnFailure(req, err);

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

/**
 * GET /api/v1/process/sales-return/rate-comparison
 * Legacy compat: GET /api/sales-return/rate-comparison
 */
async function getRateComparison(req, res, next) {
  try {
    const data = salesReturnService.getRateComparison();
    if (!data) {
      return res.status(404).json({
        success: false,
        detail: 'No rate comparison available. Run POST /run-audit first.',
        requestId: req.requestId,
      });
    }
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

/**
 * Consolidated export (validation + rate comparison) — accepts records,
 * validationIssues, and/or comparisonIssues.
 *
 * POST /api/v1/process/sales-return/export-exceptions
 * Legacy compat: POST /api/sales-return/export-exceptions
 */
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

    logger.info('Sales return consolidated export: forwarding to Python', {
      requestId: req.requestId,
      ...parsed.counts,
    });

    const { buffer, contentDisposition, contentType } = await salesReturnService.exportExceptions(
      parsed.payload,
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="sales-return-exceptions.xlsx"');
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/v1/process/sales-return/export-rate-comparison
 * Legacy compat: POST /api/sales-return/export-rate-comparison
 */
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

    logger.info('Sales return rate comparison export: forwarding to Python', {
      requestId: req.requestId,
      recordCount: parsed.records.length,
    });

    const { buffer, contentDisposition, contentType } = await salesReturnService.exportRateComparison(
      parsed.records,
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="sales-return-rate-comparison.xlsx"'
      );
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = { validate, runAudit, getRateComparison, exportExceptions, exportRateComparison };

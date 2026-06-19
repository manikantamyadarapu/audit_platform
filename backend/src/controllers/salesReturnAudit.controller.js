const salesReturnRateComparisonService = require('../services/salesReturnRateComparison.service');
const auditNotification = require('../services/auditNotification.service');
const auditRunPersistence = require('../services/auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');
const pythonClient = require('../services/pythonClient.service');
const logger = require('../utils/logger');

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

    const data = await salesReturnRateComparisonService.runAudit(
      returnFile.buffer,
      returnFile.originalname,
      returnFile.mimetype,
      { requestId: req.requestId }
    );

    const auditRunId = await auditRunPersistence.tryPersistAuditRun(
      req,
      AUDIT_KEYS.SALES_RETURN,
      returnFile.originalname,
      data
    );

    if (req.user?.id) {
      auditNotification
        .notifyAuditCompleted(
          req.user.id,
          AUDIT_KEYS.SALES_RETURN,
          returnFile.originalname,
          data
        )
        .catch(() => {});
    }

    return res.json({ ...data, auditRunId });
  } catch (err) {
    if (req.user?.id) {
      if (err.code === 'MISSING_SALES_AUDIT_BASELINE') {
        auditNotification
          .notifyMissingPrerequisite(req.user.id, AUDIT_KEYS.SALES_RETURN, err.message)
          .catch(() => {});
      } else {
        auditNotification
          .notifyAuditFailed(
            req.user.id,
            AUDIT_KEYS.SALES_RETURN,
            req.file?.originalname,
            err.message
          )
          .catch(() => {});
      }
    }

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
    const data = salesReturnRateComparisonService.getRateComparison();
    if (!data) {
      return res.status(404).json({
        success: false,
        detail: 'No rate comparison available. Run POST /api/sales-return/run-audit first.',
        requestId: req.requestId,
      });
    }
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function exportExceptions(req, res, next) {
  try {
    const {
      records,
      validationIssues,
      comparisonIssues,
      exportColumns,
      columnDisplayHeaders,
    } = req.body ?? {};
    const hasRecords = Array.isArray(records) && records.length > 0;
    const hasValidation = Array.isArray(validationIssues) && validationIssues.length > 0;
    const hasComparison = Array.isArray(comparisonIssues) && comparisonIssues.length > 0;

    if (!hasRecords && !hasValidation && !hasComparison) {
      return res.status(400).json({
        success: false,
        detail:
          'Request body must include non-empty "records" or validation/comparison issue arrays',
        requestId: req.requestId,
      });
    }

    logger.info('Sales return consolidated export: forwarding to Python', {
      requestId: req.requestId,
      recordCount: hasRecords ? records.length : 0,
      validationCount: hasValidation ? validationIssues.length : 0,
      comparisonCount: hasComparison ? comparisonIssues.length : 0,
    });

    const { buffer, contentDisposition, contentType } =
      await pythonClient.postSalesReturnExportExceptions(
        {
          records,
          validationIssues,
          comparisonIssues,
          exportColumns,
          columnDisplayHeaders,
        },
        { requestId: req.requestId }
      );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="sales-return-exceptions.xlsx"'
      );
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

async function exportRateComparison(req, res, next) {
  try {
    const records = req.body?.records;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        detail: 'Request body must include a non-empty "records" array',
        requestId: req.requestId,
      });
    }

    logger.info('Sales return rate comparison export: forwarding to Python', {
      requestId: req.requestId,
      recordCount: records.length,
    });

    const { buffer, contentDisposition, contentType } =
      await pythonClient.postSalesReturnExportRateComparison(records, {
        requestId: req.requestId,
      });

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

module.exports = { runAudit, getRateComparison, exportExceptions, exportRateComparison };

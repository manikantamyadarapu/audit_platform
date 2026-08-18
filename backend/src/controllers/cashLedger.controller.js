const cashLedgerService = require('../services/cashLedger.service');
const { validateCashLedgerExportInvalidBody } = require('../validators/cashLedger.validator');
const logger = require('../utils/logger');

async function validateCashLedger(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file"',
        requestId: req.requestId,
      });
    }

    logger.info('Cash ledger: forwarding to Python', {
      requestId: req.requestId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    const { data, auditRunId } = await cashLedgerService.validateCashLedger(req);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    cashLedgerService.notifyCashLedgerFailure(req, err);
    return next(err);
  }
}

async function exportInvalidCashLedger(req, res, next) {
  try {
    const parsed = validateCashLedgerExportInvalidBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('Cash ledger export-invalid: forwarding to Python', {
      requestId: req.requestId,
      recordCount: parsed.records.length,
    });

    const { buffer, contentDisposition, contentType } = await cashLedgerService.exportInvalidCashLedger(
      parsed.records,
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="cash-ledger-invalid-rows.xlsx"');
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  validateCashLedger,
  exportInvalidCashLedger,
};

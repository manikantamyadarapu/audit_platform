const negativeBankService = require('../services/negativeBank.service');
const { validateNegativeBankExportInvalidBody } = require('../validators/negativeBank.validator');
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

    const { data, auditRunId } = await negativeBankService.validateNegativeBank(req);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    negativeBankService.notifyNegativeBankFailure(req, err);
    return next(err);
  }
}

async function exportInvalidNegativeBank(req, res, next) {
  try {
    const parsed = validateNegativeBankExportInvalidBody(req.body);
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

    const { buffer, contentDisposition, contentType } = await negativeBankService.exportInvalidNegativeBank(
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

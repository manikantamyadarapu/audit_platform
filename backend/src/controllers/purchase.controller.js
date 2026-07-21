const purchaseService = require('../services/purchase.service');
const { validatePurchaseExportInvalidBody } = require('../validators/purchase.validator');
const logger = require('../utils/logger');

async function validate(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file"',
        requestId: req.requestId,
      });
    }

    logger.info('Purchase ledger: forwarding to Python (sales endpoint)', {
      requestId: req.requestId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    const data = await purchaseService.validatePurchase(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      { requestId: req.requestId }
    );

    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function exportInvalid(req, res, next) {
  try {
    const parsed = validatePurchaseExportInvalidBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('Purchase export-invalid: forwarding to Python (sales endpoint)', {
      requestId: req.requestId,
      recordCount: parsed.records.length,
    });

    const { buffer, contentDisposition, contentType } = await purchaseService.exportInvalidPurchase(
      parsed.records,
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="purchase-invalid-rows.xlsx"');
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = { validate, exportInvalid };

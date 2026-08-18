const grossWeightService = require('../services/grossWeight.service');
const { validateGrossWeightExportInvalidBody } = require('../validators/grossWeight.validator');
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

    logger.info('Gross weight: forwarding to Python', {
      requestId: req.requestId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    const { data, auditRunId } = await grossWeightService.validateGrossWeight(req);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    grossWeightService.notifyGrossWeightFailure(req, err);
    return next(err);
  }
}

async function exportInvalid(req, res, next) {
  try {
    const parsed = validateGrossWeightExportInvalidBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('Gross weight export-invalid: forwarding to Python', {
      requestId: req.requestId,
      recordCount: parsed.records.length,
    });

    const { buffer, contentDisposition, contentType } = await grossWeightService.exportInvalidGrossWeight(
      parsed.records,
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="gross-weight-invalid-rows.xlsx"');
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = { validate, exportInvalid };

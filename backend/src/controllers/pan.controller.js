const panService = require('../services/pan.service');
const { validatePanExportInvalidBody } = require('../validators/pan.validator');
const logger = require('../utils/logger');

async function validatePan(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file"',
        requestId: req.requestId,
      });
    }

    logger.info('PAN validate: forwarding to Python', {
      requestId: req.requestId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    const { data, auditRunId } = await panService.validatePan(req);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    panService.notifyPanFailure(req, err);
    return next(err);
  }
}

async function exportInvalidPan(req, res, next) {
  try {
    const parsed = validatePanExportInvalidBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('PAN export-invalid: forwarding to Python', {
      requestId: req.requestId,
      recordCount: parsed.records.length,
    });

    const { buffer, contentDisposition, contentType } = await panService.exportInvalidPan(
      parsed.records,
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="pan-invalid-rows.xlsx"');
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  validatePan,
  exportInvalidPan,
};

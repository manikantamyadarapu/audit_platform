const tds01Service = require('../services/tds01.service');
const { validateTds01ExportBody } = require('../validators/tds01.validator');
const logger = require('../utils/logger');

async function validateTds01(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file"',
        requestId: req.requestId,
      });
    }

    logger.info('TDS @ 0.1%: forwarding to Python', {
      requestId: req.requestId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    const { data, auditRunId } = await tds01Service.validateTds01(req);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    tds01Service.notifyTds01Failure(req, err);
    return next(err);
  }
}

async function exportTds01(req, res, next) {
  try {
    const parsed = validateTds01ExportBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('TDS @ 0.1% export: forwarding to Python', {
      requestId: req.requestId,
      detailedCount: parsed.detailedRecords.length,
      summaryCount: parsed.summaryRecords.length,
    });

    const { buffer, contentDisposition, contentType } = await tds01Service.exportTds01(
      {
        detailedRecords: parsed.detailedRecords,
        summaryRecords: parsed.summaryRecords,
      },
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="TDS_0_1_Report.xlsx"');
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  validateTds01,
  exportTds01,
};

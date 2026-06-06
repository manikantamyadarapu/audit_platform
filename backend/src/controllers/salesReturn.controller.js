const pythonClient = require('../services/pythonClient.service');
const logger = require('../utils/logger');

async function validate(req, res, next) {
  try {
    const salesFile = req.files?.salesFile?.[0];
    const returnFile = req.files?.salesReturnFile?.[0];

    if (!salesFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "salesFile" (Sales Audit File)',
        requestId: req.requestId,
      });
    }
    if (!returnFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "salesReturnFile" (Sales Return Audit File)',
        requestId: req.requestId,
      });
    }

    logger.info('Sales return audit: forwarding to Python', {
      requestId: req.requestId,
      salesFilename: salesFile.originalname,
      returnFilename: returnFile.originalname,
      salesSize: salesFile.size,
      returnSize: returnFile.size,
    });

    const data = await pythonClient.postSalesReturnValidate(
      salesFile.buffer,
      salesFile.originalname,
      salesFile.mimetype,
      returnFile.buffer,
      returnFile.originalname,
      returnFile.mimetype,
      { requestId: req.requestId }
    );
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function exportExceptions(req, res, next) {
  try {
    const records = req.body?.records;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        detail: 'Request body must include a non-empty "records" array',
        requestId: req.requestId,
      });
    }

    logger.info('Sales return exception export: forwarding to Python', {
      requestId: req.requestId,
      recordCount: records.length,
    });

    const { buffer, contentDisposition, contentType } =
      await pythonClient.postSalesReturnExportExceptions(records, {
        requestId: req.requestId,
      });

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

module.exports = { validate, exportExceptions, exportRateComparison };

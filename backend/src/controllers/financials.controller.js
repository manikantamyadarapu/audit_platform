const financialsService = require('../services/financials.service');
const logger = require('../utils/logger');

function sendExcelDownload(res, file) {
  if (file.contentDisposition) {
    res.setHeader('Content-Disposition', file.contentDisposition);
  }
  res.setHeader('Content-Type', file.contentType);
  return res.send(file.buffer);
}

async function processFinancialsPivot(req, res, next) {
  try {
    const salesFile = req.files?.salesFile?.[0];
    const purchasesFile = req.files?.purchasesFile?.[0];

    if (!salesFile || !purchasesFile) {
      return res.status(400).json({
        success: false,
        detail: 'Both salesFile and purchasesFile are required',
        requestId: req.requestId,
      });
    }

    logger.info('Financials pivot: forwarding to Python', {
      requestId: req.requestId,
      salesFile: salesFile.originalname,
      purchasesFile: purchasesFile.originalname,
    });

    const { data, auditRunId } = await financialsService.processFinancialsPivot(
      req,
      salesFile,
      purchasesFile
    );
    return res.json({ ...data, auditRunId });
  } catch (err) {
    financialsService.notifyFinancialsPivotFailure(req, err);
    return next(err);
  }
}

async function exportFinancialsPivots(req, res, next) {
  try {
    const file = await financialsService.exportFinancialsPivots(req, req.body || {});
    return sendExcelDownload(res, file);
  } catch (err) {
    return next(err);
  }
}

async function exportClosingStockTemplate(req, res, next) {
  try {
    const file = await financialsService.exportClosingStockTemplate(req, req.body || {});
    return sendExcelDownload(res, file);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  processFinancialsPivot,
  exportFinancialsPivots,
  exportClosingStockTemplate,
};

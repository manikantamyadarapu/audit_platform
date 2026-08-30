const financialsService = require('../services/financials.service');
const {
  validateFinancialsExportPivotsBody,
  validateClosingStockExportBody,
} = require('../validators/financials.validator');
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
    const openingQtyFile = req.files?.openingQtyFile?.[0];
    const previousYearFile = req.files?.previousYearFile?.[0];

    if (!salesFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "salesFile"',
        requestId: req.requestId,
      });
    }
    if (!purchasesFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "purchasesFile"',
        requestId: req.requestId,
      });
    }
    if (!openingQtyFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "openingQtyFile"',
        requestId: req.requestId,
      });
    }
    if (!previousYearFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "previousYearFile"',
        requestId: req.requestId,
      });
    }

    logger.info('Financials pivot: forwarding to Python', {
      requestId: req.requestId,
      salesFile: salesFile.originalname,
      purchasesFile: purchasesFile.originalname,
      openingQtyFile: openingQtyFile.originalname,
      previousYearFile: previousYearFile.originalname,
    });

    const { data, auditRunId } = await financialsService.processFinancialsPivot(
      req,
      salesFile,
      purchasesFile,
      openingQtyFile,
      previousYearFile
    );
    return res.json({ ...data, auditRunId });
  } catch (err) {
    financialsService.notifyFinancialsPivotFailure(req, err);
    return next(err);
  }
}

async function exportFinancialsPivots(req, res, next) {
  try {
    const parsed = validateFinancialsExportPivotsBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('Financials pivots export: forwarding to Python', {
      requestId: req.requestId,
      salesCount: parsed.salesPivot.length,
      purchasesCount: parsed.purchasesPivot.length,
    });

    const file = await financialsService.exportFinancialsPivots(req, {
      salesPivot: parsed.salesPivot,
      purchasesPivot: parsed.purchasesPivot,
    });
    return sendExcelDownload(res, file);
  } catch (err) {
    return next(err);
  }
}

async function exportClosingStockTemplate(req, res, next) {
  try {
    const parsed = validateClosingStockExportBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('Closing Stock template export: forwarding to Python', {
      requestId: req.requestId,
      salesCount: parsed.salesPivot.length,
      purchasesCount: parsed.purchasesPivot.length,
      openingCount: parsed.openingPivot.length,
      productCount: parsed.products.length,
    });

    const file = await financialsService.exportClosingStockTemplate(req, {
      products: parsed.products,
      salesPivot: parsed.salesPivot,
      purchasesPivot: parsed.purchasesPivot,
      openingPivot: parsed.openingPivot,
      companyName: parsed.companyName,
      address: parsed.address,
      financialYear: parsed.financialYear,
    });
    return sendExcelDownload(res, file);
  } catch (err) {
    return next(err);
  }
}

async function getClosingStockRuleBook(req, res, next) {
  try {
    const data = await financialsService.getClosingStockRuleBook(req);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function remapClosingStock(req, res, next) {
  try {
    const parsed = validateFinancialsExportPivotsBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    const data = await financialsService.remapClosingStock(req, {
      salesPivot: parsed.salesPivot,
      purchasesPivot: parsed.purchasesPivot,
      openingPivot: parsed.openingPivot,
    });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  processFinancialsPivot,
  exportFinancialsPivots,
  exportClosingStockTemplate,
  getClosingStockRuleBook,
  remapClosingStock,
};

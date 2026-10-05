const financialsService = require('../services/financials.service');
const {
  validateFinancialsExportPivotsBody,
  validateClosingStockExportBody,
} = require('../validators/financials.validator');
const logger = require('../utils/logger');

function sendExcelDownload(res, file, requestId) {
  if (file.contentDisposition) {
    res.setHeader('Content-Disposition', file.contentDisposition);
  }
  res.setHeader('Content-Type', file.contentType);
  if (requestId) {
    res.setHeader('x-request-id', requestId);
  }
  return res.send(file.buffer);
}

async function processFinancialsPivot(req, res, next) {
  try {
    const salesFile = req.files?.salesFile?.[0];
    const purchasesFile = req.files?.purchasesFile?.[0];
    const openingQtyFile = req.files?.openingQtyFile?.[0];
    const previousYearFile = req.files?.previousYearFile?.[0];
    const mrFile = req.files?.mrFile?.[0];
    const dcFile = req.files?.dcFile?.[0];

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
    if (!mrFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "mrFile"',
        requestId: req.requestId,
      });
    }
    if (!dcFile?.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "dcFile"',
        requestId: req.requestId,
      });
    }

    logger.info('Financials pivot: forwarding to Python', {
      requestId: req.requestId,
      salesFile: salesFile.originalname,
      purchasesFile: purchasesFile.originalname,
      openingQtyFile: openingQtyFile.originalname,
      previousYearFile: previousYearFile.originalname,
      mrFile: mrFile.originalname,
      dcFile: dcFile.originalname,
    });

    const { data, auditRunId } = await financialsService.processFinancialsPivot(
      req,
      salesFile,
      purchasesFile,
      openingQtyFile,
      previousYearFile,
      mrFile,
      dcFile
    );
    return res.json({ ...data, auditRunId });
  } catch (err) {
    financialsService.notifyFinancialsPivotFailure(req, err);
    return next(err);
  }
}

async function processFinancialsSalesPurchases(req, res, next) {
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

    logger.info('Financials sales/purchases/opening pivot: forwarding to Python', {
      requestId: req.requestId,
      salesFile: salesFile.originalname,
      purchasesFile: purchasesFile.originalname,
      openingQtyFile: openingQtyFile.originalname,
      previousYearFile: previousYearFile.originalname,
    });

    const { data, auditRunId } = await financialsService.processFinancialsSalesPurchases(
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

async function processSalesPurchasesPivots(req, res, next) {
  try {
    const salesFile = req.files?.salesFile?.[0];
    const purchasesFile = req.files?.purchasesFile?.[0];
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
    const openingQtyFile = req.files?.openingQtyFile?.[0];
    const previousYearFile = req.files?.previousYearFile?.[0];
    if (Boolean(openingQtyFile?.buffer) !== Boolean(previousYearFile?.buffer)) {
      return res.status(400).json({
        success: false,
        detail: 'Opening Stock needs both the Opening Quantity file and Previous Year Financials.',
        requestId: req.requestId,
      });
    }
    logger.info('Sales/Purchases pivots: forwarding to Python', {
      requestId: req.requestId,
      salesFile: salesFile.originalname,
      purchasesFile: purchasesFile.originalname,
      openingQtyFile: openingQtyFile?.originalname,
      previousYearFile: previousYearFile?.originalname,
    });
    const { data, auditRunId } = await financialsService.processSalesPurchasesPivots(
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
    return sendExcelDownload(res, file, req.requestId);
  } catch (err) {
    return next(err);
  }
}

async function exportJubileeHillsTemplate(req, res, next) {
  try {
    const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName : '';
    const address = typeof req.body?.address === 'string' ? req.body.address : '';
    const financialYear = typeof req.body?.financialYear === 'string' ? req.body.financialYear : '';
    const file = await financialsService.exportJubileeHillsTemplate(req, {
      companyName,
      address,
      financialYear,
      layoutByCategory: req.body?.layoutByCategory || null,
      salesPivot: Array.isArray(req.body?.salesPivot) ? req.body.salesPivot : [],
      purchasesPivot: Array.isArray(req.body?.purchasesPivot) ? req.body.purchasesPivot : [],
      openingPivot: Array.isArray(req.body?.openingPivot) ? req.body.openingPivot : [],
    });
    return sendExcelDownload(res, file, req.requestId);
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
      mrPivots: parsed.mrPivots,
      dcPivots: parsed.dcPivots,
      companyName: parsed.companyName,
      address: parsed.address,
      financialYear: parsed.financialYear,
    });
    return sendExcelDownload(res, file, req.requestId);
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

async function placeJubileeHillsSheets(req, res, next) {
  try {
    const parsed = validateFinancialsExportPivotsBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }
    const data = await financialsService.placeJubileeHillsSheets(req, {
      salesPivot: parsed.salesPivot,
      purchasesPivot: parsed.purchasesPivot,
      openingPivot: parsed.openingPivot,
      mrPivots: parsed.mrPivots,
      dcPivots: parsed.dcPivots,
    });
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
      mrPivots: parsed.mrPivots,
      dcPivots: parsed.dcPivots,
    });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function processJubileeHillsFinancials(req, res, next) {
  try {
    const required = [
      ['salesFile', 'salesFile'],
      ['purchasesFile', 'purchasesFile'],
      ['openingQtyFile', 'openingQtyFile'],
      ['previousYearFile', 'previousYearFile'],
      ['salesReturnFile', 'salesReturnFile'],
      ['purchaseReturnFile', 'purchaseReturnFile'],
      ['creditNoteFile', 'creditNoteFile'],
      ['debitNoteFile', 'debitNoteFile'],
    ];
    const files = {};
    for (const [key, field] of required) {
      const file = req.files?.[field]?.[0];
      if (!file?.buffer) {
        return res.status(400).json({
          success: false,
          detail: `Missing file field "${field}"`,
          requestId: req.requestId,
        });
      }
      files[key] = file;
    }
    files.mrFile = req.files?.mrFile?.[0] || null;
    files.dcFile = req.files?.dcFile?.[0] || null;
    files.savedOpeningMappings =
      typeof req.body?.savedOpeningMappings === 'string' ? req.body.savedOpeningMappings : '[]';
    files.sourceAverageRates =
      typeof req.body?.sourceAverageRates === 'string' ? req.body.sourceAverageRates : '{}';

    logger.info('Jubilee Hills financials: forwarding to Python', {
      requestId: req.requestId,
      salesFile: files.salesFile.originalname,
      purchasesFile: files.purchasesFile.originalname,
      salesReturnFile: files.salesReturnFile.originalname,
      purchaseReturnFile: files.purchaseReturnFile.originalname,
      creditNoteFile: files.creditNoteFile.originalname,
      debitNoteFile: files.debitNoteFile.originalname,
    });

    const { data, auditRunId } = await financialsService.processJubileeHillsFinancials(req, files);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    financialsService.notifyFinancialsPivotFailure(req, err);
    return next(err);
  }
}

module.exports = {
  processFinancialsPivot,
  processJubileeHillsFinancials,
  processFinancialsSalesPurchases,
  processSalesPurchasesPivots,
  exportFinancialsPivots,
  exportJubileeHillsTemplate,
  exportClosingStockTemplate,
  getClosingStockRuleBook,
  remapClosingStock,
  placeJubileeHillsSheets,
};

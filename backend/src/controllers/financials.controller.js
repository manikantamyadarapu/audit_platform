const financialsService = require('../services/financials.service');
const heldFinancialsService = require('../services/heldFinancials.service');
const { isValidBranch } = require('../constants/heldFinancials');
const {
  validateFinancialsExportPivotsBody,
  validateClosingStockExportBody,
} = require('../validators/financials.validator');
const logger = require('../utils/logger');

function branchFromParams(req) {
  const branch = String(req.params?.branch || '').trim();
  if (!isValidBranch(branch)) {
    const err = new Error(`Unsupported Financials branch "${branch}"`);
    err.status = 400;
    throw err;
  }
  return branch;
}

function heldErrorResponse(err, req, res, next) {
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      detail: err.message,
      requestId: req.requestId,
    });
  }
  return next(err);
}

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

function sixFileProcessBranch(req) {
  return String(req.body?.destinationBranch || '').trim() === 'kokapet'
    ? 'kokapet'
    : 'basheerbagh';
}

function formJsonField(value, empty) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || empty;
  }
  if (value == null) return empty;
  try {
    return JSON.stringify(value);
  } catch {
    return empty;
  }
}

function processBasheerbaghFinancials(req, res, next) {
  req.body = { ...(req.body || {}), destinationBranch: 'basheerbagh' };
  return processFinancialsPivot(req, res, next);
}

function processKokapetFinancials(req, res, next) {
  req.body = { ...(req.body || {}), destinationBranch: 'kokapet' };
  return processFinancialsPivot(req, res, next);
}

async function processFinancialsPivot(req, res, next) {
  try {
    req.files = await heldFinancialsService.resolveProcessFiles(req, sixFileProcessBranch(req));
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
    if (err.status) {
      return heldErrorResponse(err, req, res, next);
    }
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

async function holdFinancialsBranchFiles(req, res, next) {
  try {
    const branch = branchFromParams(req);
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        detail: 'Authentication required',
        requestId: req.requestId,
      });
    }
    const data = await heldFinancialsService.holdBranchFiles(req.user.id, branch, req.files);
    return res.json({ success: true, ...data, requestId: req.requestId });
  } catch (err) {
    return heldErrorResponse(err, req, res, next);
  }
}

async function listHeldFinancialsBranchFiles(req, res, next) {
  try {
    const branch = branchFromParams(req);
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        detail: 'Authentication required',
        requestId: req.requestId,
      });
    }
    const data = await heldFinancialsService.listHeldFiles(req.user.id, branch);
    return res.json({ success: true, ...data, requestId: req.requestId });
  } catch (err) {
    return heldErrorResponse(err, req, res, next);
  }
}

async function clearHeldFinancialsBranchFiles(req, res, next) {
  try {
    const branch = branchFromParams(req);
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        detail: 'Authentication required',
        requestId: req.requestId,
      });
    }
    const data = await heldFinancialsService.clearBranchFiles(req.user.id, branch);
    return res.json({ success: true, branch, ...data, requestId: req.requestId });
  } catch (err) {
    return heldErrorResponse(err, req, res, next);
  }
}

function exportBasheerbaghPivots(req, res, next) {
  req.financialsBranch = 'basheerbagh';
  return exportFinancialsPivots(req, res, next);
}

function exportKokapetPivots(req, res, next) {
  req.financialsBranch = 'kokapet';
  return exportFinancialsPivots(req, res, next);
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

async function exportConsolidatedFinancialsTemplate(req, res, next) {
  try {
    const file = await financialsService.exportConsolidatedFinancialsTemplate(req);
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
    const body = req.body || {};
    const file = await financialsService.exportJubileeHillsTemplate(req, {
      companyName,
      address,
      financialYear,
      destinationBranch: body.destinationBranch == null ? 'jubileeHills' : String(body.destinationBranch),
      layoutByCategory: body.layoutByCategory && typeof body.layoutByCategory === 'object' ? body.layoutByCategory : {},
      salesPivot: Array.isArray(body.salesPivot) ? body.salesPivot : [],
      purchasesPivot: Array.isArray(body.purchasesPivot) ? body.purchasesPivot : [],
      openingPivot: Array.isArray(body.openingPivot) ? body.openingPivot : [],
      mrPivots: body.mrPivots && typeof body.mrPivots === 'object' ? body.mrPivots : {},
      dcPivots: body.dcPivots && typeof body.dcPivots === 'object' ? body.dcPivots : {},
      sourceAverageRates:
        body.sourceAverageRates && typeof body.sourceAverageRates === 'object' ? body.sourceAverageRates : {},
      receiptRateMappings: Array.isArray(body.receiptRateMappings) ? body.receiptRateMappings : [],
      sourceIssueLayouts:
        body.sourceIssueLayouts && typeof body.sourceIssueLayouts === 'object' ? body.sourceIssueLayouts : {},
      sourceOpeningComplete:
        body.sourceOpeningComplete && typeof body.sourceOpeningComplete === 'object'
          ? body.sourceOpeningComplete
          : {},
      sourceOpeningPending:
        body.sourceOpeningPending && typeof body.sourceOpeningPending === 'object'
          ? body.sourceOpeningPending
          : {},
      sourceTransferLines:
        body.sourceTransferLines && typeof body.sourceTransferLines === 'object' ? body.sourceTransferLines : {},
      destinationTransferLines:
        body.destinationTransferLines && typeof body.destinationTransferLines === 'object'
          ? body.destinationTransferLines
          : {},
    });
    return sendExcelDownload(res, file, req.requestId);
  } catch (err) {
    return next(err);
  }
}

function exportBasheerbaghClosingStock(req, res, next) {
  req.financialsBranch = 'basheerbagh';
  return exportClosingStockTemplate(req, res, next);
}

function exportKokapetClosingStock(req, res, next) {
  req.financialsBranch = 'kokapet';
  return exportClosingStockTemplate(req, res, next);
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
      destinationBranch: parsed.destinationBranch || req.financialsBranch || '',
      sourceAverageRates: parsed.sourceAverageRates,
      receiptRateMappings: parsed.receiptRateMappings,
      layoutByCategory: parsed.layoutByCategory,
      sourceIssueLayouts: parsed.sourceIssueLayouts,
      sourceOpeningComplete: parsed.sourceOpeningComplete,
      sourceOpeningPending: parsed.sourceOpeningPending,
      sourceTransferLines: parsed.sourceTransferLines,
      destinationTransferLines: parsed.destinationTransferLines,
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
      salesReturnPivot: parsed.salesReturnPivot,
      purchaseReturnPivot: parsed.purchaseReturnPivot,
      supplierDebitNotePivot: parsed.supplierDebitNotePivot,
      supplierCreditNotePivot: parsed.supplierCreditNotePivot,
      mrPivots: parsed.mrPivots,
      dcPivots: parsed.dcPivots,
      sourceAverageRates: parsed.sourceAverageRates,
      receiptRateMappings: parsed.receiptRateMappings,
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
      destinationBranch: parsed.destinationBranch,
      sourceAverageRates: parsed.sourceAverageRates,
      receiptRateMappings: parsed.receiptRateMappings,
    });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function fillReceiptAmounts(req, res, next) {
  try {
    const body = req.body;
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        detail: 'Request body must be a JSON object',
        requestId: req.requestId,
      });
    }
    const data = await financialsService.fillReceiptAmounts(req, {
      destinationBranch: body.destinationBranch == null ? '' : String(body.destinationBranch),
      layoutByCategory:
        body.layoutByCategory && typeof body.layoutByCategory === 'object'
          ? body.layoutByCategory
          : {},
      sourceAverageRates:
        body.sourceAverageRates && typeof body.sourceAverageRates === 'object'
          ? body.sourceAverageRates
          : {},
      receiptRateMappings: Array.isArray(body.receiptRateMappings) ? body.receiptRateMappings : [],
      sourceIssueLayouts:
        body.sourceIssueLayouts && typeof body.sourceIssueLayouts === 'object'
          ? body.sourceIssueLayouts
          : {},
      sourceOpeningComplete:
        body.sourceOpeningComplete && typeof body.sourceOpeningComplete === 'object'
          ? body.sourceOpeningComplete
          : {},
      sourceOpeningPending:
        body.sourceOpeningPending && typeof body.sourceOpeningPending === 'object'
          ? body.sourceOpeningPending
          : {},
      sourceTransferLines:
        body.sourceTransferLines && typeof body.sourceTransferLines === 'object'
          ? body.sourceTransferLines
          : {},
      destinationTransferLines:
        body.destinationTransferLines && typeof body.destinationTransferLines === 'object'
          ? body.destinationTransferLines
          : {},
    });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function processJubileeHillsFinancials(req, res, next) {
  try {
    req.files = await heldFinancialsService.resolveProcessFiles(req, 'jubilee-hills');
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
    files.savedOpeningMappings = formJsonField(req.body?.savedOpeningMappings, '[]');
    files.sourceAverageRates = formJsonField(req.body?.sourceAverageRates, '{}');
    files.receiptRateMappings = formJsonField(req.body?.receiptRateMappings, '[]');

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
    if (err.status) {
      return heldErrorResponse(err, req, res, next);
    }
    financialsService.notifyFinancialsPivotFailure(req, err);
    return next(err);
  }
}

module.exports = {
  processFinancialsPivot,
  processBasheerbaghFinancials,
  processKokapetFinancials,
  processJubileeHillsFinancials,
  processFinancialsSalesPurchases,
  processSalesPurchasesPivots,
  holdFinancialsBranchFiles,
  listHeldFinancialsBranchFiles,
  clearHeldFinancialsBranchFiles,
  exportBasheerbaghPivots,
  exportKokapetPivots,
  exportFinancialsPivots,
  exportJubileeHillsTemplate,
  exportConsolidatedFinancialsTemplate,
  exportBasheerbaghClosingStock,
  exportKokapetClosingStock,
  exportClosingStockTemplate,
  getClosingStockRuleBook,
  remapClosingStock,
  fillReceiptAmounts,
  placeJubileeHillsSheets,
};

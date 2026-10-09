const express = require('express');
const financialsController = require('../controllers/financials.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { financialsPivotFiles, financialsSalesPurchasesFiles, financialsSalesPurchasesPivotFiles, financialsJubileeHillsFiles, handleMulterError } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full paths (mounted under /api/v1):
 * POST /api/v1/process/financials/validate/basheerbagh
 * POST /api/v1/process/financials/validate/kokapet
 * POST /api/v1/process/financials/validate/jubilee-hills
 * POST /api/v1/process/financials/export-pivots/basheerbagh
 * POST /api/v1/process/financials/export-pivots/kokapet
 * POST /api/v1/process/financials/export-closing-stock/basheerbagh
 * POST /api/v1/process/financials/export-closing-stock/kokapet
 * POST /api/v1/process/financials/jubilee-hills/template
 * POST /api/v1/process/financials/hold/:branch
 * GET  /api/v1/process/financials/hold/:branch
 * DELETE /api/v1/process/financials/hold/:branch
 * GET  /api/v1/process/financials/closing-stock-rule-book
 * POST /api/v1/process/financials/remap-closing-stock
 */
function holdBranchUpload(req, res, next) {
  const branch = String(req.params?.branch || '');
  const upload =
    branch === 'jubilee-hills' ? financialsJubileeHillsFiles : financialsPivotFiles;
  return upload(req, res, (err) => handleMulterError(err, req, res, next));
}

router.post('/hold/:branch', holdBranchUpload, financialsController.holdFinancialsBranchFiles);
router.get('/hold/:branch', financialsController.listHeldFinancialsBranchFiles);
router.delete('/hold/:branch', financialsController.clearHeldFinancialsBranchFiles);
router.post(
  '/validate/basheerbagh',
  financialsPivotFiles,
  handleMulterError,
  financialsController.processBasheerbaghFinancials
);
router.post(
  '/validate/kokapet',
  financialsPivotFiles,
  handleMulterError,
  financialsController.processKokapetFinancials
);
router.post(
  '/validate/jubilee-hills',
  financialsJubileeHillsFiles,
  handleMulterError,
  financialsController.processJubileeHillsFinancials
);
router.post(
  '/validate-sales-purchases',
  financialsSalesPurchasesFiles,
  handleMulterError,
  financialsController.processFinancialsSalesPurchases
);
router.post(
  '/validate-sales-purchases-pivots',
  financialsSalesPurchasesPivotFiles,
  handleMulterError,
  financialsController.processSalesPurchasesPivots
);
router.post(
  '/export-pivots/basheerbagh',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.exportBasheerbaghPivots
);
router.post(
  '/export-pivots/kokapet',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.exportKokapetPivots
);
router.post(
  '/jubilee-hills/template',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.exportJubileeHillsTemplate
);
router.post(
  '/export-closing-stock/basheerbagh',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.exportBasheerbaghClosingStock
);
router.post(
  '/export-closing-stock/kokapet',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.exportKokapetClosingStock
);
router.get('/closing-stock-rule-book', financialsController.getClosingStockRuleBook);
router.post(
  '/remap-closing-stock',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.remapClosingStock
);
router.post(
  '/jubilee-hills/place',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.placeJubileeHillsSheets
);

module.exports = router;

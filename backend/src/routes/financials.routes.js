const express = require('express');
const financialsController = require('../controllers/financials.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { financialsPivotFiles } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full paths (mounted under /api/v1):
 * POST /api/v1/process/financials/validate  (sales/purchases/opening/previousYear + optional mr/dc)
 * POST /api/v1/process/financials/export-pivots
 * POST /api/v1/process/financials/export-closing-stock
 * GET  /api/v1/process/financials/closing-stock-rule-book
 * POST /api/v1/process/financials/remap-closing-stock
 */
router.post('/validate', financialsPivotFiles, financialsController.processFinancialsPivot);
router.post(
  '/export-pivots',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.exportFinancialsPivots
);
router.post(
  '/export-closing-stock',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.exportClosingStockTemplate
);
router.get('/closing-stock-rule-book', financialsController.getClosingStockRuleBook);
router.post(
  '/remap-closing-stock',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  financialsController.remapClosingStock
);

module.exports = router;

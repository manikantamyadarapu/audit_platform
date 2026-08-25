const express = require('express');
const router = express.Router();
const financialsController = require('../controllers/financials.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { handleMulterError, financialsPivotFiles } = require('../middleware/upload.middleware');

router.post(
  '/validate',
  authenticate,
  financialsPivotFiles,
  handleMulterError,
  financialsController.processFinancialsPivot
);

router.post('/export-pivots', authenticate, financialsController.exportFinancialsPivots);
router.post(
  '/export-closing-stock',
  authenticate,
  financialsController.exportClosingStockTemplate
);

module.exports = router;

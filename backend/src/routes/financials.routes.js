const express = require('express');
const financialsController = require('../controllers/financials.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { financialsPivotFiles } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);
router.use(authorize(PROCESS_ROLES));

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

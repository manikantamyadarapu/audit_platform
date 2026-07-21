const express = require('express');
const salesReturnController = require('../controllers/salesReturn.controller');
const { singleSalesReturnFile } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full path: POST /api/v1/process/sales-return/validate
 * Thin proxy (no persistence) — kept for parity/back-compat.
 */
router.post('/validate', singleSalesReturnFile, salesReturnController.validate);

/**
 * Full path: POST /api/v1/process/sales-return/run-audit
 * Legacy compat: POST /api/sales-return/run-audit
 * Primary sales-return audit endpoint used by the frontend — persists the
 * audit run and fires notifications.
 */
router.post('/run-audit', singleSalesReturnFile, salesReturnController.runAudit);

/**
 * Full path: GET /api/v1/process/sales-return/rate-comparison
 * Legacy compat: GET /api/sales-return/rate-comparison
 */
router.get('/rate-comparison', salesReturnController.getRateComparison);

router.post(
  '/export-exceptions',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  salesReturnController.exportExceptions
);

router.post(
  '/export-rate-comparison',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  salesReturnController.exportRateComparison
);

module.exports = router;

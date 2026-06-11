const express = require('express');
const salesReturnAuditController = require('../controllers/salesReturnAudit.controller');
const { optionalAuth } = require('../middleware/optionalAuth.middleware');
const { singleSalesReturnFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

/**
 * POST /api/sales-return/run-audit
 * Single-file upload: sales return audit file only.
 */
router.post('/run-audit', optionalAuth, singleSalesReturnFile, salesReturnAuditController.runAudit);

/**
 * GET /api/sales-return/rate-comparison
 * Returns rate comparison from the most recent run-audit on this server instance.
 */
router.get('/rate-comparison', salesReturnAuditController.getRateComparison);

router.post(
  '/export-exceptions',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  salesReturnAuditController.exportExceptions
);

router.post(
  '/export-rate-comparison',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  salesReturnAuditController.exportRateComparison
);

module.exports = router;

const express = require('express');
const salesReturnController = require('../controllers/salesReturn.controller');
const { singleSalesReturnFile } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full path: POST /api/v1/process/sales-return/validate
 */
router.post('/validate', singleSalesReturnFile, salesReturnController.validate);

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

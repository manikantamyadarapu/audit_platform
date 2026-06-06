const express = require('express');
const salesReturnController = require('../controllers/salesReturn.controller');
const { dualSalesReturnFiles } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

/**
 * Full path: POST /api/v1/process/sales-return/validate
 */
router.post('/validate', dualSalesReturnFiles, salesReturnController.validate);

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

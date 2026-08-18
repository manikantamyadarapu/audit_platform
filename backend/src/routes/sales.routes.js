const express = require('express');
const salesController = require('../controllers/sales.controller');
const { singlePanFile } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full path: POST /api/v1/process/sales/validate
 */
router.post('/validate', singlePanFile, salesController.validate);

router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  salesController.exportInvalid
);

/**
 * Full path: GET /api/v1/process/sales/product-average-rates
 * Legacy compat: GET /api/sales-audit/product-average-rates
 */
router.get('/product-average-rates', salesController.getProductAverageRates);

/**
 * Full path: GET /api/v1/process/sales/product-average-rates/export
 * Legacy compat: GET /api/sales-audit/product-average-rates/export
 */
router.get('/product-average-rates/export', salesController.exportProductAverageRates);

module.exports = router;

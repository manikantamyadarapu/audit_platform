const express = require('express');
const salesController = require('../controllers/sales.controller');
const { singleExcelFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

/**
 * Full paths (mounted under /api/v1/process/sales-audit):
 * POST /api/v1/process/sales-audit
 * POST /api/v1/process/sales-audit/export-invalid
 */
router.post('/', singleExcelFile, salesController.validateSalesAudit);
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  salesController.exportInvalidSalesAudit
);

module.exports = router;

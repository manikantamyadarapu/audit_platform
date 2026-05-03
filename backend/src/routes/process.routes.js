const express = require('express');
const processController = require('../controllers/process.controller');
const { singleExcelFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

/**
 * Full paths (mounted under /api/v1/process/gross-weight):
 * POST /api/v1/process/gross-weight
 * POST /api/v1/process/gross-weight/export-invalid
 */
router.post('/', singleExcelFile, processController.validateGrossWeight);
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  processController.exportInvalidGrossWeight
);

module.exports = router;

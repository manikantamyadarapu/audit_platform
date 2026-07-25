const express = require('express');
const purchaseController = require('../controllers/purchase.controller');
const { singlePanFile } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full paths (mounted under /api/v1):
 * POST /api/v1/process/purchase/validate
 * POST /api/v1/process/purchase/export-invalid
 *
 * Purchase ledgers use the dedicated purchase Python endpoint and persist
 * product averages under PURCHASE for Purchase Return baseline.
 */
router.post('/validate', singlePanFile, purchaseController.validate);
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  purchaseController.exportInvalid
);

module.exports = router;

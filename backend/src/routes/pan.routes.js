const express = require('express');
const panController = require('../controllers/pan.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { singlePanFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full paths (mounted under /api/v1):
 * POST /api/v1/process/pan/validate
 * POST /api/v1/process/pan/export-invalid
 */
router.post('/validate', singlePanFile, panController.validatePan);
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  panController.exportInvalidPan
);

module.exports = router;

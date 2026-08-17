const express = require('express');
const tds01Controller = require('../controllers/tds01.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { singleTds01File } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full paths (mounted under /api/v1):
 * POST /api/v1/process/tds-rate-0.1/validate
 * POST /api/v1/process/tds-rate-0.1/export
 */
router.post('/validate', singleTds01File, tds01Controller.validateTds01);
router.post(
  '/export',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  tds01Controller.exportTds01
);

module.exports = router;

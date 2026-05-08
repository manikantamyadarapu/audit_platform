const express = require('express');
const grossWeightController = require('../controllers/grossWeight.controller');
const { singlePanFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

/**
 * Full path: POST /api/v1/process/gross-weight/validate
 */
router.post('/validate', singlePanFile, grossWeightController.validate);

router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  grossWeightController.exportInvalid
);

module.exports = router;

const express = require('express');
const panController = require('../controllers/pan.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { singlePanFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

router.post('/validate', authorize(PROCESS_ROLES), singlePanFile, panController.validatePan);
router.post(
  '/export-invalid',
  authorize(PROCESS_ROLES),
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  panController.exportInvalidPan
);

module.exports = router;

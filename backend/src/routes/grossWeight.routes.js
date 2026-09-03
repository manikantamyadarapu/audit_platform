const express = require('express');
const grossWeightController = require('../controllers/grossWeight.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { singlePanFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);
router.use(authorize(PROCESS_ROLES));

router.post('/validate', singlePanFile, grossWeightController.validate);
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  grossWeightController.exportInvalid
);

module.exports = router;

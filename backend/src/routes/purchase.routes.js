const express = require('express');
const purchaseController = require('../controllers/purchase.controller');
const { singlePanFile } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

router.post('/validate', authorize(PROCESS_ROLES), singlePanFile, purchaseController.validate);
router.post(
  '/export-invalid',
  authorize(PROCESS_ROLES),
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  purchaseController.exportInvalid
);

module.exports = router;

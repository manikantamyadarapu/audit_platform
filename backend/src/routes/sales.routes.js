const express = require('express');
const salesController = require('../controllers/sales.controller');
const { singlePanFile } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

router.post('/validate', authorize(PROCESS_ROLES), singlePanFile, salesController.validate);

router.post(
  '/export-invalid',
  authorize(PROCESS_ROLES),
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  salesController.exportInvalid
);

router.get('/product-average-rates', salesController.getProductAverageRates);
router.get('/product-average-rates/export', salesController.exportProductAverageRates);

module.exports = router;

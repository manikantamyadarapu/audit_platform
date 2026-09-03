const express = require('express');
const salesReturnController = require('../controllers/salesReturn.controller');
const { singleSalesReturnFile } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);
router.use(authorize(PROCESS_ROLES));

router.post('/validate', singleSalesReturnFile, salesReturnController.validate);
router.post('/run-audit', singleSalesReturnFile, salesReturnController.runAudit);
router.get('/rate-comparison', salesReturnController.getRateComparison);
router.post(
  '/export-exceptions',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  salesReturnController.exportExceptions
);
router.post(
  '/export-rate-comparison',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  salesReturnController.exportRateComparison
);

module.exports = router;

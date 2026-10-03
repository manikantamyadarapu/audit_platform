const express = require('express');
const purchaseReturnController = require('../controllers/purchaseReturn.controller');
const { singleSalesReturnFile } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);
router.use(authorize(PROCESS_ROLES));

router.post('/validate', singleSalesReturnFile, purchaseReturnController.validate);
router.post('/run-audit', singleSalesReturnFile, purchaseReturnController.runAudit);
router.get('/rate-comparison', purchaseReturnController.getRateComparison);
router.post(
  '/export-exceptions',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  purchaseReturnController.exportExceptions
);
router.post(
  '/export-rate-comparison',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  purchaseReturnController.exportRateComparison
);

module.exports = router;

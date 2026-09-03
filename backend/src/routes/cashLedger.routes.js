const express = require('express');
const cashLedgerController = require('../controllers/cashLedger.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { singleCashLedgerFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);
router.use(authorize(PROCESS_ROLES));

router.post('/validate', singleCashLedgerFile, cashLedgerController.validateCashLedger);
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  cashLedgerController.exportInvalidCashLedger
);

module.exports = router;

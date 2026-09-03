const express = require('express');
const negativeBankController = require('../controllers/negativeBank.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { singleCashLedgerFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);
router.use(authorize(PROCESS_ROLES));

router.post('/validate', singleCashLedgerFile, negativeBankController.validateNegativeBank);
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  negativeBankController.exportInvalidNegativeBank
);

module.exports = router;

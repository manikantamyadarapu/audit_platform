const express = require('express');
const negativeBankController = require('../controllers/negativeBank.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { singleCashLedgerFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full paths (mounted under /api/v1):
 * POST /api/v1/process/negative-bank/validate
 * POST /api/v1/process/negative-bank/export-invalid
 *
 * Reuses the same Excel upload middleware as Cash Ledger (identical workbook schema).
 */
router.post('/validate', singleCashLedgerFile, negativeBankController.validateNegativeBank);
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  negativeBankController.exportInvalidNegativeBank
);

module.exports = router;

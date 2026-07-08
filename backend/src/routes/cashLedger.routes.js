const express = require('express');
const cashLedgerController = require('../controllers/cashLedger.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { singleCashLedgerFile } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full paths (mounted under /api/v1):
 * POST /api/v1/process/cash-ledger/validate
 * POST /api/v1/process/cash-ledger/export-invalid
 */
router.post('/validate', singleCashLedgerFile, cashLedgerController.validateCashLedger);
router.post(
  '/export-invalid',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  cashLedgerController.exportInvalidCashLedger
);

module.exports = router;

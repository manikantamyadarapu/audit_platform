const express = require('express');
const partyWiseTdsController = require('../controllers/partyWiseTds.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { dualPartyWiseTdsFiles } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full paths (mounted under /api/v1):
 * POST /api/v1/process/party-wise-tds/validate
 * POST /api/v1/process/party-wise-tds/export
 */
router.post('/validate', dualPartyWiseTdsFiles, partyWiseTdsController.validatePartyWiseTds);
router.post(
  '/export',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  partyWiseTdsController.exportPartyWiseTds
);

module.exports = router;

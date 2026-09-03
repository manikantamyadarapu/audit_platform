const express = require('express');
const partyWiseTdsController = require('../controllers/partyWiseTds.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { dualPartyWiseTdsFiles } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);
router.use(authorize(PROCESS_ROLES));

router.post('/validate', dualPartyWiseTdsFiles, partyWiseTdsController.validatePartyWiseTds);
router.post(
  '/export',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  partyWiseTdsController.exportPartyWiseTds
);

module.exports = router;

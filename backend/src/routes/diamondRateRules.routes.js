const express = require('express');
const diamondRateRulesController = require('../controllers/diamondRateRules.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ADMIN_ROLES } = require('../constants/roles');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

router.get('/', diamondRateRulesController.getDiamondRateRules);
router.post(
  '/',
  authorize(ADMIN_ROLES),
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  diamondRateRulesController.saveDiamondRateRules
);

module.exports = router;

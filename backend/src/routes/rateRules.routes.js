const express = require('express');
const rateRulesController = require('../controllers/rateRules.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ADMIN_ROLES } = require('../constants/roles');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

router.get('/', rateRulesController.getRateRules);
router.post(
  '/',
  authorize(ADMIN_ROLES),
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  rateRulesController.saveRateRules
);

module.exports = router;

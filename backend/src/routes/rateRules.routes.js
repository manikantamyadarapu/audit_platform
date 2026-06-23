const express = require('express');
const rateRulesController = require('../controllers/rateRules.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

router.get('/', rateRulesController.getRateRules);
router.post('/', express.json({ limit: REQUEST_BODY_JSON_LIMIT }), rateRulesController.saveRateRules);

module.exports = router;

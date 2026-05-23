const express = require('express');
const diamondRateRulesController = require('../controllers/diamondRateRules.controller');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.get('/', diamondRateRulesController.getDiamondRateRules);
router.post(
  '/',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  diamondRateRulesController.saveDiamondRateRules
);

module.exports = router;

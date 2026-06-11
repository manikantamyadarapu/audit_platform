const express = require('express');
const diamondRateRulesController = require('../controllers/diamondRateRules.controller');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

/**
 * @swagger
 * /api/v1/diamond-rate-rules:
 *   get:
 *     summary: Get diamond rate rules
 *     tags: [Diamond Rate Rules]
 *     security: [bearerAuth: []]
 *     responses:
 *       200: { description: Diamond rate rules retrieved }
 *       401: { description: Unauthorized }
 *   post:
 *     summary: Save diamond rate rules
 *     tags: [Diamond Rate Rules]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { description: Diamond rate rules saved }
 *       401: { description: Unauthorized }
 */
router.get('/', diamondRateRulesController.getDiamondRateRules);
router.post(
  '/',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  diamondRateRulesController.saveDiamondRateRules
);

module.exports = router;

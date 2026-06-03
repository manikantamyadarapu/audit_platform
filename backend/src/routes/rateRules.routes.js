const express = require('express');
const rateRulesController = require('../controllers/rateRules.controller');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

/**
 * @swagger
 * /api/v1/rate-rules:
 *   get:
 *     summary: Get rate rules
 *     tags: [Rate Rules]
 *     security: [bearerAuth: []]
 *     responses:
 *       200: { description: Rate rules retrieved }
 *       401: { description: Unauthorized }
 *   post:
 *     summary: Save rate rules
 *     tags: [Rate Rules]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { description: Rate rules saved }
 *       401: { description: Unauthorized }
 */
router.get('/', rateRulesController.getRateRules);
router.post('/', express.json({ limit: REQUEST_BODY_JSON_LIMIT }), rateRulesController.saveRateRules);

module.exports = router;

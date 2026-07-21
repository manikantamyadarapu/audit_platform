const express = require('express');
const { getTdsRules, saveTdsRules } = require('../controllers/tds.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

/**
 * Full paths (mounted under /api/v1):
 * GET  /api/v1/tds-rules
 * POST /api/v1/tds-rules
 */
router.get('/', getTdsRules);
router.post('/', express.json({ limit: REQUEST_BODY_JSON_LIMIT }), saveTdsRules);

module.exports = router;

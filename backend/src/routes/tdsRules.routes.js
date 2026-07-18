const express = require('express');
const { getTdsRules, saveTdsRules } = require('../controllers/tdsRules.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

router.get('/', getTdsRules);
router.post('/', express.json({ limit: REQUEST_BODY_JSON_LIMIT }), saveTdsRules);

module.exports = router;

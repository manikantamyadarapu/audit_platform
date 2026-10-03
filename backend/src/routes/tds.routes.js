const express = require('express');
const { getTdsRules, saveTdsRules } = require('../controllers/tds.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ADMIN_ROLES } = require('../constants/roles');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

router.get('/', getTdsRules);
router.post(
  '/',
  authorize(ADMIN_ROLES),
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  saveTdsRules
);

module.exports = router;

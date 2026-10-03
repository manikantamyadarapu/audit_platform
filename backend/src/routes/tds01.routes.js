const express = require('express');
const tds01Controller = require('../controllers/tds01.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { singleTds01File } = require('../middleware/upload.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);
router.use(authorize(PROCESS_ROLES));

router.post('/validate', singleTds01File, tds01Controller.validateTds01);
router.post(
  '/export',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  tds01Controller.exportTds01
);

module.exports = router;

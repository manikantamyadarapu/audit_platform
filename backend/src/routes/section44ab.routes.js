const express = require('express');
const router = express.Router();
const section44abController = require('../controllers/section44ab.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { PROCESS_ROLES } = require('../constants/roles');
const { handleMulterError, section44abFiles } = require('../middleware/upload.middleware');

router.post(
  '/validate',
  authenticate,
  authorize(PROCESS_ROLES),
  section44abFiles,
  handleMulterError,
  section44abController.validateSection44AB
);

module.exports = router;

const express = require('express');
const router = express.Router();
const section44abController = require('../controllers/section44ab.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { handleMulterError, section44abFiles } = require('../middleware/upload.middleware');

// Section 44AB routes
router.post(
  '/validate',
  authenticate,
  section44abFiles,
  handleMulterError,
  section44abController.validateSection44AB
);

module.exports = router;

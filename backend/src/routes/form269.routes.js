const express = require('express');
const form269Controller = require('../controllers/form269.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { handleMulterError, form269Files } = require('../middleware/upload.middleware');

const router = express.Router();

router.post(
  '/',
  authenticate,
  form269Files,
  handleMulterError,
  form269Controller.processForm269
);

module.exports = router;

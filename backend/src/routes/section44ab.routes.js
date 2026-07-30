const express = require('express');
const router = express.Router();
const section44abController = require('../controllers/section44ab.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { handleMulterError } = require('../middleware/upload.middleware');
const upload = require('../middleware/upload.middleware');

// Section 44AB routes
router.post(
  '/validate',
  authenticate,
  upload.fields([
    { name: 'cashFiles', maxCount: 10 },
    { name: 'bankFiles', maxCount: 50 },
  ]),
  handleMulterError,
  section44abController.validateSection44AB
);

module.exports = router;

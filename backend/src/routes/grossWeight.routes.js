const express = require('express');
const grossWeightController = require('../controllers/grossWeight.controller');
const { singlePanFile } = require('../middleware/upload.middleware');

const router = express.Router();

/**
 * Full path: POST /api/v1/process/gross-weight/validate
 */
router.post('/validate', singlePanFile, grossWeightController.validate);

module.exports = router;

const express = require('express');
const salesController = require('../controllers/sales.controller');
const { singlePanFile } = require('../middleware/upload.middleware');

const router = express.Router();

/**
 * Full path: POST /api/v1/process/sales/validate
 */
router.post('/validate', singlePanFile, salesController.validate);

module.exports = router;

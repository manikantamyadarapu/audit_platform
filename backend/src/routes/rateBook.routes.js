const express = require('express');
const rateBookController = require('../controllers/rateBook.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { REQUEST_BODY_JSON_LIMIT } = require('../config');

const router = express.Router();

router.use(authenticate);

router.get('/diamonds', rateBookController.getDiamondRates);
router.post(
  '/diamonds',
  express.json({ limit: REQUEST_BODY_JSON_LIMIT }),
  rateBookController.saveDiamondRates
);

module.exports = router;

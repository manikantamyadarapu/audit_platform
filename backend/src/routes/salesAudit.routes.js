const express = require('express');
const salesAuditController = require('../controllers/salesAudit.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

router.get(
  '/product-average-rates',
  authMiddleware,
  salesAuditController.getProductAverageRates
);

router.get(
  '/product-average-rates/export',
  authMiddleware,
  salesAuditController.exportProductAverageRates
);

module.exports = router;

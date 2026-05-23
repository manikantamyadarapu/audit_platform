const express = require('express');
const panRoutes = require('./pan.routes');
const grossWeightRoutes = require('./grossWeight.routes');
const salesRoutes = require('./sales.routes');
const rateRulesRoutes = require('./rateRules.routes');
const diamondRateRulesRoutes = require('./diamondRateRules.routes');

const router = express.Router();

router.use('/process/pan', panRoutes);
router.use('/process/gross-weight', grossWeightRoutes);
router.use('/process/sales', salesRoutes);
router.use('/rate-rules', rateRulesRoutes);
router.use('/diamond-rate-rules', diamondRateRulesRoutes);

module.exports = router;

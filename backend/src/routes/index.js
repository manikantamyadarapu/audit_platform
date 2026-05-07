const express = require('express');
const panRoutes = require('./pan.routes');
const grossWeightRoutes = require('./process.routes');
const salesRoutes = require('./sales.routes');

const router = express.Router();

router.use('/process/pan', panRoutes);
router.use('/process/gross-weight', grossWeightRoutes);
router.use('/process/sales-audit', salesRoutes);

module.exports = router;

const express = require('express');
const panRoutes = require('./pan.routes');

const router = express.Router();

router.use('/process/pan', panRoutes);

module.exports = router;

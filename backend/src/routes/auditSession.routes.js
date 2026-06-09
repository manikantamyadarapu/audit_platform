const express = require('express');
const auditSessionController = require('../controllers/auditSession.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/restore', authMiddleware, auditSessionController.restore);
router.post('/save', authMiddleware, auditSessionController.save);
router.delete('/clear', authMiddleware, auditSessionController.clear);

module.exports = router;

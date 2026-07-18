const express = require('express');
const panRoutes = require('./pan.routes');
const grossWeightRoutes = require('./grossWeight.routes');
const salesRoutes = require('./sales.routes');
const salesReturnRoutes = require('./salesReturn.routes');
const rateRulesRoutes = require('./rateRules.routes');
const diamondRateRulesRoutes = require('./diamondRateRules.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const dashboardRoutes = require('./dashboard.routes');
const salesAuditRoutes = require('./salesAudit.routes');
const auditSessionRoutes = require('./auditSession.routes');
const rateBookRoutes = require('./rateBook.routes');
const cashLedgerRoutes = require('./cashLedger.routes');
const negativeBankRoutes = require('./negativeBank.routes');
const tdsRulesRoutes = require('./tdsRules.routes');

const router = express.Router();

router.use('/process/pan', panRoutes);
router.use('/process/gross-weight', grossWeightRoutes);
router.use('/process/sales', salesRoutes);
router.use('/process/sales-return', salesReturnRoutes);
router.use('/process/cash-ledger', cashLedgerRoutes);
router.use('/process/negative-bank', negativeBankRoutes);
router.use('/rate-rules', rateRulesRoutes);
router.use('/diamond-rate-rules', diamondRateRulesRoutes);
router.use('/tds-rules', tdsRulesRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/sales-audit', salesAuditRoutes);
router.use('/audit-sessions', auditSessionRoutes);
router.use('/rate-book', rateBookRoutes);

module.exports = router;

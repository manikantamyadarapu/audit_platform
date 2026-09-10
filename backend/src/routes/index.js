const express = require('express');
const panRoutes = require('./pan.routes');
const grossWeightRoutes = require('./grossWeight.routes');
const salesRoutes = require('./sales.routes');
const salesReturnRoutes = require('./salesReturn.routes');
const purchaseRoutes = require('./purchase.routes');
const rateRulesRoutes = require('./rateRules.routes');
const diamondRateRulesRoutes = require('./diamondRateRules.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const dashboardRoutes = require('./dashboard.routes');
const auditSessionRoutes = require('./auditSession.routes');
const rateBookRoutes = require('./rateBook.routes');
const cashLedgerRoutes = require('./cashLedger.routes');
const negativeBankRoutes = require('./negativeBank.routes');
const partyWiseTdsRoutes = require('./partyWiseTds.routes');
const tds01Routes = require('./tds01.routes');
const purchaseReturnRoutes = require('./purchaseReturn.routes');
const tdsRoutes = require('./tds.routes');
const notificationRoutes = require('./notification.routes');
const section44abRoutes = require('./section44ab.routes');
const financialsRoutes = require('./financials.routes');

const router = express.Router();

// Single mount point for every audit domain + platform route — all
// available under /api/v1/*. Some routers are additionally mounted
// directly on app.js for legacy unversioned frontend compatibility
// (see app.js for the exact list and why).
router.use('/process/pan', panRoutes);
router.use('/process/gross-weight', grossWeightRoutes);
router.use('/process/sales', salesRoutes);
router.use('/process/sales-return', salesReturnRoutes);
router.use('/process/purchase-return', purchaseReturnRoutes);
router.use('/process/purchase', purchaseRoutes);
router.use('/process/cash-ledger', cashLedgerRoutes);
router.use('/process/negative-bank', negativeBankRoutes);
router.use('/process/party-wise-tds', partyWiseTdsRoutes);
router.use('/process/tds-rate-0.1', tds01Routes);
router.use('/process/section44ab', section44abRoutes);
router.use('/process/financials', financialsRoutes);
router.use('/rate-rules', rateRulesRoutes);
router.use('/diamond-rate-rules', diamondRateRulesRoutes);
router.use('/tds-rules', tdsRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/audit-sessions', auditSessionRoutes);
router.use('/rate-book', rateBookRoutes);
router.use('/notifications', notificationRoutes);
router.use('/demo-videos', require('./demoVideo.routes'));

module.exports = router;

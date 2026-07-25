/**
 * Purchase Return audit persistence — baseline from Purchase Rate & Ledger averages.
 */
const auditRunRepository = require('./auditRun.repository');
const salesProductAverageRepository = require('./salesProductAverage.repository');

module.exports = {
  resolveAuditTypeId: auditRunRepository.resolveAuditTypeId,
  createAuditRun: auditRunRepository.createAuditRun,
  findLatestPurchaseAuditProductAverages:
    salesProductAverageRepository.findLatestPurchaseAuditProductAverages,
};

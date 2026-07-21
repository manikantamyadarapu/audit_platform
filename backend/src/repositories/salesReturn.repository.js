/**
 * Sales Return audit persistence — audit runs are stored in the shared
 * audit_runs table, and the sales-return baseline is read from the sales
 * product-average repository.
 */
const auditRunRepository = require('./auditRun.repository');
const salesProductAverageRepository = require('./salesProductAverage.repository');

module.exports = {
  resolveAuditTypeId: auditRunRepository.resolveAuditTypeId,
  createAuditRun: auditRunRepository.createAuditRun,
  findLatestSalesAuditProductAverages: salesProductAverageRepository.findLatestSalesAuditProductAverages,
};

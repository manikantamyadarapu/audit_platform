/**
 * Purchase ledger audit has no dedicated persistence yet — it thin-wraps
 * the same Python/sales process endpoints used for sales ledgers. Stub
 * kept so the layer file exists per the one-file-per-audit-per-layer
 * convention; re-export shared audit-run helpers for when persistence is
 * added.
 */
const auditRunRepository = require('./auditRun.repository');

module.exports = {
  resolveAuditTypeId: auditRunRepository.resolveAuditTypeId,
  createAuditRun: auditRunRepository.createAuditRun,
};

/**
 * Negative Bank audit has no dedicated tables — audit runs are persisted
 * through the shared audit_runs table. Re-export the helpers this audit
 * relies on so the layer file exists per the one-file-per-audit-per-layer
 * convention.
 */
const auditRunRepository = require('./auditRun.repository');

module.exports = {
  resolveAuditTypeId: auditRunRepository.resolveAuditTypeId,
  createAuditRun: auditRunRepository.createAuditRun,
};

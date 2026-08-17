const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const auditRunPersistence = require('./auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');
const purchaseReturnRepository = require('../repositories/purchaseReturn.repository');

/** @type {{ rateComparisonRecords: object[]; validationIssues: object[]; summary: object; ranAt: string } | null} */
let lastAuditResult = null;

function mapStoredAverageRow(row) {
  return {
    product: row.product,
    salesAccount: row.salesAccount,
    totalQuantity: row.totalQuantity,
    totalGrossAmount: row.totalGrossAmount,
    averageRate: row.averageRate,
  };
}

/**
 * Run purchase return audit using stored purchase audit averages from the database.
 */
async function runAudit(returnBuffer, returnName, returnMime, options = {}) {
  const { auditRun, rows } = await purchaseReturnRepository.findLatestPurchaseAuditProductAverages();

  if (!auditRun || !rows.length) {
    const error = new Error(
      'No purchase audit product averages found. Run Purchase Rate & Ledger Audit first while logged in.'
    );
    error.status = 400;
    error.code = 'MISSING_PURCHASE_AUDIT_BASELINE';
    throw error;
  }

  const purchaseAverages = rows.map(mapStoredAverageRow);

  const data = await pythonClient.postPurchaseReturnValidate(
    returnBuffer,
    returnName,
    returnMime,
    purchaseAverages,
    {
      ...options,
      purchaseAuditRunId: auditRun.id,
      purchaseAuditFileName: auditRun.fileName,
    }
  );

  lastAuditResult = {
    rateComparisonRecords: data.rateComparisonRecords ?? data.comparisonIssues ?? [],
    validationIssues: data.returnValidationRecords ?? data.validationIssues ?? [],
    summary: data.summary ?? {},
    ranAt: new Date().toISOString(),
    purchaseAuditRunId: auditRun.id,
    purchaseAuditFileName: auditRun.fileName,
  };

  return {
    ...data,
    validationIssues: data.validationIssues ?? data.returnValidationRecords ?? [],
    comparisonIssues: data.comparisonIssues ?? data.rateComparisonRecords ?? [],
    purchaseAuditRunId: auditRun.id,
    purchaseAuditFileName: auditRun.fileName,
    purchaseAuditBaselineCount: rows.length,
    salesAuditRunId: auditRun.id,
    salesAuditFileName: auditRun.fileName,
    salesAuditBaselineCount: rows.length,
  };
}

function getRateComparison() {
  if (!lastAuditResult) {
    return null;
  }
  return {
    success: true,
    rateComparisonRecords: lastAuditResult.rateComparisonRecords,
    comparisonIssues: lastAuditResult.rateComparisonRecords,
    summary: lastAuditResult.summary,
    ranAt: lastAuditResult.ranAt,
    purchaseAuditRunId: lastAuditResult.purchaseAuditRunId,
    purchaseAuditFileName: lastAuditResult.purchaseAuditFileName,
    salesAuditRunId: lastAuditResult.purchaseAuditRunId,
    salesAuditFileName: lastAuditResult.purchaseAuditFileName,
  };
}

async function runAuditWithPersistence(req) {
  const { file, requestId, user } = req;

  const data = await runAudit(file.buffer, file.originalname, file.mimetype, { requestId });

  const fileMetadata = {
    originalName: file.originalname,
    storagePath: null,
    fileHash: null,
    fileSize: file.size,
  };

  const performanceMetrics = {
    processingTimeMs: data.processingTimeMs || null,
    memoryUsageMb: data.memoryUsageMb || null,
    rowsPerSecond: data.rowsPerSecond || null,
    cpuUsagePercent: data.cpuUsagePercent || null,
  };

  const auditRunId = await auditRunPersistence.tryPersistAuditRun(
    req,
    AUDIT_KEYS.PURCHASE_RETURN,
    file.originalname,
    data,
    fileMetadata,
    performanceMetrics
  );

  if (user?.id) {
    auditNotification
      .notifyAuditCompleted(user.id, AUDIT_KEYS.PURCHASE_RETURN, file.originalname, data)
      .catch(() => {});
  }

  return { data, auditRunId };
}

function notifyPurchaseReturnFailure(req, err) {
  if (!req.user?.id) return;

  if (err.code === 'MISSING_PURCHASE_AUDIT_BASELINE') {
    auditNotification
      .notifyMissingPrerequisite(req.user.id, AUDIT_KEYS.PURCHASE_RETURN, err.message)
      .catch(() => {});
    return;
  }

  auditNotification
    .notifyAuditFailed(req.user.id, AUDIT_KEYS.PURCHASE_RETURN, req.file?.originalname, err.message)
    .catch(() => {});
}

async function exportRateComparison(records, options = {}) {
  return pythonClient.postPurchaseReturnExportRateComparison(records, options);
}

async function exportExceptions(payload, options = {}) {
  return pythonClient.postPurchaseReturnExportExceptions(payload, options);
}

module.exports = {
  runAudit,
  runAuditWithPersistence,
  notifyPurchaseReturnFailure,
  getRateComparison,
  exportRateComparison,
  exportExceptions,
};

const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const auditRunPersistence = require('./auditRunPersistence.service');
const { AUDIT_KEYS } = require('../constants/notifications');
const salesReturnRepository = require('../repositories/salesReturn.repository');

/** @type {Map<number, object>} */
const lastAuditResultByUser = new Map();

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
 * @param {Buffer} returnBuffer
 * @param {string} returnName
 * @param {string} returnMime
 * @param {{ requestId?: string, userId?: number }} [options]
 */
async function runAudit(returnBuffer, returnName, returnMime, options = {}) {
  const uploadedBy = options.userId != null ? Number(options.userId) : undefined;
  const { auditRun, rows } = await salesReturnRepository.findLatestSalesAuditProductAverages(
    uploadedBy
  );

  if (!auditRun || !rows.length) {
    const error = new Error(
      'No sales audit product averages found. Run Sales Audit (Rate & Ledger Audit) first while logged in.'
    );
    error.status = 400;
    error.code = 'MISSING_SALES_AUDIT_BASELINE';
    throw error;
  }

  const salesAverages = rows.map(mapStoredAverageRow);

  const data = await pythonClient.postSalesReturnValidate(
    returnBuffer,
    returnName,
    returnMime,
    salesAverages,
    {
      ...options,
      salesAuditRunId: auditRun.id,
      salesAuditFileName: auditRun.fileName,
    }
  );

  const result = {
    rateComparisonRecords: data.rateComparisonRecords ?? data.comparisonIssues ?? [],
    validationIssues: data.returnValidationRecords ?? data.validationIssues ?? [],
    summary: data.summary ?? {},
    ranAt: new Date().toISOString(),
    salesAuditRunId: auditRun.id,
    salesAuditFileName: auditRun.fileName,
  };

  if (uploadedBy != null) {
    lastAuditResultByUser.set(uploadedBy, result);
  }

  return {
    ...data,
    validationIssues: data.validationIssues ?? data.returnValidationRecords ?? [],
    comparisonIssues: data.comparisonIssues ?? data.rateComparisonRecords ?? [],
    salesAuditRunId: auditRun.id,
    salesAuditFileName: auditRun.fileName,
    salesAuditBaselineCount: rows.length,
  };
}

/**
 * @param {number} [userId]
 */
function getRateComparison(userId) {
  const lastAuditResult =
    userId != null ? lastAuditResultByUser.get(Number(userId)) : null;
  if (!lastAuditResult) {
    return null;
  }
  return {
    success: true,
    rateComparisonRecords: lastAuditResult.rateComparisonRecords,
    comparisonIssues: lastAuditResult.rateComparisonRecords,
    summary: lastAuditResult.summary,
    ranAt: lastAuditResult.ranAt,
    salesAuditRunId: lastAuditResult.salesAuditRunId,
    salesAuditFileName: lastAuditResult.salesAuditFileName,
  };
}

async function runAuditWithPersistence(req) {
  const { file, requestId, user } = req;

  const data = await runAudit(file.buffer, file.originalname, file.mimetype, {
    requestId,
    userId: user?.id,
  });

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
    AUDIT_KEYS.SALES_RETURN,
    file.originalname,
    data,
    fileMetadata,
    performanceMetrics
  );

  if (user?.id) {
    auditNotification
      .notifyAuditCompleted(user.id, AUDIT_KEYS.SALES_RETURN, file.originalname, data)
      .catch(() => {});
  }

  return { data, auditRunId };
}

function notifySalesReturnFailure(req, err) {
  if (!req.user?.id) return;

  if (err.code === 'MISSING_SALES_AUDIT_BASELINE') {
    auditNotification
      .notifyMissingPrerequisite(req.user.id, AUDIT_KEYS.SALES_RETURN, err.message)
      .catch(() => {});
    return;
  }

  auditNotification
    .notifyAuditFailed(req.user.id, AUDIT_KEYS.SALES_RETURN, req.file?.originalname, err.message)
    .catch(() => {});
}

async function exportRateComparison(records, options = {}) {
  return pythonClient.postSalesReturnExportRateComparison(records, options);
}

async function exportExceptions(payload, options = {}) {
  return pythonClient.postSalesReturnExportExceptions(payload, options);
}

module.exports = {
  runAudit,
  runAuditWithPersistence,
  notifySalesReturnFailure,
  getRateComparison,
  exportRateComparison,
  exportExceptions,
};

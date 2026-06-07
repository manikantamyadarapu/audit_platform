const pythonClient = require('./pythonClient.service');
const salesProductAverageRepository = require('../repositories/salesProductAverage.repository');

/** @type {{ rateComparisonRecords: object[]; summary: object; ranAt: string } | null} */
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
 * Run sales return audit using stored sales audit averages from the database.
 *
 * @param {Buffer} returnBuffer
 * @param {string} returnName
 * @param {string} returnMime
 * @param {{ requestId?: string }} [options]
 */
async function runAudit(returnBuffer, returnName, returnMime, options = {}) {
  const { auditRun, rows } = await salesProductAverageRepository.findLatestSalesAuditProductAverages();

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

  lastAuditResult = {
    rateComparisonRecords: data.rateComparisonRecords ?? data.comparisonIssues ?? [],
    validationIssues: data.returnValidationRecords ?? data.validationIssues ?? [],
    summary: data.summary ?? {},
    ranAt: new Date().toISOString(),
    salesAuditRunId: auditRun.id,
    salesAuditFileName: auditRun.fileName,
  };

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
 * Rate comparison rows from the most recent successful run-audit on this server instance.
 */
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
    salesAuditRunId: lastAuditResult.salesAuditRunId,
    salesAuditFileName: lastAuditResult.salesAuditFileName,
  };
}

module.exports = {
  runAudit,
  getRateComparison,
};

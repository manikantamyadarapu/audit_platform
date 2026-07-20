const auditRunRepository = require('../repositories/auditRun.repository');
const logger = require('../utils/logger');

const SUMMARY_ISSUE_FIELDS = [
  { key: 'rateDeviationViolations', code: 'INVALID_RATE_DEVIATION', name: 'Rate Deviation' },
  { key: 'invalidProductMappings', code: 'INVALID_PRODUCT_MAPPING', name: 'Sales ledger mismatch' },
  { key: 'invalidProductPatterns', code: 'INVALID_PRODUCT_PATTERN', name: 'Product Pattern' },
  { key: 'invalidUomRows', code: 'INVALID_UOM', name: 'invalid UOM' },
  { key: 'invalidFreeQuantityRows', code: 'INVALID_FREE_QUANTITY', name: 'Free Quantity' },
  { key: 'higherReturnRateProducts', code: 'HIGHER_SALES_RETURN_RATE', name: 'Higher Return Rate' },
  {
    key: 'missingSalesBaselineProducts',
    code: 'PRODUCT_NOT_FOUND_IN_SALES',
    name: 'Missing Sales Baseline',
  },
  { key: 'invalidPanFormatCount', code: 'INVALID_PAN_FORMAT', name: 'Invalid PAN Format' },
  { key: 'noPanNoForm60Count', code: 'NO_PAN_NO_FORM60', name: 'No PAN / Form 60' },
  {
    key: 'noPanForm60AvailableCount',
    code: 'PAN_FORM60_AVAILABLE',
    name: 'no pan and form 60 available',
  },
  { key: 'noPanInvalidForm60Count', code: 'INVALID_FORM60', name: 'Invalid Form 60' },
  { key: 'gst50kAddressMissingCount', code: 'GST_ADDRESS_MISSING', name: 'gst >= 50k address missing' },
  {
    key: 'incorrectAddressFormatCount',
    code: 'INVALID_ADDRESS_FORMAT',
    name: 'Invalid Address Format',
  },
  { key: 'mismatchCount', code: 'GROSS_WEIGHT_MISMATCH', name: 'gross weight mismatch' },
  { key: 'weightMismatch', code: 'GROSS_WEIGHT_MISMATCH', name: 'gross weight mismatch' },
  { key: 'negativeValueViolations', code: 'NEGATIVE_GROSS_WEIGHT', name: 'Negative Gross Weight' },
];

/**
 * @param {Record<string, unknown>} pythonResult
 */
function extractMetrics(pythonResult) {
  const summary = pythonResult?.summary ?? {};
  const totalRows = Number(
    pythonResult?.totalRows ?? summary.totalRows ?? summary.totalInputRows ?? 0
  );

  let invalidRows = Number(
    summary.exceptionRowCount ??
      pythonResult?.errorRows ??
      summary.distinctInvalidRows ??
      summary.errorRowsCount ??
      summary.totalInvalidRows ??
      summary.returnValidationErrorRows ??
      summary.mismatchCount ??
      summary.invalidPanFormatCount ??
      0
  );

  if (!invalidRows && Number(summary.rateComparisonViolations) > 0) {
    invalidRows = Number(summary.rateComparisonViolations);
  }

  return { totalRows, invalidRows };
}

/**
 * @param {Record<string, unknown>} pythonResult
 * @returns {Array<{ code: string, name: string, count: number }>}
 */
function extractIssueCounts(pythonResult) {
  const summary = pythonResult?.summary ?? {};
  const merged = new Map();

  for (const field of SUMMARY_ISSUE_FIELDS) {
    const count = Number(summary[field.key]) || 0;
    if (count <= 0) continue;

    const existing = merged.get(field.code);
    if (existing) {
      existing.count += count;
    } else {
      merged.set(field.code, {
        code: field.code,
        name: field.name,
        count,
      });
    }
  }

  return [...merged.values()];
}

/**
 * Persist one completed audit run for dashboard metrics.
 * @param {{
 *   userId: number,
 *   auditCode: string,
 *   fileName?: string,
 *   pythonResult: Record<string, unknown>,
 *   fileMetadata?: object,
 *   performanceMetrics?: object,
 * }} params
 * @returns {Promise<number | null>}
 */
async function persistAuditRunFromResult({ userId, auditCode, fileName, pythonResult, fileMetadata, performanceMetrics }) {
  if (!userId) return null;

  const auditTypeId = await auditRunRepository.resolveAuditTypeId(auditCode);
  if (!auditTypeId) {
    throw new Error(`Audit type not configured for code: ${auditCode}`);
  }

  const { totalRows, invalidRows } = extractMetrics(pythonResult);
  const issueCounts = extractIssueCounts(pythonResult);

  // Build resultSummary based on audit type
  const resultSummary = {
    issueCounts: issueCounts,
  };

  // Add audit-type specific fields to resultSummary
  const summary = pythonResult?.summary ?? {};
  if (auditCode === 'GROSS' || auditCode === 'GROSS_WEIGHT') {
    resultSummary.grossMismatchCount = summary.mismatchCount || 0;
    resultSummary.netMismatchCount = summary.weightMismatch || 0;
    resultSummary.stoneMismatchCount = summary.stoneMismatchCount || 0;
    resultSummary.validRows = summary.validRows || 0;
  } else if (auditCode === 'SALES') {
    resultSummary.goldDeviationCount = summary.rateDeviationViolations || 0;
    resultSummary.silverDeviationCount = summary.silverDeviationCount || 0;
    resultSummary.diamondDeviationCount = summary.diamondDeviationCount || 0;
    resultSummary.missingRuleCount = summary.missingRuleCount || 0;
    resultSummary.rateOutOfRangeCount = summary.rateOutOfRangeCount || 0;
  } else if (auditCode === 'PAN' || auditCode === 'PAN_AUDIT') {
    resultSummary.invalidPanCount = summary.invalidPanFormatCount || 0;
    resultSummary.invalidAadharCount = summary.invalidAadharCount || 0;
    resultSummary.invalidGstCount = summary.invalidGstCount || 0;
    resultSummary.duplicatePanCount = summary.duplicatePanCount || 0;
    resultSummary.duplicateAadharCount = summary.duplicateAadharCount || 0;
    resultSummary.missingIdCount = summary.missingIdCount || 0;
  }

  const auditRun = await auditRunRepository.createAuditRun({
    auditTypeId,
    uploadedBy: userId,
    fileName,
    totalRows,
    invalidRows,
    resultSummary,
    fileMetadata,
    performanceMetrics,
  });

  return auditRun.id;
}

/**
 * @param {import('express').Request} req
 * @param {string} auditCode
 * @param {string | undefined} fileName
 * @param {Record<string, unknown>} pythonResult
 * @param {object} fileMetadata
 * @param {object} performanceMetrics
 */
async function tryPersistAuditRun(req, auditCode, fileName, pythonResult, fileMetadata, performanceMetrics) {
  if (!req.user?.id) return null;

  try {
    return await persistAuditRunFromResult({
      userId: req.user.id,
      auditCode,
      fileName,
      pythonResult,
      fileMetadata,
      performanceMetrics,
    });
  } catch (err) {
    logger.error('Audit run persist failed', {
      requestId: req.requestId,
      userId: req.user.id,
      auditCode,
      message: err.message,
    });
    return null;
  }
}

module.exports = {
  persistAuditRunFromResult,
  tryPersistAuditRun,
  extractMetrics,
  extractIssueCounts,
};

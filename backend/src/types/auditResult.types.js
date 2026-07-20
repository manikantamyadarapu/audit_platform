/**
 * @typedef {Object} IssueCount
 * @property {string} code - Issue code (e.g., 'INVALID_RATE_DEVIATION', 'GROSS_WEIGHT_MISMATCH')
 * @property {string} name - Human-readable issue name
 * @property {number} count - Number of occurrences
 */

/**
 * @typedef {Object} BaseResultSummary
 * @property {IssueCount[]} issueCounts - Array of issue counts
 */

/**
 * @typedef {BaseResultSummary & {
 *   grossMismatchCount: number,
 *   netMismatchCount: number,
 *   stoneMismatchCount: number,
 *   validRows: number
 * }} GrossAuditResultSummary
 * Result summary for Gross Weight audits
 */

/**
 * @typedef {BaseResultSummary & {
 *   goldDeviationCount: number,
 *   silverDeviationCount: number,
 *   diamondDeviationCount: number,
 *   missingRuleCount: number,
 *   rateOutOfRangeCount: number
 * }} SalesAuditResultSummary
 * Result summary for Sales audits
 */

/**
 * @typedef {BaseResultSummary & {
 *   invalidPanCount: number,
 *   invalidAadharCount: number,
 *   invalidGstCount: number,
 *   duplicatePanCount: number,
 *   duplicateAadharCount: number,
 *   missingIdCount: number
 * }} PanAuditResultSummary
 * Result summary for PAN/ID Proof audits
 */

/**
 * @typedef {BaseResultSummary & {
 *   productRates: ProductRate[]
 * }} SalesAuditWithRatesResultSummary
 * Result summary for Sales audits with product rates
 */

/**
 * @typedef {Object} ProductRate
 * @property {string} product - Product name
 * @property {string} productNorm - Normalized product name
 * @property {string} salesAccount - Sales account
 * @property {number} totalQuantity - Total quantity
 * @property {number} totalGrossAmount - Total gross amount
 * @property {number} averageRate - Average rate
 * @property {number} transactionCount - Number of transactions
 */

/**
 * @typedef {GrossAuditResultSummary | SalesAuditResultSummary | PanAuditResultSummary | SalesAuditWithRatesResultSummary} AuditResultSummary
 * Union type for all audit result summary types
 */

/**
 * @typedef {Object} FileMetadata
 * @property {string} originalName - Original filename
 * @property {string|null} storagePath - Storage path (if file is stored)
 * @property {string|null} fileHash - File hash (if computed)
 * @property {number} fileSize - File size in bytes
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number|null} processingTimeMs - Processing time in milliseconds
 * @property {number|null} memoryUsageMb - Memory usage in MB
 * @property {number|null} rowsPerSecond - Rows processed per second
 * @property {number|null} cpuUsagePercent - CPU usage percentage
 */

/**
 * @typedef {Object} DashboardMetricByAuditType
 * @property {string} auditType - Audit type code
 * @property {string} auditName - Audit type name
 * @property {number} totalAudits - Total number of audits
 * @property {number} completedAudits - Number of completed audits
 * @property {number} failedAudits - Number of failed audits
 * @property {number} totalRows - Total rows processed
 * @property {number} totalIssues - Total issues found
 * @property {number} avgProcessingTimeSec - Average processing time in seconds
 */

module.exports = {
  // Export type references for JSDoc usage
};

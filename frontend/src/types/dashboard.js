/**
 * @typedef {'up'|'down'|'neutral'} DashboardTrend
 */

/**
 * @typedef {Object} DashboardWidgetMetric
 * @property {number} value
 * @property {number} change
 * @property {DashboardTrend} trend
 */

/**
 * @typedef {Object} DashboardWidgetsData
 * @property {'week'|'month'|'year'} period
 * @property {DashboardWidgetMetric} totalAudits
 * @property {DashboardWidgetMetric} totalRecords
 * @property {DashboardWidgetMetric} totalIssues
 * @property {DashboardWidgetMetric} accuracy
 */

/**
 * @typedef {'daily'|'weekly'|'monthly'} DashboardTrendPeriod
 */

/**
 * @typedef {Object} DashboardAuditTrendData
 * @property {DashboardTrendPeriod} period
 * @property {string[]} labels
 * @property {number[]} auditsProcessed
 * @property {number[]} issuesFound
 */

/**
 * @typedef {Object} DashboardIssueCategoryItem
 * @property {string} name
 * @property {string} code
 * @property {number} count
 * @property {number} percentage
 */

/**
 * @typedef {Object} DashboardIssuesCategoryData
 * @property {'week'|'month'|'year'} period
 * @property {number} totalIssues
 * @property {DashboardIssueCategoryItem[]} categories
 */

/**
 * @typedef {'PENDING'|'PROCESSING'|'COMPLETED'|'FAILED'} DashboardAuditStatus
 */

/**
 * @typedef {Object} DashboardRecentAuditItem
 * @property {number} auditId
 * @property {string} fileName
 * @property {string} auditType
 * @property {number} records
 * @property {string} uploadedOn
 * @property {DashboardAuditStatus} status
 */

/**
 * @typedef {Object} DashboardPaginationMeta
 * @property {number} page
 * @property {number} limit
 * @property {number} total
 * @property {number} totalPages
 */

/**
 * @typedef {Object} DashboardRecentAuditsResult
 * @property {DashboardRecentAuditItem[]} items
 * @property {DashboardPaginationMeta} pagination
 */

export {};

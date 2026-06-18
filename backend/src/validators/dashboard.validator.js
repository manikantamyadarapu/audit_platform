const ALLOWED_PERIODS = ['week', 'month', 'year'];
const ALLOWED_TREND_PERIODS = ['daily', 'weekly', 'monthly'];
const ALLOWED_AUDIT_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
const MAX_RECENT_AUDITS_LIMIT = 100;
const DEFAULT_RECENT_AUDITS_LIMIT = 10;
const DEFAULT_RECENT_AUDITS_PAGE = 1;

/**
 * Validate dashboard widgets query parameters.
 * @param {{ period?: string }} query
 * @returns {{ period: 'week' | 'month' | 'year' }}
 * @throws {{ statusCode: number, message: string }}
 */
function validateWidgetsQuery(query = {}) {
  const period = query.period == null || query.period === '' ? 'week' : String(query.period).toLowerCase();

  if (!ALLOWED_PERIODS.includes(period)) {
    const error = new Error('Invalid period filter');
    error.statusCode = 400;
    throw error;
  }

  return { period };
}

/**
 * Validate audit trend query parameters (aligned with dashboard widgets period).
 * @param {{ period?: string }} query
 * @returns {{ period: 'week' | 'month' | 'year' }}
 */
function validateTrendQuery(query = {}) {
  const raw = query.period == null || query.period === '' ? 'week' : String(query.period).toLowerCase();
  const legacyMap = {
    daily: 'week',
    weekly: 'month',
    monthly: 'year',
  };
  const period = legacyMap[raw] ?? raw;
  return validateWidgetsQuery({ period });
}

/**
 * Parse positive integer query param with bounds.
 * @param {unknown} value
 * @param {number} fallback
 * @param {{ min?: number, max?: number }} [bounds]
 * @returns {number}
 */
function parsePositiveInt(value, fallback, bounds = {}) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed < (bounds.min ?? 1)) {
    const error = new Error('Invalid query parameters');
    error.statusCode = 400;
    throw error;
  }

  if (bounds.max != null && parsed > bounds.max) {
    const error = new Error(`limit must not exceed ${bounds.max}`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

/**
 * Validate recent audits query parameters.
 * @param {{ page?: string, limit?: string, status?: string, auditType?: string, search?: string }} query
 * @returns {{ page: number, limit: number, status?: string, auditType?: number, search?: string }}
 * @throws {{ statusCode: number, message: string }}
 */
function validateRecentAuditsQuery(query = {}) {
  const page = parsePositiveInt(query.page, DEFAULT_RECENT_AUDITS_PAGE);
  const limit = parsePositiveInt(query.limit, DEFAULT_RECENT_AUDITS_LIMIT, {
    min: 1,
    max: MAX_RECENT_AUDITS_LIMIT,
  });

  let status;
  if (query.status != null && query.status !== '') {
    status = String(query.status).toUpperCase();
    if (!ALLOWED_AUDIT_STATUSES.includes(status)) {
      const error = new Error('Invalid status filter');
      error.statusCode = 400;
      throw error;
    }
  }

  let auditType;
  if (query.auditType != null && query.auditType !== '') {
    auditType = Number.parseInt(String(query.auditType), 10);
    if (!Number.isFinite(auditType) || auditType < 1) {
      const error = new Error('Invalid auditType filter');
      error.statusCode = 400;
      throw error;
    }
  }

  let search;
  if (query.search != null && String(query.search).trim() !== '') {
    search = String(query.search).trim();
  }

  let period;
  if (query.period != null && query.period !== '') {
    period = validateWidgetsQuery({ period: query.period }).period;
  }

  return { page, limit, status, auditType, search, period };
}

module.exports = {
  validateWidgetsQuery,
  validateTrendQuery,
  validateRecentAuditsQuery,
  ALLOWED_PERIODS,
  ALLOWED_TREND_PERIODS,
  ALLOWED_AUDIT_STATUSES,
  MAX_RECENT_AUDITS_LIMIT,
};

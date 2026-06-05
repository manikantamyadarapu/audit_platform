const ALLOWED_PERIODS = ['week', 'month', 'year'];
const ALLOWED_TREND_PERIODS = ['daily', 'weekly', 'monthly'];

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
 * Validate audit trend query parameters.
 * @param {{ period?: string }} query
 * @returns {{ period: 'daily' | 'weekly' | 'monthly' }}
 * @throws {{ statusCode: number, message: string }}
 */
function validateTrendQuery(query = {}) {
  const period = query.period == null || query.period === '' ? 'daily' : String(query.period).toLowerCase();

  if (!ALLOWED_TREND_PERIODS.includes(period)) {
    const error = new Error('Invalid period filter');
    error.statusCode = 400;
    throw error;
  }

  return { period };
}

module.exports = {
  validateWidgetsQuery,
  validateTrendQuery,
  ALLOWED_PERIODS,
  ALLOWED_TREND_PERIODS,
};

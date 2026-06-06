const dashboardRepository = require('../repositories/dashboard.repository');
const {
  validateWidgetsQuery,
  validateTrendQuery,
  validateRecentAuditsQuery,
} = require('../validators/dashboard.validator');
const logger = require('../utils/logger');

const PERIOD_DAYS = {
  week: 7,
  month: 30,
  year: 365,
};

/**
 * @param {'week'|'month'|'year'} period
 */
function getPeriodRanges(period) {
  const days = PERIOD_DAYS[period];
  const currentEnd = new Date();
  const currentStart = new Date(currentEnd);
  currentStart.setDate(currentStart.getDate() - days);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  return {
    current: { startDate: currentStart, endDate: currentEnd },
    previous: { startDate: previousStart, endDate: currentStart },
  };
}

/**
 * @param {number} totalRecords
 * @param {number} totalIssues
 * @returns {number}
 */
function calculateAccuracy(totalRecords, totalIssues) {
  if (totalRecords <= 0) {
    return 0;
  }
  const accuracy = ((totalRecords - totalIssues) / totalRecords) * 100;
  return Math.round(accuracy * 100) / 100;
}

/**
 * Percent change vs previous period for count metrics (audits, records, issues).
 * @param {number} currentValue
 * @param {number} previousValue
 * @returns {{ value: number, change: number, trend: 'up' | 'down' | 'neutral' }}
 */
function buildTrendMetric(currentValue, previousValue) {
  const value = currentValue;

  if (previousValue === 0) {
    return { value, change: 0, trend: 'neutral' };
  }

  const change = Math.round(((currentValue - previousValue) / previousValue) * 100);

  let trend = 'neutral';
  if (change > 0) trend = 'up';
  else if (change < 0) trend = 'down';

  return { value, change, trend };
}

/**
 * Accuracy trend uses percentage-point delta (not percent-of-percent).
 * @param {number} currentAccuracy
 * @param {number} previousAccuracy
 * @returns {{ value: number, change: number, trend: 'up' | 'down' | 'neutral' }}
 */
function buildAccuracyTrend(currentAccuracy, previousAccuracy) {
  const value = currentAccuracy;

  if (previousAccuracy === 0) {
    return { value, change: 0, trend: 'neutral' };
  }

  const change = Math.round((currentAccuracy - previousAccuracy) * 100) / 100;

  let trend = 'neutral';
  if (change > 0) trend = 'up';
  else if (change < 0) trend = 'down';

  return { value, change, trend };
}

/**
 * @param {import('express').Request['query']} query
 * @param {{ id: number, role?: string }} user
 */
async function getDashboardWidgets(query, user) {
  const { period } = validateWidgetsQuery(query);
  const ranges = getPeriodRanges(period);

  logger.info('Fetching dashboard widgets', {
    userId: user?.id,
    role: user?.role,
    period,
  });

  const [
    currentAudits,
    previousAudits,
    currentRecords,
    previousRecords,
    currentIssues,
    previousIssues,
  ] = await Promise.all([
    dashboardRepository.getTotalAudits(ranges.current.startDate, ranges.current.endDate),
    dashboardRepository.getTotalAudits(ranges.previous.startDate, ranges.previous.endDate, true),
    dashboardRepository.getTotalRecords(ranges.current.startDate, ranges.current.endDate),
    dashboardRepository.getTotalRecords(ranges.previous.startDate, ranges.previous.endDate, true),
    dashboardRepository.getTotalIssues(ranges.current.startDate, ranges.current.endDate),
    dashboardRepository.getTotalIssues(ranges.previous.startDate, ranges.previous.endDate, true),
  ]);

  const currentAccuracy = calculateAccuracy(currentRecords, currentIssues);
  const previousAccuracy = calculateAccuracy(previousRecords, previousIssues);

  return {
    period,
    totalAudits: buildTrendMetric(currentAudits, previousAudits),
    totalRecords: buildTrendMetric(currentRecords, previousRecords),
    totalIssues: buildTrendMetric(currentIssues, previousIssues),
    accuracy: buildAccuracyTrend(currentAccuracy, previousAccuracy),
  };
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function getWeekStart(date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? 6 : day - 1;
  value.setDate(value.getDate() - diff);
  return value;
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildDailyBuckets() {
  const buckets = [];
  const today = startOfDay(new Date());

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    buckets.push({
      key: day.toISOString().slice(0, 10),
      label: formatDayLabel(day),
      start: startOfDay(day),
      end: endOfDay(day),
    });
  }

  return buckets;
}

function buildWeeklyBuckets() {
  const buckets = [];
  const currentWeekStart = getWeekStart(new Date());

  for (let index = 11; index >= 0; index -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - index * 7);
    const weekEnd = endOfDay(new Date(weekStart));
    weekEnd.setDate(weekEnd.getDate() + 6);

    buckets.push({
      key: weekStart.toISOString().slice(0, 10),
      label: `Week ${12 - index}`,
      start: weekStart,
      end: weekEnd,
    });
  }

  return buckets;
}

function buildMonthlyBuckets() {
  const buckets = [];
  const now = new Date();

  for (let index = 11; index >= 0; index -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const monthStart = startOfDay(monthDate);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

    buckets.push({
      key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
      label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      start: monthStart,
      end: monthEnd,
    });
  }

  return buckets;
}

/**
 * @param {'daily'|'weekly'|'monthly'} period
 */
function getTrendBuckets(period) {
  if (period === 'weekly') return buildWeeklyBuckets();
  if (period === 'monthly') return buildMonthlyBuckets();
  return buildDailyBuckets();
}

/**
 * @param {Array<{ createdAt: Date, invalidRows: number, issueCounts: Array<{ issueCount: number }> }>} runs
 * @param {Array<{ key: string, label: string, start: Date, end: Date }>} buckets
 */
function aggregateRunsIntoBuckets(runs, buckets) {
  const auditsByKey = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const issuesByKey = new Map(buckets.map((bucket) => [bucket.key, 0]));

  for (const run of runs) {
    const runDate = new Date(run.createdAt);
    const bucket = buckets.find((entry) => runDate >= entry.start && runDate <= entry.end);
    if (!bucket) continue;

    auditsByKey.set(bucket.key, (auditsByKey.get(bucket.key) || 0) + 1);
    issuesByKey.set(
      bucket.key,
      (issuesByKey.get(bucket.key) || 0) + dashboardRepository.resolveRunIssueTotal(run)
    );
  }

  return {
    labels: buckets.map((bucket) => bucket.label),
    auditsProcessed: buckets.map((bucket) => auditsByKey.get(bucket.key) || 0),
    issuesFound: buckets.map((bucket) => issuesByKey.get(bucket.key) || 0),
  };
}

/**
 * @param {import('express').Request['query']} query
 * @param {{ id: number, role?: string }} user
 */
async function getAuditTrend(query, user) {
  const { period } = validateTrendQuery(query);
  const buckets = getTrendBuckets(period);
  const startDate = buckets[0].start;

  logger.info('Fetching audit activity trend', {
    userId: user?.id,
    role: user?.role,
    period,
  });

  let runs;
  if (period === 'weekly') {
    runs = await dashboardRepository.getWeeklyTrend(startDate);
  } else if (period === 'monthly') {
    runs = await dashboardRepository.getMonthlyTrend(startDate);
  } else {
    runs = await dashboardRepository.getDailyTrend(startDate);
  }

  if (!runs.length) {
    return {
      period,
      labels: [],
      auditsProcessed: [],
      issuesFound: [],
      isEmpty: true,
    };
  }

  const chartData = aggregateRunsIntoBuckets(runs, buckets);

  return {
    period,
    ...chartData,
    isEmpty: false,
  };
}

/**
 * @param {number} count
 * @param {number} totalIssues
 * @returns {number}
 */
function calculateCategoryPercentage(count, totalIssues) {
  if (totalIssues <= 0) {
    return 0;
  }

  return Math.round((count / totalIssues) * 1000) / 10;
}

/**
 * Build donut-chart categories from grouped issue rows (dynamic — any issue type from DB).
 * @param {Array<{ issueCode: string, issueName: string, _sum: { issueCount: number | null } }>} groupedIssues
 */
function buildDynamicIssueCategories(groupedIssues) {
  const categories = groupedIssues
    .map((row) => ({
      name: row.issueName || row.issueCode,
      code: row.issueCode,
      count: row._sum.issueCount ?? 0,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalIssues = categories.reduce((sum, item) => sum + item.count, 0);

  return {
    totalIssues,
    categories: categories.map((item) => ({
      name: item.name,
      code: item.code,
      count: item.count,
      percentage: calculateCategoryPercentage(item.count, totalIssues),
    })),
  };
}

/**
 * @param {import('express').Request['query']} query
 * @param {{ id: number, role?: string }} user
 */
async function getIssuesByCategory(query, user) {
  const { period } = validateWidgetsQuery(query);
  const { startDate, endDate } = getPeriodRanges(period).current;

  logger.info('Fetching issues by category', {
    userId: user?.id,
    role: user?.role,
    period,
  });

  const groupedIssues = await dashboardRepository.getIssuesByCategory(startDate, endDate);

  if (!groupedIssues.length) {
    return {
      period,
      totalIssues: 0,
      categories: [],
      isEmpty: true,
    };
  }

  const { totalIssues, categories } = buildDynamicIssueCategories(groupedIssues);

  if (totalIssues <= 0 || !categories.length) {
    return {
      period,
      totalIssues: 0,
      categories: [],
      isEmpty: true,
    };
  }

  return {
    period,
    totalIssues,
    categories,
    isEmpty: false,
  };
}

/**
 * @param {{ id: number, fileName: string, totalRows: number, createdAt: Date, status: string, auditType: { auditName: string } }} run
 */
function mapRecentAuditRow(run) {
  return {
    auditId: run.id,
    fileName: run.fileName,
    auditType: run.auditType?.auditName ?? 'Unknown',
    records: run.totalRows,
    uploadedOn: run.createdAt.toISOString(),
    status: run.status,
  };
}

/**
 * @param {import('express').Request['query']} query
 * @param {{ id: number, role?: string }} user
 */
async function getRecentAudits(query, user) {
  const filters = validateRecentAuditsQuery(query);

  logger.info('Fetching recent audit uploads', {
    userId: user?.id,
    role: user?.role,
    page: filters.page,
    limit: filters.limit,
    status: filters.status,
    auditType: filters.auditType,
    search: filters.search,
  });

  const { runs, total } = await dashboardRepository.getRecentAudits(filters);
  const totalPages = total === 0 ? 0 : Math.ceil(total / filters.limit);

  return {
    data: runs.map(mapRecentAuditRow),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages,
    },
  };
}

module.exports = {
  getDashboardWidgets,
  getAuditTrend,
  getIssuesByCategory,
  getRecentAudits,
  getPeriodRanges,
  calculateAccuracy,
  buildTrendMetric,
  buildAccuracyTrend,
  getTrendBuckets,
  aggregateRunsIntoBuckets,
  calculateCategoryPercentage,
  buildDynamicIssueCategories,
};

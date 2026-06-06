import { formatNumber } from './format';

/** @typedef {'week'|'month'|'year'} DashboardPeriod */

export const DASHBOARD_PERIOD_OPTIONS = [
  { id: 'week', label: 'Week', compareLabel: 'previous 7 days' },
  { id: 'month', label: 'Month', compareLabel: 'previous 30 days' },
  { id: 'year', label: 'Year', compareLabel: 'previous year' },
];

/**
 * @param {DashboardPeriod} period
 */
export function periodCompareLabel(period) {
  return DASHBOARD_PERIOD_OPTIONS.find((o) => o.id === period)?.compareLabel ?? 'previous period';
}

/**
 * @param {{ value: number, change: number, trend: string }} metric
 * @param {DashboardPeriod} period
 * @param {{ isAccuracy?: boolean, invertTrendColor?: boolean }} [options]
 */
export function formatWidgetTrend(metric, period, options = {}) {
  const { isAccuracy = false, invertTrendColor = false } = options;
  const compare = periodCompareLabel(period);

  if (!metric || metric.trend === 'neutral') {
    return { text: `No prior data · ${compare}`, tone: 'neutral' };
  }

  const arrow = metric.trend === 'up' ? '\u2191' : '\u2193';
  const sign = metric.change > 0 ? '+' : '';
  const changeText = isAccuracy
    ? `${sign}${metric.change}%`
    : `${sign}${metric.change}%`;

  let tone = metric.trend === 'up' ? 'up' : 'down';
  if (invertTrendColor) {
    tone = metric.trend === 'up' ? 'down' : metric.trend === 'down' ? 'up' : 'neutral';
  }

  return {
    text: `${arrow} ${changeText} vs ${compare}`,
    tone,
  };
}

const KPI_DEFINITIONS = [
  { key: 'totalAudits', label: 'Total Audits', tone: 'green' },
  { key: 'totalRecords', label: 'Total Records', tone: 'amber' },
  { key: 'totalIssues', label: 'Total Issues', tone: 'red' },
  { key: 'accuracy', label: 'Accuracy', tone: 'green' },
];

/**
 * @param {import('../types/dashboard').DashboardWidgetsData | null} widgets
 */
export function buildDashboardKpiItems(widgets) {
  if (!widgets) {
    return KPI_DEFINITIONS.map((def) => ({
      ...def,
      value: '—',
      trend: { text: 'Loading metrics…', tone: 'neutral' },
    }));
  }

  const period = widgets.period ?? 'week';

  return [
    {
      key: 'totalAudits',
      label: 'Total Audits',
      value: formatNumber(widgets.totalAudits?.value ?? 0),
      tone: 'green',
      trend: formatWidgetTrend(widgets.totalAudits, period),
    },
    {
      key: 'totalRecords',
      label: 'Total Records',
      value: formatNumber(widgets.totalRecords?.value ?? 0),
      tone: 'amber',
      trend: formatWidgetTrend(widgets.totalRecords, period),
    },
    {
      key: 'totalIssues',
      label: 'Total Issues',
      value: formatNumber(widgets.totalIssues?.value ?? 0),
      tone: 'red',
      trend: formatWidgetTrend(widgets.totalIssues, period, { invertTrendColor: true }),
    },
    {
      key: 'accuracy',
      label: 'Accuracy',
      value: `${formatNumber(widgets.accuracy?.value ?? 0, 2)}%`,
      tone: 'green',
      trend: formatWidgetTrend(widgets.accuracy, period, { isAccuracy: true }),
    },
  ];
}

/**
 * @param {import('../types/dashboard').DashboardWidgetsData | null} widgets
 */
export function buildSummaryStripItems(widgets) {
  if (!widgets) {
    return [
      { label: 'Processed Rows', value: '—', trend: { text: '…', tone: 'neutral' } },
      { label: 'Failed Validations', value: '—', trend: { text: '…', tone: 'neutral' } },
      { label: 'Passed Validations', value: '—', trend: { text: '…', tone: 'neutral' } },
      { label: 'Accuracy Score', value: '—', trend: { text: '…', tone: 'neutral' }, badge: null },
    ];
  }

  const records = widgets.totalRecords?.value ?? 0;
  const issues = widgets.totalIssues?.value ?? 0;
  const passed = Math.max(0, records - issues);
  const accuracy = widgets.accuracy?.value ?? 0;

  const period = widgets.period ?? 'week';

  const recordsTrend = formatWidgetTrend(widgets.totalRecords, period);
  const issuesTrend = formatWidgetTrend(widgets.totalIssues, period, { invertTrendColor: true });
  const accuracyTrend = formatWidgetTrend(widgets.accuracy, period, { isAccuracy: true });

  return [
    {
      label: 'Processed Rows',
      value: formatNumber(records),
      trend: recordsTrend,
    },
    {
      label: 'Failed Validations',
      value: formatNumber(issues),
      trend: issuesTrend,
    },
    {
      label: 'Passed Validations',
      value: formatNumber(passed),
      trend: {
        text: passed > 0 ? `${formatNumber(passed)} rows clean` : '—',
        tone: 'neutral',
      },
    },
    {
      label: 'Accuracy Score',
      value: `${formatNumber(accuracy, 2)}%`,
      trend: accuracyTrend,
      badge: accuracy >= 95 ? 'Low risk' : accuracy >= 85 ? 'Medium' : 'High',
    },
  ];
}

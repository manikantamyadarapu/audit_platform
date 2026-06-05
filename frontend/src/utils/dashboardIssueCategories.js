/** Rotating palette for dynamic issue slices in the donut chart. */
export const ISSUE_CHART_COLORS = [
  '#58c995',
  '#c9eca0',
  '#ffda6b',
  '#a78bfa',
  '#38bdf8',
  '#fb923c',
  '#f472b6',
  '#34d399',
  '#818cf8',
  '#fbbf24',
  '#cbd5e1',
];

/**
 * @param {import('../types/dashboard').DashboardIssuesCategoryData | null} data
 */
export function buildIssueCategoryItems(data) {
  if (!data?.categories?.length) {
    return [];
  }

  return data.categories.map((category, index) => ({
    name: category.name,
    code: category.code,
    value: category.count,
    percent: `${category.percentage}%`,
    color: ISSUE_CHART_COLORS[index % ISSUE_CHART_COLORS.length],
  }));
}

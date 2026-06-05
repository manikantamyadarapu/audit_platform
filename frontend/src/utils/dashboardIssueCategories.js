export const ISSUE_CATEGORY_COLORS = {
  'PAN Issues': '#58c995',
  'Gross Weight Issues': '#c9eca0',
  'Rate Verification Issues': '#ffda6b',
  'ID Proof Issues': '#a78bfa',
  'Other Issues': '#cbd5e1',
};

/**
 * @param {import('../types/dashboard').DashboardIssuesCategoryData | null} data
 */
export function buildIssueCategoryItems(data) {
  if (!data?.categories?.length) {
    return [];
  }

  return data.categories.map((category) => ({
    name: category.name,
    value: category.count,
    percent: `${category.percentage}%`,
    color: ISSUE_CATEGORY_COLORS[category.name] || '#cbd5e1',
  }));
}

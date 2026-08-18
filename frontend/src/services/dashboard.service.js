import apiClient, { getApiErrorMessage } from './apiClient';
import { getAuthToken } from '../utils/authUser';

/**
 * @param {'week'|'month'|'year'} [period='week']
 * @returns {Promise<import('../types/dashboard').DashboardWidgetsData>}
 */
export async function fetchDashboardWidgets(period = 'week') {
  const token = getAuthToken();
  const { data } = await apiClient.get('/api/dashboard/widgets', {
    params: { period },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to load dashboard widgets');
  }

  return data.data;
}

export function getDashboardWidgetsErrorMessage(error) {
  return getApiErrorMessage(error);
}

/**
 * @param {'week'|'month'|'year'} [period='week']
 * @returns {Promise<import('../types/dashboard').DashboardAuditTrendData>}
 */
export async function fetchDashboardAuditTrend(period = 'week') {
  const token = getAuthToken();
  const { data } = await apiClient.get('/api/dashboard/audit-trend', {
    params: { period },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to load audit trend');
  }

  return data.data;
}

export function getDashboardAuditTrendErrorMessage(error) {
  return getApiErrorMessage(error);
}

/**
 * @param {'week'|'month'|'year'} [period='week']
 * @returns {Promise<import('../types/dashboard').DashboardIssuesCategoryData>}
 */
export async function fetchDashboardIssuesCategory(period = 'week') {
  const token = getAuthToken();
  const { data } = await apiClient.get('/api/dashboard/issues-category', {
    params: { period },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to load issues by category');
  }

  return data.data;
}

export function getDashboardIssuesCategoryErrorMessage(error) {
  return getApiErrorMessage(error);
}

/**
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   period?: 'week'|'month'|'year',
 *   status?: import('../types/dashboard').DashboardAuditStatus,
 *   auditType?: number,
 *   search?: string,
 * }} [params]
 * @returns {Promise<import('../types/dashboard').DashboardRecentAuditsResult>}
 */
export async function fetchDashboardRecentAudits(params = {}) {
  const token = getAuthToken();
  const { data } = await apiClient.get('/api/dashboard/recent-audits', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to load recent audits');
  }

  return {
    items: data.data ?? [],
    pagination: data.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      total: 0,
      totalPages: 0,
    },
  };
}

export function getDashboardRecentAuditsErrorMessage(error) {
  return getApiErrorMessage(error);
}

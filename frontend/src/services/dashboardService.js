import api, { getApiErrorMessage } from './api';
import { getAuthToken } from '../utils/authUser';

/**
 * @param {'week'|'month'|'year'} [period='week']
 * @returns {Promise<import('../types/dashboard').DashboardWidgetsData>}
 */
export async function fetchDashboardWidgets(period = 'week') {
  const token = getAuthToken();
  const { data } = await api.get('/api/dashboard/widgets', {
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
 * @param {'daily'|'weekly'|'monthly'} [period='daily']
 * @returns {Promise<import('../types/dashboard').DashboardAuditTrendData>}
 */
export async function fetchDashboardAuditTrend(period = 'daily') {
  const token = getAuthToken();
  const { data } = await api.get('/api/dashboard/audit-trend', {
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
  const { data } = await api.get('/api/dashboard/issues-category', {
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

import api, { getApiErrorMessage } from './api';
import { getAuthToken } from '../utils/authUser';

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * @param {Record<string, string | number | undefined>} [params]
 */
export async function fetchProductAverageRates(params = {}) {
  const { data } = await api.get('/api/sales-audit/product-average-rates', {
    params,
    headers: authHeaders(),
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to load product average rates');
  }

  return {
    rows: data.data ?? [],
    pagination: data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 1 },
  };
}

/**
 * @param {Record<string, string | number | undefined>} [params]
 */
export async function exportProductAverageRates(params = {}) {
  const response = await api.get('/api/sales-audit/product-average-rates/export', {
    params,
    headers: authHeaders(),
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `product-average-rates-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getSalesAuditServiceErrorMessage(error) {
  return getApiErrorMessage(error);
}

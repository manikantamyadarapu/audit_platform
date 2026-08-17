import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';
import { getAuthToken } from '../utils/authUser';
import { exportInvalidRecordsXlsx } from './scrutinyExport';

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validateSalesExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  try {
    const { data } = await apiClient.post('/api/v1/process/sales/validate', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...authHeaders(),
      },
      signal,
    });
    return data;
  } catch (err) {
    const msg = getApiErrorMessage(err);
    const e = new Error(msg);
    const payload = getProcessingErrorPayload(err);
    if (payload) e.details = payload;
    throw e;
  }
}

/**
 * @param {Record<string, unknown>[]} records
 * @param {AbortSignal} [signal]
 */
export function exportInvalidSalesRows(records, signal) {
  return exportInvalidRecordsXlsx('/api/v1/process/sales/export-invalid', records, signal);
}

/**
 * @param {Record<string, string | number | undefined>} [params]
 */
export async function fetchProductAverageRates(params = {}) {
  const { data } = await apiClient.get('/api/sales-audit/product-average-rates', {
    params,
    headers: authHeaders(),
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to load product average rates');
  }

  return {
    rows: data.data ?? [],
    pagination: data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 1 },
    meta: data.meta ?? null,
  };
}

/**
 * @param {Record<string, string | number | undefined>} [params]
 */
export async function exportProductAverageRates(params = {}) {
  const response = await apiClient.get('/api/sales-audit/product-average-rates/export', {
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

export function getSalesServiceErrorMessage(error) {
  return getApiErrorMessage(error);
}

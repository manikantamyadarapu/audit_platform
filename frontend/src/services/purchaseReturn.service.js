import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';
import { getAuthToken } from '../utils/authUser';
import { exportInvalidRecordsXlsx } from './scrutinyExport';

/**
 * Purchase Return Audit — dedicated API (purchase baseline, not sales).
 * @param {File} returnFile
 * @param {AbortSignal} [signal]
 */
export async function validatePurchaseReturnAudit(returnFile, signal) {
  const form = new FormData();
  form.append('file', returnFile);
  try {
    const token = getAuthToken();
    const { data } = await apiClient.post('/api/purchase-return/run-audit', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
 * @param {AbortSignal} [signal]
 */
export async function fetchPurchaseReturnRateComparison(signal) {
  try {
    const { data } = await apiClient.get('/api/purchase-return/rate-comparison', { signal });
    return data;
  } catch (err) {
    const msg = getApiErrorMessage(err);
    throw new Error(msg, { cause: err });
  }
}

/**
 * @param {Record<string, unknown>[]} records
 * @param {AbortSignal} [signal]
 */
export function exportPurchaseReturnRateComparison(records, signal) {
  return exportInvalidRecordsXlsx(
    '/api/purchase-return/export-rate-comparison',
    records,
    signal
  );
}

/**
 * @param {{
 *   validationIssues?: Record<string, unknown>[],
 *   comparisonIssues?: Record<string, unknown>[],
 *   records?: Record<string, unknown>[],
 *   exportColumns?: string[],
 *   columnDisplayHeaders?: Record<string, string>,
 * }} payload
 * @param {AbortSignal} [signal]
 */
export async function exportPurchaseReturnConsolidated(
  { records, validationIssues, comparisonIssues, exportColumns, columnDisplayHeaders },
  signal
) {
  try {
    const res = await apiClient.post(
      '/api/purchase-return/export-exceptions',
      { records, validationIssues, comparisonIssues, exportColumns, columnDisplayHeaders },
      {
        responseType: 'blob',
        signal,
      }
    );
    const blob = res.data;
    const disposition = res.headers['content-disposition'];
    let filename = 'purchase-return-audit-report.xlsx';
    if (disposition && disposition.includes('filename=')) {
      const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(disposition);
      if (match?.[1]) filename = decodeURIComponent(match[1].replace(/["']/g, ''));
    }
    const ctype = res.headers['content-type'] || '';
    if (ctype.includes('application/json')) {
      const text = await blob.text();
      let j;
      try {
        j = JSON.parse(text);
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw new Error(text || 'Export failed', { cause: e });
        }
        throw e;
      }
      throw new Error(typeof j.detail === 'string' ? j.detail : 'Export failed');
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { blob, filename };
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

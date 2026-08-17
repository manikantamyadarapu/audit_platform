import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';
import { getAuthToken } from '../utils/authUser';

/**
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validateTds01Excel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  const token = getAuthToken();
  try {
    const { data } = await apiClient.post('/api/v1/process/tds-rate-0.1/validate', form, {
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
 * @param {{
 *   detailedRecords?: Record<string, unknown>[],
 *   summaryRecords?: Record<string, unknown>[],
 * }} payload
 * @param {AbortSignal} [signal]
 */
export async function exportTds01Report(
  { detailedRecords = [], summaryRecords = [] },
  signal
) {
  try {
    const res = await apiClient.post(
      '/api/v1/process/tds-rate-0.1/export',
      { detailedRecords, summaryRecords },
      {
        responseType: 'blob',
        signal,
      }
    );
    const blob = res.data;
    const disposition = res.headers['content-disposition'];
    let filename = 'TDS_0_1_Report.xlsx';
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

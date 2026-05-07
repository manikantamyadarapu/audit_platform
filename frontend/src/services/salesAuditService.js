import api, { getApiErrorMessage } from './api';

/**
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validateSalesAuditExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  try {
    const { data } = await api.post('/api/v1/process/sales-audit', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    });
    return data;
  } catch (err) {
    const message = getApiErrorMessage(err);
    throw new Error(message, { cause: err });
  }
}

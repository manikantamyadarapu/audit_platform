import api, { getApiErrorMessage } from './api';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';

/**
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validateGrossWeightExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  try {
    const { data } = await api.post('/api/v1/process/gross-weight/validate', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validateSalesExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  try {
    const { data } = await api.post('/api/v1/process/sales/validate', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
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

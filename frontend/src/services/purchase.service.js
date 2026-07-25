import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';
import { getAuthToken } from '../utils/authUser';

/**
 * Purchase rate & ledger audit — dedicated purchase validate endpoint.
 * Persists product averages under PURCHASE for Purchase Return baseline.
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validatePurchaseLedgerExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  const token = getAuthToken();
  try {
    const { data } = await apiClient.post('/api/v1/process/purchase/validate', form, {
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

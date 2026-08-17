import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';
import { getAuthToken } from '../utils/authUser';
import { exportInvalidRecordsXlsx } from './scrutinyExport';

/**
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validateCashLedgerExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  const token = getAuthToken();
  try {
    const { data } = await apiClient.post('/api/v1/process/cash-ledger/validate', form, {
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
 * @param {Record<string, unknown>[]} records
 * @param {AbortSignal} [signal]
 */
export function exportInvalidCashLedgerRows(records, signal) {
  return exportInvalidRecordsXlsx('/api/v1/process/cash-ledger/export-invalid', records, signal);
}

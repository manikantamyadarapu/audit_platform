import api, { getApiErrorMessage } from './api';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';
import { getAuthToken } from '../utils/authUser';
import { exportInvalidRecordsXlsx } from './scrutinyExport';

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
  const token = getAuthToken();
  try {
    const { data } = await api.post('/api/v1/process/sales/validate', form, {
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
export function exportInvalidGrossWeightRows(records, signal) {
  return exportInvalidRecordsXlsx('/api/v1/process/gross-weight/export-invalid', records, signal);
}

/**
 * @param {Record<string, unknown>[]} records
 * @param {AbortSignal} [signal]
 */
export function exportInvalidSalesRows(records, signal) {
  return exportInvalidRecordsXlsx('/api/v1/process/sales/export-invalid', records, signal);
}

/**
 * @param {File} returnFile
 * @param {AbortSignal} [signal]
 */
export async function validateSalesReturnAudit(returnFile, signal) {
  const form = new FormData();
  form.append('file', returnFile);
  try {
    const { data } = await api.post('/api/sales-return/run-audit', form, {
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
 * Rate comparison from the most recent run-audit (server-side cache).
 * @param {AbortSignal} [signal]
 */
export async function fetchSalesReturnRateComparison(signal) {
  try {
    const { data } = await api.get('/api/sales-return/rate-comparison', { signal });
    return data;
  } catch (err) {
    const msg = getApiErrorMessage(err);
    throw new Error(msg);
  }
}

/**
 * @param {Record<string, unknown>[]} records
 * @param {AbortSignal} [signal]
 */
export function exportSalesReturnRateComparison(records, signal) {
  return exportInvalidRecordsXlsx(
    '/api/sales-return/export-rate-comparison',
    records,
    signal
  );
}

/**
 * @param {Record<string, unknown>[]} records
 * @param {AbortSignal} [signal]
 */
export function exportSalesReturnExceptions(records, signal) {
  return exportInvalidRecordsXlsx(
    '/api/sales-return/export-exceptions',
    records,
    signal
  );
}

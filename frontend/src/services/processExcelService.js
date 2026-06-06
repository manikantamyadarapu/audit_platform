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
 * @param {File} salesFile
 * @param {File} returnFile
 * @param {AbortSignal} [signal]
 */
export async function validateSalesReturnAudit(salesFile, returnFile, signal) {
  const form = new FormData();
  form.append('salesFile', salesFile);
  form.append('salesReturnFile', returnFile);
  try {
    const { data } = await api.post('/api/v1/process/sales-return/validate', form, {
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
 * @param {Record<string, unknown>[]} records
 * @param {AbortSignal} [signal]
 */
export function exportSalesReturnRateComparison(records, signal) {
  return exportInvalidRecordsXlsx(
    '/api/v1/process/sales-return/export-rate-comparison',
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
    '/api/v1/process/sales-return/export-exceptions',
    records,
    signal
  );
}

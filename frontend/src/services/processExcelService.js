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
    const token = getAuthToken();
    const { data } = await api.post('/api/v1/process/gross-weight/validate', form, {
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
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validateCashLedgerExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  const token = getAuthToken();
  try {
    const { data } = await api.post('/api/v1/process/cash-ledger/validate', form, {
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
    const token = getAuthToken();
    const { data } = await api.post('/api/sales-return/run-audit', form, {
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
 * Rate comparison from the most recent run-audit (server-side cache).
 * @param {AbortSignal} [signal]
 */
export async function fetchSalesReturnRateComparison(signal) {
  try {
    const { data } = await api.get('/api/sales-return/rate-comparison', { signal });
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
export function exportSalesReturnRateComparison(records, signal) {
  return exportInvalidRecordsXlsx(
    '/api/sales-return/export-rate-comparison',
    records,
    signal
  );
}

/**
 * Export one consolidated Sales Return audit workbook (validation + rate comparison).
 * @param {{
 *   validationIssues?: Record<string, unknown>[],
 *   comparisonIssues?: Record<string, unknown>[],
 *   records?: Record<string, unknown>[],
 * }} payload
 * @param {AbortSignal} [signal]
 */
export async function exportSalesReturnConsolidated(
  { records, validationIssues, comparisonIssues, exportColumns, columnDisplayHeaders },
  signal
) {
  try {
    const res = await api.post(
      '/api/sales-return/export-exceptions',
      { records, validationIssues, comparisonIssues, exportColumns, columnDisplayHeaders },
      {
      responseType: 'blob',
      signal,
    });
    const blob = res.data;
    const disposition = res.headers['content-disposition'];
    let filename = 'sales-return-audit-report.xlsx';
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

/** @deprecated Use exportSalesReturnConsolidated */
export function exportSalesReturnExceptions(records, signal) {
  return exportSalesReturnConsolidated({ records }, signal);
}

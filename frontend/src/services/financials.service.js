import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';

/**
 * Closing Stock audit — Sales & Purchases product pivots.
 * @param {File} salesFile
 * @param {File} purchasesFile
 * @param {AbortSignal} [signal]
 */
export async function processFinancialsPivot(salesFile, purchasesFile, signal) {
  const form = new FormData();
  form.append('salesFile', salesFile);
  form.append('purchasesFile', purchasesFile);
  try {
    const { data } = await apiClient.post('/api/v1/process/financials/validate', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    });
    return data;
  } catch (err) {
    const error = new Error(getApiErrorMessage(err));
    const payload = getProcessingErrorPayload(err);
    if (payload) error.details = payload;
    throw error;
  }
}

async function downloadBlobResponse(res, fallbackName) {
  const blob = res.data;
  const disposition = res.headers['content-disposition'];
  let filename = fallbackName;
  if (disposition && disposition.includes('filename=')) {
    const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(disposition);
    if (match?.[1]) filename = decodeURIComponent(match[1].replace(/["']/g, ''));
  }
  const ctype = res.headers['content-type'] || '';
  if (ctype.includes('application/json')) {
    const text = await blob.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(text || 'Export failed');
    }
    throw new Error(typeof json.detail === 'string' ? json.detail : 'Export failed');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { blob, filename };
}

/**
 * Download Sales + Purchases pivots as one workbook (two sheets).
 * @param {{ salesPivot?: object[], purchasesPivot?: object[] }} payload
 * @param {AbortSignal} [signal]
 */
export async function downloadFinancialsPivots(payload, signal) {
  try {
    const res = await apiClient.post('/api/v1/process/financials/export-pivots', payload, {
      responseType: 'blob',
      signal,
    });
    return downloadBlobResponse(res, 'Financials-Sales-Purchases-Pivots.xlsx');
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

/**
 * Download blank Closing Stock working-paper template (five category sheets).
 * Products are mapped to sheets on the server via the Closing Stock Rule Book.
 * Prefer sending sales/purchases pivots so qty/gross can be routed by category.
 * @param {{
 *   products?: string[],
 *   salesPivot?: object[],
 *   purchasesPivot?: object[],
 *   companyName?: string,
 *   address?: string,
 *   financialYear?: string,
 * }} payload
 * @param {AbortSignal} [signal]
 */
export async function downloadClosingStockTemplate(payload, signal) {
  try {
    const res = await apiClient.post(
      '/api/v1/process/financials/export-closing-stock',
      payload,
      {
        responseType: 'blob',
        signal,
      }
    );
    return downloadBlobResponse(res, 'Closing-Stock-Jewels.xlsx');
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

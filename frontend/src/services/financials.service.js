import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';

/**
 * Closing Stock audit — Sales, Purchases, Opening, Previous Year, optional MR + DC.
 * @param {File} salesFile
 * @param {File} purchasesFile
 * @param {File} openingQtyFile
 * @param {File} previousYearFile
 * @param {File} [mrFile]
 * @param {File} [dcFile]
 * @param {AbortSignal} [signal]
 */
export async function processFinancialsPivot(
  salesFile,
  purchasesFile,
  openingQtyFile,
  previousYearFile,
  mrFile,
  dcFile,
  signal
) {
  // Backward-compatible: older callers may pass signal as 5th arg.
  if (mrFile && typeof mrFile === 'object' && !(mrFile instanceof File) && mrFile.aborted != null) {
    signal = mrFile;
    mrFile = undefined;
    dcFile = undefined;
  }

  const form = new FormData();
  form.append('salesFile', salesFile);
  form.append('purchasesFile', purchasesFile);
  form.append('openingQtyFile', openingQtyFile);
  form.append('previousYearFile', previousYearFile);
  if (mrFile) form.append('mrFile', mrFile);
  if (dcFile) form.append('dcFile', dcFile);
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
 * Download Closing Stock working-paper template (five category sheets).
 * @param {{
 *   products?: string[],
 *   salesPivot?: object[],
 *   purchasesPivot?: object[],
 *   openingPivot?: object[],
 *   receiptsPivot?: object[],
 *   issuesPivot?: object[],
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

/** Live Rule Book JSON + fingerprint from Python service (single source of truth). */
export async function fetchClosingStockRuleBook(signal) {
  try {
    const { data } = await apiClient.get('/api/v1/process/financials/closing-stock-rule-book', {
      signal,
    });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

/** Rebuild Closing Stock mapping from current Rule Book + stored pivots. */
export async function remapClosingStockFromPivots(payload, signal) {
  try {
    const { data } = await apiClient.post('/api/v1/process/financials/remap-closing-stock', payload, {
      signal,
    });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

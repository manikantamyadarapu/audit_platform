import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';
import { readSourceAverageRates } from '../utils/sourceAverageRates';
import { readReceiptRateMappings } from '../utils/receiptRateMappings';
import {
  buildHoldUploadParts,
  normalizeFinancialsHoldBranch,
} from '../utils/financialsHoldUpload';

export { buildHoldUploadParts } from '../utils/financialsHoldUpload';

function financialsBranch(destinationBranch) {
  return normalizeFinancialsHoldBranch(destinationBranch);
}

function throwProcessingError(err) {
  const error = new Error(getApiErrorMessage(err));
  const payload = getProcessingErrorPayload(err);
  if (payload) error.details = payload;
  throw error;
}

/**
 * Persist classified branch workbooks for the authenticated user.
 * @param {'basheerbagh'|'kokapet'|'jubilee-hills'} branch
 * @param {Record<string, File|null|undefined>} slotFiles
 * @param {AbortSignal} [signal]
 */
export async function holdFinancialsBranchFiles(branch, slotFiles, signal) {
  const form = new FormData();
  const parts = buildHoldUploadParts(branch, slotFiles);
  if (!parts.length) {
    throw new Error('No Financials workbooks were selected to hold');
  }
  for (const { field, file } of parts) {
    form.append(field, file);
  }
  try {
    const { data } = await apiClient.post(
      `/api/v1/process/financials/hold/${financialsBranch(branch)}`,
      form,
      {
        // Let the browser set multipart boundary; do not force Content-Type.
        signal,
      }
    );
    return data;
  } catch (err) {
    throwProcessingError(err);
  }
}

/**
 * @param {'basheerbagh'|'kokapet'|'jubilee-hills'} branch
 * @param {AbortSignal} [signal]
 */
export async function listHeldFinancialsBranchFiles(branch, signal) {
  try {
    const { data } = await apiClient.get(
      `/api/v1/process/financials/hold/${financialsBranch(branch)}`,
      { signal }
    );
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

/**
 * @param {'basheerbagh'|'kokapet'|'jubilee-hills'} branch
 * @param {AbortSignal} [signal]
 */
export async function clearHeldFinancialsBranchFiles(branch, signal) {
  try {
    const { data } = await apiClient.delete(
      `/api/v1/process/financials/hold/${financialsBranch(branch)}`,
      { signal }
    );
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

/**
 * Closing Stock audit — Sales, Purchases, Opening Quantity, Previous Year Closing, MR, DC.
 * @param {File} salesFile
 * @param {File} purchasesFile
 * @param {File} openingQtyFile
 * @param {File} previousYearFile
 * @param {File} mrFile
 * @param {File} dcFile
 * @param {AbortSignal} [signal]
 */
export async function processFinancialsPivot(
  salesFile,
  purchasesFile,
  openingQtyFile,
  previousYearFile,
  mrFile,
  dcFile,
  signal,
  destinationBranch = 'basheerbagh'
) {
  const form = new FormData();
  form.append('salesFile', salesFile);
  form.append('purchasesFile', purchasesFile);
  form.append('openingQtyFile', openingQtyFile);
  form.append('previousYearFile', previousYearFile);
  form.append('mrFile', mrFile);
  form.append('dcFile', dcFile);
  form.append('sourceAverageRates', JSON.stringify(readSourceAverageRates()));
  const branch = financialsBranch(destinationBranch);
  form.append('receiptRateMappings', JSON.stringify(readReceiptRateMappings(branch)));
  try {
    const { data } = await apiClient.post(`/api/v1/process/financials/validate/${branch}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    });
    return data;
  } catch (err) {
    throwProcessingError(err);
  }
}

/**
 * Re-process a previously held six-file branch without re-uploading.
 * @param {'basheerbagh'|'kokapet'} destinationBranch
 * @param {AbortSignal} [signal]
 */
export async function processFinancialsPivotFromHeld(destinationBranch = 'basheerbagh', signal) {
  const branch = financialsBranch(destinationBranch);
  const form = new FormData();
  form.append('sourceAverageRates', JSON.stringify(readSourceAverageRates()));
  form.append('receiptRateMappings', JSON.stringify(readReceiptRateMappings(branch)));
  try {
    const { data } = await apiClient.post(`/api/v1/process/financials/validate/${branch}`, form, {
      signal,
    });
    return data;
  } catch (err) {
    throwProcessingError(err);
  }
}

/**
 * Jubilee Hills Financials — ten workbooks on a dedicated API.
 * The download still uses the shared Closing Stock workbook.
 */
export async function processJubileeHillsFinancials(files, options = {}) {
  const { signal, savedOpeningMappings } = options;
  const form = new FormData();
  form.append('salesFile', files.sales);
  form.append('purchasesFile', files.purchases);
  form.append('openingQtyFile', files.quantity);
  form.append('previousYearFile', files.previousYear);
  form.append('salesReturnFile', files.salesReturn);
  form.append('purchaseReturnFile', files.purchaseReturn);
  form.append('creditNoteFile', files.creditNote);
  form.append('debitNoteFile', files.debitNote);
  if (files.mr) form.append('mrFile', files.mr);
  if (files.dc) form.append('dcFile', files.dc);
  form.append('savedOpeningMappings', JSON.stringify(savedOpeningMappings || []));
  form.append('sourceAverageRates', JSON.stringify(readSourceAverageRates()));
  form.append('receiptRateMappings', JSON.stringify(readReceiptRateMappings('jubileeHills')));
  try {
    const { data } = await apiClient.post('/api/v1/process/financials/validate/jubilee-hills', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    });
    return data;
  } catch (err) {
    throwProcessingError(err);
  }
}

/**
 * Re-process previously held Jubilee Hills workbooks without re-uploading.
 * @param {{ signal?: AbortSignal, savedOpeningMappings?: object[] }} [options]
 */
export async function processJubileeHillsFinancialsFromHeld(options = {}) {
  const { signal, savedOpeningMappings } = options;
  const form = new FormData();
  form.append('savedOpeningMappings', JSON.stringify(savedOpeningMappings || []));
  form.append('sourceAverageRates', JSON.stringify(readSourceAverageRates()));
  form.append('receiptRateMappings', JSON.stringify(readReceiptRateMappings('jubileeHills')));
  try {
    const { data } = await apiClient.post('/api/v1/process/financials/validate/jubilee-hills', form, {
      signal,
    });
    return data;
  } catch (err) {
    throwProcessingError(err);
  }
}

/**
 * Sales and Purchases product pivots, plus Opening Stock when both opening files are sent.
 * @param {File} salesFile
 * @param {File} purchasesFile
 * @param {{ openingQtyFile?: File, previousYearFile?: File, signal?: AbortSignal }} [options]
 */
export async function processSalesPurchasesPivots(salesFile, purchasesFile, options = {}) {
  const { openingQtyFile, previousYearFile, signal } = options;
  const form = new FormData();
  form.append('salesFile', salesFile);
  form.append('purchasesFile', purchasesFile);
  if (openingQtyFile) form.append('openingQtyFile', openingQtyFile);
  if (previousYearFile) form.append('previousYearFile', previousYearFile);
  try {
    const { data } = await apiClient.post(
      '/api/v1/process/financials/validate-sales-purchases-pivots',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
      }
    );
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

function financialsDownloadBranch(destinationBranch) {
  return destinationBranch === 'kokapet' ? 'kokapet' : 'basheerbagh';
}

/**
 * Download Sales + Purchases pivots as one workbook (two sheets).
 * @param {{ salesPivot?: object[], purchasesPivot?: object[], destinationBranch?: string }} payload
 * @param {AbortSignal} [signal]
 */
export async function downloadFinancialsPivots(payload, signal) {
  const branch = financialsDownloadBranch(payload?.destinationBranch);
  try {
    const res = await apiClient.post(
      `/api/v1/process/financials/export-pivots/${branch}`,
      payload,
      {
        responseType: 'blob',
        signal,
      }
    );
    return downloadBlobResponse(res, 'Financials-Sales-Purchases-Pivots.xlsx');
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

/**
 * Download the Jubilee Hills workbook. A placed layout fills the sheets; otherwise the workbook stays blank.
 */
export async function downloadJubileeHillsTemplate(payload, signal) {
  try {
    const res = await apiClient.post('/api/v1/process/financials/jubilee-hills/template', payload, {
      responseType: 'blob',
      signal,
    });
    return downloadBlobResponse(res, 'Jubilee-Hills-Financials.xlsx');
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
 *   companyName?: string,
 *   address?: string,
 *   financialYear?: string,
 * }} payload
 * @param {AbortSignal} [signal]
 */
export async function downloadClosingStockTemplate(payload, signal) {
  const branch = financialsDownloadBranch(payload?.destinationBranch);
  try {
    const res = await apiClient.post(
      `/api/v1/process/financials/export-closing-stock/${branch}`,
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

/** Rebuild Jubilee Hills sheets after an opening amount is mapped by hand. */
export async function placeJubileeHillsFromPivots(payload, signal) {
  try {
    const { data } = await apiClient.post('/api/v1/process/financials/jubilee-hills/place', payload, {
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

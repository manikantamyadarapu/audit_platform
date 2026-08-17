import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';
import { getAuthToken } from '../utils/authUser';

/**
 * Party Wise TDS Summary — requires both ledger files.
 * @param {File} purchaseGoodsFile
 * @param {File} tdsPayableFile
 * @param {AbortSignal} [signal]
 */
export async function validatePartyWiseTdsSummary(purchaseGoodsFile, tdsPayableFile, signal) {
  const form = new FormData();
  form.append('purchaseGoodsFile', purchaseGoodsFile);
  form.append('tdsPayableFile', tdsPayableFile);
  const token = getAuthToken();
  try {
    const { data } = await apiClient.post('/api/v1/process/party-wise-tds/validate', form, {
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
 * Export Party_Wise_TDS_Summary.xlsx (two worksheets).
 * @param {{
 *   purchaseSummary?: Record<string, unknown>[],
 *   payableSummary?: Record<string, unknown>[],
 * }} payload
 * @param {AbortSignal} [signal]
 */
export async function exportPartyWiseTdsSummary(
  { purchaseSummary = [], payableSummary = [] },
  signal
) {
  try {
    const res = await apiClient.post(
      '/api/v1/process/party-wise-tds/export',
      { purchaseSummary, payableSummary },
      {
        responseType: 'blob',
        signal,
      }
    );
    const blob = res.data;
    const disposition = res.headers['content-disposition'];
    let filename = 'Party_Wise_TDS_Summary.xlsx';
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

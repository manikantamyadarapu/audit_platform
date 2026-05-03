import api, { getApiErrorMessage } from './api';

/**
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validateGrossWeightExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  try {
    const { data } = await api.post('/api/v1/process/gross-weight', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    });
    return data;
  } catch (err) {
    const message = getApiErrorMessage(err);
    throw new Error(message, { cause: err });
  }
}

/**
 * @param {Record<string, unknown>[]} records Invalid rows only (`status === 'invalid'`).
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function exportInvalidGrossWeightRows(records, signal) {
  try {
    const res = await api.post('/api/v1/process/gross-weight/export-invalid', { records }, {
      responseType: 'blob',
      signal,
    });
    const blob = res.data;
    const disposition = res.headers['content-disposition'];
    let filename = 'gross-weight-invalid-rows.xlsx';
    if (disposition && disposition.includes('filename=')) {
      const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(disposition);
      if (match?.[1]) filename = decodeURIComponent(match[1].replace(/["']/g, ''));
    }
    const ctype = res.headers['content-type'] || '';
    if (ctype.includes('application/json')) {
      const text = await blob.text();
      try {
        const j = JSON.parse(text);
        throw new Error(typeof j.detail === 'string' ? j.detail : 'Export failed');
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
        throw new Error(text || 'Export failed', { cause: e });
      }
    }
    return { blob, filename };
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      const text = await err.response.data.text();
      try {
        const j = JSON.parse(text);
        throw new Error(typeof j.detail === 'string' ? j.detail : getApiErrorMessage(err), {
          cause: err,
        });
      } catch (e) {
        if (e instanceof Error && e.message !== getApiErrorMessage(err)) throw e;
      }
      throw new Error(text || getApiErrorMessage(err), { cause: err });
    }
    throw err instanceof Error ? err : new Error(getApiErrorMessage(err), { cause: err });
  }
}

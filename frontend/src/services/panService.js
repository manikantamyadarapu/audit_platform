import api, { getApiErrorMessage } from './api';

/**
 * @param {File} file
 * @param {AbortSignal} [signal]
 */
export async function validatePanExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  try {
    const { data } = await api.post('/api/v1/process/pan/validate', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

/**
 * @param {Record<string, unknown>[]} records
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function exportInvalidPanRows(records, signal) {
  try {
    const res = await api.post('/api/v1/process/pan/export-invalid', { records }, {
      responseType: 'blob',
      signal,
    });
    const blob = res.data;
    const disposition = res.headers['content-disposition'];
    let filename = 'pan-invalid-rows.xlsx';
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
    return { blob, filename };
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      const text = await err.response.data.text();
      let j;
      try {
        j = JSON.parse(text);
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw new Error(text || getApiErrorMessage(err), { cause: e });
        }
        throw e;
      }
      throw new Error(typeof j.detail === 'string' ? j.detail : getApiErrorMessage(err), { cause: err });
    }
    throw err instanceof Error ? err : new Error(getApiErrorMessage(err), { cause: err });
  }
}

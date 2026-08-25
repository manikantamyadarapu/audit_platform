import apiClient, { getApiErrorMessage } from './apiClient';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';
import { getAuthToken } from '../utils/authUser';

const API_PATH = '/api/v1/process/form-269';

/**
 * Process ledger Excel files from a selected folder.
 *
 * @param {File[]} inputFiles
 * @param {AbortSignal} [signal]
 */
export async function processForm269(inputFiles, signal) {
  const form = new FormData();
  inputFiles.forEach((file) => {
    form.append('inputFiles', file, file.name);
  });

  const token = getAuthToken();
  try {
    const { data } = await apiClient.post(API_PATH, form, {
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

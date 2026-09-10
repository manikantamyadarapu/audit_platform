import apiClient, { getApiErrorMessage } from './apiClient';
import { getAuthToken } from '../utils/authUser';
import { getProcessingErrorPayload } from '../utils/processingErrorUtils';

const API_BASE = '/api/v1/process/section44ab';

/**
 * Validate Section 44AB Cash & Bank files
 * @param {File[]} cashFiles - Array of Cash ledger files
 * @param {File[]} bankFiles - Array of Bank ledger files
 * @returns {Promise<Object>} Section 44AB report results
 */
export async function validateSection44AB(cashFiles = [], bankFiles = []) {
  const formData = new FormData();

  (cashFiles || []).forEach((file) => {
    formData.append('cashFiles', file);
  });

  (bankFiles || []).forEach((file) => {
    formData.append('bankFiles', file);
  });

  const token = getAuthToken();
  try {
    const { data } = await apiClient.post(`${API_BASE}/validate`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

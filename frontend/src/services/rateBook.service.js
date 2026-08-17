import apiClient, { getApiErrorMessage } from './apiClient';

/**
 * @param {AbortSignal} [signal]
 */
export async function fetchDiamondRates(signal) {
  try {
    const { data } = await apiClient.get('/api/v1/rate-book/diamonds', { signal });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {AbortSignal} [signal]
 */
export async function saveDiamondRates(payload, signal) {
  try {
    const { data } = await apiClient.post('/api/v1/rate-book/diamonds', payload, { signal });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}
